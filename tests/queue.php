<?php
$app=require __DIR__.'/../scripts/bootstrap.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();
final class QueueReadinessProbe implements \Illuminate\Contracts\Queue\ShouldQueue {
    use \Illuminate\Bus\Queueable;
    public function __construct(public string $key) {}
    public function handle(): void { \Illuminate\Support\Facades\Cache::put($this->key,'executed',60); }
}
try {
    $key='sig-uhe-readiness-'.bin2hex(random_bytes(8));
    dispatch((new QueueReadinessProbe($key))->onQueue('sig-uhe-readiness'));
    $status=\Illuminate\Support\Facades\Artisan::call('queue:work',['--queue'=>'sig-uhe-readiness','--stop-when-empty'=>true,'--tries'=>1]);
    if ($status!==0 || \Illuminate\Support\Facades\Cache::pull($key)!=='executed') throw new RuntimeException('Queue probe did not execute.');
    $failed=\Illuminate\Support\Facades\DB::table('failed_jobs')->count();
    echo "Redis queued probe executed by the Laravel worker. Failed jobs in development DB: $failed\n";
    if ($failed>0) exit(1);
} catch (\Throwable $e) { fwrite(STDERR,get_class($e).' code '.$e->getCode()."\n"); exit(1); }
