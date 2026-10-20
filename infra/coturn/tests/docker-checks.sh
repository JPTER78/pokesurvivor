#!/bin/sh
# Run only on a disposable Linux test host: the smoke test binds host ports.
set -eu
cd "$(dirname "$0")/.."
node --test tests/broker.test.mjs
python3 -m unittest discover -s tests -p 'test_*.py'
sh tests/docker-smoke.sh
docker pull aquasec/trivy:0.76.0
for service in coturn credentials https; do
    # Compose's explicit project name determines the local build tags.
    docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
        -v pokesurvivor-turn-trivy-cache:/root/.cache/trivy aquasec/trivy:0.76.0 image \
        --scanners vuln --severity HIGH,CRITICAL --exit-code 1 "pokesurvivor-turn-$service"
done
