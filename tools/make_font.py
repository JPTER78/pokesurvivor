# -*- coding: utf-8 -*-
"""Fuente del juego con números más fáciles de distinguir.

Pixelify Sans (OFL) dibuja el 2, el 5, el 8 (y la S) casi iguales, todos
redondeados. Este script saca dos versiones fijas de la fuente variable
(normal 400 y negrita 700) y redibuja los números con un mapa de píxeles de
5x7 más anguloso: el 2 con escalones, el 5 con la esquina recta, el 8
estrechado por la cintura... Las esquinas siguen recortadas como en el resto
de letras para que no desentonen.

    python tools/make_font.py   ->  assets/fonts/PixelifyPS-400.ttf y -700.ttf

Necesita fontTools (pip install fonttools). La fuente cambia de nombre
("Pixelify PS"), como pide la licencia OFL para versiones modificadas.
"""
import os, unicodedata
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.pens.transformPen import TransformPen

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
SRC = os.path.join(ROOT, 'assets', 'fonts', 'PixelifySans.ttf')
OUT = os.path.join(ROOT, 'assets', 'fonts', 'PixelifyPS-{}.ttf')
FAMILY = 'Pixelify PS'

# 5 columnas x 7 filas, de arriba abajo. '#' = píxel.
DIGITS = {
    'zero':  ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
    'two':   ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
    'three': ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
    'four':  ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
    'five':  ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
    'six':   ['..##.', '.#...', '#....', '####.', '#...#', '#...#', '.###.'],
    'seven': ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
    'eight': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
    'nine':  ['.###.', '#...#', '#...#', '.####', '....#', '...#.', '.##..'],
}


def add_vietnamese(font):
    """Añade las vocales y tonos vietnamitas que faltan en Pixelify Sans."""
    glyf, hmtx = font['glyf'], font['hmtx']
    cmap = font.getBestCmap()
    order = list(font.getGlyphOrder())

    def rect(pen, x0, y0, x1, y1):
        pen.moveTo((x0, y0)); pen.lineTo((x0, y1)); pen.lineTo((x1, y1)); pen.lineTo((x1, y0)); pen.closePath()

    def put_glyph(cp, name, g, adv):
        if name not in order:
            order.append(name)
            font.setGlyphOrder(order)
        g.recalcBounds(glyf)
        glyf[name] = g
        hmtx[name] = (adv, g.xMin if g.numberOfContours else 0)
        cmap[cp] = name
        for t in font['cmap'].tables:
            t.cmap[cp] = name

    # 1. Marcas combinables que faltan: gancho arriba (0309), cuerno (031B) y punto abajo (0323).
    p_hook = TTGlyphPen(glyf)
    rect(p_hook, 95, 625, 195, 675)
    rect(p_hook, 145, 570, 195, 625)
    rect(p_hook, 105, 524, 155, 570)
    put_glyph(0x0309, 'hookabovecomb', p_hook.glyph(), 0)

    p_dot = TTGlyphPen(glyf)
    rect(p_dot, 99, -175, 201, -74)
    put_glyph(0x0323, 'dotbelowcomb', p_dot.glyph(), 0)

    p_horn = TTGlyphPen(glyf)
    rect(p_horn, 480, 390, 560, 460)
    rect(p_horn, 525, 450, 605, 535)
    put_glyph(0x031B, 'horncomb', p_horn.glyph(), 0)

    def combine(base_name, mark_name, dx, dy):
        gset = font.getGlyphSet()
        pen = TTGlyphPen(gset)
        gset[base_name].draw(pen)
        gset[mark_name].draw(TransformPen(pen, (1, 0, 0, 1, dx, dy)))
        return pen.glyph()

    # 2. Vocales con cuerno: Ơ (01A0), ơ (01A1), Ư (01AF), ư (01B0).
    for cp, name, bname, dy in [(0x01A0, 'Ohorn', 'O', 180), (0x01A1, 'ohorn', 'o', 0),
                                (0x01AF, 'Uhorn', 'U', 180), (0x01B0, 'uhorn', 'u', 0)]:
        put_glyph(cp, name, combine(bname, 'horncomb', 0, dy), hmtx[bname][0])

    # 3. Todas las vocales vietnamitas precompuestas (1EA0..1EF9).
    mark_for = {0x0300: 'gravecomb', 0x0301: 'acutecomb', 0x0302: 'uni0302', 0x0303: 'tildecomb',
                0x0306: 'uni0306', 0x0309: 'hookabovecomb', 0x0323: 'dotbelowcomb'}
    for cp in range(0x1EA0, 0x1EFA):
        if cp in cmap:
            continue
        dec = unicodedata.decomposition(chr(cp)).split()
        if len(dec) != 2:
            continue
        b_cp, m_cp = int(dec[0], 16), int(dec[1], 16)
        bname = 'dotlessi' if (b_cp == 0x69 and m_cp != 0x0323 and 'dotlessi' in glyf) else cmap.get(b_cp)
        mname = mark_for.get(m_cp)
        if not bname or not mname:
            continue
        bg, mg = glyf[bname], glyf[mname]
        bg.recalcBounds(glyf); mg.recalcBounds(glyf)
        dx = round((bg.xMin + bg.xMax) / 2 - (mg.xMin + mg.xMax) / 2)
        dy = 0 if m_cp == 0x0323 else round(bg.yMax + 74 - mg.yMin)
        put_glyph(cp, f'uni{cp:04X}', combine(bname, mname, dx, dy), hmtx[bname][0])

    font.setGlyphOrder(order)


