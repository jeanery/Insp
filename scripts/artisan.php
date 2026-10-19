<?php
$app=require __DIR__.'/bootstrap.php';
$kernel=$app->make(\Illuminate\Contracts\Console\Kernel::class);
$status=$kernel->handle($input=new \Symfony\Component\Console\Input\ArgvInput, new \Symfony\Component\Console\Output\ConsoleOutput);
$kernel->terminate($input,$status); exit($status);
