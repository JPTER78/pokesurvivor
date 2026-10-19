#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Añade a js/data/pokedex.js el Ataque, Ataque Especial, Defensa y Defensa
Especial de cada Pokémon que ya está (sin cambiar nada más ni la lista).

    python tools/fetch_stats.py

  pa / sa   multiplicador de daño de sus ataques físicos / especiales (la
            misma fórmula que 'atk', que sigue siendo el mayor de los dos)
  df / sd   Defensa y Defensa Especial base, tal cual (ver G.Stats)

(tools/fetch_pokedex.py ya los trae también; esto es para no rehacer la
Pokédex entera, que cambiaría qué Pokémon hay.)
"""
import json
import os
import re
import urllib.request
from concurrent.futures import ThreadPoolExecutor

API = 'https://pokeapi.co/api/v2'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEX = os.path.join(ROOT, 'js', 'data', 'pokedex.js')


def mul(base):
    return round(0.70 + base / 100 * 0.55, 2)


def get(url, retries=4):
    for _ in range(retries):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'pokesurvivor/1.0'})
            with urllib.request.urlopen(req, timeout=40) as r:
                return json.load(r)
        except Exception:
            pass
    return None


def stats(dex):
    p = get(f'{API}/pokemon/{dex}')
    if not p:
        return dex, None
    b = {st['stat']['name']: int(st['base_stat']) for st in p['stats']}
    return dex, {'pa': mul(b['attack']), 'sa': mul(b['special-attack']), 'df': b['defense'], 'sd': b['special-defense']}


def main():
    src = open(DEX, encoding='utf-8').read()
    rows = re.findall(r'^  (\{"dex":.*\}),?$', src, re.M)
    dexes = [json.loads(r)['dex'] for r in rows]
    print(f'Bajando las estadísticas de {len(dexes)} Pokémon de PokeAPI...')
    got = {}
    with ThreadPoolExecutor(max_workers=8) as ex:
        for i, (d, s) in enumerate(ex.map(stats, dexes), 1):
            if s:
                got[d] = s
            if i % 100 == 0 or i == len(dexes):
                print(f'  {i}/{len(dexes)}')
    miss = [d for d in dexes if d not in got]
    if miss:
        raise SystemExit(f'Faltan {len(miss)} (no se cambia nada): {miss[:20]}')

    def fix(m):
        o = json.loads(m.group(1))
        for k in ('pa', 'sa', 'df', 'sd'):
            o.pop(k, None)
        # Detrás de 'atk', para que se lea junto.
        out = {}
        for k, v in o.items():
            out[k] = v
            if k == 'atk':
                out.update(got[o['dex']])
        return '  ' + json.dumps(out, ensure_ascii=False, separators=(',', ':')) + m.group(2)

    src = re.sub(r'^  (\{"dex":.*\})(,?)$', fix, src, flags=re.M)
    src = src.replace(' * hp/spd/atk son stats de juego derivados de los stats base.',
                      ' * hp/spd/atk son stats de juego derivados de los stats base.\n'
                      ' * pa/sa: daño de sus ataques físicos/especiales (atk = el mayor) · df/sd: Defensa y Defensa Especial base.', 1) \
        if ' * pa/sa' not in src else src
    open(DEX, 'w', encoding='utf-8', newline='\n').write(src)
    print('ok:', len(got), 'Pokémon con pa/sa/df/sd')


if __name__ == '__main__':
    main()
