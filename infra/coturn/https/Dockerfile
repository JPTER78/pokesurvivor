FROM golang:1.27.2-alpine AS builder
RUN apk add --no-cache git ca-certificates
WORKDIR /src
# Exact upstream release commit; rebuild its binary with maintained dependencies.
RUN git init && git remote add origin https://github.com/caddyserver/caddy.git \
    && git fetch --depth=1 origin 87c43dc4f54861ec7e54302cfb2ad3e34508b6dc \
    && git checkout --detach FETCH_HEAD
RUN go get golang.org/x/net@v0.60.0 \
    && CGO_ENABLED=0 go build -trimpath -o /out/caddy ./cmd/caddy

FROM caddy:2.11.7-alpine
RUN apk upgrade --no-cache
COPY --from=builder /out/caddy /usr/bin/caddy
USER 1000:1000
