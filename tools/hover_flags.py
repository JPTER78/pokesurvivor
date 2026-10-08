#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Marca qué Pokémon FLOTAN de verdad en su sprite (y por tanto pueden pasar por
encima de rocas y agua) y cuáles caminan aunque sean de tipo Volador.

    python tools/hover_flags.py

Mira el primer fotograma de Idle (mirando abajo) de cada Pokémon: si el pixel
opaco más bajo queda claramente por encima del ancla del suelo (la sombra),
es que flota. Añade "hv":1 a esos Pokémon en js/data/sprites-meta.js.
"""
import io
import json
import os
import re

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
META = os.path.join(ROOT, 'js', 'data', 'sprites-meta.js')
ASSETS = os.path.join(ROOT, 'assets', 'pokemon')
GAP = 1          # píxeles de arte entre los pies y el suelo (los que caminan dan <= -0,5)

LINE = re.compile(r'^(\s*)(\d+): (\{.*\}),\s*$')


def gap_of(dex, idle):
    path = os.path.join(ASSETS, str(dex), 'Idle.png')
    if not os.path.exists(path):
        return 0
    im = Image.open(path).convert('RGBA')
    w, h = idle['w'], idle['h']
    frame = im.crop((0, 0, w, h))
    alpha = frame.getchannel('A')
    bbox = alpha.point(lambda a: 255 if a > 40 else 0).getbbox()
    if not bbox:
        return 0
    bottom = bbox[3] - 1                     # fila del pixel opaco más bajo
    return idle['ay'] - bottom


def main():
    with io.open(META, encoding='utf-8') as f:
        lines = f.read().split('\n')
    out, hovering = [], []
    for ln in lines:
        m = LINE.match(ln)
        if not m:
            out.append(ln)
            continue
        dex = int(m.group(2))
        data = json.loads(m.group(3))
        data.pop('hv', None)
        idle = data['a'].get('Idle') or data['a'].get('Walk')
        if idle and gap_of(dex, idle) >= GAP:
            data['hv'] = 1
            hovering.append(dex)
        out.append(f"{m.group(1)}{dex}: {json.dumps(data, separators=(',', ':'))},")
    text = '\n'.join(out)
    if ' *                 hv=1 si flota' not in text:
        text = text.replace(' *                 sm animaciones que le faltan al shiny',
                            ' *                 sm animaciones que le faltan al shiny\n'
                            ' *                 hv=1 si flota en su sprite (tools/hover_flags.py):\n'
                            ' *                 pasa por encima de rocas y agua')
    with io.open(META, 'w', encoding='utf-8', newline='\n') as f:
        f.write(text)
    print(f'{len(hovering)} Pokémon flotan')
    return hovering


if __name__ == '__main__':
    h = main()
    for d in [6, 12, 16, 41, 81, 92, 93, 94, 109, 151, 722, 18, 142, 249, 384]:
        print(d, 'flota' if d in h else 'camina')
