#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Datos de los juegos originales para el nivel permanente de cada Pokémon.

    python tools/fetch_moves.py

Baja UNA vez las tablas CSV de PokeAPI (su repositorio de GitHub, a
tools/cache/pokeapi-csv/) y genera, para los Pokémon de js/data/pokedex.js:

  js/data/moves-gen.js     catálogo de movimientos convertidos al juego
  js/data/learnsets.js     qué aprende cada Pokémon por nivel y por MT
  js/data/abilities.js     habilidades (normales y oculta) con su texto
  js/data/pokedex-ext.js   stats base completos, ritmo de crecimiento,
                           tablas de experiencia y naturalezas

Reglas (ver el plan de cambios):
  - Lista de aprendizaje: la de NIVEL del juego más reciente en que sale el
    Pokémon (Escarlata/Púrpura, si no Espada/Escudo, DBPR, USUL...). Se
    saltan Leyendas Arceus, Let's Go y Champions (listas incompletas o raras).
    Los de nivel 0 (al evolucionar) cuentan como nivel 1: aquí no se evoluciona.
  - MT: lo que aprende por máquina en ese mismo juego.
  - Cada movimiento de daño se convierte en una de las formas de atacar del
    juego (projectile, melee, beam...). Los 64 de js/data/moves.js son los
    "curados": se usan tal cual y sirven de plantilla para los demás.
  - Los de estado sólo entran si tienen un efecto claro (STATUS más abajo);
    el resto no se crea y desaparece de las listas.

