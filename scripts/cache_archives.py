#!/usr/bin/env python3
"""Cache official GitHub archives at the exact refs in the unmodified Composer lock.

The canonical codeload endpoint is the archive source behind GitHub's zipball API.
No package, reference, lockfile, expected checksum, or TLS policy is changed.
"""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import hashlib, json, re, urllib.request, zipfile
ROOT=Path(__file__).resolve().parents[1]
lock=json.loads((ROOT/'.runtime/fleetbase/api/composer.lock').read_text())
cache=ROOT/'.runtime/composer/cache/files'
def fetch(p):
    dist=p.get('dist',{});url=dist.get('url','')
    match=re.fullmatch(r'https://api\.github\.com/repos/([^/]+/[^/]+)/zipball/([a-f0-9]{40})',url)
    if not match: raise RuntimeError('Unrecognized archive source for '+p['name'])
    if dist.get('reference')!=match[2]: raise RuntimeError('Archive reference mismatch: '+p['name'])
    target=cache/p['name']/(hashlib.sha1(url.encode()).hexdigest()+'.zip')
    if target.exists(): return
    archive='https://codeload.github.com/'+match[1]+'/legacy.zip/'+match[2]
    with urllib.request.urlopen(archive,timeout=120) as response: data=response.read()
    if dist.get('shasum') and hashlib.sha1(data).hexdigest()!=dist['shasum']: raise RuntimeError('Checksum mismatch: '+p['name'])
    target.parent.mkdir(parents=True,exist_ok=True)
    tmp=target.with_suffix('.tmp');tmp.write_bytes(data)
    with zipfile.ZipFile(tmp) as z:
        if z.testzip() is not None: raise RuntimeError('Damaged archive: '+p['name'])
    tmp.replace(target)
packages=lock['packages']+lock.get('packages-dev',[])
with ThreadPoolExecutor(max_workers=6) as pool:
    for n,_ in enumerate(pool.map(fetch,packages),1):
        if n%25==0: print(f'{n}/{len(packages)} official archives cached',flush=True)
print(f'{len(packages)} archives available at locked references.')
