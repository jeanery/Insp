<?php
$app=require __DIR__.'/../scripts/bootstrap.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();
use Illuminate\Support\Facades\DB;
try {
$auth=json_decode(file_get_contents(__DIR__.'/../.runtime/test-auth.json'),true,512,JSON_THROW_ON_ERROR);
$company=$auth['company_uuid'];
$links=DB::table('uhe_request_orders')->where('company_uuid',$company)->get();
if ($links->count()!==100) throw new RuntimeException('Expected exactly 100 persisted order links.');
foreach ($links as $link) {
    $order=\Fleetbase\FleetOps\Models\Order::where('company_uuid',$company)->where('uuid',$link->order_uuid)->firstOrFail();
    $request=DB::table('uhe_requests')->where('id',$link->request_id)->first();
    if ($order->status!=='created' || $request->status!=='open') throw new RuntimeException('Native order/request status coupling.');
    $payload=$order->payload;
    if (!$payload || !$payload->pickup || !$payload->dropoff) throw new RuntimeException('Native payload/places missing.');
    if (abs($payload->dropoff->location->getLat()-(float)$request->access_latitude)>1e-6) throw new RuntimeException('Access latitude mismatch.');
    if (abs($payload->dropoff->location->getLng()-(float)$request->access_longitude)>1e-6) throw new RuntimeException('Access longitude mismatch.');
}
echo "100 native orders with independent states, payloads and actual access coordinates verified in MySQL.\n";

} catch (\Throwable $e) {
    fwrite(STDERR, get_class($e).' code '.$e->getCode().' at '.$e->getFile().':'.$e->getLine()."\n");
    exit(1);
}
