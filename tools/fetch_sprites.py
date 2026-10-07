#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Descarga los sprites estilo Mundo Misterioso de SpriteCollab (normal y shiny)
a assets/pokemon/ y genera js/data/sprites-meta.js.

    python tools/fetch_sprites.py            # todos los que existan (1-1025)
    python tools/fetch_sprites.py 1 151      # sólo un rango de la Pokédex

Se puede interrumpir y relanzar: lo ya bajado se reutiliza (tools/cache/).

Fuente: https://github.com/PMDCollab/SpriteCollab  (CC BY-NC 4.0)
Créditos: python tools/fetch_credits.py

Formato de SpriteCollab:
  sprite/{dex}/            sprite normal
  sprite/{dex}/0000/0001/  sprite shiny (forma 0000, variante 0001)
  - columnas = fotogramas, filas = 8 direcciones
    (Down, DownRight, Right, UpRight, Up, UpLeft, Left, DownLeft; verificado
     con los -Offsets.png)
  - cada animación tiene su propio tamaño de fotograma, así que se alinean por
    el ancla al suelo, que se saca del -Shadow.png

Las hojas se guardan como PNG con paleta (sin pérdida): ocupan la mitad.
"""
import io
import json
import os
import re
import sys
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor

from PIL import Image

RAW = 'https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master'
BASE = RAW + '/sprite'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_ASSETS = os.path.join(ROOT, 'assets', 'pokemon')
OUT_META = os.path.join(ROOT, 'js', 'data', 'sprites-meta.js')
CACHE = os.path.join(ROOT, 'tools', 'cache')

WANT = ['Idle', 'Walk', 'Attack', 'Shoot', 'Charge', 'Hurt', 'Faint']
FALLBACK = {
    'Idle': ['Walk'],
    'Walk': ['Idle'],
    'Attack': ['Strike', 'Swing', 'Shoot', 'Idle'],
    'Shoot': ['Attack', 'Strike', 'Idle'],
    'Charge': ['DeepBreath', 'Idle'],
    'Hurt': ['Cringe', 'Idle'],
    'Faint': ['Hurt', 'Idle'],
}
REQUIRED = {'Idle', 'Walk', 'Attack'}


def fetch(url, retries=4):
    last = None
    for _ in range(retries):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'pokesurvivor/1.0'})
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None
            last = e
        except Exception as e:
            last = e
    print(f'    ! {url.split("/sprite/")[-1]} -> {last}')
    return None


def parse_animdata(xml):
    anims = {}
    for blk in re.findall(r'<Anim>(.*?)</Anim>', xml, re.S):
        name = re.search(r'<Name>(\w+)</Name>', blk)
        if not name:
            continue
        name = name.group(1)
        copy = re.search(r'<CopyOf>(\w+)</CopyOf>', blk)
        if copy:
            anims[name] = {'copyOf': copy.group(1)}
            continue
        fw = re.search(r'<FrameWidth>(\d+)</FrameWidth>', blk)
        fh = re.search(r'<FrameHeight>(\d+)</FrameHeight>', blk)
        if not (fw and fh):
            continue
        durs = [int(x) for x in re.findall(r'<Duration>(\d+)</Duration>', blk)]
        anims[name] = {'w': int(fw.group(1)), 'h': int(fh.group(1)), 'n': len(durs), 'd': durs}
    shadow = re.search(r'<ShadowSize>(\d+)</ShadowSize>', xml)
    return anims, int(shadow.group(1)) if shadow else 1


def resolve(anims, name, seen=None):
    seen = seen or set()
    if name not in anims or name in seen:
        return None, None
    seen.add(name)
    a = anims[name]
    if 'copyOf' in a:
        return resolve(anims, a['copyOf'], seen)
    return name, a


def ground_anchor(png, w, h):
    try:
        im = Image.open(io.BytesIO(png)).convert('RGBA')
    except Exception:
        return None
    px = im.crop((0, 0, w, h)).load()
    xs = ys = n = 0
    for y in range(h):
        for x in range(w):
            if px[x, y][3] > 40:
                xs += x; ys += y; n += 1
    return (round(xs / n, 1), round(ys / n, 1)) if n else None


def save_optimized(png, path):
    """Guarda como PNG con paleta exacta (sin pérdida). Devuelve (ancho, alto)."""
    im = Image.open(io.BytesIO(png)).convert('RGBA')
    cols = im.getcolors(256)
    if cols is None:                          # más de 256 colores: tal cual
        im.save(path, 'PNG', optimize=True)
        return im.size
    colors = [c for _, c in cols]
    # El transparente primero: algunos lectores lo agradecen.
    colors.sort(key=lambda c: c[3])
    idx = {c: i for i, c in enumerate(colors)}
    pim = Image.new('P', im.size)
    data = im.get_flattened_data() if hasattr(im, 'get_flattened_data') else im.getdata()
    pim.putdata([idx[p] for p in data])
    flat = []
    for c in colors:
        flat += c[:3]
    pim.putpalette(flat + [0] * (768 - len(flat)))
    pim.save(path, 'PNG', optimize=True, transparency=bytes(c[3] for c in colors))
    return im.size


def download_set(url_base, out_dir, anims, geometry_from=None):
    """Baja las animaciones de WANT desde url_base. `geometry_from` reutiliza
    las anclas del sprite normal (el shiny es el mismo dibujo recoloreado)."""
    os.makedirs(out_dir, exist_ok=True)
    meta = {}
    for want in WANT:
        src, geom = None, None
        for cand in [want] + FALLBACK[want]:
            src, geom = resolve(anims, cand)
            if geom:
                break
        if not geom:
            continue
        png = fetch(f'{url_base}/{src}-Anim.png')
        if not png:
            continue
        path = os.path.join(out_dir, want + '.png')
        w, h = save_optimized(png, path)
        cols, rows = w // geom['w'], h // geom['h']
        if rows < 1 or cols < 1:
            os.remove(path)
            continue

        ref = geometry_from.get(want) if geometry_from else None
        if ref and ref['w'] == geom['w'] and ref['h'] == geom['h']:
            ax, ay = ref['ax'], ref['ay']
        else:
            sh = fetch(f'{url_base}/{src}-Shadow.png')
            anchor = ground_anchor(sh, geom['w'], geom['h']) if sh else None
            ax, ay = (anchor if anchor else (geom['w'] / 2, geom['h'] * 0.78))
        meta[want] = {'w': geom['w'], 'h': geom['h'], 'n': min(geom['n'], cols), 'r': rows,
                      'd': geom['d'][:cols], 'ax': ax, 'ay': ay}
    return meta


def do_dex(job):
    dex, want_shiny = job
    cache_file = os.path.join(CACHE, f'{dex}.json')
    out_dir = os.path.join(OUT_ASSETS, str(dex))
    if os.path.exists(cache_file):
        meta = json.load(open(cache_file, encoding='utf-8'))
        if all(os.path.exists(os.path.join(out_dir, a + '.png')) for a in meta['a']):
            return dex, meta

    tag = f'{dex:04d}'
    xml = fetch(f'{BASE}/{tag}/AnimData.xml')
    if not xml:
        return dex, None
    anims, shadow = parse_animdata(xml.decode('utf-8', 'replace'))
    normal = download_set(f'{BASE}/{tag}', out_dir, anims)
    if not REQUIRED & set(normal):
        return dex, None
    meta = {'s': shadow, 'a': normal}

    if want_shiny:
        sxml = fetch(f'{BASE}/{tag}/0000/0001/AnimData.xml')
        sanims = parse_animdata(sxml.decode('utf-8', 'replace'))[0] if sxml else anims
        shiny = download_set(f'{BASE}/{tag}/0000/0001', os.path.join(out_dir, 's'), sanims, normal)
        if REQUIRED <= set(shiny) or ('Idle' in shiny and 'Walk' in shiny):
            meta['sh'] = 1
            # Sólo se guarda la geometría shiny si difiere de la normal.
            diff = {k: v for k, v in shiny.items() if normal.get(k) != v}
            if diff:
                meta['sa'] = diff
            missing_s = [k for k in normal if k not in shiny]
            if missing_s:
                meta['sm'] = missing_s

    with open(cache_file, 'w', encoding='utf-8') as f:
        json.dump(meta, f, separators=(',', ':'))
    return dex, meta


def main():
    lo = int(sys.argv[1]) if len(sys.argv) > 1 else 1
    hi = int(sys.argv[2]) if len(sys.argv) > 2 else 1025
    os.makedirs(OUT_ASSETS, exist_ok=True)
    os.makedirs(CACHE, exist_ok=True)

    print('Leyendo tracker.json de SpriteCollab...')
    tracker = json.loads(fetch(RAW + '/tracker.json').decode('utf-8'))
    jobs = []
    for dex in range(lo, hi + 1):
        e = tracker.get(f'{dex:04d}')
        if not e or not REQUIRED <= set(e.get('sprite_files', {})):
            continue
        s = e.get('subgroups', {}).get('0000', {}).get('subgroups', {}).get('0001', {})
        jobs.append((dex, {'Idle', 'Walk'} <= set(s.get('sprite_files', {}))))
    print(f'{len(jobs)} Pokemon con sprites en {lo}-{hi} ({sum(1 for _, s in jobs if s)} con shiny)')

    metas, missing, done = {}, [], 0
    with ThreadPoolExecutor(max_workers=16) as ex:
        for dex, meta in ex.map(do_dex, jobs):
            done += 1
            if meta:
                metas[dex] = meta
            else:
                missing.append(dex)
            if done % 50 == 0 or done == len(jobs):
                print(f'  {done}/{len(jobs)}', flush=True)

    # Compatibilidad con cachés antiguas: anota qué le falta al shiny.
    for dex, m in metas.items():
        if m.get('sh') and 'sm' not in m:
            sdir = os.path.join(OUT_ASSETS, str(dex), 's')
            miss = [k for k in m['a'] if not os.path.exists(os.path.join(sdir, k + '.png'))]
            if miss:
                m['sm'] = miss

    # Funde con lo que ya hubiera en caché fuera del rango pedido.
    for fn in os.listdir(CACHE):
        d = int(fn.split('.')[0])
        if d not in metas and os.path.isdir(os.path.join(OUT_ASSETS, str(d))):
            metas[d] = json.load(open(os.path.join(CACHE, fn), encoding='utf-8'))

    lines = [
        '/* ============ sprites-meta.js — GENERADO, no editar a mano ============',
        ' * Lo produce tools/fetch_sprites.py a partir de los AnimData.xml de',
        ' * SpriteCollab. Va en un .js y no en un .json porque fetch() está',
        ' * bloqueado en file:// y el juego se abre con doble clic.',
        ' *',
        ' * Por Pokémon:    s ShadowSize · a animaciones · sh=1 si hay shiny',
        ' *                 sa geometría shiny que difiera de la normal (raro)',
        ' *                 sm animaciones que le faltan al shiny',
        ' * Por animación:  w,h fotograma · n fotogramas · r filas',
        ' *                 d duración de cada fotograma (1/60 s)',
        ' *                 ax,ay ancla al suelo dentro del fotograma',
        ' * Filas: 0 Down · 1 DownRight · 2 Right · 3 UpRight',
        ' *        4 Up   · 5 UpLeft    · 6 Left  · 7 DownLeft',
        ' */',
        'G.SPRITE_META = {',
    ]
    for dex in sorted(metas):
        lines.append(f'  {dex}: {json.dumps(metas[dex], separators=(",", ":"))},')
    lines += ['};', '']
    with io.open(OUT_META, 'w', encoding='utf-8', newline='\n') as f:
        f.write('\n'.join(lines))

    size = sum(os.path.getsize(os.path.join(dp, fn)) for dp, _, fns in os.walk(OUT_ASSETS) for fn in fns)
    print(f'\n{len(metas)} Pokemon ({sum(1 for m in metas.values() if m.get("sh"))} con shiny), {size / 1e6:.1f} MB')
    if missing:
        print(f'Fallaron ({len(missing)}): {missing}')


if __name__ == '__main__':
    main()
