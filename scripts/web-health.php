<?php
$curl=curl_init('http://127.0.0.1:4200/_sig-uhe/health');
curl_setopt_array($curl,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_TIMEOUT=>8]);
$body=curl_exec($curl); $status=curl_getinfo($curl,CURLINFO_HTTP_CODE); curl_close($curl);
exit($status===200 && (json_decode($body,true)['status']??'')==='ok'?0:1);
