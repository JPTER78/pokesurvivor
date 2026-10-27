"""
make_skins.py — disfraces de Halloween pintados en las hojas de sprites.

Para cada skin (core/skins.js) copia las hojas del Pokémon (normal y shiny) a
  assets/pokemon/{dex}/k-{skin}/{Anim}.png        (y k-{skin}/s/ las shiny)
con el sombrero y la capa de bruja dibujados en cada fotograma y cada
dirección, a partir de la silueta de ese fotograma. Así encajan siempre: el
sombrero apoyado en la coronilla, la capa siguiendo el cuerpo (delante de él
si se ve de espaldas o de lado, detrás si mira hacia ti).

Las hojas nuevas llevan un margen (PAD_X a los lados, PAD_T arriba) para que
quepa el sombrero; el juego suma ese margen a la geometría de sprites-meta.js.

Usa también los -Offsets.png de SpriteCollab (cara y centro del cuerpo de cada
fotograma; se guardan en tools/cache/skins/).

Uso: python tools/make_skins.py
"""
import io
import os
import sys

from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fetch_sprites import BASE, FALLBACK, fetch, parse_animdata, resolve  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, 'tools', 'cache', 'skins')
META = os.path.join(ROOT, 'js', 'data', 'sprites-meta.js')

PAD_X, PAD_T = 8, 16          # (los mismos que G.Skins.PAD_X / PAD_T)

# neck: dónde empieza la capa (parte del alto, de la coronilla a los pies);
# len: hasta dónde llega (parte de lo que queda hasta los pies) ·
# under_face: nunca por encima de la boca · flare: cuánto se abre por abajo ·
# quad: cuadrúpedo (en diagonal de espaldas, como de lado: sólo sobre el lomo) ·
# head: dónde va el sombrero respecto a la cara, por dirección (si no, se calcula: crown) ·
# clasp: broche de frente · sink: cuánto se hunde el ala en la cabeza.
SKINS = {
    'bruja-gengar':  dict(dex=94,  hat='big',   sink=2, cape=dict(neck=0.28, len=0.95, under_face=False, flare=3, clasp=False)),
    'bruja-pikachu': dict(dex=25,  hat='small', sink=2, cape=None),
    # Umbreon y Kecleon: el centro del cráneo, marcado a mano por dirección (entre
    # las orejas / la cresta; desde la cara, en su Idle). Sigue a la cara en cada fotograma.
    'bruja-umbreon': dict(dex=197, hat='small', sink=2, cape=None,
                          head=[(0, -9), (-1, -8), (-2, -7), (-2, -6), (0, -7), (2, -6), (2, -7), (1, -8)]),
    'hat':           dict(dex=352, hat='small', sink=2, cape=None,
                          head=[(0, -11), (-2, -11), (-5, -10), (-5, -8), (0, -6), (5, -8), (5, -10), (2, -11)]),
}

ANIMS = ['Idle', 'Walk', 'Attack', 'Shoot', 'Charge', 'Hurt', 'Faint']
BACK, SIDE = {3, 4, 5}, {2, 6}
FACE_X = [0, 1, 1, 1, 0, -1, -1, -1]       # hacia dónde mira en x, por fila

K = (0x1b, 0x15, 0x28, 255)                # contorno (el de los iconos)
PUR, PUR_L, PUR_D = (0x3d, 0x22, 0x66, 255), (0x6a, 0x40, 0xa8, 255), (0x26, 0x13, 0x3f, 255)
ORA, ORA_D, YEL = (0xff, 0x8a, 0x2a, 255), (0xc4, 0x5a, 0x12, 255), (0xff, 0xd2, 0x3f, 255)
PAL = {'k': K, 'p': PUR, 'l': PUR_L, 'o': ORA, 'y': YEL, 'd': ORA_D}

HAT_BIG = ['........kk.....', '.......kpk.....', '......kplk.....', '......kpplk....', '.....kppplk....',
           '.....kpppplk...', '....kppppplk...', '....koooyook...', '.kkkpppppppkkk.', 'kpppppppppppplk', '.kkkkkkkkkkkkk.']
HAT_SMALL = ['.....kk....', '....kpk....', '....kplk...', '...kpplk...', '...kppplk..',
             '..kooyook..', 'kkpppppppkk', '.kkkkkkkkk.']
CLASP = ['kk.kk', 'kpopk', 'kk.kk']


# ---------------- datos de SpriteCollab (cara y cuerpo por fotograma) ----------------

def cached(dex, name):
    os.makedirs(os.path.join(CACHE, str(dex)), exist_ok=True)
    p = os.path.join(CACHE, str(dex), name)
    if not os.path.exists(p):
        data = fetch(f'{BASE}/{str(dex).zfill(4)}/{name}')
        if data is None:
            return None
        with open(p, 'wb') as f:
            f.write(data)
    with open(p, 'rb') as f:
        return f.read()


