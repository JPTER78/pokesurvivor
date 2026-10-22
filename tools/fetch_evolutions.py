#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Baja una sola vez las cadenas de evolucion de PokeAPI y las deja en
js/data/evolutions.js. A partir de ahi el juego no toca internet.

    python tools/fetch_evolutions.py

Solo guarda las evoluciones entre Pokemon que estan en el juego (pokedex.js):
si falta una fase intermedia (Tranquill, Dolliv) se une el abuelo con el nieto.
Lo usan los aliados (systems/allies.js): evolucionan al subir de nivel.

  G.EVOS[dex]  sus evoluciones (las que hace un aliado)
  G.PREVO[dex] su pre-evolucion (tambien las de forma regional: para saber en
               que fase va y de que familia es)
"""
import json
import os
import re
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor

API = 'https://pokeapi.co/api/v2'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEX = os.path.join(ROOT, 'js', 'data', 'pokedex.js')
OUT = os.path.join(ROOT, 'js', 'data', 'evolutions.js')
MAX_CHAIN = 600          # hay ~550 cadenas; las que no existen dan 404
# Evoluciones que solo hace una forma regional (Corsola de Galar -> Cursola...)
# o que no existen (Phione no evoluciona: Manaphy solo esta en su cadena). La
# cadena de PokeAPI no dice de que forma viene cada una, por eso van a mano.
REGIONAL = {(52, 863), (222, 864), (264, 862), (211, 904), (550, 902), (215, 903), (562, 867), (194, 980)}
NOT_EVOS = {(489, 490)}


def get(url, retries=3):
    for _ in range(retries):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'pokesurvivor/1.0'})
            with urllib.request.urlopen(req, timeout=40) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None
        except Exception:
            pass
    return None


def species_id(node):
    return int(node['species']['url'].rstrip('/').split('/')[-1])


def walk(node, out, in_game, anc=None):
    """Une cada Pokemon del juego con su antepasado mas cercano que tambien este."""
    me = species_id(node)
    if me in in_game:
        if anc is not None:
            out.add((anc, me))
        anc = me
    for child in node['evolves_to']:
        walk(child, out, in_game, anc)


def main():
    with open(DEX, encoding='utf-8') as f:
        in_game = {int(d) for d in re.findall(r'"dex":(\d+)', f.read())}
    with ThreadPoolExecutor(16) as pool:
        chains = list(pool.map(lambda i: get(f'{API}/evolution-chain/{i}/'), range(1, MAX_CHAIN + 1)))
    pairs = set()
    for c in chains:
        if c:
            walk(c['chain'], pairs, in_game)
    pairs -= NOT_EVOS
    evos, prevo = {}, {}
    for d, k in sorted(pairs):
        prevo[k] = d
        if (d, k) not in REGIONAL:
            evos.setdefault(d, []).append(k)
    js = lambda m: '{' + ','.join(f'{k}:{json.dumps(v, separators=(",", ":"))}' for k, v in sorted(m.items())) + '}'
    with open(OUT, 'w', encoding='utf-8', newline='\r\n') as f:
        f.write('/* ============ evolutions.js — GENERADO, no editar a mano ============\n'
                ' * Lo produce tools/fetch_evolutions.py (PokeAPI, una sola vez).\n'
                ' * G.EVOS[dex]  = sus evoluciones directas (sólo las que están en el juego).\n'
                ' * G.PREVO[dex] = su pre-evolución (también las de forma regional).\n'
                ' */\n'
                'G.EVOS = ' + js(evos) + ';\n'
                'G.PREVO = ' + js(prevo) + ';\n')
    print(f'ok: {len(evos)} Pokemon con evolucion, {len(prevo)} con pre-evolucion -> {os.path.relpath(OUT, ROOT)}')


if __name__ == '__main__':
    main()
