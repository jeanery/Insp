<?php
$app=require __DIR__.'/../scripts/bootstrap.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
$name='sig_uhe_migration_'.bin2hex(random_bytes(8));
$original=DB::getDefaultConnection();
$source=config('database.connections.mysql.database');
$created=false; $status=0;
try {
    DB::connection('mysql')->statement("CREATE DATABASE `$name` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
    $created=true;
    // Copy actual native table definitions, without data. All destructive DDL is isolated.
    foreach (['companies','orders'] as $table) DB::connection('mysql')->statement("CREATE TABLE `$name`.`$table` LIKE `$source`.`$table`");
    $connection=config('database.connections.mysql'); $connection['database']=$name;
    config(['database.connections.migration_test'=>$connection]);
    DB::setDefaultConnection('migration_test'); Schema::clearResolvedInstance('db.schema');
    $migration=require __DIR__.'/../extensions/sig-uhe/migrations/2026_10_19_000001_create_sig_uhe_tables.php';
    $migration->up();
    foreach (['uhe_plants','uhe_reservoirs','uhe_requests','uhe_request_orders','uhe_audit_events'] as $table) {
        if (!Schema::hasTable($table)) throw new RuntimeException('Missing table after up: '.$table);
    }
    $migration->down();
    foreach (['uhe_plants','uhe_reservoirs','uhe_requests','uhe_request_orders','uhe_audit_events'] as $table) {
        if (Schema::hasTable($table)) throw new RuntimeException('Table remains after down: '.$table);
    }
    if (!Schema::hasTable('companies') || !Schema::hasTable('orders')) throw new RuntimeException('Native tables removed.');
    echo "Migration up/down verified against real MySQL in an isolated empty schema.\n";
} catch (\Throwable $e) {
    fwrite(STDERR,get_class($e).' code '.$e->getCode()."\n"); $status=1;
} finally {
    DB::setDefaultConnection($original); Schema::clearResolvedInstance('db.schema');
    if ($created) DB::connection('mysql')->statement("DROP DATABASE `$name`");
}

exit($status);
