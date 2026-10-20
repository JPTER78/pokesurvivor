"""Render local deployment files; never installs software or starts a service."""
import argparse
import ipaddress
import json
import os
from pathlib import Path
import re
import secrets

ROOT = Path(__file__).resolve().parent
DENIED = [
    '0.0.0.0-0.255.255.255', '10.0.0.0-10.255.255.255',
    '100.64.0.0-100.127.255.255', '127.0.0.0-127.255.255.255',
    '169.254.0.0-169.254.255.255', '172.16.0.0-172.31.255.255',
    '192.0.0.0-192.0.0.255', '192.0.2.0-192.0.2.255',
    '192.168.0.0-192.168.255.255', '198.18.0.0-198.19.255.255',
    '198.51.100.0-198.51.100.255', '203.0.113.0-203.0.113.255',
    '224.0.0.0-255.255.255.255', '::-ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff',
]


def validate(c):
    for key in ['turnHost', 'apiHost']:
        host = c.get(key, '')
        if not re.fullmatch(r'(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}', host):
            raise ValueError(f'{key}: use a DNS hostname without scheme or port')
        if host.endswith('.example.com'):
            raise ValueError(f'{key}: replace the example hostname')
    if c['turnHost'] == c['apiHost']:
        raise ValueError('Use separate DNS names for TURN and the credential API')
    public, local = (ipaddress.IPv4Address(c[k]) for k in ['publicIp', 'localIp'])
    if not public.is_global or public.is_multicast:
        raise ValueError('publicIp must be a real public IPv4 address, not the example')
    if local.is_unspecified or local.is_loopback or local.is_multicast or local.is_link_local or local.is_reserved:
        raise ValueError('localIp must be the IPv4 address assigned to the VPS interface')
    if not re.fullmatch(r'[a-zA-Z0-9_.+%-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', c.get('acmeEmail', '')):
        raise ValueError('Invalid ACME email')
    if c['acmeEmail'].endswith('@example.com'):
        raise ValueError('Replace the ACME example email')
    if c.get('projectId') != 'pokesurvivor-free':
        raise ValueError('Only the existing pokesurvivor-free project is supported')
    if type(c.get('tls')) is not bool or type(c.get('allowAllAuthenticated')) is not bool:
        raise ValueError('tls and allowAllAuthenticated must be booleans')
    if not isinstance(c.get('allowedUids'), list) or any(
        not isinstance(uid, str) or not re.fullmatch(r'[^:\s]{1,128}', uid) for uid in c['allowedUids']
    ):
        raise ValueError('Invalid allowedUids')
    if not isinstance(c.get('origins'), list) or not c['origins'] or any(
        not isinstance(o, str) or not re.fullmatch(r'https://[a-z0-9.-]+(?::[0-9]{1,5})?', o) for o in c['origins']
    ):
        raise ValueError('origins must contain exact HTTPS origins without a path')
    ranges = {'credentialTtl': (600, 7200), 'relayMinPort': (1024, 65535),
              'relayMaxPort': (1024, 65535), 'totalQuota': (1, 10000), 'userQuota': (1, 100),
              'maxBps': (65536, 1000000000), 'bpsCapacity': (65536, 1000000000)}
    for key, (lo, hi) in ranges.items():
        if type(c.get(key)) is not int or not lo <= c[key] <= hi:
            raise ValueError(f'{key}: expected an integer between {lo} and {hi}')
    if c['relayMaxPort'] < c['relayMinPort'] or c['relayMaxPort'] - c['relayMinPort'] + 1 < c['totalQuota']:
        raise ValueError('Relay port range must have at least totalQuota ports')
    if any(c['relayMinPort'] <= p <= c['relayMaxPort'] for p in [3478, 5349, 8088]):
        raise ValueError('Relay range overlaps a service port')
    if c['bpsCapacity'] < c['maxBps'] or c['userQuota'] > c['totalQuota']:
        raise ValueError('Global limits must be at least the per-allocation/user limit')
    return c


