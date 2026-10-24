#!/bin/sh
# Disposable Linux CI host only. Never run over a production deployment.
set -eu
cd "$(dirname "$0")/.."
trap 'docker compose down --remove-orphans' EXIT
python3 - <<'PY'
import json
import socket
from pathlib import Path
from prepare import prepare

config = json.loads(Path('settings.example.json').read_text())
with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
    s.connect(('8.8.8.8', 53))
    local_ip = s.getsockname()[0]
config.update(turnHost='turn.test.net', apiHost='ice.test.net',
              publicIp='8.8.8.8', localIp=local_ip, acmeEmail='admin@test.net')
prepare(config)
PY
docker compose config --quiet
docker compose build --pull
docker compose up -d --wait --wait-timeout 90 credentials
# Validate the actual generated HTTPS configuration without requesting certificates.
docker compose run --rm --no-deps https caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
# Use HTTP only for the isolated smoke test: no public DNS or ACME credentials.
cat > runtime/Caddyfile <<'CADDY'
:80 {
    reverse_proxy credentials:8088 {
        header_up X-Real-IP {remote_host}
    }
}
CADDY
docker compose up -d --wait --wait-timeout 90
sleep 3
for service in coturn credentials https; do
    container_id=$(docker compose ps -q "$service")
    test -n "$container_id"
    test "$(docker inspect -f '{{.RestartCount}}' "$container_id")" = 0
    test "$(docker inspect -f '{{.HostConfig.ReadonlyRootfs}}' "$container_id")" = true
    docker compose exec -T "$service" sh -ec '
        test "$(id -u)" != 0
        test "$(id -g)" != 0
        grep -Eq "^CapEff:[[:space:]]+0+$" /proc/1/status
        grep -Eq "^NoNewPrivs:[[:space:]]+1$" /proc/1/status
        if touch /etc/hardening-must-not-write 2>/dev/null; then exit 1; fi
    '
    # A manual .env/user override to root must also fail closed at entry.
    if docker compose run --rm --no-deps --user 0:0 "$service"; then
        echo "Root override unexpectedly accepted for $service" >&2
        exit 1
    fi
done
test "$(curl --silent --output /dev/null --write-out '%{http_code}' --retry 5 --retry-connrefused --retry-delay 1 \
    -X POST -H 'Origin: https://pokesurvivor.com' http://127.0.0.1/v1/ice)" = 401
python3 - <<'PY'
import json
import subprocess
config = json.loads(subprocess.check_output(['docker', 'compose', 'config', '--format', 'json']))
assert not config['services']['credentials'].get('ports'), 'API port must not be published'
for name in ['credentials', 'https']:
    assert config['services'][name].get('network_mode') != 'host'
PY
echo 'Docker smoke checks passed; real TURN/ACME tests remain required.'
