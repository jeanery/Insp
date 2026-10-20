<?php
header_remove('X-Powered-By');
// Local development gateway: static console and authenticated API on one origin.
$dist=realpath(__DIR__.'/../.runtime/console/dist');
$path=parse_url($_SERVER['REQUEST_URI'],PHP_URL_PATH);
if (!is_string($path) || !$dist) { http_response_code(503); exit('Console não compilada. Execute scripts/setup_console.py.'); }
if ($path==='/_sig-uhe/health') {
    $curl=curl_init('http://api:8000/sig-uhe/v1/plants');
    curl_setopt_array($curl,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_NOPROXY=>'api',CURLOPT_TIMEOUT=>5,CURLOPT_HTTPHEADER=>['Accept: application/json']]);
    curl_exec($curl); $status=curl_getinfo($curl,CURLINFO_HTTP_CODE); curl_close($curl);
    header('Content-Type: application/json'); http_response_code($status===401?200:503);
    exit(json_encode(['status'=>$status===401?'ok':'unavailable']));
}
if ($path==='/fleetbase.config.json') {
    $host=$_SERVER['HTTP_HOST']??'localhost:4200';
    if (!preg_match('/^(localhost|127\.0\.0\.1)(:\d+)?$/D',$host)) { http_response_code(400); exit; }
    header('Content-Type: application/json'); header('Cache-Control: no-store');
    exit(json_encode(['API_HOST'=>'http://'.$host,'API_NAMESPACE'=>'int/v1','EXTENSIONS'=>['@sig-uhe/engine']]));
}
if (preg_match('#^/(int/|v1/|sig-uhe/v1/|sanctum/|~registry/)#',$path)) {
    $curl=curl_init('http://api:8000'.$_SERVER['REQUEST_URI']);
    $forward=[];
    foreach (getallheaders() as $name=>$value) {
        if (!in_array(strtolower($name),['host','connection','content-length','proxy-connection','transfer-encoding'])) $forward[]=$name.': '.$value;
    }
    $headers=[];
    curl_setopt_array($curl,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_NOPROXY=>'api',CURLOPT_CUSTOMREQUEST=>$_SERVER['REQUEST_METHOD'],
        CURLOPT_HTTPHEADER=>$forward,CURLOPT_TIMEOUT=>90,CURLOPT_POSTFIELDS=>file_get_contents('php://input'),
        CURLOPT_HEADERFUNCTION=>function ($curl,$line) use (&$headers) {
            if (str_contains($line,':')) {
                [$name,$value]=explode(':',$line,2);
                if (!in_array(strtolower(trim($name)),['connection','transfer-encoding','keep-alive','host','x-powered-by'])) $headers[]=trim($name).': '.trim($value);
            }
            return strlen($line);
        }]);
    $body=curl_exec($curl); $status=curl_getinfo($curl,CURLINFO_HTTP_CODE); curl_close($curl);
    if ($body===false || !$status) { http_response_code(502); header('Content-Type: application/json'); exit('{"message":"API temporariamente indisponível."}'); }
    http_response_code($status);
    foreach ($headers as $header) header($header,false);
    echo $body; exit;
}
if (!in_array($_SERVER['REQUEST_METHOD'],['GET','HEAD'])) { http_response_code(405); exit; }
$file=realpath($dist.'/'.rawurldecode(ltrim($path,'/')));
if (!$file || !str_starts_with($file,$dist.'/') || !is_file($file)) {
    if (pathinfo($path,PATHINFO_EXTENSION)!=='') { http_response_code(404); exit; }
    $file=$dist.'/index.html';
}
$types=['html'=>'text/html; charset=utf-8','css'=>'text/css','js'=>'application/javascript','json'=>'application/json','svg'=>'image/svg+xml','png'=>'image/png','jpg'=>'image/jpeg','woff'=>'font/woff','woff2'=>'font/woff2','csv'=>'text/csv; charset=utf-8'];
header('Content-Type: '.($types[pathinfo($file,PATHINFO_EXTENSION)]??'application/octet-stream'));
header('X-Content-Type-Options: nosniff');
if ($_SERVER['REQUEST_METHOD']==='GET') readfile($file);
