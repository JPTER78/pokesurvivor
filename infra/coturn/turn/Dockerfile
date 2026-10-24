FROM coturn/coturn:4.18.0-r0-alpine
# The entrypoint uses configured IPv4 addresses; DNS diagnostic tools are unused.
RUN apk upgrade --no-cache && apk del --no-cache bind-tools
USER 1000:1000
