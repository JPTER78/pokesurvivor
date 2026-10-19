import copy
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('prepare', ROOT / 'prepare.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def config():
    c = json.loads((ROOT / 'settings.example.json').read_text(encoding='utf-8'))
    c.update(turnHost='turn.test.net', apiHost='ice.test.net', publicIp='8.8.8.8',
             localIp='8.8.8.8', acmeEmail='admin@test.net')
    return c


class PreparationTests(unittest.TestCase):
    def test_direct_and_nat_mapping(self):
        c = config()
        direct, _, _ = module.render(c, 'a' * 64)
        self.assertNotIn('external-ip=', direct)
        c['localIp'] = '10.0.0.5'
        nat, _, _ = module.render(c, 'a' * 64)
        self.assertIn('external-ip=8.8.8.8/10.0.0.5', nat)
        self.assertIn('relay-ip=10.0.0.5', nat)

    def test_unsafe_settings_and_placeholders_fail(self):
        for key, value in [('turnHost', 'x\nno-auth'), ('publicIp', '169.254.169.254'),
                           ('publicIp', '203.0.113.10'), ('localIp', '127.0.0.1'),
                           ('origins', ['*']), ('projectId', 'another-project'),
                           ('credentialTtl', 0), ('tls', 'false'), ('totalQuota', 0),
                           ('relayMaxPort', 49160), ('allowAllAuthenticated', 'true')]:
            c = config(); c[key] = value
            with self.subTest(key=key, value=value), self.assertRaises(ValueError): module.validate(c)

    def test_private_metadata_and_ipv6_peers_blocked(self):
        conf, broker, caddy = module.render(config(), 'a' * 64)
        self.assertIn('denied-peer-ip=169.254.0.0-169.254.255.255', conf)
        self.assertIn('denied-peer-ip=::-ffff:', conf)
        self.assertIn('use-auth-secret', conf)
        self.assertIn('cli=false', conf)
        self.assertNotIn('no-auth', conf)
        self.assertNotIn('a' * 64, broker + caddy)
        self.assertFalse(json.loads(broker)['allowAllAuthenticated'])

    def test_tls_requires_operator_supplied_certificate(self):
        c = config(); c['tls'] = True
        conf, _, _ = module.render(c, 'a' * 64)
        self.assertIn('cert=/certs/fullchain.pem', conf)
        self.assertNotIn('no-tls', conf)
        with tempfile.TemporaryDirectory() as tmp:
            with self.assertRaises(ValueError): module.prepare(c, tmp)

    def test_preparation_preserves_secret_and_writes_no_secret_to_env(self):
        with tempfile.TemporaryDirectory() as tmp:
            module.prepare(config(), tmp)
            secret = (Path(tmp) / 'runtime/auth-secret').read_text().strip()
            self.assertRegex(secret, r'^[a-f0-9]{64}$')
            module.prepare(config(), tmp)
            self.assertEqual((Path(tmp) / 'runtime/auth-secret').read_text().strip(), secret)
            self.assertNotIn(secret, (Path(tmp) / '.env').read_text())


if __name__ == '__main__':
    unittest.main()
