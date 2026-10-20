#!/usr/bin/env python3
"""Real Chromium/Fleetbase E2E. Seed test identities first; no production data."""
from pathlib import Path
import csv,io,json,os,uuid,urllib.request
from playwright.sync_api import sync_playwright, expect
ROOT=Path(__file__).resolve().parents[1]
AUTH=json.loads((ROOT/'.runtime/test-auth.json').read_text())
ORIGIN='http://localhost:4200'
RUN=uuid.uuid4().hex[:8]

def api(method,path,data=None,ctype='application/json',actor='alpha'):
    body=data.encode() if isinstance(data,str) else json.dumps(data).encode() if data is not None else None
    req=urllib.request.Request(ORIGIN+'/sig-uhe/v1/'+path,data=body,method=method,
        headers={'Authorization':'Bearer '+AUTH[actor],'Accept':'application/json','Content-Type':ctype})
    with urllib.request.urlopen(req,timeout=90) as res: return json.loads(res.read())

def sign_in(page,reader=False):
    page.goto(ORIGIN+'/auth?shift=sig-uhe',wait_until='domcontentloaded',timeout=90000)
    page.locator('input[name=email]').fill(AUTH['reader_email' if reader else 'login_email'],timeout=90000)
    page.locator('input[name=password]').fill(AUTH['reader_password' if reader else 'login_password'])
    # Submit the actual native login form; tokens are never injected into browser storage.
    page.locator('input[name=password]').press('Enter')
    page.wait_for_url('**/sig-uhe',timeout=60000)
    expect(page.locator('.sig-workspace h1')).to_have_text('SIG-UHE',timeout=60000)
    expect(page.locator('.sig-loading')).to_have_count(0,timeout=30000)

def tab(page,text):
    page.get_by_role('navigation',name='Navegação SIG-UHE').get_by_role('button',name=text,exact=True).click()
    expect(page.locator('.sig-loading')).to_have_count(0,timeout=30000)

def save(page):
    page.get_by_role('button',name='Salvar registro',exact=True).click()
    expect(page.locator('.sig-form-card')).to_have_count(0,timeout=30000)
    expect(page.locator('.sig-loading')).to_have_count(0,timeout=30000)

def search(page,text):
    page.get_by_label('Pesquisar',exact=True).fill(text)
    page.get_by_role('button',name='Filtrar',exact=True).click()
    expect(page.locator('.sig-loading')).to_have_count(0,timeout=30000)