def game_meta(dex):
    import json
    import re
    src = open(META, encoding='utf8').read()
    return json.loads(re.search(r'\n  %d: (\{.*\}),?\n' % dex, src).group(1))


def offsets(dex, anim, g):
    """[fila][fotograma] -> (cara, cuerpo) en píxeles del fotograma, o None."""
    xml = cached(dex, 'AnimData.xml')
    anims, _ = parse_animdata(xml.decode('utf8'))
    src = geom = None
    for cand in [anim] + FALLBACK[anim]:
        src, geom = resolve(anims, cand)
        if geom:
            break
    png = geom and cached(dex, f'{src}-Offsets.png')
    if not png:
        return None
    im = Image.open(io.BytesIO(png)).convert('RGBA')
    px, (W, H) = im.load(), im.size
    out = []
    for r in range(g['r']):
        row, last = [], None
        for f in range(g['n']):
            face = body = None
            for y in range(r * g['h'], min(H, r * g['h'] + g['h'])):
                for x in range(f * g['w'], min(W, f * g['w'] + g['w'])):
                    p = px[x, y]
                    if p[3] < 200:
                        continue
                    if p[:3] == (0, 0, 0):
                        face = (x - f * g['w'], y - r * g['h'])
                    elif p[:3] == (0, 255, 0):
                        body = (x - f * g['w'], y - r * g['h'])
            face = face or (last and last[0])
            body = body or (last and last[1]) or face
            last = (face, body) if face else last
            row.append((face, body))
        out.append(row)
    return out


# ---------------- pintar ----------------

def stamp(img, rows, x0, y0, flip=False):
    """Dibuja un dibujo de filas de letras con su esquina en (x0, y0)."""
    w = len(rows[0])
    for j, line in enumerate(rows):
        for i in range(w):
            ch = line[w - 1 - i if flip else i]
            if ch == '.':
                continue
            x, y = x0 + i, y0 + j
            if 0 <= x < img.width and 0 <= y < img.height:
                img.putpixel((x, y), PAL[ch])


def runs(mask, y, W):
    out, x = [], 0
    while x < W:
        if mask(x, y):
            s = x
            while x < W and mask(x, y):
                x += 1
            out.append((s, x - 1))
        else:
            x += 1
    return out


def crown(mask, W, H, face):
    """Coronilla: el centro de la cabeza a la altura de la cara, y lo más alto de
    la silueta en esas columnas (la más baja de tres, para no posarse en un pincho)."""
    ys = [y for y in range(H) for x in range(W) if mask(x, y)]
    if not ys:
        return None
    top = min(ys)
    if face:
        fx, fy = face
    else:
        xs = [x for x in range(W) for y in range(top, top + 4) if mask(x, y)]
        fx, fy = sum(xs) / len(xs), top + 4
    hc = None
    for yy in [int(fy) - 1, int(fy), int(fy) - 2, int(fy) + 1]:
        rr = runs(mask, max(0, min(H - 1, yy)), W)
        if rr:
            best = min(rr, key=lambda r: 0 if r[0] <= fx <= r[1] else min(abs(fx - r[0]), abs(fx - r[1])))
            hc = round((best[0] + best[1]) / 2)
            break
    if hc is None:
        hc = round(fx)
    tops = []
    for c in (hc - 1, hc, hc + 1):
        t = next((y for y in range(H) if mask(c, y)), None)
        if t is not None:
            tops.append(t)
    return (hc, max(tops)) if tops else (hc, top)