El juego los carga en dev.html (js/data/moves.js une moves-gen.js al catálogo).
"""
import csv
import json
import os
import re
import subprocess
import urllib.request
from collections import Counter, defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CSV_DIR = os.path.join(ROOT, 'tools', 'cache', 'pokeapi-csv')
CSV_URL = 'https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/'
DATA = os.path.join(ROOT, 'js', 'data')
TABLES = ['pokemon_moves', 'moves', 'move_names', 'move_meta', 'move_meta_stat_changes',
          'move_flag_map', 'pokemon_stats', 'pokemon_species', 'pokemon_abilities',
          'abilities', 'ability_names', 'ability_flavor_text', 'version_groups',
          'natures', 'nature_names', 'experience', 'types']

ES, EN = '7', '9'
# Juegos (version groups) por orden de preferencia: el más reciente primero.
VG_ORDER = ['25', '20', '23', '18', '17', '16', '15', '14', '11', '10', '9', '8',
            '7', '6', '5', '4', '3', '2', '1']
VG_NAME = {'25': 'Escarlata/Púrpura', '20': 'Espada/Escudo', '23': 'DBPR', '18': 'USUL',
           '17': 'Sol/Luna', '16': 'ROZA', '15': 'X/Y', '14': 'N2/B2', '11': 'Negro/Blanco',
           '10': 'HGSS', '9': 'Platino', '8': 'Diamante/Perla', '7': 'RFVH', '6': 'Esmeralda',
           '5': 'Rubí/Zafiro', '4': 'Cristal', '3': 'Oro/Plata', '2': 'Amarillo', '1': 'Rojo/Azul'}
LEVEL_UP, MACHINE = '1', '4'
CLASS = {'1': 'st', '2': 'p', '3': 's'}            # estado, físico, especial
STAT = {'1': 'hp', '2': 'atk', '3': 'def', '4': 'spa', '5': 'spd', '6': 'spe', '7': 'acc', '8': 'eva'}

# Para escalar el daño: potencia "de referencia" de un movimiento sin potencia
# fija (Movimiento Sísmico, Patada Baja, Fisura...).
VARIABLE_POWER = 60
OHKO_POWER = 120

# ---------------------------------------------------------------------------
# Movimientos de ESTADO que sí se crean (efectos claros; el resto no existe).
#   buff    al propio Pokémon, acumulable mientras está activo (como ahora)
#           stat: atk (físico) · spa (especial) · def · spe (velocidad) · regen
#   debuff  aura alrededor: los enemigos cercanos...
#           weak   pegan menos         armor  reciben más daño
#           slow   van más lentos      poison / burn  sufren daño con el tiempo
#   hazard  trampas en el suelo (como Púas): slow o daño
#   weather invoca un clima del juego unos segundos (sistema G.Weather)
# Los que podrían romper el juego van rebajados: dormir/paralizar = frenar.
# ---------------------------------------------------------------------------
B = lambda stat, amount=0.10: {'k': 'buff', 'stat': stat, 'amount': amount}
D = lambda eff, amount: {'k': 'debuff', 'eff': eff, 'amount': amount}
STATUS = {
    # --- potenciadores ---
    'swords-dance': B('atk', 0.13), 'howl': B('atk', 0.07), 'work-up': B('atk', 0.08),
    'growth': B('atk', 0.08), 'bulk-up': B('atk', 0.09), 'hone-claws': B('atk', 0.08),
    'meditate': B('atk', 0.07), 'sharpen': B('atk', 0.07), 'coaching': B('atk', 0.08),
    'dragon-dance': B('atk', 0.10), 'shift-gear': B('spe', 0.10), 'shell-smash': B('atk', 0.16),
    'nasty-plot': B('spa', 0.13), 'calm-mind': B('spa', 0.09), 'quiver-dance': B('spa', 0.10),
    'tail-glow': B('spa', 0.13), 'geomancy': B('spa', 0.14), 'take-heart': B('spa', 0.09),
    'harden': B('def', 0.07), 'withdraw': B('def', 0.07), 'defense-curl': B('def', 0.07),
    'iron-defense': B('def', 0.10), 'acid-armor': B('def', 0.10), 'barrier': B('def', 0.10),
    'cotton-guard': B('def', 0.13), 'amnesia': B('def', 0.10), 'cosmic-power': B('def', 0.09),
    'stockpile': B('def', 0.08), 'shelter': B('def', 0.10), 'stuff-cheeks': B('def', 0.08),
    'agility': B('spe', 0.10), 'rock-polish': B('spe', 0.10), 'autotomize': B('spe', 0.10),
    'aqua-ring': B('regen', 0.9), 'ingrain': B('regen', 1.0), 'recover': B('regen', 1.2),
    'roost': B('regen', 1.1), 'synthesis': B('regen', 1.0), 'moonlight': B('regen', 1.0),
    'morning-sun': B('regen', 1.0), 'soft-boiled': B('regen', 1.2), 'slack-off': B('regen', 1.2),
    'milk-drink': B('regen', 1.2), 'shore-up': B('regen', 1.1), 'wish': B('regen', 0.9),
    'rest': B('regen', 1.4), 'life-dew': B('regen', 0.9), 'jungle-healing': B('regen', 1.0),
    # --- auras contra los enemigos de alrededor ---
    'growl': D('weak', 0.10), 'charm': D('weak', 0.16), 'baby-doll-eyes': D('weak', 0.12),
    'feather-dance': D('weak', 0.14), 'tickle': D('weak', 0.12), 'play-nice': D('weak', 0.10),
    'noble-roar': D('weak', 0.12), 'parting-shot': D('weak', 0.12), 'memento': D('weak', 0.18),
    'sand-attack': D('weak', 0.08), 'smokescreen': D('weak', 0.08), 'flash': D('weak', 0.08),
    'kinesis': D('weak', 0.08), 'sweet-scent': D('weak', 0.08), 'confide': D('weak', 0.08),
    'leer': D('armor', 0.10), 'tail-whip': D('armor', 0.10), 'screech': D('armor', 0.16),
    'metal-sound': D('armor', 0.14), 'fake-tears': D('armor', 0.14), 'tearful-look': D('weak', 0.12),
    'scary-face': D('slow', 0.30), 'cotton-spore': D('slow', 0.30), 'string-shot': D('slow', 0.25),
    'thunder-wave': D('slow', 0.40), 'stun-spore': D('slow', 0.40), 'glare': D('slow', 0.40),
    'sleep-powder': D('slow', 0.45), 'spore': D('slow', 0.50), 'hypnosis': D('slow', 0.45),
    'sing': D('slow', 0.40), 'lovely-kiss': D('slow', 0.45), 'grass-whistle': D('slow', 0.40),
    'yawn': D('slow', 0.35), 'dark-void': D('slow', 0.50), 'confuse-ray': D('slow', 0.30),
    'supersonic': D('slow', 0.25), 'sweet-kiss': D('slow', 0.30), 'teeter-dance': D('slow', 0.30),
    'poison-powder': D('poison', 1), 'poison-gas': D('poison', 1), 'toxic': D('poison', 2),
    'will-o-wisp': D('burn', 1),
    # --- trampas en el suelo ---
    'spikes': {'k': 'hazard', 'eff': 'dmg'}, 'toxic-spikes': {'k': 'hazard', 'eff': 'poison'},
    'stealth-rock': {'k': 'hazard', 'eff': 'dmg'}, 'sticky-web': {'k': 'hazard', 'eff': 'slow'},
    # --- climas (los del juego, G.Weather) ---
    'sunny-day': {'k': 'weather', 'w': 'sun'}, 'rain-dance': {'k': 'weather', 'w': 'rain'},
    'sandstorm': {'k': 'weather', 'w': 'sand'}, 'hail': {'k': 'weather', 'w': 'snow'},
    'snowscape': {'k': 'weather', 'w': 'snow'}, 'chilly-reception': {'k': 'weather', 'w': 'snow'},
}

# Movimientos de daño famosos con una forma elegida a mano (los demás, por reglas).
KIND_OVERRIDE = {
    'surf': 'nova', 'earthquake': 'aura', 'magnitude': 'aura', 'fissure': 'aura',
    'thunder': 'meteor', 'blizzard': 'cone', 'fire-blast': 'projectile', 'hurricane': 'orbit',
    'solar-beam': 'beam', 'solar-blade': 'melee', 'hyper-beam': 'beam', 'giga-impact': 'dash',
    'explosion': 'nova', 'self-destruct': 'nova', 'misty-explosion': 'nova',
    'stone-edge': 'meteor', 'draco-meteor': 'meteor', 'leaf-tornado': 'orbit',
    'whirlpool': 'orbit', 'sand-tomb': 'orbit', 'magma-storm': 'orbit', 'infestation': 'orbit',
    'bind': 'melee', 'wrap': 'melee', 'clamp': 'melee', 'thunder-cage': 'orbit',
    'sludge-wave': 'nova', 'boomburst': 'nova', 'lava-plume': 'nova', 'parabolic-charge': 'aura',
    'earth-power': 'meteor', 'precipice-blades': 'meteor', 'origin-pulse': 'nova',
    'u-turn': 'boomerang', 'volt-switch': 'chain', 'flip-turn': 'boomerang',
    'air-cutter': 'boomerang', 'air-slash': 'boomerang', 'leaf-blade': 'melee',
    'shadow-sneak': 'dash', 'extreme-speed': 'dash', 'flare-blitz': 'dash', 'brave-bird': 'dash',
    'wild-charge': 'dash', 'double-edge': 'dash', 'take-down': 'dash', 'head-smash': 'dash',
    'fly': 'dash', 'bounce': 'meteor', 'dig': 'trail', 'dive': 'trail', 'rollout': 'trail',
    'ice-ball': 'trail', 'steamroller': 'trail', 'mortal-spin': 'aura', 'rapid-spin': 'aura',
    'icicle-crash': 'meteor', 'rock-tomb': 'meteor', 'rock-wrecker': 'meteor', 'diamond-storm': 'nova',
    'seed-bomb': 'projectile', 'egg-bomb': 'projectile', 'sludge-bomb': 'projectile',
    'petal-dance': 'orbit', 'petal-blizzard': 'orbit', 'outrage': 'aura', 'thrash': 'aura',
    'twister': 'orbit', 'ominous-wind': 'orbit', 'silver-wind': 'orbit', 'bleakwind-storm': 'orbit',
    'heat-wave': 'nova', 'icy-wind': 'cone', 'dragon-breath': 'cone', 'flame-burst': 'nova',
    'fire-pledge': 'trail', 'water-pledge': 'trail', 'grass-pledge': 'trail', 'fire-lash': 'melee',
    'mystical-fire': 'cone', 'searing-shot': 'nova', 'ice-shard': 'projectile',
}

# Forma de atacar -> stat de la carta que lo hace evolucionar (como en moves.js).
EVO_NEED = {'projectile': 'atk', 'melee': 'atk', 'beam': 'atk', 'dash': 'spd', 'trail': 'spd',
            'orbit': 'rgn', 'aura': 'rgn', 'nova': 'cd', 'cone': 'cd', 'boomerang': 'cd',
            'chain': 'cd', 'mine': 'cd', 'meteor': 'cd', 'turret': 'cd'}


# ---------------------------------------------------------------------------

def ensure_csv():
    os.makedirs(CSV_DIR, exist_ok=True)
    for t in TABLES:
        path = os.path.join(CSV_DIR, t + '.csv')
        if not os.path.exists(path):
            print('  bajando', t)
            req = urllib.request.Request(CSV_URL + t + '.csv', headers={'User-Agent': 'pokesurvivor/1.0'})
            with urllib.request.urlopen(req, timeout=120) as r, open(path, 'wb') as f:
                f.write(r.read())


def rows(name):
    with open(os.path.join(CSV_DIR, name + '.csv'), encoding='utf-8', newline='') as f:
        yield from csv.DictReader(f)


def our_dex():
    """Los Pokémon del juego (los que tienen sprite), sacados de pokedex.js."""
    out = {}
    with open(os.path.join(DATA, 'pokedex.js'), encoding='utf-8') as f:
        for line in f:
            line = line.strip().rstrip(',')
            if line.startswith('{"dex"'):
                p = json.loads(line)
                out[p['dex']] = p
    return out


def curated():
    """Los 64 movimientos hechos a mano en js/data/moves.js (vía Node)."""
    js = ("global.G={};eval(require('fs').readFileSync(process.argv[1],'utf8'));"
          "const out={};for(const m of G.Moves.ALL){const o=Object.assign({},m);delete o.ups;delete o.def;out[m.id]=o}"
          "const types=['normal','fire','water','grass','electric','ice','fighting','poison','ground','flying',"
          "'psychic','bug','rock','ghost','dragon','dark','steel','fairy'];"
          "const start={};for(const t of types)start[t]=G.Moves.startFor({types:[t]});"
          "process.stdout.write(JSON.stringify({moves:out,evo:G.Moves.EVO,start}))")
    r = subprocess.run(['node', '-e', js, os.path.join(DATA, 'moves.js')],
                       capture_output=True, text=True, encoding='utf-8', check=True)
    return json.loads(r.stdout)


def names(table, key, lang):
    out = {}
    for r in rows(table):
        if r['local_language_id'] == lang:
            out[r[key]] = r['name']
    return out


# ---------------------------------------------------------------------------

def main():
    ensure_csv()
    dex = our_dex()
    cur = curated()
    CUR, START = cur['moves'], cur['start']
    print(f'{len(dex)} Pokémon del juego · {len(CUR)} movimientos curados')

    types = {r['id']: r['identifier'] for r in rows('types')}
    mv = {r['id']: r for r in rows('moves')}
    by_ident = {r['identifier']: r['id'] for r in mv.values()}
    meta = {r['move_id']: r for r in rows('move_meta')}
    flags = defaultdict(set)
    for r in rows('move_flag_map'):
        flags[r['move_id']].add(int(r['move_flag_id']))
    stat_chg = defaultdict(list)
    for r in rows('move_meta_stat_changes'):
        stat_chg[r['move_id']].append((STAT.get(r['stat_id']), int(r['change'])))
    mname_es, mname_en = names('move_names', 'move_id', ES), names('move_names', 'move_id', EN)

    # --- listas de aprendizaje: el juego más reciente con movimientos por nivel ---
    per = defaultdict(lambda: defaultdict(lambda: {'lv': {}, 'tm': set()}))
    for r in rows('pokemon_moves'):
        pid = int(r['pokemon_id'])
        if pid not in dex or r['version_group_id'] not in VG_NAME:
            continue
        e = per[pid][r['version_group_id']]
        if r['pokemon_move_method_id'] == LEVEL_UP:
            lv = max(1, int(r['level'] or 1))
            e['lv'][r['move_id']] = min(lv, e['lv'].get(r['move_id'], 999))
        elif r['pokemon_move_method_id'] == MACHINE:
            e['tm'].add(r['move_id'])
    chosen = {}
    for pid in dex:
        for vg in VG_ORDER:
            if per[pid].get(vg) and per[pid][vg]['lv']:
                chosen[pid] = vg
                break
    missing = sorted(set(dex) - set(chosen))
    if missing:
        print('  ! sin lista de aprendizaje:', missing)

    # --- qué movimientos hacen falta y cómo se convierten ---
    used = set()
    for pid, vg in chosen.items():
        used |= set(per[pid][vg]['lv']) | per[pid][vg]['tm']

    def power_of(mid):
        m, me = mv[mid], meta.get(mid, {})
        pw = int(m['power']) if m['power'] else (OHKO_POWER if m['effect_id'] == '39' else VARIABLE_POWER)
        lo, hi = me.get('min_hits') or '', me.get('max_hits') or ''
        if lo and hi:                                   # golpes múltiples: lo que hace de media
            pw = round(pw * (int(lo) + int(hi)) / 2)
        return pw

    # Plantillas: los curados de daño, por forma (y su potencia original).
    tmpl = defaultdict(list)
    for cid, c in CUR.items():
        mid = by_ident.get(cid)
        if c['kind'] == 'buff' or not mid or not mv[mid]['power']:
            continue                                    # los de estado convertidos no sirven de plantilla
        tmpl[c['kind']].append((cid, power_of(mid)))

    def kind_of(mid):
        m, me, fl = mv[mid], meta.get(mid, {}), flags[mid]
        ident, t = m['identifier'], types[m['type_id']]
        if ident in KIND_OVERRIDE:
            return KIND_OVERRIDE[ident]
        contact, sound, ball, pulse, punch, bite = 1 in fl, 9 in fl, 18 in fl, 17 in fl, 8 in fl, 16 in fl
        target, prio = m['target_id'], int(m['priority'])
        multi = bool(me.get('min_hits'))
        recoil = int(me.get('drain') or 0) < 0
        trap = me.get('meta_ailment_id') == '8'
        if trap:
            return 'orbit'
        if target in ('9', '11'):                        # a todos los de alrededor
            if t in ('ground', 'rock') and not sound:
                return 'aura'
            return 'melee' if contact else 'nova'
        if contact:
            if prio > 0 or recoil:
                return 'dash'
            return 'melee'
        if re.search(r'beam|cannon|(^|-)ray$|laser|hydro', ident):
            return 'beam'
        if re.search(r'meteor|comet|fall$|drop|avalanche|stone', ident):
            return 'meteor'
        if sound:
            return 'nova'
        if re.search(r'cutter|razor|boomerang|blade', ident):
            return 'boomerang'
        if re.search(r'storm|twister|vortex|tornado|cyclone|spin', ident):
            return 'orbit'
        if re.search(r'breath|spray|jet|flamethrower|blast-burn|burn-up|scald|mist-ball', ident) and not ball:
            return 'cone'
        if t == 'electric' and m['damage_class_id'] == '3' and power_of(mid) >= 70:
            return 'chain'
        if multi:
            return 'projectile'
        if pulse:
            return 'nova' if power_of(mid) >= 80 else 'projectile'
        return 'projectile'

    def template(kind, t, pw):
        opts = tmpl.get(kind) or tmpl['projectile']
        same = [o for o in opts if CUR[o[0]]['type'] == t]
        pool = same or opts
        return min(pool, key=lambda o: abs(o[1] - pw))

    out_moves = {}
    dropped_status = Counter()
    for mid in sorted(used, key=int):
        m = mv[mid]
        ident = m['identifier']
        t = types[m['type_id']]
        cls = CLASS[m['damage_class_id']]
        nm = [mname_es.get(mid) or mname_en.get(mid) or ident, mname_en.get(mid) or ident]
        if ident in CUR:                                 # curado: tal cual
            c = dict(CUR[ident])
            o = {'n': nm, 't': c['type'], 'c': cls, 'pw': power_of(mid) if m['power'] else 0, 'k': c['kind'], 'cur': 1}
            out_moves[ident] = o
            continue
        if cls == 'st':
            if ident not in STATUS:
                dropped_status[ident] += 1
                continue
            out_moves[ident] = dict({'n': nm, 't': t, 'c': 'st'}, **STATUS[ident])
            continue
        pw = power_of(mid)
        kind = kind_of(mid)
        base_id, base_pw = template(kind, t, pw)
        base = CUR[base_id]
        ratio = max(0.6, min(1.8, (pw / base_pw) ** 0.7))
        o = {'n': nm, 't': t, 'c': cls, 'pw': pw, 'k': kind, 'tpl': base_id,
             'dmg': round(base['dmg'] * ratio, 1)}
        if not m['power']:
            o['var'] = 1                                 # potencia variable o fija (se ha supuesto una)
        fl, me = flags[mid], meta.get(mid, {})
        # Datos originales para que cada movimiento se note distinto en el juego
        # (js/data/moves.js: ritmo, tamaño, efectos propios y aspecto).
        o['pp'] = int(m['pp'] or 0)
        o['acc'] = int(m['accuracy'] or 0)               # 0 = nunca falla (Rapidez, Golpe Aéreo...)
        if int(m['priority']):
            o['pri'] = int(m['priority'])
        lo_h, hi_h = me.get('min_hits') or '', me.get('max_hits') or ''
        if lo_h and hi_h and int(hi_h) > 1:
            o['hits'] = [int(lo_h), int(hi_h)]
        f = ''.join(ch for fid, ch in ((1, 'c'), (8, 'p'), (9, 's'), (16, 'b'), (17, 'u'), (18, 'l')) if fid in fl)
        if f:
            o['fl'] = f                                  # c contacto · p puño · s sonido · b mordisco · u pulso · l bomba
        # Sube TUS stats al golpear (categoría 7 con subida): Nitrocarga, Puño Incremento...
        if me.get('meta_category_id') == '7':
            ups = [(st, ch) for st, ch in stat_chg.get(mid, []) if ch > 0]
            if ups:
                o['up'] = [ups[0][0], int(me.get('stat_chance') or 0) or 100]
        cd_mul = 1.0
        if 3 in fl:
            cd_mul *= 1.4                                # Hiperrayo: recarga
        if 2 in fl:
            cd_mul *= 1.3                                # Rayo Solar: carga
        if m['effect_id'] == '39':
            cd_mul *= 1.5                                # Fisura y compañía: fuerte pero lento
        if ident in ('explosion', 'self-destruct', 'misty-explosion', 'final-gambit', 'memento'):
            cd_mul *= 2.0
            o['self'] = 0.15                             # se hace daño (no se debilita)
        if cd_mul != 1.0:
            o['cdm'] = round(cd_mul, 2)
        # Efectos sacados de los datos (los que el juego sabe hacer, o hará en la fase 3).
        ail, ach = me.get('meta_ailment_id', '0'), int(me.get('ailment_chance') or 0)
        if ail in ('4',) and (ach >= 10 or me.get('meta_category_id') == '4'):
            o['burn'] = 1
        elif ail in ('5',) and (ach >= 10 or me.get('meta_category_id') == '4'):
            o['poison'] = 1
        elif ail in ('1', '3', '2') and ach >= 10:
            o['slow'] = 0.4                              # parálisis / congelación / sueño: frenar
        if int(me.get('flinch_chance') or 0) >= 10:
            o['knock'] = 60
        drain = int(me.get('drain') or 0)
        if drain > 0:
            o['drain'] = round(drain / 100, 2)
        elif drain < 0:
            o['recoil'] = round(-drain / 100, 2)
        if int(me.get('crit_rate') or 0) > 0:
            o['crit'] = 0.12
        # Sólo si baja los stats del ENEMIGO (categoría 6, "daño + bajar"); los que
        # bajan los tuyos (Sofoco, A Bocajarro, Cometa Draco: categoría 7) no.
        for st, ch in stat_chg.get(mid, []) if me.get('meta_category_id') == '6' else []:
            if ch < 0 and int(me.get('stat_chance') or 0) >= 10:
                if st == 'spe':
                    o['slow'] = max(o.get('slow', 0), 0.3)
                elif st in ('atk', 'spa'):
                    o['weak'] = 0.1
                elif st in ('def', 'spd'):
                    o['armor'] = 0.1
        out_moves[ident] = o

    # Evolución de los movimientos generados: se convierte en el más fuerte de su
    # mismo tipo y forma (si no hay, en el más fuerte de su tipo y clase).
    damaging = {i: o for i, o in out_moves.items() if o.get('pw') and o['k'] != 'buff'}
    # Como destino de evolución no valen los raros: golpe fulminante, autodestrucción,
    # carga/recarga o potencia variable.
    targets = {i: o for i, o in damaging.items() if not (o.get('var') or o.get('self') or o.get('cdm'))}
    for ident, o in damaging.items():
        if o.get('cur'):
            continue                                    # los curados ya tienen su evolución en moves.js
        better = [(x['pw'], i) for i, x in targets.items()
                  if i != ident and x['t'] == o['t'] and x['k'] == o['k'] and x['pw'] > o['pw']]
        if not better:
            better = [(x['pw'], i) for i, x in targets.items()
                      if i != ident and x['t'] == o['t'] and x['c'] == o['c'] and x['pw'] > o['pw']]
        evo_name = out_moves[max(better)[1]]['n'] if better else [o['n'][0] + ' +', o['n'][1] + ' +']
        o['evo'] = [evo_name, EVO_NEED.get(o['k'], 'atk')]

    keep = set(out_moves)
    move_ids = sorted(keep)
    idx = {m: i for i, m in enumerate(move_ids)}
    ident_of = {mid: mv[mid]['identifier'] for mid in mv}

    learn, tms, src, fixed = {}, {}, {}, []
    is_dmg = lambda i: out_moves[i]['c'] != 'st'
    for pid in sorted(chosen):
        e = per[pid][chosen[pid]]
        lv = sorted(((l, ident_of[m]) for m, l in e['lv'].items() if ident_of[m] in keep), key=lambda x: (x[0], x[1]))
        # Todos tienen que poder atacar desde el Nv. 1 (Magikarp, Abra, Metapod...):
        # se adelanta su primer movimiento de daño o, si no tiene, el de inicio de su tipo.
        if not any(l <= 1 and is_dmg(i) for l, i in lv):
            first = next((i for l, i in lv if is_dmg(i)), None)
            if first:
                lv = [(1 if i == first else l, i) for l, i in lv]
            else:
                lv.insert(0, (1, START[dex[pid]['types'][0]]))
            lv.sort(key=lambda x: (x[0], x[1]))
            fixed.append(dex[pid]['name'])
        learn[pid] = [[l, idx[i]] for l, i in lv]
        tms[pid] = sorted(idx[ident_of[m]] for m in e['tm'] if ident_of[m] in keep)
        src[pid] = int(chosen[pid])

    # --- habilidades ---
    ab_es, ab_en = names('ability_names', 'ability_id', ES), names('ability_names', 'ability_id', EN)
    ab_ident = {r['id']: r['identifier'] for r in rows('abilities')}
    flavor = {}
    vg_rank = {vg: i for i, vg in enumerate(['27', '26'] + VG_ORDER)}
    for r in rows('ability_flavor_text'):
        if r['language_id'] not in (ES, EN):
            continue
        k = (r['ability_id'], r['language_id'])
        rank = vg_rank.get(r['version_group_id'], 99)
        if k not in flavor or rank < flavor[k][0]:
            flavor[k] = (rank, ' '.join(r['flavor_text'].split()))
    dex_ab = {}
    used_ab = set()
    for r in rows('pokemon_abilities'):
        pid = int(r['pokemon_id'])
        if pid not in dex:
            continue
        slot = dex_ab.setdefault(pid, [None, None, None])
        i = 2 if r['is_hidden'] == '1' else (0 if r['slot'] == '1' else 1)
        slot[i] = ab_ident[r['ability_id']]
        used_ab.add(r['ability_id'])
    abilities = {}
    for aid in sorted(used_ab, key=int):
        ident = ab_ident[aid]
        abilities[ident] = {
            'n': [ab_es.get(aid) or ab_en.get(aid) or ident, ab_en.get(aid) or ident],
            'd': [flavor.get((aid, ES), (0, ''))[1], flavor.get((aid, EN), (0, ''))[1]],
        }

    # --- stats completos, crecimiento, experiencia y naturalezas ---
    stats = defaultdict(dict)
    for r in rows('pokemon_stats'):
        pid = int(r['pokemon_id'])
        if pid in dex:
            stats[pid][STAT[r['stat_id']]] = int(r['base_stat'])
    growth = {int(r['id']): int(r['growth_rate_id']) for r in rows('pokemon_species') if int(r['id']) in dex}
    exp = defaultdict(list)
    for r in rows('experience'):
        exp[int(r['growth_rate_id'])].append((int(r['level']), int(r['experience'])))
    exp_tables = {g: [x for _, x in sorted(v)] for g, v in exp.items()}
    nat_es, nat_en = names('nature_names', 'nature_id', ES), names('nature_names', 'nature_id', EN)
    natures = []
    for r in rows('natures'):
        up, down = STAT[r['increased_stat_id']], STAT[r['decreased_stat_id']]
        natures.append({'id': r['identifier'], 'n': [nat_es.get(r['id'], r['identifier']), nat_en.get(r['id'], r['identifier'])],
                        'up': None if up == down else up, 'down': None if up == down else down})

    # --- escribir ---
    J = lambda o: json.dumps(o, ensure_ascii=False, separators=(',', ':'))
    head = lambda name, what: [f'/* ============ {name} — GENERADO, no editar a mano ============',
                               ' * Lo produce tools/fetch_moves.py con los datos de PokeAPI (una sola vez).',
                               *[' * ' + w for w in what], ' */']

    write('moves-gen.js', head('moves-gen.js', [
        'Movimientos originales convertidos al juego (js/data/moves.js los une al catálogo).',
        'n [es, en] · t tipo · c p/s/st (físico, especial, estado) · pw potencia original',
        'k forma de atacar · tpl curado que sirve de plantilla · dmg daño · cdm × recarga',
        'cur = usa el de js/data/moves.js tal cual · evo [nombre, carta que lo evoluciona]',
        'pp · acc (0 = nunca falla) · pri prioridad · hits [mín, máx] · fl banderas (c contacto,',
        'p puño, s sonido, b mordisco, u pulso, l bomba) · up [stat, %] sube tus stats al golpear',
        'Estado: k buff/debuff/hazard/weather (ver STATUS en tools/fetch_moves.py).']) + [
        'G.MOVES_GEN = {'] + [f'  {J(i)}:{J(out_moves[i])},' for i in move_ids] + ['};', ''])

    write('learnsets.js', head('learnsets.js', [
        'G.MOVE_IDS: lista de movimientos (los números de abajo son posiciones en ella).',
        'G.LEARN[dex]: [[nivel, movimiento], ...] por nivel · G.TM[dex]: los que aprende por MT.',
        'G.LEARN_SRC[dex]: juego del que sale la lista (id de version group de PokeAPI).']) + [
        'G.MOVE_IDS = ' + J(move_ids) + ';',
        'G.LEARN = {'] + [f'  {pid}:{J(learn[pid])},' for pid in sorted(learn)] + ['};',
        'G.TM = {'] + [f'  {pid}:{J(tms[pid])},' for pid in sorted(tms)] + ['};',
        'G.LEARN_SRC = ' + J({p: src[p] for p in sorted(src)}) + ';', ''])

    write('abilities.js', head('abilities.js', [
        'G.ABILITIES[id]: { n: [es, en], d: [texto es, texto en] }',
        'G.DEX_ABIL[dex]: [habilidad 1, habilidad 2 o null, oculta o null]']) + [
        'G.ABILITIES = {'] + [f'  {J(i)}:{J(abilities[i])},' for i in sorted(abilities)] + ['};',
        'G.DEX_ABIL = {'] + [f'  {pid}:{J(dex_ab[pid])},' for pid in sorted(dex_ab)] + ['};', ''])

    write('pokedex-ext.js', head('pokedex-ext.js', [
        'G.DEX_STATS[dex]: [PS, Ataque, Defensa, At. Esp., Def. Esp., Velocidad, ritmo de crecimiento]',
        'G.EXP_TABLE[ritmo]: experiencia total para cada nivel (1..100), como en los juegos',
        'G.NATURES: { id, n: [es, en], up, down } (up/down null = neutra)']) + [
        'G.DEX_STATS = {'] + [f'  {pid}:{J([stats[pid][s] for s in ("hp", "atk", "def", "spa", "spd", "spe")] + [growth[pid]])},'
                              for pid in sorted(stats)] + ['};',
        'G.EXP_TABLE = ' + J(exp_tables) + ';',
        'G.NATURES = ' + J(natures) + ';', ''])

    # --- informe ---
    kinds = Counter('curado' if o.get('cur') else o['k'] for o in out_moves.values())
    print(f'\nMovimientos en el catálogo: {len(out_moves)} (de {len(used)} que aparecen en las listas)')
    print('  por forma:', dict(sorted(kinds.items(), key=lambda x: -x[1])))
    print(f'  de estado sin crear: {len(dropped_status)}')
    print('  juego de origen:', dict(Counter(VG_NAME[str(v)] for v in src.values()).most_common()))
    ln = [len(v) for v in learn.values()]
    tn = [len(v) for v in tms.values()]
    print(f'  por nivel: media {sum(ln) / len(ln):.1f} (mín {min(ln)}, máx {max(ln)}) · MT: media {sum(tn) / len(tn):.1f}')
    print(f'  habilidades distintas: {len(abilities)}')
    print(f'  sin ataque a Nv. 1 (arreglados): {len(fixed)}:', ', '.join(fixed))


def write(name, lines):
    path = os.path.join(DATA, name)
    with open(path, 'w', encoding='utf-8', newline='\n') as f:
        f.write('\n'.join(lines))
    print(f'  {name}: {os.path.getsize(path) / 1024:.0f} KB')


if __name__ == '__main__':
    main()
