#!/usr/bin/env python3
"""Prepare a local development runtime without editing upstream source files."""
from pathlib import Path
import base64, os, secrets, shutil, socket, subprocess, sys, urllib.parse
ROOT=Path(__file__).resolve().parents[1]
os.chdir(ROOT)
os.environ['DOCKER_CONFIG']=str(ROOT/'.runtime/docker-config')
(ROOT/'.runtime/docker-config').mkdir(parents=True,exist_ok=True)
def run(*args,**kw): subprocess.run(args,check=True,**kw)
base=ROOT/'.runtime/fleetbase'
commit='89ff7c34c336e865d174144762d182becb9ff6ce'
if not base.exists():
    run('git','clone','--no-checkout','https://github.com/fleetbase/fleetbase.git',str(base))
    run('git','-C',str(base),'checkout','--detach',commit)
elif (base/'.git').exists():
    actual=subprocess.check_output(['git','-C',str(base),'rev-parse','HEAD'],text=True).strip()
    if actual!=commit: raise SystemExit('Existing upstream checkout differs from the audited commit; preserve it and investigate.')
if not (ROOT/'.env').exists():
    key=base64.b64encode(secrets.token_bytes(32)).decode()
    password=secrets.token_hex(24)
    env=f'''APP_ENV=local
APP_DEBUG=false
APP_KEY=base64:{key}
APP_URL=http://localhost:8000
SIG_UHE_DB_PASSWORD={password}
DATABASE_URL=mysql://root:{password}@database:3306/fleetbase
DB_CONNECTION=mysql
CACHE_DRIVER=redis
REDIS_CLIENT=predis
REDIS_HOST=cache
CACHE_URL=tcp://cache
REDIS_URL=tcp://cache
SESSION_DRIVER=file
QUEUE_CONNECTION=redis
BROADCAST_DRIVER=log
MAIL_MAILER=log
LOG_CHANNEL=stderr
REGISTRY_PREINSTALLED_EXTENSIONS=false
TELEMETRY_DISABLED=true
'''
    (ROOT/'.env').write_text(env); (ROOT/'.env').chmod(0o600)
# CA is public trust material, never an authentication credential.
cert=os.environ.get('SSL_CERT_FILE','/etc/ssl/certs/ca-certificates.crt')
shutil.copyfile(cert,ROOT/'infrastructure/platform-ca.crt')
args=['docker','build','--build-arg','HTTP_PROXY','--build-arg','HTTPS_PROXY','--build-arg','NO_PROXY']
proxy=os.environ.get('HTTPS_PROXY')
if proxy:
    host=urllib.parse.urlsplit(proxy).hostname
    args+=['--add-host',host+':'+socket.gethostbyname(host)]
run(*args,'-t','sig-uhe-php:dev','-f','infrastructure/Dockerfile','infrastructure')
run(sys.executable, 'scripts/cache_archives.py')
# Composer must use this environment's trusted proxy, including its DNS mapping.
args=['docker','run','--rm','-u',f'{os.getuid()}:{os.getgid()}','-e','COMPOSER_HOME=/app/.runtime/composer']
for name in ['HTTP_PROXY','HTTPS_PROXY','NO_PROXY','http_proxy','https_proxy','no_proxy']:
    if name in os.environ: args+=['-e',name]
if proxy: args+=['--add-host',host+':'+socket.gethostbyname(host)]
args+=['-v',f'{ROOT}:/app','-w','/app/.runtime/fleetbase/api','sig-uhe-php:dev','composer','install','--no-interaction','--prefer-dist','--no-progress']
run(*args)
run('docker','compose','up','-d','--wait','database','cache')
run('docker','compose','run','--rm','api','php','scripts/artisan.php','mysql:createdb','--no-interaction')
run('docker','compose','run','--rm','api','php','scripts/artisan.php','migrate','--force','--no-interaction')
run('docker','compose','up','-d','--wait','api','worker')
print('Runtime installed. Run the documented functional tests before claiming application readiness.')
