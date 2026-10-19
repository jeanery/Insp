<?php
try {
$app=require __DIR__.'/bootstrap.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();
foreach (['companies','users','orders','fleets','uhe_plants','uhe_reservoirs','uhe_requests','uhe_request_orders','uhe_audit_events'] as $table) {
    if (!\Illuminate\Support\Facades\Schema::hasTable($table)) { fwrite(STDERR,"Required table absent: $table\n"); exit(1); }
}
\Illuminate\Support\Facades\DB::select('SELECT 1');
\Illuminate\Support\Facades\Redis::connection()->ping();
echo "Fleetbase and SIG-UHE database prerequisites available.\n";

} catch (\Throwable $e) { fwrite(STDERR, "Dependency check failed: ".get_class($e)."\n"); exit(1); }