def build(weight):
    font = instancer.instantiateVariableFont(TTFont(SRC), {'wght': weight})
    glyf, hmtx = font['glyf'], font['hmtx']
    # Caja de los números de la fuente original (la del 0) y grosor de su trazo.
    z = glyf['zero']
    coords = z.getCoordinates(glyf)[0]
    xs = sorted(set(x for x, _ in coords))
    ys = sorted(set(y for _, y in coords))
    x0, x1, y0, y1 = xs[0], xs[-1], ys[0], ys[-1]
    stroke = xs[2] - xs[0]                    # p. ej. 60 -> 161 en la normal
    cw, ch = (x1 - x0) / 5, (y1 - y0) / 7
    bleed = max(0, (stroke - cw) / 2)        # la negrita tiene el trazo más gordo que un píxel
    for name, rows in DIGITS.items():
        pen = TTGlyphPen(glyf)
        for r, row in enumerate(rows):
            c = 0
            while c < 5:
                if row[c] != '#':
                    c += 1
                    continue
                c2 = c
                while c2 + 1 < 5 and row[c2 + 1] == '#':
                    c2 += 1
                # Tramo horizontal de píxeles (con algo de grosor extra en la negrita),
                # sin salirse de la caja original.
                ax = round(max(x0, x0 + c * cw - bleed))
                bx = round(min(x1, x0 + (c2 + 1) * cw + bleed))
                top = round(min(y1, y1 - r * ch + bleed))
                bot = round(max(y0, y1 - (r + 1) * ch - bleed))
                pen.moveTo((ax, bot)); pen.lineTo((ax, top)); pen.lineTo((bx, top)); pen.lineTo((bx, bot))
                pen.closePath()
                c = c2 + 1
        g = pen.glyph()
        g.recalcBounds(glyf)
        glyf[name] = g
        hmtx[name] = (hmtx[name][0], g.xMin)
    add_vietnamese(font)
    # Nombre nuevo (OFL: una versión modificada no debe llamarse igual).
    style = 'Regular' if weight == 400 else 'Bold'
    for rec in font['name'].names:
        if rec.nameID in (1, 16):
            rec.string = FAMILY
        elif rec.nameID == 4:
            rec.string = FAMILY + ' ' + style
        elif rec.nameID == 6:
            rec.string = FAMILY.replace(' ', '') + '-' + style
        elif rec.nameID == 17:
            rec.string = style
    font.save(OUT.format(weight))
    print('ok:', os.path.basename(OUT.format(weight)), 'pixel', round(cw), 'x', round(ch), 'extra', round(bleed))


if __name__ == '__main__':
    for w in (400, 700):
        build(w)
