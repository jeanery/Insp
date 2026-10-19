<?php
namespace SigUhe;

use Fleetbase\FleetOps\Models\Fleet;
use Fleetbase\FleetOps\Models\Order;
use Fleetbase\FleetOps\Models\OrderConfig;
use Fleetbase\FleetOps\Models\Payload;
use Fleetbase\FleetOps\Models\Place;
use Fleetbase\LaravelMysqlSpatial\Types\Point;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

final class Controller extends \Illuminate\Routing\Controller
{
    private function query(string $table) { return DB::table($table)->where($table.'.company_uuid', session('company')); }
    private function find(string $table, string $id) { return $this->query($table)->where('id', $id)->first() ?? abort(404); }
    private function insert(string $table, array $data): array
    {
        $row = ['id'=>(string) Str::uuid(), 'company_uuid'=>session('company'), ...$data, 'created_at'=>now(), 'updated_at'=>now()];
        DB::table($table)->insert($row);
        $this->record('create.'.$table, $row['id'], []);
        return $row;
    }
    private function record(string $action, string $id, array $details): void
    {
        DB::table('uhe_audit_events')->insert(['id'=>(string) Str::uuid(), 'company_uuid'=>session('company'),
            'actor_uuid'=>session('user'), 'action'=>$action, 'subject_id'=>$id, 'details'=>json_encode($details, JSON_THROW_ON_ERROR), 'created_at'=>now()]);
    }
    public function teams()
    {
        return Fleet::where('company_uuid',session('company'))->select(['uuid','public_id','name'])->orderBy('name')->paginate(50);
    }
    public function createTeam(Request $r)
    {
        $v=$r->validate(['name'=>'required|string|max:160']);
        return response()->json(DB::transaction(function () use ($v) {
            $fleet=Fleet::create(['company_uuid'=>session('company'),'name'=>$v['name']]);
            $this->record('team.created',$fleet->uuid,[]);
            return ['uuid'=>$fleet->uuid,'public_id'=>$fleet->public_id,'name'=>$fleet->name];
        }),201);
    }
    public function updateRequest(Request $r, string $id)
    {
        $v=$r->validate(['status'=>'required|in:open,triage,awaiting_schedule,scheduled,in_progress,completed,cancelled',
            'reason'=>'required|string|max:2000']);
        return DB::transaction(function () use ($id,$v) {
            $row=$this->query('uhe_requests')->where('id',$id)->lockForUpdate()->first() ?? abort(404);
            $transitions=['open'=>['triage','cancelled'],'triage'=>['awaiting_schedule','cancelled'],
                'awaiting_schedule'=>['scheduled','cancelled'],'scheduled'=>['in_progress','awaiting_schedule','cancelled'],
                'in_progress'=>['completed','cancelled'],'completed'=>[],'cancelled'=>[]];
            abort_unless(in_array($v['status'],$transitions[$row->status]??[]),409,'Transição não permitida.');
            $this->query('uhe_requests')->where('id',$id)->update(['status'=>$v['status'],'updated_at'=>now()]);
            $this->record('request.status_changed',$id,['from'=>$row->status,'to'=>$v['status'],'reason'=>$v['reason']]);
            return (array)$this->find('uhe_requests',$id);
        });
    }
    public function plants() { return $this->query('uhe_plants')->orderBy('code')->paginate(50); }
    public function reservoirs() { return $this->query('uhe_reservoirs')->orderBy('name')->paginate(50); }
    public function requests() { return $this->query('uhe_requests')->orderBy('protocol')->paginate(50); }
    public function audit() { return $this->query('uhe_audit_events')->orderByDesc('created_at')->paginate(50); }
    public function createPlant(Request $r)
    {
        $v=$r->validate(['code'=>['required','string','max:30',Rule::unique('uhe_plants')->where('company_uuid',session('company'))],
            'name'=>'required|string|max:160','state'=>'required|in:AC,AL,AP,AM,BA,CE,DF,ES,GO,MA,MT,MS,MG,PA,PB,PR,PE,PI,RJ,RN,RS,RO,RR,SC,SP,SE,TO']);
        return response()->json(DB::transaction(fn()=> $this->insert('uhe_plants',$v)),201);
    }
    public function createReservoir(Request $r)
    {
        $v=$r->validate(['plant_id'=>'required|uuid','name'=>'required|string|max:160']);
        $this->find('uhe_plants',$v['plant_id']);
        Validator::make($v,['name'=>Rule::unique('uhe_reservoirs')->where('plant_id',$v['plant_id'])])->validate();
        return response()->json(DB::transaction(fn()=> $this->insert('uhe_reservoirs',$v)),201);
    }
    private function validateRequest(array $data): array
    {
        $v=Validator::make($data,[
            'reservoir_id'=>'required|uuid', 'protocol'=>['required','string','max:80',Rule::unique('uhe_requests')->where('company_uuid',session('company'))],
            'description'=>'required|string|max:10000','category'=>'required|string|max:80', 'priority'=>'required|in:low,normal,high,urgent',
            'latitude'=>'required|numeric|between:-90,90','longitude'=>'required|numeric|between:-180,180',
            'access_latitude'=>'nullable|required_with:access_longitude|numeric|between:-90,90',
            'access_longitude'=>'nullable|required_with:access_latitude|numeric|between:-180,180',
            'service_seconds'=>'required|integer|between:60,86400','due_at'=>'nullable|date_format:Y-m-d\TH:i:sP',
        ])->validate();
        $this->find('uhe_reservoirs',$v['reservoir_id']);
        if (!empty($v['due_at'])) $v['due_at']=\Carbon\Carbon::parse($v['due_at'])->utc();
        return $v;
    }
    public function createRequest(Request $r)
    {
        return response()->json(DB::transaction(fn()=> $this->insert('uhe_requests',$this->validateRequest($r->all()))),201);
    }
    public function import(Request $r)
    {
        abort_unless(str_starts_with($r->header('Content-Type',''), 'text/csv'),415,'Envie CSV UTF-8 com cabeçalho.');
        abort_if(strlen($r->getContent())>2*1024*1024,413);
        $stream=fopen('php://temp','r+'); fwrite($stream,$r->getContent()); rewind($stream);
        $header=fgetcsv($stream,0,',','"','');
        abort_unless(is_array($header) && count($header)===count(array_unique($header)),422,'Cabeçalho inválido.');
        $rows=[];
        while (($values=fgetcsv($stream,0,',','"',''))!==false) {
            if ($values===[null]) continue;
            abort_unless(count($values)===count($header),422,'Quantidade de colunas inválida.');
            $rows[]=array_combine($header,array_map(fn($v)=>$v===''?null:$v,$values));
            abort_if(count($rows)>100,422,'Limite: 100 solicitações por importação.');
        }
        fclose($stream); abort_unless(count($rows)>0,422,'CSV vazio.');
        $result=DB::transaction(function () use ($rows) {
            $created=[];
            foreach ($rows as $row) $created[]=$this->insert('uhe_requests',$this->validateRequest($row));
            return $created;
        });
        return response()->json(['count'=>count($result),'data'=>$result],201);
    }
    public function orders(string $id)
    {
        $this->find('uhe_requests',$id);
        return $this->query('uhe_request_orders')->where('request_id',$id)
            ->join('orders','orders.uuid','=','uhe_request_orders.order_uuid')
            ->select(['uhe_request_orders.*','orders.public_id as order_number','orders.status as order_status','orders.deleted_at as order_deleted_at'])->get();
    }
    public function issueBatch(Request $r)
    {
        $v=$r->validate(['items'=>'required|array|min:1|max:100','items.*.request_id'=>'required|uuid','items.*.idempotency_key'=>'required|string|max:80','items.*.base_latitude'=>'required|numeric|between:-90,90','items.*.base_longitude'=>'required|numeric|between:-180,180']);
        $result=DB::transaction(function () use ($r,$v) {
            $items=$v['items'];
            usort($items,fn($a,$b)=>strcmp($a['request_id'],$b['request_id']));
            return array_map(function ($item) use ($r) {
                $child=Request::create('/','POST',$item);
                $child->setLaravelSession($r->session());
                return $this->issueOrder($child,$item['request_id'])->getData(true);
            },$items);
        });
        return response()->json(['count'=>count($result),'data'=>$result],201);
    }
    public function issueOrder(Request $r, string $id)
    {
        $v=$r->validate(['idempotency_key'=>'required|string|max:80', 'base_latitude'=>'required|numeric|between:-90,90',
            'base_longitude'=>'required|numeric|between:-180,180']);
        // Normalize before hashing; retries with different payloads must fail.
        $hash=hash('sha256',json_encode([$id,(float)$v['base_latitude'],(float)$v['base_longitude']]));
        $result=DB::transaction(function () use ($id,$v,$hash) {
            // Serialize tenant issuance to protect idempotency keys even across different requests.
            DB::table('companies')->where('uuid',session('company'))->lockForUpdate()->first();
            $request=$this->query('uhe_requests')->where('id',$id)->lockForUpdate()->first() ?? abort(404);
            $old=$this->query('uhe_request_orders')->where('idempotency_key',$v['idempotency_key'])->first();
            if ($old) { abort_unless(hash_equals($old->input_hash,$hash),409,'Chave já usada para outra operação.'); return (array)$old; }
            abort_if(in_array($request->status,['cancelled','completed']),409,'Solicitação encerrada.');
            abort_if($request->access_latitude===null || $request->access_longitude===null,422,'Defina o ponto de acesso; o local da ocorrência não implica acesso viário.');
            $config=OrderConfig::where('key','transport')->where(function ($q) { $q->where('company_uuid',session('company'))->orWhereNull('company_uuid'); })->first();
            abort_unless($config,503,'Configuração nativa transport não instalada; execute o seed do Fleet-Ops.');
            $base=Place::create(['company_uuid'=>session('company'),'name'=>'Base operacional informada','country'=>'BR',
                'location'=>new Point((float)$v['base_latitude'],(float)$v['base_longitude'])]);
            $access=Place::create(['company_uuid'=>session('company'),'name'=>'Acesso '.$request->protocol,'country'=>'BR',
                'location'=>new Point((float)$request->access_latitude,(float)$request->access_longitude)]);
            $payload=Payload::create(['company_uuid'=>session('company'),'type'=>'transport']);
            $payload->setPickup($base); $payload->setDropoff($access); $payload->save();
            $order=Order::create(['company_uuid'=>session('company'),'created_by_uuid'=>session('user'),
                'payload_uuid'=>$payload->uuid,'order_config_uuid'=>$config->uuid,'type'=>'transport','status'=>'created',
                'orchestrator_priority'=>['low'=>10,'normal'=>50,'high'=>80,'urgent'=>100][$request->priority],
                'meta'=>['sig_uhe_request_id'=>$id,'service_seconds'=>$request->service_seconds,'requires_access_review'=>true],
                'notes'=>$request->description]);
            $link=$this->insert('uhe_request_orders',['request_id'=>$id,'order_uuid'=>$order->uuid,'idempotency_key'=>$v['idempotency_key'],'input_hash'=>$hash]);
            $this->record('order.issued',$id,['order_uuid'=>$order->uuid]);
            // Request and order states are intentionally independent. No routing or dispatch occurs here.
            return $link;
        });
        return response()->json($result,201);
    }
}
