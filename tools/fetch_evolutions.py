#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Baja una sola vez las cadenas de evolucion de PokeAPI y las deja en
js/data/evolutions.js (G.EVO). A partir de ahi el juego no toca internet.

    python tools/fetch_evolutions.py

Para cada Pokemon del juego (los que tienen sprite, o sea G.DEX) guarda sus
formas canonicas siguientes:

    G.EVO[dex] = [{ to, lvl, how }, ...]

  to   dex de la forma siguiente (tiene que estar en G.DEX)
  lvl  nivel de evolucion (null si no es por nivel: piedras, amistad, intercambio...)
  how  'level' o el disparador de PokeAPI ('use-item', 'trade', 'shed'...)

Las cadenas ramificadas (Eevee tiene 8, Poliwhirl 2...) se guardan enteras y el
juego decide que hacer con ellas. Solo se guardan los Pokemon que existen en el
juego, para no inventar formas sin sprite.
"""
import json
import os
import re
import urllib.error
import urllib.request
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor

API = 'https://pokeapi.co/api/v2'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEX_JS = os.path.join(ROOT, 'js', 'data', 'pokedex.js')
OUT = os.path.join(ROOT, 'js', 'data', 'evolutions.js')


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


def dex_of_game():
    """Los dex que tiene el juego (los que salen en pokedex.js)."""
    src = open(DEX_JS, encoding='utf-8').read()
    return {int(d) for d in re.findall(r'"dex":(\d+)', src)}


def species_id(url):
    """.../pokemon-species/25/ -> 25"""
    return int(url.rstrip('/').rsplit('/', 1)[1])


def how_of(node):
    """Como evoluciona un nodo: nivel (y cuanto) o el disparador que sea.

    PokeAPI da una lista de detalles (uno por grupo de versiones). Nos quedamos
    con el primero que sirva: uno por nivel con nivel, y si no, el primero.
    """
    ds = node.get('evolution_details') or []
    if not ds:
        return None, None
    for d in ds:
        t = (d.get('trigger') or {}).get('name')
        if t == 'level-up' and d.get('min_level'):
            return d['min_level'], 'level'
    d = ds[0]
    return None, (d.get('trigger') or {}).get('name') or 'level'


def walk(chain, evo):
    """Recorre el arbol de una cadena y rellena evo[origen] = [siguientes]."""
    for child in chain.get('evolves_to') or []:
        src, dst = species_id(chain['species']['url']), species_id(child['species']['url'])
        lvl, how = how_of(child)
        if how:
            evo[src].append({'to': dst, 'lvl': lvl, 'how': how})
        walk(child, evo)


def main():
    known = dex_of_game()
    print(f'Pokemon en el juego: {len(known)}')

    first = get(f'{API}/evolution-chain/?limit=1')
    total = first['count']
    print(f'Bajando {total} cadenas de evolucion de PokeAPI...')

    evo = defaultdict(list)
    missing_link = missing_dex = 0
    with ThreadPoolExecutor(max_workers=10) as ex:
        for i, c in enumerate(ex.map(lambda n: get(f'{API}/evolution-chain/{n}'), range(1, total + 1)), 1):
            if c:
                tmp = defaultdict(list)
                walk(c['chain'], tmp)
                for s, kids in tmp.items():
                    if s not in known:
                        missing_dex += 1
                        continue
                    for k in kids:
                        if k['to'] not in known:
                            missing_link += 1
                            continue
                        evo[s].append(k)
            if i % 100 == 0 or i == total:
                print(f'  {i}/{total}')

    rows = []
    for s in sorted(evo):
        kids = sorted({(k['to'], k['lvl'], k['how']) for k in evo[s]})
        rows.append('  ' + json.dumps(str(s), ensure_ascii=False) + ':[' +
                    ','.join(json.dumps({'to': t, 'lvl': l, 'how': h}, ensure_ascii=False,
                                        separators=(',', ':')) for t, l, h in kids) + '],')

    head = [
        '/* ============ evolutions.js - GENERADO, no editar a mano ============',
        ' * Lo produce tools/fetch_evolutions.py con los datos de PokeAPI.',
        ' *',
        ' * G.EVO[dexOrigen] = [{ to, lvl, how }, ...]  formas canonicas siguientes',
        ' *   to   dex de la forma siguiente (existe en G.DEX, tiene sprite)',
        ' *   lvl  nivel de evolucion canonico (null si no es por nivel)',
        ' *   how  "level" o el disparador de PokeAPI ("use-item", "trade"...)',
        ' *',
        ' * Puede haber varias (ramas: Eevee, Poliwhirl...); quien lo use decide.',
        ' * El nivel que se pide en la run es ese mismo (el canonico de los juegos).',
        ' */',
        'G.EVO = {',
    ]
    with open(OUT, 'w', encoding='utf-8', newline='\n') as f:
        f.write('\n'.join(head + rows + ['};', '']))

    linear = sum(1 for r in rows if r.count('"to"') == 1)
    print(f'ok: {len(rows)} Pokemon con evolucion ({linear} lineales, {len(rows) - linear} ramificados)')
    print(f'    enlaces saltados: {missing_link} por forma sin sprite, {missing_dex} por origen que no esta en el juego')
    print(f'    escrito en {os.path.relpath(OUT, ROOT)}')


if __name__ == '__main__':
    main()