def paint_frame(fr, row, frame_i, anim, sk, face, body):
    """fr: fotograma ya con margen (RGBA). Lo modifica."""
    W, H = fr.size
    px = fr.load()
    sprite = [[px[x, y][3] > 0 for y in range(H)] for x in range(W)]
    mask = lambda x, y: 0 <= x < W and 0 <= y < H and sprite[x][y]
    if face:
        face = (face[0] + PAD_X, face[1] + PAD_T)
    if body:
        body = (body[0] + PAD_X, body[1] + PAD_T)
    if sk.get('head') and face:
        dx, dy = sk['head'][row]
        cr = (round(face[0] + dx), round(face[1] + dy))
    else:
        cr = crown(mask, W, H, face)
    if not cr:
        return
    hx, hy = cr
    fx = FACE_X[row]
    back, side = row in BACK, row in SIDE
    c = sk['cape']
    if c and c.get('quad') and row in (3, 5):
        back, side = False, True
    if c and anim != 'Faint':
        feet = max(y for y in range(H) for x in range(W) if sprite[x][y])
        neck = round(hy + c['neck'] * (feet - hy))
        if c['under_face'] and face:
            neck = max(neck, round(face[1]) + 1)
        hem = min(feet - 1, round(neck + c['len'] * (feet - neck)))
        if hem - neck >= 4:
            xs_ = body[0] if body else hx
            cape = set()
            for y in range(neck, hem + 1):
                t = (y - neck) / max(1, hem - neck)
                d = round(1 + c['flare'] * t)
                # Sólo el tronco: el tramo de la fila que pasa por el centro del cuerpo
                # (o el más cercano), no los brazos ni la cola sueltos.
                rr = runs(mask, y, W)
                if rr:
                    rr = [min(rr, key=lambda q: 0 if q[0] <= xs_ <= q[1] else min(abs(xs_ - q[0]), abs(xs_ - q[1])))]
                for a, b in rr:
                    l, r = a - d, b + d
                    if not (back or side) and fx:          # en diagonal, se abre más hacia atrás
                        if fx > 0:
                            l -= 2; r -= 1
                        else:
                            r += 2; l += 1
                    for x in range(l, r + 1):
                        if side and (x - xs_) * fx > 0:   # de lado, sólo la mitad de atrás
                            continue
                        cape.add((x, y))
            # El bajo en picos (al andar se mueven).
            ph = frame_i % 3 if anim == 'Walk' else 0
            cape = {(x, y) for (x, y) in cape if not (y == hem and (x + ph) % 3 == 0)}
            if not (back or side):                            # de frente, detrás del cuerpo
                cape = {p for p in cape if not mask(*p)}
            if cape:
                lx = {}
                for (x, y) in cape:
                    lx.setdefault(y, [x, x])
                    lx[y][0] = min(lx[y][0], x); lx[y][1] = max(lx[y][1], x)
                for (x, y) in cape:
                    if not (0 <= x < W and 0 <= y < H):
                        continue
                    a, b = lx[y]
                    if back or side:
                        if y == neck:
                            col = ORA
                        elif y == neck + 1:
                            col = PUR_D
                        else:
                            k = (x - a) % 4
                            col = PUR_L if k == 1 else PUR_D if k == 3 else PUR
                    else:
                        # Detrás: lo pegado al cuerpo es el forro naranja; el borde, morado.
                        near = mask(x - 1, y) or mask(x + 1, y) or mask(x, y - 1)
                        col = ORA if near and y > neck + 1 else PUR if (x + y) % 5 else PUR_L
                    px[x, y] = col
                # Contorno.
                edge = set()
                for (x, y) in cape:
                    for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                        if (nx, ny) in cape or not (0 <= nx < W and 0 <= ny < H):
                            continue
                        if not (back or side) and mask(nx, ny):
                            continue
                        edge.add((nx, ny))
                for p in edge:
                    px[p] = K
        if c.get('clasp') and not (back or side) and face:
            stamp(fr, CLASP, round(face[0]) - 2, neck - 1)

    hat = HAT_BIG if sk['hat'] == 'big' else HAT_SMALL
    w, h = len(hat[0]), len(hat)
    stamp(fr, hat, hx - w // 2, hy + sk['sink'] - h + 1, flip=fx < 0)


def make(skin, sk):
    dex = sk['dex']
    m = game_meta(dex)
    done = 0
    for shiny in (False, True):
        if shiny and not m.get('sh'):
            continue
        for anim in ANIMS:
            g = (m.get('sa') or {}).get(anim) if shiny else None
            g = g or m['a'].get(anim)
            if not g or (shiny and anim in (m.get('sm') or [])):
                continue
            src = os.path.join(ROOT, 'assets', 'pokemon', str(dex), 's' if shiny else '', anim + '.png')
            if not os.path.exists(src):
                continue
            sheet = Image.open(src).convert('RGBA')
            off = offsets(dex, anim, g)
            W, H = g['w'] + 2 * PAD_X, g['h'] + PAD_T
            out = Image.new('RGBA', (W * g['n'], H * g['r']))
            for r in range(g['r']):
                for f in range(g['n']):
                    fr = Image.new('RGBA', (W, H))
                    fr.alpha_composite(sheet.crop((f * g['w'], r * g['h'], (f + 1) * g['w'], (r + 1) * g['h'])), (PAD_X, PAD_T))
                    face, body = off[r][f] if off and r < len(off) and f < len(off[r]) else (None, None)
                    paint_frame(fr, r, f, anim, sk, face, body)
                    out.alpha_composite(fr, (f * W, r * H))
            dst = os.path.join(ROOT, 'assets', 'pokemon', str(dex), 'k-' + skin, 's' if shiny else '')
            os.makedirs(dst, exist_ok=True)
            out.save(os.path.join(dst, anim + '.png'), optimize=True)
            done += 1
    print(skin, dex, done, 'hojas')


def main():
    for skin, sk in SKINS.items():
        make(skin, sk)


if __name__ == '__main__':
    main()