def render(c, secret):
    validate(c)
    if not re.fullmatch(r'[a-f0-9]{64}', secret):
        raise ValueError('Secret must be 32 random bytes represented as 64 hex characters')
    conf = [f'listening-ip={c["localIp"]}', f'relay-ip={c["localIp"]}',
            'listening-port=3478', 'use-auth-secret', f'static-auth-secret={secret}',
            f'realm={c["turnHost"]}', 'fingerprint', 'no-stun', 'no-dtls', 'no-tcp-relay',
            'no-multicast-peers', 'no-software-attribute', 'cli=false', 'web-admin=false',
            'stale-nonce=600', 'max-allocate-lifetime=600', 'relay-threads=2',
            'log-file=stdout', 'simple-log', 'pidfile=/tmp/turnserver.pid']
    if c['publicIp'] != c['localIp']:
        conf.append(f'external-ip={c["publicIp"]}/{c["localIp"]}')
    for setting, key in [('min-port', 'relayMinPort'), ('max-port', 'relayMaxPort'),
                         ('total-quota', 'totalQuota'), ('user-quota', 'userQuota'),
                         ('max-bps', 'maxBps'), ('bps-capacity', 'bpsCapacity')]:
        conf.append(f'{setting}={c[key]}')
    conf.extend('denied-peer-ip=' + address for address in DENIED)
    if c['tls']:
        conf.extend(['tls-listening-port=5349', 'cert=/certs/fullchain.pem', 'pkey=/certs/privkey.pem'])
    else:
        conf.append('no-tls')
    broker = {key: c[key] for key in ['turnHost', 'projectId', 'origins', 'allowedUids',
                                     'allowAllAuthenticated', 'credentialTtl', 'tls']}
    # Only the HTTPS API uses Caddy; TURN sockets bypass HTTP proxies entirely.
    caddy = f'''{{
    email {c['acmeEmail']}
    admin off
    servers {{
        protocols h1 h2
    }}
}}
{c['apiHost']} {{
    @api path /v1/ice
    handle @api {{
        reverse_proxy credentials:8088 {{
            header_up X-Real-IP {{remote_host}}
        }}
    }}
    handle {{
        respond "Not found" 404
    }}
}}
'''
    return '\n'.join(conf) + '\n', json.dumps(broker, indent=2) + '\n', caddy


def write_private(path, value):
    # Runtime material never goes into source control. Restrict before writing.
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    os.chmod(path, 0o600)
    with os.fdopen(fd, 'w', encoding='utf-8', newline='\n') as f:
        f.write(value)


def prepare(settings, output=ROOT):
    c = validate(settings)
    uid = os.getuid() if hasattr(os, 'getuid') else 1000
    gid = os.getgid() if hasattr(os, 'getgid') else 1000
    if uid == 0 or gid == 0:
        raise ValueError('Run prepare.py as a non-root deployment user and group (without sudo)')
    output = Path(output)
    runtime = output / 'runtime'
    runtime.mkdir(mode=0o700, parents=True, exist_ok=True)
    os.chmod(runtime, 0o700)
    for name in ['caddy-data', 'caddy-config']:
        directory = runtime / name
        directory.mkdir(mode=0o700, exist_ok=True)
        os.chmod(directory, 0o700)
    certs = output / 'certs'
    certs.mkdir(mode=0o700, exist_ok=True)
    os.chmod(certs, 0o700)
    if c['tls'] and any(not (certs / name).is_file() for name in ['fullchain.pem', 'privkey.pem']):
        raise ValueError('TLS selected: install the TURN hostname certificate/key in certs/ first')
    secret_file = runtime / 'auth-secret'
    secret = secret_file.read_text(encoding='utf-8').strip() if secret_file.exists() else secrets.token_hex(32)
    conf, broker, caddy = render(c, secret)
    for name, value in [('auth-secret', secret + '\n'), ('turnserver.conf', conf),
                        ('broker.json', broker), ('Caddyfile', caddy)]:
        write_private(runtime / name, value)
    # Non-root containers use the owner of the files. Windows is for preparation
    # tests only: regenerate on the target Linux VPS before starting Compose.
    write_private(output / '.env', f'DEPLOY_UID={uid}\nDEPLOY_GID={gid}\n')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--settings', type=Path, default=ROOT / 'settings.json')
    parser.add_argument('--check', action='store_true', help='Validate only; write nothing')
    args = parser.parse_args()
    try:
        config = json.loads(args.settings.read_text(encoding='utf-8-sig'))
        validate(config)
        if not args.check:
            prepare(config)
        print('Settings valid.' if args.check else 'Prepared runtime files. No service started; no secrets printed.')
    except (OSError, ValueError, KeyError, TypeError) as exc:
        raise SystemExit(f'Preparation failed: {exc}')
