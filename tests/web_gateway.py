#!/usr/bin/env python3
"""Gateway boundary tests: private setup files stay outside the document root."""
import json,unittest,urllib.request,urllib.error
ORIGIN='http://localhost:4200'
def get(path):
    request=urllib.request.Request(ORIGIN+path,headers={'Accept':'application/json'})
    try:
        with urllib.request.urlopen(request,timeout=15) as response:return response.status,response.read()
    except urllib.error.HTTPError as error:return error.code,error.read()
class Gateway(unittest.TestCase):
    def test_private_files_not_served(self):
        for path in ['/.env','/../.env','/%2e%2e/.env','/.runtime/test-auth.json','/scripts/bootstrap.php']:
            with self.subTest(path=path):self.assertEqual(get(path)[0],404)
    def test_api_preserves_authentication(self):self.assertEqual(get('/sig-uhe/v1/plants')[0],401)
    def test_readiness_and_spa_route(self):
        status,body=get('/_sig-uhe/health');self.assertEqual(status,200);self.assertEqual(json.loads(body)['status'],'ok')
        status,body=get('/sig-uhe');self.assertEqual(status,200);self.assertIn(b'Fleetbase',body)
    def test_csv_and_missing_assets(self):
        status,body=get('/sig-uhe-exemplo.csv');self.assertEqual(status,200);self.assertTrue(body.startswith(b'reservoir_id,'))
        self.assertEqual(get('/assets/missing.js')[0],404)
if __name__=='__main__':unittest.main(verbosity=2)
