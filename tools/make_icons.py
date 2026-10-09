# Iconos de la app (PWA, favicon, iPhone) en pixel art: Poké Ball sobre azul marino.
#   python tools/make_icons.py   -> assets/icons/*.png
import os
from PIL import Image, ImageDraw

OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'icons')
os.makedirs(OUT, exist_ok=True)

NAVY, NAVY2, K = (10, 20, 48), (26, 49, 112), (27, 21, 40)
RED, RED2, WHITE, GREY, GOLD = (232, 57, 74), (168, 30, 48), (242, 242, 242), (190, 196, 214), (255, 210, 63)

# Poké Ball de 16x16 (k contorno, r rojo, d rojo oscuro, w blanco, g gris, o centro)
BALL = [
    '.....kkkkkk.....',
    '...kkrrrrrrkk...',
    '..krrwwrrrrrrk..',
    '.krrwwrrrrrrrdk.',
    '.krwrrrrrrrrrdk.',
    'krrrrrrrrrrrrrdk',
    'krrrrrkkkkrrrrdk',
    'kkkkkkkwwkkkkkkk',
    'kwwwwwkwwkwwwwgk',
    'kwwwwwkkkkwwwwgk',
    '.kwwwwwwwwwwwgk.',
    '.kwwwwwwwwwwwgk.',
    '..kwwwwwwwwwgk..',
    '...kkggggggkk...',
    '.....kkkkkk.....',
    '................',
]
PAL = {'k': K, 'r': RED, 'd': RED2, 'w': WHITE, 'g': GREY}

def icon(size, maskable=False):
    img = Image.new('RGBA', (size, size), NAVY + (255,))
    d = ImageDraw.Draw(img)
    # Marco dorado pixelado (no en el maskable: el sistema recorta las esquinas).
    unit = size // 32
    if not maskable:
        d.rectangle([unit, unit, size - unit - 1, size - unit - 1], outline=GOLD, width=unit)
        d.rectangle([unit * 2, unit * 2, size - unit * 2 - 1, size - unit * 2 - 1], fill=NAVY2)
    # La bola ocupa la zona segura (60% en maskable, 70% si no).
    frac = 0.56 if maskable else 0.7
    px = max(1, int(size * frac / 16))
    w = px * 16
    ox, oy = (size - w) // 2, (size - w) // 2 + px // 2
    for y, row in enumerate(BALL):
        for x, ch in enumerate(row):
            if ch in PAL:
                d.rectangle([ox + x * px, oy + y * px, ox + (x + 1) * px - 1, oy + (y + 1) * px - 1], fill=PAL[ch])
    # Destellos dorados
    for cx, cy in ((0.2, 0.22), (0.8, 0.78), (0.82, 0.24)):
        x, y = int(size * cx), int(size * cy)
        s = max(1, px // 2)
        d.rectangle([x - s, y - 3 * s, x + s - 1, y + 3 * s - 1], fill=GOLD)
        d.rectangle([x - 3 * s, y - s, x + 3 * s - 1, y + s - 1], fill=GOLD)
    return img

for size in (512, 192, 180, 32):
    icon(size).save(os.path.join(OUT, f'icon-{size}.png'))
icon(512, True).save(os.path.join(OUT, 'icon-maskable-512.png'))
print('ok', os.listdir(OUT))
