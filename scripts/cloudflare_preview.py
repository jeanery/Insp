#!/usr/bin/env python3
"""Temporary Cloudflare HTTPS access to the existing console; native login stays required."""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import argparse, http.client, json, re, shutil, subprocess, threading, time, urllib.error, urllib.request

ROOT = Path(__file__).resolve().parents[1]
ORIGIN = 'http://127.0.0.1:4200'
PUBLIC_URL = re.compile(r'https://(?!api\.)[a-z0-9]+(?:-[a-z0-9]+)+\.trycloudflare\.com')
HOP = {'host', 'connection', 'content-length', 'transfer-encoding', 'keep-alive', 'proxy-connection', 'upgrade'}

class Gateway(BaseHTTPRequestHandler):
    public_origin = None
    def log_message(self, *_): pass  # Never log authentication headers, query strings or bodies.
    def forward(self):
        if self.path.split('?', 1)[0] == '/fleetbase.config.json':
            if not self.public_origin:
                self.send_error(503, 'Waiting for Cloudflare'); return
            body = json.dumps(dict(API_HOST=self.public_origin, API_NAMESPACE='int/v1', EXTENSIONS=['@sig-uhe/engine'])).encode()
            self.send_response(200); self.send_header('Content-Type', 'application/json')
            self.send_header('Cache-Control', 'no-store'); self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            if self.command != 'HEAD': self.wfile.write(body)
            return
        # A fixed upstream and origin-form path prevent use as an open forward proxy.
        if not self.path.startswith('/') or self.path.startswith('//'):
            self.send_error(400); return
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if length < 0 or length > 4 * 1024 * 1024:
                self.send_error(413); return
            if self.headers.get('Transfer-Encoding'):
                self.send_error(400); return
            body = self.rfile.read(length) if length else None
            conn = http.client.HTTPConnection('127.0.0.1', 4200, timeout=90)
            headers = {k: v for k, v in self.headers.items() if k.lower() not in HOP}
            headers['Host'] = 'localhost:4200'
            headers['Accept-Encoding'] = 'identity'
            conn.request(self.command, self.path, body=body, headers=headers)
            res = conn.getresponse(); data = res.read()
            self.send_response(res.status)
            for key, value in res.getheaders():
                if key.lower() not in HOP: self.send_header(key, value)
            self.send_header('Content-Length', str(len(data))); self.end_headers()
            if self.command != 'HEAD': self.wfile.write(data)
            conn.close()
        except (OSError, ValueError, http.client.HTTPException):
            self.send_error(502)
    do_GET = do_HEAD = do_POST = do_PATCH = do_PUT = do_DELETE = do_OPTIONS = forward


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check-local', action='store_true', help='Validate the local gateway without publishing anything')
    parser.add_argument('--cloudflared', default=shutil.which('cloudflared') or str(ROOT/'.runtime/bin/cloudflared'))
    args = parser.parse_args()
    with urllib.request.urlopen(ORIGIN+'/_sig-uhe/health', timeout=10) as res:
        if res.status != 200: raise SystemExit('Start the Compose services first.')
    server = ThreadingHTTPServer(('127.0.0.1', 4210), Gateway)
    thread = threading.Thread(target=server.serve_forever, daemon=True); thread.start()
    tunnel = None
    try:
        if args.check_local:
            assert PUBLIC_URL.search('Post https://api.trycloudflare.com/tunnel failed') is None
            assert PUBLIC_URL.search('https://example-preview-demo.trycloudflare.com') is not None
            Gateway.public_origin = 'https://preview.invalid'
            base = 'http://127.0.0.1:4210'
            with urllib.request.urlopen(base+'/fleetbase.config.json') as res:
                assert json.load(res)['API_HOST'] == Gateway.public_origin
            with urllib.request.urlopen(base+'/sig-uhe') as res:
                assert res.status == 200 and b'<html' in res.read().lower()
            for path, code in [('/sig-uhe/v1/plants',401),('/.env',404),('/.runtime/test-auth.json',404)]:
                try:
                    urllib.request.urlopen(urllib.request.Request(base+path, headers={'Accept':'application/json'}))
                    raise AssertionError('Unexpected success for '+path)
                except urllib.error.HTTPError as error: assert error.code == code, (path, error.code)
            print('PASS: HTTPS runtime configuration, real console, authentication and private-file protection (local gateway only).')
            return
        if not Path(args.cloudflared).is_file():
            raise SystemExit('Install the official cloudflared binary first; see docs/CLOUDFLARE_TEST.md.')
        log = ROOT/'.runtime/cloudflare-preview.log'
        with log.open('w') as output:
            tunnel = subprocess.Popen([args.cloudflared,'tunnel','--no-autoupdate','--url','http://127.0.0.1:4210','--protocol','http2'],stdout=output,stderr=subprocess.STDOUT)
            deadline = time.monotonic()+45
            while time.monotonic() < deadline:
                match = PUBLIC_URL.search(log.read_text())
                if match:
                    Gateway.public_origin = match.group()
                    reachable = False
                    while time.monotonic() < deadline and tunnel.poll() is None:
                        try:
                            with urllib.request.urlopen(Gateway.public_origin+'/_sig-uhe/health',timeout=5) as res:
                                healthy = res.status == 200 and json.load(res).get('status') == 'ok'
                            with urllib.request.urlopen(Gateway.public_origin+'/fleetbase.config.json',timeout=5) as res:
                                reachable = healthy and json.load(res).get('API_HOST') == Gateway.public_origin
                            if reachable: break
                        except (OSError, ValueError): pass
                        time.sleep(1)
                    if not reachable: raise SystemExit('A tunnel address was allocated, but public connectivity could not be verified; access has been stopped.')
                    print('Verified temporary address: '+Gateway.public_origin+'/auth?shift=sig-uhe',flush=True)
                    print('Native login is required. Keep this command running; Ctrl+C closes access.',flush=True)
                    tunnel.wait()
                    raise SystemExit(tunnel.returncode)
                if tunnel.poll() is not None:
                    raise SystemExit('Cloudflare could not create the tunnel. Details: .runtime/cloudflare-preview.log. Check network/DNS access.')
                time.sleep(0.25)
            raise SystemExit('Cloudflare did not provide an address within 45 seconds; the tunnel has been stopped.')
    except KeyboardInterrupt:
        pass
    finally:
        if tunnel and tunnel.poll() is None:
            tunnel.terminate()
            try: tunnel.wait(timeout=5)
            except subprocess.TimeoutExpired: tunnel.kill(); tunnel.wait()
        server.shutdown(); server.server_close()

if __name__ == '__main__': main()
