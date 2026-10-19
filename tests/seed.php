<?php
$app=require __DIR__.'/../scripts/bootstrap.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();
use Fleetbase\Models\Company;
use Fleetbase\Models\User;
use Fleetbase\Models\Permission;
use Fleetbase\FleetOps\Models\Fleet;
use Fleetbase\FleetOps\Support\FleetOps;
use Illuminate\Support\Str;

try {
$run=(string) Str::uuid();
$tokens=[];
foreach (['alpha','beta'] as $org) {
    $company=Company::create(['name'=>'SIG-UHE fictícia '.$org.' '.$run,'country'=>'BR','timezone'=>'America/Sao_Paulo']);
    $admin=User::create(['name'=>'Administrador fictício','email'=>$org.'-'.$run.'@example.invalid','company_uuid'=>$company->uuid]);
    $admin->forceFill(['type'=>'admin','password'=>\Illuminate\Support\Facades\Hash::make(Str::random(40))])->save();
    \Fleetbase\Models\CompanyUser::create(['company_uuid'=>$company->uuid,'user_uuid'=>$admin->uuid,'status'=>'active']);
    $company->owner_uuid=$admin->uuid; $company->save();
    FleetOps::createTransportConfig($company);
    $tokens[$org]=$admin->createToken('sig-uhe-functional-test')->plainTextToken;
    if ($org==='alpha') {
        $reader=User::create(['name'=>'Consulta fictícia','email'=>'reader-'.$run.'@example.invalid','company_uuid'=>$company->uuid]);
        $reader->forceFill(['type'=>'user'])->save();
        \Fleetbase\Models\CompanyUser::create(['company_uuid'=>$company->uuid,'user_uuid'=>$reader->uuid,'status'=>'active']);
        $permission=Permission::firstOrCreate(['name'=>'sig-uhe.read','guard_name'=>'sanctum']);
        $reader->givePermissionTo($permission);
        $tokens['reader']=$reader->createToken('sig-uhe-functional-test')->plainTextToken;
        for ($i=1;$i<=3;$i++) Fleet::create(['company_uuid'=>$company->uuid,'name'=>'Equipe sintética '.$i]);
        $tokens['company_uuid']=$company->uuid;
    }
}
$path=__DIR__.'/../.runtime/test-auth.json';
file_put_contents($path,json_encode($tokens,JSON_THROW_ON_ERROR)); chmod($path,0600);
echo "Duas organizações sintéticas, três equipes nativas e identidades de teste criadas.\n";

} catch (\Throwable $e) {
    fwrite(STDERR, get_class($e).' code '.$e->getCode().' at '.$e->getFile().':'.$e->getLine()."\n");
    exit(1);
}
