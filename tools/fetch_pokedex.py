#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Baja una sola vez los datos de PokeAPI y los deja en js/data/pokedex.js.
A partir de ahi el juego no toca internet: todo es local.

    python tools/fetch_pokedex.py

Trae nombre en espanol, tipos, stats base y altura, y de ahi deriva los stats
del juego y la rareza para el gacha.
"""
import io
import json
import os
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor

API = 'https://pokeapi.co/api/v2'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'js', 'data', 'pokedex.js')

STARTERS = {1, 4, 7, 152, 155, 158, 252, 255, 258, 387, 390, 393, 495, 498, 501,
            650, 653, 656, 722, 725, 728, 810, 813, 816, 906, 909, 912, 54, 79}
# Último Pokémon de cada generación.
GEN_END = [151, 251, 386, 493, 649, 721, 809, 905, 1025]


def gen_of(dex):
    for g, end in enumerate(GEN_END, 1):
        if dex <= end:
            return g
    return 9


def dexes_with_sprites():
    """Sólo los que tienen sprite de Mundo Misterioso (según SpriteCollab)."""
    url = 'https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/tracker.json'
    req = urllib.request.Request(url, headers={'User-Agent': 'pokesurvivor/1.0'})
    t = json.load(urllib.request.urlopen(req, timeout=120))
    need = {'Idle', 'Walk', 'Attack'}
    return [d for d in range(1, 1026) if need <= set(t.get(f'{d:04d}', {}).get('sprite_files', {}))]


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


def rarity(bst, dex, is_legendary, is_mythical):
    """5 estrellas = legendarios y pseudolegendarios; 1 = los mas comunes."""
    if is_mythical or is_legendary:
        return 5
    if bst >= 580:
        return 5
    if bst >= 495:
        return 4
    if bst >= 410:
        return 3
    if bst >= 320:
        return 2
    return 1


def one(dex):
    p = get(f'{API}/pokemon/{dex}')
    s = get(f'{API}/pokemon-species/{dex}')
    if not p or not s:
        print(f'  ! {dex} no disponible')
        return None

    base = {st['stat']['name']: st['base_stat'] for st in p['stats']}
    bst = sum(base.values())

    name_es = p['name'].capitalize()
    for n in s.get('names', []):
        if n['language']['name'] == 'es':
            name_es = n['name']
            break

    # --- stats del juego a partir de los stats base ---
    hp = round(70 + base['hp'] * 0.45)
    spd = round(78 + base['speed'] * 0.42)
    atk = round(0.70 + max(base['attack'], base['special-attack']) / 100 * 0.55, 2)

    return {
        'dex': dex,
        'name': name_es,
        'slug': p['name'],
        'types': [t['type']['name'] for t in p['types']],
        'hp': hp,
        'spd': spd,
        'atk': atk,
        'bst': bst,
        'height': p['height'],
        'rarity': rarity(bst, dex, s.get('is_legendary'), s.get('is_mythical')),
        'starter': dex in STARTERS,
        'gen': gen_of(dex),
        'leg': bool(s.get('is_legendary') or s.get('is_mythical')),
    }


def main():
    DEXES = dexes_with_sprites()
    print(f'Bajando {len(DEXES)} Pokemon de PokeAPI...')
    rows = []
    with ThreadPoolExecutor(max_workers=10) as ex:
        for i, r in enumerate(ex.map(one, DEXES), 1):
            if r:
                rows.append(r)
            if i % 100 == 0 or i == len(DEXES):
                print(f'  {i}/{len(DEXES)}')

    rows.sort(key=lambda r: r['dex'])

    lines = [
        '/* ============ pokedex.js — GENERADO, no editar a mano ============',
        ' * Lo produce tools/fetch_pokedex.py. Los datos se bajaron una vez de',
        ' * PokeAPI y viven aqui: el juego no hace ninguna peticion a internet.',
        ' *',
        ' * hp/spd/atk son stats de juego derivados de los stats base.',
        ' * rarity 1-5 para el gacha · gen = generación (banner) · starter = test',
        ' * leg = legendario o singular (sólo salen en las grietas)',
        ' */',
        'G.DEX = [',
    ]
    for r in rows:
        o = {
            'dex': r['dex'], 'name': r['name'], 'types': r['types'],
            'hp': r['hp'], 'spd': r['spd'], 'atk': r['atk'],
            'rarity': r['rarity'], 'bst': r['bst'],
            'starter': r['starter'], 'gen': r['gen'],
        }
        if r['leg']:
            o['leg'] = True
        lines.append('  ' + json.dumps(o, ensure_ascii=False, separators=(',', ':')) + ',')
    lines += [
        '];',
        '',
        'G.DEX_BY = {};',
        'for (const p of G.DEX) G.DEX_BY[p.dex] = p;',
        'G.getPokemon = dex => G.DEX_BY[dex];',
        '',
    ]
    with io.open(OUT, 'w', encoding='utf-8', newline='\n') as f:
        f.write('\n'.join(lines))

    print(f'\n{len(rows)} Pokemon escritos en js/data/pokedex.js')
    print('\nrareza por generacion (1* 2* 3* 4* 5*):')
    for g in range(1, 10):
        c = [sum(1 for x in rows if x['gen'] == g and x['rarity'] == r) for r in range(1, 6)]
        print(f'  gen {g}: {c}  total {sum(c)}')


if __name__ == '__main__':
    main()
