<?php
// Development wrapper: no edits to Fleetbase bootstrap/config or Composer manifests.
$base=getenv('FLEETBASE_API_PATH') ?: '/app/.runtime/fleetbase/api';
require $base.'/vendor/autoload.php';
spl_autoload_register(function ($class) {
    if (str_starts_with($class,'SigUhe\\')) {
        $file=__DIR__.'/../extensions/sig-uhe/src/'.substr($class,7).'.php';
        if (is_file($file)) require $file;
    }
});
$app=require $base.'/bootstrap/app.php';
$app->register(\SigUhe\ServiceProvider::class);
// Local runtime override: native defaults append names to Redis DB numbers;
// Redis SELECT requires integer indexes. Keep separate supported logical DBs.
$app->afterBootstrapping(\Illuminate\Foundation\Bootstrap\RegisterProviders::class, function ($app) {
    $app['config']->set('queue.default', 'redis');
    $app['config']->set('queue.connections.redis.after_commit', true);
    foreach (['default'=>0,'cache'=>1,'sql'=>2,'geocode-cache'=>3] as $connection=>$index) {
        $app['config']->set("database.redis.$connection.url", null);
        $app['config']->set("database.redis.$connection.database", $index);
    }
});
return $app;
