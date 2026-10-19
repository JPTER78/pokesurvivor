#!/usr/bin/env python3
"""Servidor local para probar el juego (dev.html), también a través de un túnel.

    python tools/serve.py            -> http://ps.localhost:8766/dev.html
    python tools/serve.py 8770       -> otro puerto

`python -m http.server` sólo deja 5 conexiones en cola: dev.html pide unos 110
ficheros a la vez y, por un túnel (cloudflared), muchos se rechazaban y el juego
se quedaba en "Cargando…". Este acepta muchas a la vez (con un hilo por petición)
y no deja que el navegador guarde copias viejas de los scripts.
"""
import functools
import http.server
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8766


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Siempre la última versión de cada fichero (estás probando cambios).
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()

    def log_message(self, fmt, *args):
        pass                                   # sin una línea por cada fichero


class Server(http.server.ThreadingHTTPServer):
    request_queue_size = 256                   # (la de serie es 5)
    daemon_threads = True


if __name__ == '__main__':
    httpd = Server(('127.0.0.1', PORT), functools.partial(Handler, directory=ROOT))
    print(f'Sirviendo {ROOT}')
    print(f'  http://ps.localhost:{PORT}/dev.html   (Ctrl+C para parar)')
    httpd.serve_forever()
