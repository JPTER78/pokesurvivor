#!/bin/sh
set -eu
if [ "$(id -u)" = 0 ] || [ "$(id -g)" = 0 ]; then
    echo 'Refusing to start: configure a non-root deployment UID and GID.' >&2
    exit 1
fi
exec "$@"
