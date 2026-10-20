#!/usr/bin/env python3
"""Integration tests against the real Fleetbase HTTP kernel and MySQL."""
import csv, io, json, unittest, urllib.request, urllib.error, uuid
from pathlib import Path
TOKENS=json.loads((Path(__file__).resolve().parents[1]/'.runtime/test-auth.json').read_text())
BASE='http://127.0.0.1:8000/sig-uhe/v1/'
def call(method,path,data=None,actor='alpha',ctype='application/json'):
    headers={'Accept':'application/json','Content-Type':ctype}
    if actor: headers['Authorization']='Bearer '+TOKENS[actor]
    body=data.encode() if isinstance(data,str) else (json.dumps(data).encode() if data is not None else None)
    url=('http://127.0.0.1:8000'+path) if path.startswith('/') else BASE+path
    req=urllib.request.Request(url,data=body,headers=headers,method=method)
    try:
        with urllib.request.urlopen(req,timeout=90) as res: return res.status,json.loads(res.read())
    except urllib.error.HTTPError as e:
        text=e.read().decode()
        try: body=json.loads(text)
        except ValueError: body=text[:500]
        return e.code,body
class Workflow(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.run_id=uuid.uuid4().hex[:10]
        status,cls.plant=call('POST','plants',{'code':'CN1-'+cls.run_id,'name':'Canoas I — fictícia','state':'PR'})
        if status!=201: raise RuntimeError(('plant creation',status,cls.plant))
        status,cls.reservoir=call('POST','reservoirs',{'plant_id':cls.plant['id'],'name':'Reservatório sintético'})
        if status!=201: raise RuntimeError(('reservoir creation',status,cls.reservoir))
    def request(self,**extra):
        return {'reservoir_id':self.reservoir['id'],'protocol':uuid.uuid4().hex,'description':'Vistoria sintética de rampa',
                'category':'rampa','priority':'normal','latitude':-23.0,'longitude':-50.0,'service_seconds':900,**extra}
    def test_01_unauthenticated(self): self.assertEqual(call('GET','plants',actor=None)[0],401)
    def test_02_tenant_isolation(self):
        self.assertNotIn(self.plant['id'],[v['id'] for v in call('GET','plants',actor='beta')[1]['data']])
        self.assertEqual(call('POST','reservoirs',{'plant_id':self.plant['id'],'name':'Intrusão'},actor='beta')[0],404)
        self.assertEqual(call('POST','requests',self.request(),actor='beta')[0],404)
    def test_03_reader_cannot_write(self):
        self.assertEqual(call('GET','plants',actor='reader')[0],200)
        self.assertEqual(call('POST','requests',self.request(),actor='reader')[0],403)
    def test_04_coordinates(self):
        for patch in [{'latitude':91},{'longitude':181},{'access_latitude':-23}]:
            self.assertEqual(call('POST','requests',self.request(**patch))[0],422)
    def test_05_no_road_access(self):
        status,obj=call('POST','requests',self.request());self.assertEqual(status,201,obj)
        status,obj=call('POST','requests/'+obj['id']+'/orders',{'idempotency_key':uuid.uuid4().hex,'base_latitude':-23,'base_longitude':-50})
        self.assertEqual(status,422,obj)
    def test_06_import_and_issue_100(self):
        rows=[self.request(protocol=self.run_id+'-'+str(i),access_latitude=-23.01,access_longitude=-50.01) for i in range(100)]
        buf=io.StringIO();w=csv.DictWriter(buf,fieldnames=list(rows[0]));w.writeheader();w.writerows(rows)
        status,obj=call('POST','requests/import',buf.getvalue(),ctype='text/csv');self.assertEqual(status,201,obj);self.assertEqual(obj['count'],100)
        items=[{'request_id':v['id'],'idempotency_key':self.run_id+'-'+str(i),'base_latitude':-23.02,'base_longitude':-50.02} for i,v in enumerate(obj['data'])]
        status,result=call('POST','requests/orders/batch',{'items':items});self.assertEqual(status,201,result);self.assertEqual(result['count'],100)
        self.assertEqual(len({v['order_uuid'] for v in result['data']}),100)
        first=items[0];url='requests/'+first['request_id']+'/orders'
        before=call('GET',url)[1];self.assertEqual(len(before),1)
        number=before[0]['order_number']
        native_status,native=call('GET','/v1/orders/'+number)
        self.assertEqual(native_status,200,native)
        self.assertEqual(native.get('data',native)['id'],number)
        self.assertEqual(call('POST',url,first)[0],201)
        self.assertEqual(len(call('GET',url)[1]),1)
        self.assertEqual(call('POST',url,{**first,'base_latitude':-24})[0],409)
        self.assertEqual(call('GET',url,actor='beta')[0],404)
    def test_07_duplicate_protocol_and_atomic_import(self):
        row=self.request();self.assertEqual(call('POST','requests',row)[0],201)
        self.assertEqual(call('POST','requests',row)[0],422)
        row=self.request();bad=self.request(latitude=99)
        buf=io.StringIO();w=csv.DictWriter(buf,fieldnames=list(row));w.writeheader();w.writerows([row,bad])
        self.assertEqual(call('POST','requests/import',buf.getvalue(),ctype='text/csv')[0],422)
        # Valid row can still be created, proving rollback of the earlier row.
        self.assertEqual(call('POST','requests',row)[0],201)
    def test_08_native_teams(self):
        status,obj=call('GET','teams');self.assertEqual(status,200,obj);self.assertGreaterEqual(obj['total'],3)
        status,team=call('POST','teams',{'name':'Equipe teste '+self.run_id});self.assertEqual(status,201,team)
        self.assertTrue(team['public_id'])
        self.assertNotIn(team['uuid'],[v['uuid'] for v in call('GET','teams',actor='beta')[1]['data']])
    def test_09_request_lifecycle(self):
        status,obj=call('POST','requests',self.request());self.assertEqual(status,201,obj)
        url='requests/'+obj['id']
        self.assertEqual(call('PATCH',url,{'status':'completed','reason':'Teste inválido'})[0],409)
        self.assertEqual(call('PATCH',url,{'status':'triage','reason':'Triagem sintética'})[0],200)
        self.assertEqual(call('PATCH',url,{'status':'cancelled','reason':'Cancelamento sintético'})[0],200)
        self.assertEqual(call('PATCH',url,{'status':'open','reason':'Reabertura sem autorização'})[0],409)
    def test_10_audit(self):
        status,obj=call('GET','audit');self.assertEqual(status,200,obj)
        self.assertGreater(obj['total'],100)
        self.assertTrue(all(v['company_uuid']==TOKENS['company_uuid'] for v in obj['data']))
    def test_11_overview_permissions_and_tenant_counts(self):
        status,overview=call('GET','overview');self.assertEqual(status,200,overview)
        self.assertTrue(overview['can_write']);self.assertEqual(overview['orders'],100)
        self.assertFalse(call('GET','overview',actor='reader')[1]['can_write'])
        self.assertEqual(call('GET','overview',actor='beta')[1]['plants'],0)
    def test_12_request_search_and_status_filter(self):
        protocol='FILTRO-'+self.run_id
        status,item=call('POST','requests',self.request(protocol=protocol));self.assertEqual(status,201,item)
        status,result=call('GET','requests?q='+protocol);self.assertEqual(status,200,result)
        self.assertEqual(result['total'],1);self.assertEqual(result['data'][0]['id'],item['id'])
        self.assertEqual(call('GET','requests?q='+protocol,actor='beta')[1]['total'],0)
        self.assertEqual(call('GET','requests?q='+protocol+'&status=cancelled')[1]['total'],0)
        self.assertEqual(call('GET','requests?status=invalid')[0],422)

    def test_13_team_operational_profile(self):
        status,team=call('POST','teams',{'name':'Perfil operacional '+self.run_id});self.assertEqual(status,201,team)
        url='teams/'+team['uuid']+'/profile'
        self.assertIsNone(call('GET',url)[1]['profile'])
        data=dict(version=0,reason='Definição da jornada de inspeção',availability='available',timezone='America/Sao_Paulo',
                  base_latitude=-23,base_longitude=-50,skills=['environmental','drone'],daily_capacity_minutes=420,
                  weekly_windows=[dict(day=1,start='08:00',end='12:00'),dict(day=1,start='13:00',end='17:00')])
        self.assertEqual(call('PATCH',url,data,actor='reader')[0],403)
        self.assertEqual(call('GET',url,actor='beta')[0],404)
        self.assertEqual(call('PATCH',url,data,actor='beta')[0],404)
        for changes in [dict(timezone='Invalid/Zone'),dict(skills=['unknown']),dict(skills=['drone','drone']),
                        dict(base_latitude=91),dict(daily_capacity_minutes=481),dict(weekly_windows=[]),
                        dict(weekly_windows=[dict(day=1,start='17:00',end='08:00')]),
                        dict(weekly_windows=[dict(day=1,start='08:00',end='16:00'),dict(day=1,start='15:00',end='18:00')])]:
            self.assertEqual(call('PATCH',url,{**data,**changes})[0],422,changes)
        status,profile=call('PATCH',url,data);self.assertEqual(status,200,profile)
        self.assertEqual(profile['version'],1);self.assertEqual(profile['skills'],data['skills'])
        self.assertEqual(call('GET',url,actor='reader')[1]['profile']['weekly_windows'],data['weekly_windows'])
        self.assertEqual(call('PATCH',url,data)[0],409)  # stale editor cannot overwrite
        self.assertEqual(call('GET',url)[1]['profile']['version'],1)
        status,updated=call('PATCH',url,{**data,'version':1,'availability':'unavailable','reason':'Equipe em manutenção'})
        self.assertEqual(status,200,updated);self.assertEqual(updated['availability'],'unavailable')
        listed=next(x for x in call('GET','teams')[1]['data'] if x['uuid']==team['uuid'])
        self.assertEqual(listed['operational_profile']['version'],2)
        events=[x for x in call('GET','audit')[1]['data'] if x['action']=='team.profile_updated' and x['subject_id']==team['uuid']]
        self.assertEqual(len(events),2)
        details=[json.loads(x['details']) for x in events]
        self.assertTrue(any(x['before'] and x['before']['availability']=='available' and x['after']['availability']=='unavailable' for x in details))

if __name__=='__main__': unittest.main(verbosity=2)
