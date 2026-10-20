<?php
namespace SigUhe;

use Fleetbase\FleetOps\Models\Fleet;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

final class TeamProfile extends \Illuminate\Routing\Controller
{
    public static function decode($row): ?array
    {
        if (!$row) return null;
        $data=(array)$row;
        foreach (['skills','weekly_windows'] as $key) $data[$key]=json_decode($data[$key],true,512,JSON_THROW_ON_ERROR);
        return $data;
    }
    public function show(string $id)
    {
        Fleet::where('company_uuid',session('company'))->where('uuid',$id)->firstOrFail();
        return response()->json(['profile'=>self::decode(DB::table('uhe_team_profiles')->where('company_uuid',session('company'))->where('fleet_uuid',$id)->first())]);
    }
    public function update(Request $request, string $id)
    {
        // Check ownership before validation to avoid revealing another organization's records.
        Fleet::where('company_uuid',session('company'))->where('uuid',$id)->firstOrFail();
        $validator=Validator::make($request->all(),[
            'version'=>'required|integer|min:0', 'reason'=>'required|string|max:2000',
            'availability'=>'required|in:available,unavailable', 'timezone'=>'required|timezone|max:64',
            'base_latitude'=>'required|numeric|between:-90,90', 'base_longitude'=>'required|numeric|between:-180,180',
            'skills'=>'present|array|max:6', 'skills.*'=>'required|string|distinct|in:land,environmental,engineering,nautical,tagging,drone',
            'daily_capacity_minutes'=>'required|integer|between:1,1440',
            'weekly_windows'=>'present|array|max:28', 'weekly_windows.*'=>'required|array:day,start,end',
            'weekly_windows.*.day'=>'required|integer|between:1,7',
            'weekly_windows.*.start'=>'required|date_format:H:i', 'weekly_windows.*.end'=>'required|date_format:H:i',
        ]);
        $validator->after(function ($v) use ($request) {
            if ($v->errors()->isNotEmpty()) return;
            $days=[];
            foreach ($request->input('weekly_windows') as $i=>$window) {
                if ($window['start'] >= $window['end']) $v->errors()->add("weekly_windows.$i.end",'O fim deve ser posterior ao início, no mesmo dia.');
                $days[$window['day']][]=$window;
            }
            foreach ($days as $windows) {
                usort($windows,fn($a,$b)=>strcmp($a['start'],$b['start']));
                $last=null; $minutes=0;
                foreach ($windows as $window) {
                    if ($last!==null && $window['start']<$last) $v->errors()->add('weekly_windows','Jornadas do mesmo dia não podem se sobrepor.');
                    $last=$window['end'];
                    $toMinutes=fn($time)=>(int)substr($time,0,2)*60+(int)substr($time,3,2);
                    $minutes+=$toMinutes($window['end'])-$toMinutes($window['start']);
                }
                if ($request->integer('daily_capacity_minutes')>$minutes) $v->errors()->add('daily_capacity_minutes','A capacidade não pode superar a jornada de nenhum dia cadastrado.');
            }
            if (!$days && $request->input('availability')==='available') $v->errors()->add('weekly_windows','Cadastre ao menos uma jornada para disponibilizar a equipe.');
        });
        $data=$validator->validate();
        return DB::transaction(function () use ($id,$data) {
            // Lock the native parent even on first save, serializing creation and version checks.
            Fleet::where('company_uuid',session('company'))->where('uuid',$id)->lockForUpdate()->firstOrFail();
            $query=DB::table('uhe_team_profiles')->where('company_uuid',session('company'))->where('fleet_uuid',$id);
            $before=self::decode($query->first());
            abort_unless(($before['version']??0)===(int)$data['version'],409,'O perfil foi alterado por outra pessoa. Recarregue antes de salvar.');
            $row=$data; unset($row['reason']);
            $row['version']++; $row['updated_at']=now();
            foreach (['skills','weekly_windows'] as $key) $row[$key]=json_encode($row[$key],JSON_THROW_ON_ERROR);
            if ($before) $query->update($row);
            else DB::table('uhe_team_profiles')->insert([...$row,'fleet_uuid'=>$id,'company_uuid'=>session('company'),'created_at'=>now()]);
            $after=self::decode($query->first());
            DB::table('uhe_audit_events')->insert(['id'=>(string)Str::uuid(),'company_uuid'=>session('company'),
                'actor_uuid'=>session('user'),'action'=>'team.profile_updated','subject_id'=>$id,
                'details'=>json_encode(['reason'=>$data['reason'],'before'=>$before,'after'=>$after],JSON_THROW_ON_ERROR),'created_at'=>now()]);
            return $after;
        });
    }
}