def request_form(page,protocol,access):
    page.get_by_role('button',name='Nova solicitação',exact=True).click()
    page.get_by_label('Reservatório',exact=True).select_option(label='Canoas I — demonstração · Reservatório Canoas I')
    page.get_by_label('Protocolo',exact=True).fill(protocol)
    page.get_by_label('Categoria',exact=True).fill('Rampa de acesso')
    page.get_by_label('Descrição da inspeção',exact=True).fill('Inspeção sintética de rampa na margem do reservatório.')
    page.get_by_label('Latitude da ocorrência',exact=True).fill('-23')
    page.get_by_label('Longitude da ocorrência',exact=True).fill('-50')
    if access:
        page.get_by_label('Latitude do acesso terrestre',exact=True).fill('-23.01')
        page.get_by_label('Longitude do acesso terrestre',exact=True).fill('-50.01')
    save(page)

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),args=['--no-sandbox'])
    context=browser.new_context(viewport={'width':1440,'height':1080},locale='pt-BR',color_scheme='dark')
    page=context.new_page()
    errors=[]
    page.on('pageerror',lambda error:errors.append(str(error)))
    try:
        sign_in(page)
        print('PASS: native Fleetbase login and SIG-UHE engine mounted',flush=True)
        tab(page,'UHEs e reservatórios')
        page.get_by_role('button',name='Cadastrar UHE',exact=True).click()
        page.get_by_label('Código da UHE',exact=True).fill('CN1-'+RUN)
        page.get_by_label('Nome da UHE',exact=True).fill('Canoas I — demonstração')
        save(page)
        page.get_by_role('button',name='Cadastrar reservatório',exact=True).click()
        page.get_by_label('UHE',exact=True).select_option(label='Canoas I — demonstração')
        page.get_by_label('Nome do reservatório',exact=True).fill('Reservatório Canoas I')
        save(page)
        expect(page.locator('.sig-table').last).to_contain_text('Reservatório Canoas I')
        reservoir=api('GET','reservoirs')['data'][0]
        print('PASS: UHE/reservoir created through forms and persisted in API',flush=True)
        tab(page,'Solicitações')
        no_access='SEM-ACESSO-'+RUN
        request_form(page,no_access,False)
        search(page,no_access)
        page.get_by_role('button',name='Detalhes',exact=True).click()
        expect(page.get_by_role('button',name='Emitir OS',exact=True)).to_be_disabled()
        expect(page.locator('.sig-detail')).to_contain_text('Não informado')
        page.get_by_role('button',name='Atualizar situação',exact=True).click()
        page.get_by_label('Justificativa',exact=True).fill('Triagem de acesso pendente — teste sintético.')
        save(page)
        expect(page.locator('.sig-table')).to_contain_text('Em triagem')
        print('PASS: missing access blocks OS; justified status change saved',flush=True)
        page.get_by_role('button',name='Nova solicitação',exact=True).click()
        page.get_by_role('button',name='Cancelar',exact=True).click()
        protocol='CN1-VISTORIA-'+RUN
        request_form(page,protocol,True)
        search(page,protocol)
        page.get_by_role('button',name='Detalhes',exact=True).click()
        page.get_by_role('button',name='Emitir OS',exact=True).click()
        page.get_by_label('Latitude da base',exact=True).fill('-23.02')
        page.get_by_label('Longitude da base',exact=True).fill('-50.02')
        # Commit the real order, then simulate loss of its response. Retry must reuse the same key.
        def lost_response(route):
            response=route.fetch()
            assert response.status==201,'The real backend must commit before simulating a lost response'
            route.fulfill(status=503,content_type='application/json',body=json.dumps({'message':'Resposta interrompida. Tente novamente.'}))
        page.route('**/sig-uhe/v1/requests/*/orders',lost_response,times=1)
        page.get_by_role('button',name='Salvar registro',exact=True).click()
        expect(page.get_by_role('alert')).to_contain_text('Resposta interrompida',timeout=30000)
        save(page)
        item=api('GET','requests?q='+protocol)['data'][0]
        links=api('GET','requests/'+item['id']+'/orders')
        assert len(links)==1,'Retry created duplicate native orders'
        print('PASS: native OS created; response loss/retry preserves one order',flush=True)
        # Invalid CSV must be rejected visibly; a corrected file must persist.
        fields=['reservoir_id','protocol','description','category','priority','latitude','longitude','service_seconds']
        def csv_data(lat):
            out=io.StringIO();writer=csv.DictWriter(out,fieldnames=fields);writer.writeheader()
            writer.writerow(dict(reservoir_id=reservoir['id'],protocol='CSV-'+RUN,description='Monitoramento fictício',category='Borda',priority='normal',latitude=lat,longitude=-50,service_seconds=900))
            return out.getvalue()
        page.get_by_label('Selecionar arquivo CSV',exact=True).set_input_files({'name':'invalido.csv','mimeType':'text/csv','buffer':csv_data(100).encode()})
        expect(page.get_by_role('alert')).to_be_visible(timeout=30000)
        page.get_by_label('Selecionar arquivo CSV',exact=True).set_input_files({'name':'valido.csv','mimeType':'text/csv','buffer':csv_data(-23).encode()})
        expect(page.get_by_role('status').filter(has_text='1 solicitações importadas')).to_be_visible(timeout=30000)
        assert api('GET','requests?q=CSV-'+RUN)['total']==1
        print('PASS: invalid CSV displayed; corrected CSV imported without duplication',flush=True)
        # Exercise actual page navigation using 51 additional persisted records.
        out=io.StringIO();writer=csv.DictWriter(out,fieldnames=fields);writer.writeheader()
        for i in range(51): writer.writerow(dict(reservoir_id=reservoir['id'],protocol=f'PAGINA-{RUN}-{i:03d}',description='Registro sintético de paginação',category='Monitoramento',priority='normal',latitude=-23,longitude=-50,service_seconds=900))
        api('POST','requests/import',out.getvalue(),'text/csv')
        search(page,'PAGINA-'+RUN)
        expect(page.locator('.sig-table tbody tr')).to_have_count(50)
        page.get_by_role('button',name='Próxima',exact=True).click()
        expect(page.locator('.sig-table tbody tr')).to_have_count(1,timeout=30000)
        print('PASS: 51 records paginated as 50 + 1',flush=True)
        tab(page,'Histórico')
        expect(page.locator('.sig-table')).to_contain_text('Solicitação cadastrada')
        tab(page,'Visão geral')
        screenshot=ROOT/'docs/screenshots';screenshot.mkdir(exist_ok=True)
        page.screenshot(path=str(screenshot/'sig-uhe-dashboard.png'),full_page=True)
        tab(page,'Solicitações');search(page,protocol)
        page.get_by_role('button',name='Detalhes',exact=True).click()
        expect(page.locator('.sig-detail')).to_contain_text(links[0]['order_number'])
        page.screenshot(path=str(screenshot/'sig-uhe-solicitacoes.png'),full_page=True)
        page.set_viewport_size({'width':390,'height':844})
        expect(page.locator('.sig-workspace h1')).to_be_visible()
        assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth + 1'),'Mobile page overflows horizontally'
        bounds=page.locator('.sig-workspace').bounding_box()
        assert bounds and bounds['x']>=0 and bounds['x']+bounds['width']<=391,'Mobile workspace is clipped'
        expect(page.locator('.next-sidebar')).not_to_be_visible()
        page.screenshot(path=str(screenshot/'sig-uhe-mobile.png'),full_page=True)
        print('PASS: audit, desktop screenshots and mobile layout',flush=True)
        reader=browser.new_context(viewport={'width':1440,'height':1000},locale='pt-BR')
        reader_page=reader.new_page();sign_in(reader_page,True);tab(reader_page,'Solicitações')
        expect(reader_page.get_by_role('button',name='Nova solicitação',exact=True)).to_have_count(0)
        expect(reader_page.locator('#sig-csv')).to_have_count(0)
        assert api('GET','overview',actor='reader')['can_write'] is False
        reader.close()
        print('PASS: native read-only login cannot see write/import controls',flush=True)
        assert not errors,'Browser runtime errors: '+repr(errors[:4])
        print('E2E complete: 8 scenario groups passed; real backend, no skipped groups.',flush=True)
    except Exception:
        page.screenshot(path=str(ROOT/'.runtime/browser-failure.png'),full_page=True)
        (ROOT/'.runtime/browser-failure.json').write_text(json.dumps({'url':page.url,'body':page.locator('body').inner_text()[:12000],'errors':errors[:15]},indent=2))
        raise
    finally: browser.close()
