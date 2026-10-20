#!/usr/bin/env python3
"""Assemble the native console with a local Ember engine; audited checkout stays intact."""
from pathlib import Path
import json,os,shutil,subprocess
ROOT=Path(__file__).resolve().parents[1]
source=ROOT/'.runtime/fleetbase/console'
host=ROOT/'.runtime/console'
if not source.exists(): raise SystemExit('Execute scripts/setup.py primeiro.')
if not host.exists(): shutil.copytree(source,host)
# Generate only the assembly manifests, not the audited upstream manifests.
package=json.loads((source/'package.json').read_text())
package['dependencies']['@sig-uhe/engine']='link:lib/sig-uhe'
(host/'package.json').write_text(json.dumps(package,indent=2)+'\n')
lock=(source/'pnpm-lock.yaml').read_text()
needle='importers:\n\n  .:\n    dependencies:\n'
if lock.count(needle)!=1: raise SystemExit('Upstream lock format changed; review before assembling.')
lock=lock.replace(needle,needle+"      '@sig-uhe/engine':\n        specifier: link:lib/sig-uhe\n        version: link:lib/sig-uhe\n",1)
(host/'pnpm-lock.yaml').write_text(lock)
addon=host/'lib/sig-uhe'
# Refresh only our generated source copy; the real extension is always preserved.
shutil.copytree(ROOT/'extensions/sig-uhe',addon,dirs_exist_ok=True,ignore=shutil.ignore_patterns('node_modules'))
shutil.copyfile(ROOT/'docs/examples/requests.csv',host/'public/sig-uhe-exemplo.csv')
env=dict(os.environ,npm_config_cache=str(ROOT/'.runtime/npm'),JOBS='2',NODE_OPTIONS='--max-old-space-size=6144',
         API_HOST=os.environ.get('SIG_UHE_WEB_ORIGIN','http://localhost:4200'),DISABLE_RUNTIME_CONFIG='false',EXTENSIONS='@sig-uhe/engine')
def run(*cmd): subprocess.run(cmd,cwd=host,env=env,check=True)
run('npx','--yes','pnpm@11.0.9','install','--frozen-lockfile','--store-dir',str(ROOT/'.runtime/pnpm-store'))
run('npx','--yes','pnpm@11.0.9','exec','ember','build','--environment=development')
print('Console Fleetbase + SIG-UHE compiled successfully. Start the Compose web service.')
