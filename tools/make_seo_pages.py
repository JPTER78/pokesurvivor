# Páginas para buscadores, en español y en inglés.
#   node tools/export_data.js && python tools/make_seo_pages.py
# Son páginas de texto de verdad (el juego es un canvas que Google no puede leer)
# hechas con los datos del propio juego, y enlazan al juego. Genera:
#   es: guia/ pokedex/ legendarios/ shinies/ tipos/ movimientos/ objetos/ logros/ novedades/
#   en: en/ (el juego en inglés) en/guide/ en/pokedex/ en/legendaries/ ... en/news/
#   404.html, robots.txt, sitemap.xml (con las versiones de cada idioma)
import json, os, re, datetime, html

ROOT = os.path.join(os.path.dirname(__file__), '..')
SITE = 'https://pokesurvivor.com/'
TODAY = datetime.date.today().isoformat()
D = json.load(open(os.path.join(ROOT, 'tools', 'cache', 'gamedata.json'), encoding='utf-8'))
DEX = D['dex']; BY = {p['dex']: p for p in DEX}
META = {}
for m in re.finditer(r'^\s*(\d+): (\{.*\}),?\s*$', open(os.path.join(ROOT, 'js/data/sprites-meta.js'), encoding='utf-8').read(), re.M):
    try: META[int(m.group(1))] = json.loads(m.group(2))
    except Exception: pass
esc = html.escape
N = len(DEX)

# ---------------- traducción con el diccionario del juego ----------------
EN = D['en']
PATS = []
for k, v in EN.items():
    if '{x}' in k:
        parts = [re.escape(p) for p in k.split('{x}')]
        PATS.append((re.compile('^' + '(.+?)'.join(parts) + '$'), v))
def en(s):
    if s in EN: return EN[s]
    for rx, v in PATS:
        m = rx.match(s)
        if m:
            g = iter(m.groups())
            return re.sub(r'\{x\}', lambda _: en(next(g)), v)
    return s
def L(lang, es, eng=None):
    """Texto en el idioma: 'es' tal cual; 'en' el que se da o el del diccionario."""
    return es if lang == 'es' else (eng if eng is not None else en(es))

GEN = {1: 'Kanto', 2: 'Johto', 3: 'Hoenn', 4: 'Sinnoh', 5: ('Teselia', 'Unova'), 6: 'Kalos', 7: 'Alola', 8: 'Galar', 9: 'Paldea'}
def gen_name(g, lang): v = GEN[g]; return v if isinstance(v, str) else (v[0] if lang == 'es' else v[1])
TN = D['typeName']; TC = D['typeColor']; TYPES = D['typeOrder']
def tname(t, lang): return L(lang, TN.get(t, t))
def tbadge(t, lang): return f'<i class="ty" style="background:{TC.get(t, "#888")}">{esc(tname(t, lang))}</i>'
LEG = set(D['legends'])

# ---------------- rutas ----------------
PAGES = ['home', 'guide', 'pokedex', 'legends', 'shinies', 'types', 'moves', 'items', 'achievements', 'news', 'support']
PATH = {
    'es': {'home': '', 'guide': 'guia/', 'pokedex': 'pokedex/', 'legends': 'legendarios/', 'shinies': 'shinies/', 'types': 'tipos/',
           'moves': 'movimientos/', 'items': 'objetos/', 'achievements': 'logros/', 'news': 'novedades/', 'support': 'apoyar/'},
    'en': {'home': 'en/', 'guide': 'en/guide/', 'pokedex': 'en/pokedex/', 'legends': 'en/legendaries/', 'shinies': 'en/shinies/', 'types': 'en/types/',
           'moves': 'en/moves/', 'items': 'en/items/', 'achievements': 'en/achievements/', 'news': 'en/news/', 'support': 'en/support/'},
}
NAV = {'es': [('guide', 'Guía'), ('pokedex', 'Pokédex'), ('legends', 'Legendarios'), ('moves', 'Movimientos'), ('types', 'Tipos')],
       'en': [('guide', 'Guide'), ('pokedex', 'Pokédex'), ('legends', 'Legendaries'), ('moves', 'Moves'), ('types', 'Types')]}
FOOT = {'es': [('guide', 'Guía'), ('pokedex', 'Pokédex'), ('legends', 'Legendarios y arenas'), ('shinies', 'Shinies'), ('types', 'Tabla de tipos'),
               ('moves', 'Movimientos'), ('items', 'Objetos'), ('achievements', 'Logros'), ('news', 'Novedades'), ('support', 'Apoyar el proyecto')],
        'en': [('guide', 'Guide'), ('pokedex', 'Pokédex'), ('legends', 'Legendaries & arenas'), ('shinies', 'Shinies'), ('types', 'Type chart'),
               ('moves', 'Moves'), ('items', 'Items'), ('achievements', 'Achievements'), ('news', 'News'), ('support', 'Support the project')]}

def rel(frm, to):
    """Ruta relativa entre dos páginas (las dos son carpetas)."""
    up = '../' * frm.count('/')
    return up + to if (up + to) else './'

def page(pid, lang, title, desc, body, ld=None):
    me = PATH[lang][pid]
    other = 'en' if lang == 'es' else 'es'
    up = '../' * me.count('/')
    alts = ''.join(f'<link rel="alternate" hreflang="{l}" href="{SITE}{PATH[l][pid]}">\n' for l in ('es', 'en'))
    alts += f'<link rel="alternate" hreflang="x-default" href="{SITE}{PATH["es"][pid]}">\n'
    nav = ''.join(f'<a href="{rel(me, PATH[lang][p])}">{esc(t)}</a>' for p, t in NAV[lang])
    foot = ' · '.join(f'<a href="{rel(me, PATH[lang][p])}">{esc(t)}</a>' for p, t in FOOT[lang])
    play = 'Jugar gratis' if lang == 'es' else 'Play free'
    switch = f'<a class="lang" hreflang="{other}" href="{rel(me, PATH[other][pid])}">{"English" if lang == "es" else "Español"}</a>'
    legal = ('PokéSurvivor es un juego de fans <b>gratuito y sin ánimo de lucro</b>, sin anuncios ni compras (sólo donaciones voluntarias para los servidores). No está afiliado a Nintendo, Creatures, '
             'GAME FREAK ni The Pokémon Company; Pokémon y sus personajes son propiedad de sus respectivos dueños. Sprites de PMD SpriteCollab '
             '(CC BY-NC 4.0) · datos de PokéAPI · música y sonidos originales.') if lang == 'es' else (
             'PokéSurvivor is a <b>free, non-profit</b> fan game with no ads or purchases (only voluntary donations for the servers). It is not affiliated with Nintendo, Creatures, GAME FREAK '
             'or The Pokémon Company; Pokémon and its characters are owned by their respective owners. Sprites from PMD SpriteCollab (CC BY-NC 4.0) '
             '· data from PokéAPI · original music and sounds.')
    ldj = ('<script type="application/ld+json">\n' + json.dumps(ld, ensure_ascii=False) + '\n</script>') if ld else ''
    return f'''<!doctype html>
<html lang="{lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{esc(title)}</title>
<meta name="description" content="{esc(desc)}">
<link rel="canonical" href="{SITE}{me}">
{alts}<meta name="theme-color" content="#0a1430">
<meta property="og:type" content="website">
<meta property="og:site_name" content="PokéSurvivor">
<meta property="og:locale" content="{'es_ES' if lang == 'es' else 'en_US'}">
<meta property="og:url" content="{SITE}{me}">
<meta property="og:title" content="{esc(title)}">
<meta property="og:description" content="{esc(desc)}">
<meta property="og:image" content="{SITE}assets/og-image.jpg">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" type="image/png" href="{up}assets/icons/icon-32.png">
<link rel="apple-touch-icon" href="{up}assets/icons/icon-180.png">
<link rel="stylesheet" href="{up}css/pages.css">
{ldj}
</head>
<body>
<header class="top">
  <a class="brand" href="{rel(me, PATH[lang]['home'])}">PokéSurvivor</a>
  <nav>{nav}{switch}<a class="play" href="{rel(me, PATH[lang]['home'])}">{play}</a></nav>
</header>
<main>
{body}
</main>
<footer>
  <p>{foot}</p>
  <p>{legal}</p>
  <p><a href="https://github.com/JPTER78/pokesurvivor">GitHub</a></p>
</footer>
</body>
</html>
'''

def write(pid, lang, html_):
    p = os.path.join(ROOT, PATH[lang][pid], 'index.html')
    os.makedirs(os.path.dirname(p), exist_ok=True)
    open(p, 'w', encoding='utf-8').write(html_)

def crumbs(pid, lang, name):
    return {'@type': 'BreadcrumbList', 'itemListElement': [
        {'@type': 'ListItem', 'position': 1, 'name': 'PokéSurvivor', 'item': SITE + PATH[lang]['home']},
        {'@type': 'ListItem', 'position': 2, 'name': name, 'item': SITE + PATH[lang][pid]}]}

def sprite(d, shiny=False, up='../', anim='Idle'):
    m = META.get(d, {}).get('a', {}).get(anim)
    if not m: return ''
    k = 2 if max(m['w'], m['h']) <= 48 else 1
    src = f'{up}assets/pokemon/{d}/{"s/" if shiny else ""}{anim}.png'
    return (f'<span class="spr" style="width:{m["w"] * k}px;height:{m["h"] * k}px"><img loading="lazy" decoding="async" src="{src}" '
            f'width="{m["w"]}" height="{m["h"]}" style="transform:scale({k})" alt="{esc(BY[d]["name"])}{" shiny" if shiny else ""}"></span>')

def upof(pid, lang): return '../' * PATH[lang][pid].count('/')
def cta(pid, lang, text):
    return f'<p class="cta"><a class="btn" href="{rel(PATH[lang][pid], PATH[lang]["home"])}">{esc(text)}</a></p>'

# ================= guía =================
FAQ = {
 'es': [
  ('¿PokéSurvivor es gratis?', 'Sí, totalmente. Es un juego de fans sin ánimo de lucro: no tiene anuncios ni compras. Si quieres, puedes apoyarlo con una donación voluntaria, que se usa sólo para los servidores y no da ventajas.'),
  ('¿Hay que descargar algo?', 'No. Se juega en el navegador, en PC, tablet o móvil. Si quieres, puedes instalarlo como app con «Añadir a pantalla de inicio».'),
  ('¿Se puede jugar en el móvil?', 'Sí, en horizontal. Pon el dedo en cualquier parte de la pantalla y arrastra para moverte (el joystick aparece donde tocas), toca un ataque para cambiarlo y el botón de arriba a la derecha para pausar.'),
  ('¿Está en inglés?', 'Sí: el juego sale en español o en inglés según el idioma de tu navegador, y se puede cambiar en Ajustes.'),
  ('¿Puedo jugar con mis amigos?', 'Sí: el modo cooperativo online admite hasta 4 jugadores. Añade a tus amigos por su apodo, invítalos a tu sala y empezad la partida. La experiencia se comparte y podéis revivir a un compañero caído quedándoos a su lado.'),
  ('¿Cuántos Pokémon hay?', f'{N} Pokémon de las 9 regiones (de Kanto a Paldea), todos jugables como compañero y con su versión shiny cuando existe.'),
  ('¿Cómo consigo más Pokémon?', 'Con el gacha, que funciona con tickets que se ganan jugando: los Pokémon normales sueltan tickets de vez en cuando, los jefes a veces y los legendarios de las grietas siempre dan tickets ×10. No se pueden comprar con dinero real.'),
  ('¿Qué son las grietas?', 'Portales misteriosos que aparecen muy de vez en cuando. Si entras, luchas contra un Pokémon legendario en una arena de su tipo (hay 18 distintas). Si ganas, te llevas premio; si caes, vuelves al mapa.'),
  ('¿Se guarda mi progreso?', 'Con una cuenta (nombre y contraseña o Google) tu partida se guarda en la nube y la puedes seguir en cualquier dispositivo. Como invitado se juega al momento, pero no se guarda.'),
  ('¿Es un juego oficial de Pokémon?', 'No. Es un proyecto hecho por fans, gratuito y sin ánimo de lucro, sin relación con Nintendo, GAME FREAK ni The Pokémon Company.')],
 'en': [
  ('Is PokéSurvivor free?', 'Yes, completely. It\'s a non-profit fan game with no ads or purchases. If you like, you can support it with a voluntary donation, which only pays for the servers and gives no advantages.'),
  ('Do I need to download anything?', 'No. You play in your browser on PC, tablet or phone. If you like, you can install it as an app with “Add to Home Screen”.'),
  ('Can I play on my phone?', 'Yes, in landscape. Put your finger anywhere on the screen and drag to move (the joystick appears where you touch), tap a move to switch to it and the top-right button to pause.'),
  ('Is it in English?', 'Yes: the game shows up in English or Spanish depending on your browser language, and you can change it in Settings.'),
  ('Can I play with my friends?', 'Yes: online co-op supports up to 4 players. Add your friends by nickname, invite them to your room and start the game. Experience is shared and you can revive a fallen teammate by standing next to them.'),
  ('How many Pokémon are there?', f'{N} Pokémon from all 9 regions (Kanto to Paldea), all playable as your partner, with their shiny form when one exists.'),
  ('How do I get more Pokémon?', 'From the gacha, which uses tickets you earn by playing: regular Pokémon drop tickets now and then, bosses sometimes and rift legendaries always drop ×10 tickets. They can\'t be bought with real money.'),
  ('What are rifts?', 'Mysterious portals that open very rarely. If you go in, you fight a legendary Pokémon in an arena of its type (there are 18). Win and you get a reward; fall and you\'re sent back to the map.'),
  ('Is my progress saved?', 'With an account (name and password, or Google) your game is saved in the cloud and you can continue on any device. Guests can play right away, but nothing is saved.'),
  ('Is this an official Pokémon game?', 'No. It\'s a free, non-profit fan project, unrelated to Nintendo, GAME FREAK or The Pokémon Company.')]}

def guide(lang):
    pid = 'guide'; me = PATH[lang][pid]
    lk = lambda p: rel(me, PATH[lang][p])
    if lang == 'es':
        body = f'''<article class="doc">
<h1>Guía de PokéSurvivor</h1>
<p class="lead">PokéSurvivor es un <b>juego de supervivencia con Pokémon</b> al estilo de Survivor.io o Vampire Survivors, gratis y en el
navegador: eliges un compañero, te mueves por un mapa infinito y tus ataques salen solos mientras hordas de Pokémon salvajes intentan rodearte.
¿Cuánto aguantarás?</p>
{cta(pid, lang, 'Jugar gratis ahora')}
<h2>Cómo se juega</h2>
<ul>
<li><b>En PC:</b> muévete con <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> o las flechas. Cambia de ataque con <kbd>1</kbd>–<kbd>4</kbd>, <kbd>Q</kbd>/<kbd>E</kbd> o haciendo clic en su icono. Pausa con <kbd>Esc</kbd>.</li>
<li><b>En móvil o tablet (horizontal):</b> arrastra el dedo en cualquier parte para moverte, toca un ataque para cambiarlo y el botón de arriba a la derecha para pausar.</li>
<li>Tu Pokémon <b>ataca solo</b> con el movimiento activo. Tú te encargas de esquivar y de colocarte bien.</li>
<li>Recoge la experiencia para <b>subir de nivel</b> y elige entre tres cartas: <a href="{lk('moves')}">movimientos</a> nuevos, mejorar los que tienes o potenciar a tu Pokémon.</li>
</ul>
<h2>Características</h2>
<ul class="feat">
<li><b>{N} Pokémon de las 9 regiones</b> (<a href="{lk('pokedex')}">ver la Pokédex</a>), cada uno con sus ataques y sus propias mejoras permanentes.</li>
<li><b>Los movimientos evolucionan</b>: al nivel máximo y con la mejora adecuada, Ascuas se convierte en Llamarada, Burbuja en Surf…</li>
<li><b>Enemigos con personalidad</b>: hay Pokémon que curan, ponen escudos, invocan ayuda, explotan o disparan rayos avisando en el suelo.</li>
<li><b>Jefes</b> y <a href="{lk('legends')}"><b>grietas</b> con 18 arenas legendarias</a>, una por tipo.</li>
<li><a href="{lk('types')}"><b>Clima y tabla de tipos</b></a>: con lluvia el Agua se potencia y el Fuego se debilita; sol, arena, nieve y niebla.</li>
<li><a href="{lk('shinies')}"><b>Shinies</b></a> salvajes (1 entre 4096) y en el gacha.</li>
<li><b>Gacha con forma de tragaperras</b>, por región, con tickets que se ganan jugando.</li>
<li><a href="{lk('items')}"><b>Objetos equipables</b></a> como Restos, Cinta Elección o Vidasfera.</li>
<li><b>Cooperativo online hasta 4</b> con tu lista de amigos.</li>
<li><b>Misiones</b> diarias y semanales, <a href="{lk('achievements')}"><b>127 logros</b></a> con medallas y títulos, perfil público y ranking.</li>
<li>En <b>español y en inglés</b>, en PC y en móvil, e <b>instalable como app</b>.</li>
</ul>
<h2>Consejos para aguantar más</h2>
<ol>
<li>No te quedes quieto: muévete en círculos amplios para que las hordas te sigan en fila.</li>
<li>Aprovecha la tabla de tipos: cambia al ataque que sea muy eficaz contra lo que tienes delante.</li>
<li>Los avisos en el suelo (círculos y rayas que se llenan) son ataques a punto de caer: sal de ellos.</li>
<li>Elimina primero a los Pokémon que curan o ponen escudos.</li>
<li>Gasta tus monedas en las mejoras de tu compañero favorito.</li>
</ol>
<h2>Preguntas frecuentes</h2>
{''.join(f'<h3>{esc(q)}</h3><p>{esc(a)}</p>' for q, a in FAQ[lang])}
{cta(pid, lang, 'Jugar a PokéSurvivor')}
</article>'''
        title = 'Guía de PokéSurvivor: cómo jugar, trucos y preguntas frecuentes'
        desc = f'Cómo se juega a PokéSurvivor en PC y móvil, sus características ({N} Pokémon, cooperativo, grietas legendarias, gacha), trucos y preguntas frecuentes.'
    else:
        body = f'''<article class="doc">
<h1>PokéSurvivor guide</h1>
<p class="lead">PokéSurvivor is a free <b>Pokémon survival game</b> in the style of Survivor.io and Vampire Survivors that you play in your
browser: pick a partner, roam an endless map and your moves fire on their own while hordes of wild Pokémon try to surround you.
How long can you last?</p>
{cta(pid, lang, 'Play free now')}
<h2>How to play</h2>
<ul>
<li><b>On PC:</b> move with <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> or the arrow keys. Switch moves with <kbd>1</kbd>–<kbd>4</kbd>, <kbd>Q</kbd>/<kbd>E</kbd> or by clicking their icon. Pause with <kbd>Esc</kbd>.</li>
<li><b>On phone or tablet (landscape):</b> drag your finger anywhere to move, tap a move to switch to it and the top-right button to pause.</li>
<li>Your Pokémon <b>attacks on its own</b> with the active move. Your job is to dodge and position yourself well.</li>
<li>Collect experience to <b>level up</b> and pick one of three cards: new <a href="{lk('moves')}">moves</a>, upgrades to the ones you have, or boosts for your Pokémon.</li>
</ul>
<h2>Features</h2>
<ul class="feat">
<li><b>{N} Pokémon from all 9 regions</b> (<a href="{lk('pokedex')}">see the Pokédex</a>), each with its own moves and permanent upgrades.</li>
<li><b>Moves evolve</b>: at max level with the right upgrade, Ember becomes Fire Blast, Bubble becomes Surf…</li>
<li><b>Enemies with personality</b>: some Pokémon heal, shield their allies, summon help, explode or fire telegraphed beams.</li>
<li><b>Bosses</b> and <a href="{lk('legends')}"><b>rifts</b> with 18 legendary arenas</a>, one per type.</li>
<li><a href="{lk('types')}"><b>Weather and type chart</b></a>: in the rain Water gets stronger and Fire weaker; plus sun, sand, snow and fog.</li>
<li>Wild <a href="{lk('shinies')}"><b>shinies</b></a> (1 in 4096) and in the gacha.</li>
<li>A <b>slot-machine gacha</b> for each region, with tickets you earn by playing.</li>
<li><a href="{lk('items')}"><b>Held items</b></a> such as Leftovers, Choice Band and Life Orb.</li>
<li><b>Online co-op for up to 4</b> with your friends list.</li>
<li>Daily and weekly <b>missions</b>, <a href="{lk('achievements')}"><b>127 achievements</b></a> with medals and titles, a public profile and leaderboards.</li>
<li>In <b>English and Spanish</b>, on PC and mobile, and <b>installable as an app</b>.</li>
</ul>
<h2>Tips to survive longer</h2>
<ol>
<li>Don't stand still: move in wide circles so the hordes follow you in a line.</li>
<li>Use the type chart: switch to the move that's super effective against what's in front of you.</li>
<li>Markers on the ground (circles and lines filling up) are attacks about to land: step out of them.</li>
<li>Take out healers and shield-casters first.</li>
<li>Spend your coins on upgrades for your favorite partner.</li>
</ol>
<h2>Frequently asked questions</h2>
{''.join(f'<h3>{esc(q)}</h3><p>{esc(a)}</p>' for q, a in FAQ[lang])}
{cta(pid, lang, 'Play PokéSurvivor')}
</article>'''
        title = 'PokéSurvivor guide: how to play, tips and FAQ'
        desc = f'How to play PokéSurvivor on PC and mobile, its features ({N} Pokémon, online co-op, legendary rifts, gacha), tips and frequently asked questions.'
    ld = {'@context': 'https://schema.org', '@graph': [
        {'@type': 'FAQPage', 'inLanguage': lang, 'mainEntity': [{'@type': 'Question', 'name': q, 'acceptedAnswer': {'@type': 'Answer', 'text': a}} for q, a in FAQ[lang]]},
        crumbs(pid, lang, 'Guía' if lang == 'es' else 'Guide')]}
    write(pid, lang, page(pid, lang, title, desc, body, ld))

# ================= Pokédex =================
def dexcard(e, lang, up):
    d = e['dex']
    tag = f'<b class="leg">{"Legendario" if lang == "es" else "Legendary"}</b>' if d in LEG else (
          f'<b class="st">{"Inicial" if lang == "es" else "Starter"}</b>' if e.get('starter') else '')
    return (f'<li id="p{d}">{sprite(d, up=up)}<span class="n">#{d:03d}</span><span class="nm">{esc(e["name"])}</span>'
            f'<span class="tys">{"".join(tbadge(t, lang) for t in e.get("types", []))}</span>{tag}</li>')

def pokedex(lang):
    pid = 'pokedex'; up = upof(pid, lang)
    secs = []
    for g in range(1, 10):
        mons = [e for e in DEX if e.get('gen') == g]
        gn = gen_name(g, lang)
        head = f'(generación {g} · {len(mons)} Pokémon)' if lang == 'es' else f'(generation {g} · {len(mons)} Pokémon)'
        secs.append(f'<section id="{gn.lower()}"><h2>{gn} <small>{head}</small></h2><ul class="dexgrid">{"".join(dexcard(e, lang, up) for e in mons)}</ul></section>')
    gens = ''.join(f'<a href="#{gen_name(g, lang).lower()}">{gen_name(g, lang)}</a>' for g in range(1, 10))
    if lang == 'es':
        h1, lead, c = f'Pokédex de PokéSurvivor: los {N} Pokémon jugables', (f'Todos estos Pokémon pueden ser tu compañero en PokéSurvivor, el juego gratis de supervivencia con Pokémon para '
              f'navegador y móvil. Hay {N} de las 9 regiones; los consigues como compañero inicial o en el gacha (con tickets que se ganan jugando), y también '
              f'aparecen como enemigos salvajes, jefes y legendarios en las grietas.'), 'Elige tu compañero y juega gratis'
        title, desc = f'Pokédex de PokéSurvivor: los {N} Pokémon jugables (9 regiones)', f'Lista completa de los {N} Pokémon que puedes usar en PokéSurvivor, de Kanto a Paldea, con sus tipos. Juego de Pokémon gratis en el navegador.'
    else:
        h1, lead, c = f'PokéSurvivor Pokédex: all {N} playable Pokémon', (f'Every one of these Pokémon can be your partner in PokéSurvivor, the free Pokémon survival game for your browser and phone. '
              f'There are {N} from all 9 regions; you get them as a starter or from the gacha (with tickets you earn by playing), and they also show up as wild '
              f'enemies, bosses and legendaries in rifts.'), 'Pick your partner and play free'
        title, desc = f'PokéSurvivor Pokédex: all {N} playable Pokémon (9 regions)', f'The full list of the {N} Pokémon you can play in PokéSurvivor, from Kanto to Paldea, with their types. A free Pokémon game in your browser.'
    body = f'<article class="doc wide"><h1>{esc(h1)}</h1><p class="lead">{esc(lead)}</p><nav class="gens">{gens}</nav>{"".join(secs)}{cta(pid, lang, c)}</article>'
    ld = {'@context': 'https://schema.org', '@graph': [{'@type': 'CollectionPage', 'name': h1, 'url': SITE + PATH[lang][pid], 'inLanguage': lang}, crumbs(pid, lang, 'Pokédex')]}
    write(pid, lang, page(pid, lang, title, desc, body, ld))

# ================= legendarios y arenas =================
def legends(lang):
    pid = 'legends'; up = upof(pid, lang)
    cards = ''.join(dexcard(BY[d], lang, up) for d in sorted(LEG))
    ar = ''.join(f'<li>{tbadge(t, lang)} <b>{esc(L(lang, D["arenas"][t]))}</b></li>' for t in TYPES if t in D['arenas'])
    if lang == 'es':
        h1 = 'Legendarios y grietas: las 18 arenas de PokéSurvivor'
        intro = ('<p class="lead">De vez en cuando se abre una <b>grieta misteriosa</b> en el mapa. Si entras, te enfrentas a un <b>Pokémon legendario</b> '
                 'en una arena de su tipo, con su propio terreno y clima. Si ganas te llevas un <b>ticket ×10</b> para el gacha; si caes, vuelves al mapa sin premio. '
                 'En grupo, entráis todos juntos.</p>')
        h2a, h2b = '18 arenas, una por tipo', f'Los {len(LEG)} legendarios'
        tip = '<p>Los legendarios de dos tipos eligen uno al azar para la arena. El terreno cuenta: hay lava que quema, hielo que resbala, agua que frena…</p>'
        title, desc, c = 'Legendarios y grietas de PokéSurvivor: las 18 arenas por tipo', f'Cómo funcionan las grietas de PokéSurvivor, las 18 arenas legendarias (una por tipo) y los {len(LEG)} Pokémon legendarios a los que te puedes enfrentar.', 'Busca una grieta: jugar gratis'
    else:
        h1 = 'Legendaries and rifts: PokéSurvivor\'s 18 arenas'
        intro = ('<p class="lead">Every now and then a <b>mysterious rift</b> opens on the map. Step inside and you face a <b>legendary Pokémon</b> in an arena '
                 'of its type, with its own terrain and weather. Win and you get a <b>×10 ticket</b> for the gacha; fall and you\'re sent back to the map with no reward. '
                 'In a group, you all go in together.</p>')
        h2a, h2b = '18 arenas, one per type', f'The {len(LEG)} legendaries'
        tip = '<p>Dual-type legendaries pick one of their types at random for the arena. Terrain matters: lava burns, ice is slippery, water slows you down…</p>'
        title, desc, c = 'PokéSurvivor legendaries and rifts: the 18 type arenas', f'How rifts work in PokéSurvivor, the 18 legendary arenas (one per type) and the {len(LEG)} legendary Pokémon you can battle.', 'Find a rift: play free'
    body = f'<article class="doc wide"><h1>{esc(h1)}</h1>{intro}<h2>{h2a}</h2><ul class="arenas">{ar}</ul>{tip}<h2>{h2b}</h2><ul class="dexgrid">{cards}</ul>{cta(pid, lang, c)}</article>'
    write(pid, lang, page(pid, lang, title, desc, body, {'@context': 'https://schema.org', '@graph': [crumbs(pid, lang, h1)]}))

# ================= shinies =================
SHOW = [1, 4, 7, 25, 133, 6, 150, 151, 152, 155, 158, 249, 250, 252, 255, 258, 384, 393, 448, 445, 495, 658, 722, 906]
def shinies(lang):
    pid = 'shinies'; up = upof(pid, lang)
    pairs = ''.join(f'<li><span class="pair">{sprite(d, up=up)}{sprite(d, True, up=up)}</span><span class="nm">{esc(BY[d]["name"])}</span></li>'
                    for d in SHOW if META.get(d, {}).get('sh'))
    if lang == 'es':
        h1 = 'Shinies en PokéSurvivor: cómo conseguirlos'
        body = f'''<article class="doc wide"><h1>{h1}</h1>
<p class="lead">Los <b>shiny</b> son versiones de otro color, muy raras. En PokéSurvivor casi todos los {N} Pokémon tienen su forma shiny, con sprites de verdad.</p>
<h2>Cómo conseguirlos</h2>
<ul><li><b>Salvajes:</b> cada Pokémon que aparece tiene <b>1 entre 4096</b> de salir shiny (como en los juegos clásicos). Lo verás brillar y saldrá un aviso: derrótalo y es tuyo.</li>
<li><b>En el gacha:</b> cada tirada tiene <b>1 entre 100</b> de ser shiny.</li>
<li>Un shiny repetido da el triple de Pokémonedas.</li>
<li>Cuando tienes la forma shiny de tu compañero, puedes jugar con ella (se elige en la colección).</li></ul>
<h2>Normal y shiny</h2><ul class="dexgrid pairs">{pairs}</ul>{cta(pid, lang, 'Sal a cazar shinies')}</article>'''
        title, desc = 'Shinies en PokéSurvivor: probabilidades y cómo conseguirlos', 'Cómo conseguir Pokémon shiny en PokéSurvivor: 1 entre 4096 en estado salvaje y 1 entre 100 en el gacha. Galería de formas normales y shiny.'
    else:
        h1 = 'Shinies in PokéSurvivor: how to get them'
        body = f'''<article class="doc wide"><h1>{h1}</h1>
<p class="lead"><b>Shiny</b> Pokémon are rare, differently colored versions. In PokéSurvivor almost all {N} Pokémon have a shiny form, with real sprites.</p>
<h2>How to get them</h2>
<ul><li><b>In the wild:</b> every Pokémon that spawns has a <b>1 in 4096</b> chance of being shiny (just like the classic games). You'll see it sparkle and get an alert: defeat it and it's yours.</li>
<li><b>From the gacha:</b> every pull has a <b>1 in 100</b> chance of being shiny.</li>
<li>A duplicate shiny gives triple PokéCoins.</li>
<li>Once you own your partner's shiny form, you can play with it (pick it in your collection).</li></ul>
<h2>Normal and shiny</h2><ul class="dexgrid pairs">{pairs}</ul>{cta(pid, lang, 'Go shiny hunting')}</article>'''
        title, desc = 'Shinies in PokéSurvivor: odds and how to get them', 'How to get shiny Pokémon in PokéSurvivor: 1 in 4096 in the wild and 1 in 100 from the gacha. A gallery of normal and shiny forms.'
    write(pid, lang, page(pid, lang, title, desc, body, {'@context': 'https://schema.org', '@graph': [crumbs(pid, lang, h1)]}))

# ================= tabla de tipos =================
def types_page(lang):
    pid = 'types'
    M = D['matrix']
    def cell(v):
        cls = 'x16' if v > 1.05 else ('x03' if v < 0.35 else ('x06' if v < 0.95 else ''))
        num = f'{v:g}' if lang == 'en' else f'{v:g}'.replace('.', ',')
        return f'<td class="{cls}">{"×" + num if cls else ""}</td>'
    head = ''.join(f'<th class="vt" title="{esc(tname(t, lang))}"><span style="background:{TC[t]}">{esc(tname(t, lang)[:3])}</span></th>' for t in TYPES)
    rows = ''.join(f'<tr><th>{tbadge(a, lang)}</th>{"".join(cell(M[a][d]) for d in TYPES)}</tr>' for a in TYPES)
    table = f'<div class="tablewrap"><table class="chart" id="chart"><thead><tr><th></th>{head}</tr></thead><tbody>{rows}</tbody></table></div>'
    script = '''<script>
document.querySelectorAll('#chart td').forEach(td => {
  td.onmouseenter = () => { const r = td.parentElement, i = [...r.children].indexOf(td);
    document.querySelectorAll('#chart tr').forEach(tr => tr.children[i] && tr.children[i].classList.add('hl')); r.classList.add('hl'); };
  td.onmouseleave = () => document.querySelectorAll('#chart .hl').forEach(e => e.classList.remove('hl'));
});
</script>'''
    if lang == 'es':
        h1 = 'Tabla de tipos de PokéSurvivor'
        intro = ('<p class="lead">La tabla de tipos de los juegos, pero <b>suavizada</b> para un survivor (sólo llevas un ataque activo y no puedes cambiar '
                 'de Pokémon): lo muy eficaz hace <b>×1,6</b>, lo poco eficaz <b>×0,6</b> y las inmunidades se quedan en <b>×0,3</b>. Con dos tipos se multiplican '
                 '(tope ×2,4). Vale en los dos sentidos: tus ataques contra los enemigos y los suyos contra ti.</p>'
                 '<p>Filas: tipo del ataque · columnas: tipo del Pokémon que lo recibe.</p>')
        wx = ('<h2>El clima también cuenta</h2><ul><li><b>Lluvia:</b> el Agua se potencia y el Fuego se debilita.</li><li><b>Sol abrasador:</b> el Fuego se potencia y el Agua se debilita.</li>'
              '<li><b>Tormenta de arena:</b> Roca, Tierra y Acero se potencian; el resto sufre.</li><li><b>Nevada:</b> el Hielo se potencia; el resto sufre y va más lento.</li>'
              '<li><b>Niebla:</b> Fantasma, Hada y Psíquico se potencian.</li></ul>')
        title, desc, c = 'Tabla de tipos de PokéSurvivor (interactiva) y efectos del clima', 'Tabla de tipos interactiva de PokéSurvivor: multiplicadores ×1,6 / ×0,6 / ×0,3 para los 18 tipos y cómo afectan la lluvia, el sol, la arena, la nieve y la niebla.', 'Ponlo en práctica: jugar gratis'
    else:
        h1 = 'PokéSurvivor type chart'
        intro = ('<p class="lead">The type chart from the main games, but <b>softened</b> for a survivor game (you only have one active move and can\'t swap Pokémon): '
                 'super effective deals <b>×1.6</b>, not very effective <b>×0.6</b>, and immunities become <b>×0.3</b>. Two types multiply (capped at ×2.4). '
                 'It works both ways: your attacks against enemies and theirs against you.</p><p>Rows: attacking type · columns: type of the Pokémon being hit.</p>')
        wx = ('<h2>Weather matters too</h2><ul><li><b>Rain:</b> Water is boosted and Fire is weakened.</li><li><b>Harsh sunlight:</b> Fire is boosted and Water is weakened.</li>'
              '<li><b>Sandstorm:</b> Rock, Ground and Steel are boosted; the rest suffer.</li><li><b>Snowfall:</b> Ice is boosted; the rest suffer and slow down.</li>'
              '<li><b>Fog:</b> Ghost, Fairy and Psychic are boosted.</li></ul>')
        title, desc, c = 'PokéSurvivor type chart (interactive) and weather effects', 'Interactive PokéSurvivor type chart: ×1.6 / ×0.6 / ×0.3 multipliers for all 18 types, plus how rain, sun, sand, snow and fog change the fight.', 'Put it into practice: play free'
    body = f'<article class="doc wide"><h1>{h1}</h1>{intro}{table}{wx}{cta(pid, lang, c)}</article>{script}'
    write(pid, lang, page(pid, lang, title, desc, body, {'@context': 'https://schema.org', '@graph': [crumbs(pid, lang, h1)]}))

# ================= movimientos =================
KIND = {'es': {'projectile': 'Proyectil', 'melee': 'Cuerpo a cuerpo', 'beam': 'Rayo', 'orbit': 'Órbita', 'nova': 'Ráfaga', 'aura': 'Aura', 'buff': 'Mejora',
               'boomerang': 'Bumerán', 'chain': 'Cadena', 'mine': 'Minas', 'meteor': 'Meteoros', 'turret': 'Torreta', 'dash': 'Embestida',
               'trail': 'Rastro', 'cone': 'Abanico'},
        'en': {'projectile': 'Projectile', 'melee': 'Melee', 'beam': 'Beam', 'orbit': 'Orbit', 'nova': 'Burst', 'aura': 'Aura', 'buff': 'Buff',
               'boomerang': 'Boomerang', 'chain': 'Chain', 'mine': 'Mines', 'meteor': 'Meteors', 'turret': 'Turret', 'dash': 'Dash',
               'trail': 'Trail', 'cone': 'Spray'}}
def moves_page(lang):
    pid = 'moves'
    rows = []
    for t in TYPES:
        for m in [x for x in D['moves'] if x['type'] == t]:
            evo = m['evo']
            evo_txt = (f'<b>{esc(L(lang, evo["name"]))}</b><small>{"con" if lang == "es" else "with"} {esc(L(lang, evo["needs"]))} · {esc(L(lang, evo["text"]))}</small>' if evo else '—')
            rows.append(f'<tr><td><b>{esc(L(lang, m["name"]))}</b></td><td>{tbadge(t, lang)}</td><td>{KIND[lang].get(m["kind"], m["kind"])}</td>'
                        f'<td>{esc(L(lang, m["desc"]))}</td><td class="evo">{evo_txt}</td></tr>')
    th = ('<th>Movimiento</th><th>Tipo</th><th>Clase</th><th>Qué hace</th><th>Evoluciona a</th>' if lang == 'es'
          else '<th>Move</th><th>Type</th><th>Kind</th><th>What it does</th><th>Evolves into</th>')
    nevo = sum(1 for m in D['moves'] if m['evo'])
    nm = len(D['moves'])
    if lang == 'es':
        h1 = 'Movimientos de PokéSurvivor y sus evoluciones'
        intro = (f'<p class="lead">Hay <b>{nm} movimientos</b> de los 18 tipos. Tu Pokémon ataca solo con el activo, y al subir de nivel eliges cartas '
                 f'para aprender otros o mejorarlos hasta el nivel 5. <b>{nevo} pueden evolucionar</b>: llévalos al nivel máximo, consigue la carta de mejora '
                 f'que indican (Potencia, Vigor, Reflejos…) y aparecerá una carta dorada de evolución.</p>')
        title, desc, c = f'Movimientos de PokéSurvivor: los {nm} ataques y sus evoluciones', f'Lista de los {nm} movimientos de PokéSurvivor por tipo, qué hace cada uno y en qué evoluciona (Ascuas → Llamarada, Burbuja → Surf…).', 'Pruébalos: jugar gratis'
    else:
        h1 = 'PokéSurvivor moves and their evolutions'
        intro = (f'<p class="lead">There are <b>{nm} moves</b> across all 18 types. Your Pokémon attacks on its own with the active one, and when you level up '
                 f'you pick cards to learn new moves or upgrade them up to level 5. <b>{nevo} of them can evolve</b>: max them out, get the upgrade card they ask for '
                 f'(Power, Vigor, Reflexes…) and a golden evolution card will appear.</p>')
        title, desc, c = f'PokéSurvivor moves: all {nm} attacks and their evolutions', f'All {nm} PokéSurvivor moves by type, what each one does and what it evolves into (Ember → Fire Blast, Bubble → Surf…).', 'Try them: play free'
    body = f'<article class="doc wide"><h1>{h1}</h1>{intro}<div class="tablewrap"><table class="list"><thead><tr>{th}</tr></thead><tbody>{"".join(rows)}</tbody></table></div>{cta(pid, lang, c)}</article>'
    write(pid, lang, page(pid, lang, title, desc, body, {'@context': 'https://schema.org', '@graph': [crumbs(pid, lang, h1)]}))

# ================= objetos =================
def items_page(lang):
    pid = 'items'
    rows = ''.join(f'<li><b>{esc(L(lang, i["name"]))}</b><span>{esc(L(lang, i["desc"]))}</span></li>' for i in D['items'])
    ni = len(D['items'])
    if lang == 'es':
        h1 = 'Objetos equipables de PokéSurvivor'
        intro = ('<p class="lead">Durante la partida puedes encontrar <b>objetos equipables</b> en los cofres y al derrotar a los jefes. Sólo puedes llevar <b>uno</b> '
                 'a la vez: si encuentras otro, eliges con cuál quedarte. Duran lo que dura la run.</p>')
        title, desc, c = f'Objetos de PokéSurvivor: los {ni} objetos equipables', f'Los {ni} objetos equipables de PokéSurvivor (Restos, Cinta Elección, Banda Focus, Vidasfera…) y qué hace cada uno.', 'Encuéntralos: jugar gratis'
    else:
        h1 = 'PokéSurvivor held items'
        intro = ('<p class="lead">During a run you can find <b>held items</b> in chests and by defeating bosses. You can only hold <b>one</b> at a time: '
                 'if you find another, you choose which one to keep. They last for the whole run.</p>')
        title, desc, c = f'PokéSurvivor items: all {ni} held items', f'The {ni} held items in PokéSurvivor (Leftovers, Choice Band, Focus Sash, Life Orb…) and what each one does.', 'Find them: play free'
    body = f'<article class="doc"><h1>{h1}</h1>{intro}<ul class="items">{rows}</ul>{cta(pid, lang, c)}</article>'
    write(pid, lang, page(pid, lang, title, desc, body, {'@context': 'https://schema.org', '@graph': [crumbs(pid, lang, h1)]}))

# ================= logros =================
def ach_page(lang):
    pid = 'achievements'
    cats = D['achCats'] or []
    secs = []
    for cid, cname in cats:
        items = [a for a in D['achievements'] if a['cat'] == cid]
        if not items: continue
        li = ''.join('<li><b>' + esc(L(lang, a['name'])) + '</b><span>' + esc(L(lang, a['desc'])) + '</span>'
                     + ('<em>' + esc(L(lang, a['title'])) + '</em>' if a['title'] else '') + '</li>' for a in items)
        secs.append(f'<h2>{esc(L(lang, cname))} <small>({len(items)})</small></h2><ul class="items ach">{li}</ul>')
    na = len(D['achievements'])
    if lang == 'es':
        h1 = f'Los {na} logros de PokéSurvivor'
        intro = ('<p class="lead">Cada logro da una <b>medalla</b>, un <b>premio</b> (tickets y monedas) y, los más difíciles, un <b>título</b> para tu perfil público. '
                 'Hay uno por cada legendario, por coleccionar Pokémon, por aguantar, por derrotar jefes, por evolucionar movimientos…</p>'
                 '<p>En cursiva, el título que desbloquea.</p>')
        title, desc, c = f'Logros de PokéSurvivor: los {na} logros, medallas y títulos', f'Lista completa de los {na} logros de PokéSurvivor con sus medallas y títulos: colección, supervivencia, combate, grietas y legendarios.', 'Empieza a conseguirlos'
    else:
        h1 = f'All {na} PokéSurvivor achievements'
        intro = ('<p class="lead">Every achievement gives you a <b>medal</b>, a <b>reward</b> (tickets and coins) and, for the hardest ones, a <b>title</b> for your public profile. '
                 'There\'s one for each legendary, for collecting Pokémon, surviving, defeating bosses, evolving moves…</p><p>In italics, the title it unlocks.</p>')
        title, desc, c = f'PokéSurvivor achievements: all {na} achievements, medals and titles', f'The full list of the {na} PokéSurvivor achievements with their medals and titles: collection, survival, combat, rifts and legendaries.', 'Start unlocking them'
    body = f'<article class="doc wide"><h1>{h1}</h1>{intro}{"".join(secs)}{cta(pid, lang, c)}</article>'
    write(pid, lang, page(pid, lang, title, desc, body, {'@context': 'https://schema.org', '@graph': [crumbs(pid, lang, h1)]}))

# ================= novedades =================
NEWS = [
 ('2026-10-10', ('Jefes con varios ataques, 8 tipos de movimiento nuevos y más reto', 'Bosses with several attacks, 8 new move kinds and a tougher game'),
  ('Los jefes y legendarios tienen 4 ataques avisados, se acercan o pelean de lejos y se enfurecen a media vida. 12 movimientos nuevos y 8 formas de atacar: bumerán, cadena, minas, meteoros, torreta, embestida, rastro y abanico. Menos enemigos pero más duros, eventos a mitad de partida (hordas de un tipo, hora dorada, Pokémon perdidos), Meowth que huyen cargados de monedas, los de tipo Agua nadan sin frenarse y el ranking tiene anti-trampas.',
   'Bosses and legendaries have 4 telegraphed attacks, close in or fight from range and get enraged at half health. 12 new moves and 8 new ways to attack: boomerang, chain, mines, meteors, turret, dash, trail and spray. Fewer but tougher enemies, mid-run events (single-type hordes, golden hour, lost Pokémon), Meowth running away loaded with coins, Water types swim at full speed and the leaderboard has anti-cheat.')),
 ('2026-10-09', ('Móvil, inglés y ajustes', 'Mobile, English and settings'),
  ('Ya se puede jugar en móvil y tablet con joystick táctil, en español y en inglés, e instalar como app. Nueva pantalla de ajustes con calidad gráfica automática, y menos enemigos en pantalla pero más fuertes.',
   'You can now play on phones and tablets with a touch joystick, in English and Spanish, and install it as an app. New settings screen with automatic graphics quality, and fewer but stronger enemies on screen.')),
 ('2026-10-08', ('Misiones, logros y enemigos con personalidad', 'Missions, achievements and enemies with personality'),
  ('Misiones diarias y semanales, 127 logros con medallas y títulos, perfil público, objetos equipables, evoluciones de movimientos y enemigos que curan, protegen, invocan o explotan.',
   'Daily and weekly missions, 127 achievements with medals and titles, a public profile, held items, move evolutions and enemies that heal, shield, summon or explode.')),
 ('2026-10-08', ('Grietas legendarias y clima', 'Legendary rifts and weather'),
  ('Grietas que llevan a 18 arenas legendarias, una por tipo; clima que cambia la batalla; tabla de tipos y gacha tragaperras con tickets.',
   'Rifts leading to 18 legendary arenas, one per type; weather that changes the fight; a type chart and a slot-machine gacha with tickets.')),
 ('2026-10-08', ('Cooperativo y ranking', 'Co-op and leaderboards'),
  ('Cooperativo online hasta 4 con tu lista de amigos y ranking diario, semanal, mensual, anual e histórico.',
   'Online co-op for up to 4 with your friends list, plus daily, weekly, monthly, yearly and all-time leaderboards.')),
]
def news(lang):
    pid = 'news'
    i = 0 if lang == 'es' else 1
    items = ''.join(f'<article class="news"><time datetime="{d}">{d}</time><h2>{esc(t[i])}</h2><p>{esc(x[i])}</p></article>' for d, t, x in NEWS)
    h1 = 'Novedades de PokéSurvivor' if lang == 'es' else 'PokéSurvivor news'
    title = h1 + (' · actualizaciones del juego' if lang == 'es' else ' · game updates')
    desc = ('Las últimas actualizaciones de PokéSurvivor: nuevas funciones, mejoras y arreglos.' if lang == 'es'
            else 'The latest PokéSurvivor updates: new features, improvements and fixes.')
    body = f'<div class="doc"><h1>{h1}</h1>{items}{cta(pid, lang, "Jugar gratis" if lang == "es" else "Play free")}</div>'
    write(pid, lang, page(pid, lang, title, desc, body, {'@context': 'https://schema.org', '@graph': [crumbs(pid, lang, h1)]}))

# ================= apoyar el proyecto =================
def support(lang):
    pid = 'support'
    F = D['funding']
    val = lambda v: (f'{v} €/mes' if lang == 'es' else f'€{v}/month') if isinstance(v, (int, float)) else esc(L(lang, v))
    rows = ''.join(f'<tr><td>{esc(L(lang, c))}</td><td class="num">{val(v)}</td></tr>' for c, v in F['costs'])
    kofi = f'https://ko-fi.com/{F["kofi"]}' if F['kofi'] else ''
    spons = f'https://github.com/sponsors/{F["sponsors"]}' if F['sponsors'] else ''
    if lang == 'es':
        h1 = 'Apoyar PokéSurvivor'
        btns = ''.join(x for x in [f'<a class="btn" href="{kofi}" rel="noopener">Donar en Ko-fi</a>' if kofi else '',
                                   f'<a class="btn ghost" href="{spons}" rel="noopener">GitHub Sponsors</a>' if spons else ''])
        body = f"""<article class="doc"><h1>{h1}</h1>
<p class="lead">PokéSurvivor es y será <b>gratis</b>: sin anuncios, sin compras y sin ventajas de pago. Si te gusta y quieres ayudar a que siga en línea,
puedes hacer una <b>donación voluntaria</b>. <b>Todo el dinero se usa para los servidores y el dominio</b>; lo que sobre se guarda para los meses siguientes.</p>
<p>Donar no da ninguna ventaja dentro del juego: todos los jugadores juegan igual.</p>
<h2>Qué cuesta mantenerlo</h2>
<table class="list"><tbody>{rows}</tbody></table>
<p>Los servidores guardan las partidas y las cuentas, el ranking y las partidas en grupo: cuanta más gente juega, más cuestan.</p>
<h2>Cómo apoyar</h2>
<p>{btns or 'Muy pronto podrás donar desde aquí.'}</p>
<p>También ayuda mucho, y gratis: compartir el juego con tus amigos, recomendarlo y avisar de fallos.</p>
{cta(pid, lang, 'Volver al juego')}</article>"""
        title, desc = 'Apoyar PokéSurvivor: donaciones para los servidores', 'PokéSurvivor es gratis y sin anuncios. Las donaciones voluntarias se usan sólo para los servidores y el dominio.'
    else:
        h1 = 'Support PokéSurvivor'
        btns = ''.join(x for x in [f'<a class="btn" href="{kofi}" rel="noopener">Donate on Ko-fi</a>' if kofi else '',
                                   f'<a class="btn ghost" href="{spons}" rel="noopener">GitHub Sponsors</a>' if spons else ''])
        body = f"""<article class="doc"><h1>{h1}</h1>
<p class="lead">PokéSurvivor is and will stay <b>free</b>: no ads, no purchases and no pay-to-win. If you enjoy it and want to help keep it online,
you can make a <b>voluntary donation</b>. <b>All the money goes to the servers and the domain</b>; anything left over is saved for the following months.</p>
<p>Donating gives no advantage in the game: everyone plays on equal terms.</p>
<h2>What it costs to run</h2>
<table class="list"><tbody>{rows}</tbody></table>
<p>The servers store saves and accounts, the leaderboards and group games: the more people play, the more they cost.</p>
<h2>How to support</h2>
<p>{btns or 'You\'ll be able to donate from here very soon.'}</p>
<p>Sharing the game with your friends, recommending it and reporting bugs helps a lot too, and it\'s free.</p>
{cta(pid, lang, 'Back to the game')}</article>"""
        title, desc = 'Support PokéSurvivor: donations for the servers', 'PokéSurvivor is free and ad-free. Voluntary donations only pay for the servers and the domain.'
    write(pid, lang, page(pid, lang, title, desc, body, {'@context': 'https://schema.org', '@graph': [crumbs(pid, lang, h1)]}))

# ================= el juego en inglés (/en/) =================
def game_en():
    # Parte de dev.html (con lo de SEO) y usa el mismo app.min.js que index.html,
    # así sale bien aunque index.html se haya generado con --sin-seo.
    dev = open(os.path.join(ROOT, 'dev.html'), encoding='utf-8').read()
    idx = open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()
    app = re.search(r'<script defer src="js/app\.min\.js\?v=[^"]+"></script>', idx).group(0)
    a, b = dev.index('<!-- scripts:begin -->'), dev.index('<!-- scripts:end -->') + len('<!-- scripts:end -->')
    src = dev[:a] + app + dev[b:]
    src = re.sub(r'<!-- seo:(begin|end) -->\n?', '', src)
    src = re.sub(r'<meta name="robots" content="noindex">\s*', '', src)
    src = re.sub(r'<!-- dev\.html: página fuente[^>]*-->\n?', '', src)
    s = src.replace('<html lang="es">', '<html lang="en">')
    s = s.replace('<head>\n<meta charset="utf-8">', '<head>\n<meta charset="utf-8">\n<base href="../">', 1)
    rep = [
        ('<title>PokéSurvivor – Juego Pokémon gratis online estilo Survivor.io</title>', '<title>PokéSurvivor – Free online Pokémon survival game (Survivor.io style)</title>'),
        ('content="Sobrevive a hordas de Pokémon con tu compañero en este fan game gratis para navegador y móvil: 966 Pokémon, shinies, legendarios y cooperativo con amigos. Sin descargas ni anuncios."',
         f'content="Survive hordes of Pokémon with your partner in this free fan game for browser and mobile: {N} Pokémon, shinies, legendaries and online co-op with friends. No downloads, no ads."'),
        ('<link rel="canonical" href="https://pokesurvivor.com/">', '<link rel="canonical" href="https://pokesurvivor.com/en/">'),
        ('<meta property="og:locale" content="es_ES">', '<meta property="og:locale" content="en_US">'),
        ('<meta property="og:url" content="https://pokesurvivor.com/">', '<meta property="og:url" content="https://pokesurvivor.com/en/">'),
        ('<meta property="og:title" content="PokéSurvivor – Sobrevive a las hordas Pokémon">', '<meta property="og:title" content="PokéSurvivor – Survive the Pokémon hordes">'),
        ('<meta property="og:description" content="Fan game gratis para navegador y móvil: 966 Pokémon, shinies, legendarios y cooperativo hasta 4 amigos. Sin descargas ni anuncios.">',
         f'<meta property="og:description" content="A free fan game for browser and mobile: {N} Pokémon, shinies, legendaries and co-op with up to 4 friends. No downloads, no ads.">'),
        ('<meta name="twitter:title" content="PokéSurvivor – Sobrevive a las hordas Pokémon">', '<meta name="twitter:title" content="PokéSurvivor – Survive the Pokémon hordes">'),
        ('<meta name="twitter:description" content="Fan game gratis para navegador y móvil, con cooperativo hasta 4. Sin descargas ni anuncios.">',
         '<meta name="twitter:description" content="A free fan game for browser and mobile, with co-op for up to 4. No downloads, no ads.">'),
        ('<p>Juego de supervivencia con Pokémon, gratis en el navegador y en el móvil.</p>', '<p>A Pokémon survival game, free in your browser and on mobile.</p>'),
        ('<p class="boot-ld">Cargando…</p>', '<p class="boot-ld">Loading…</p>'),
    ]
    for a, b in rep:
        assert a in s, a[:60]
        s = s.replace(a, b)
    # Enlaces a las páginas: las de inglés.
    s = s.replace('href="guia/"', 'href="en/guide/"').replace('href="pokedex/"', 'href="en/pokedex/"')
    s = s.replace('"description": "Fan game gratuito de supervivencia (bullet heaven, estilo Survivor.io) con Pokémon: elige compañero, sobrevive a hordas, sube de nivel, evoluciona tus ataques, enfréntate a legendarios en grietas y juega en cooperativo con hasta 4 amigos."',
                  '"description": "A free Pokémon survival fan game (bullet heaven, Survivor.io style): pick a partner, survive the hordes, level up, evolve your moves, fight legendaries in rifts and play co-op with up to 4 friends."')
    s = s.replace('"inLanguage": "es"', '"inLanguage": ["es", "en"]')
    os.makedirs(os.path.join(ROOT, 'en'), exist_ok=True)
    open(os.path.join(ROOT, 'en', 'index.html'), 'w', encoding='utf-8').write(s)

# ================= 404, robots y sitemap =================
def extra():
    nf = '''<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>404 · PokéSurvivor</title><link rel="icon" href="/assets/icons/icon-32.png"><link rel="stylesheet" href="/css/pages.css"></head>
<body><header class="top"><a class="brand" href="/">PokéSurvivor</a><nav><a href="/guia/">Guía</a><a href="/en/">English</a><a class="play" href="/">Jugar gratis</a></nav></header>
<main><article class="doc center"><h1>404 · Te has perdido en la mazmorra</h1><p class="lead">Esta página no existe. Pero las hordas siguen esperando…</p>
<p class="lead" lang="en">This page doesn't exist. But the hordes are still waiting…</p>
<p class="cta"><a class="btn" href="/">Volver al juego</a> <a class="btn ghost" href="/en/">Play in English</a></p></article></main></body></html>
'''
    open(os.path.join(ROOT, '404.html'), 'w', encoding='utf-8').write(nf)
    open(os.path.join(ROOT, 'robots.txt'), 'w', encoding='utf-8').write(f'# PokéSurvivor\nUser-agent: *\nAllow: /\nDisallow: /tools/\nDisallow: /docs/\nDisallow: /dev.html\n\nSitemap: {SITE}sitemap.xml\n')
    PRI = {'home': '1.0', 'guide': '0.8', 'pokedex': '0.7', 'legends': '0.7', 'moves': '0.6', 'types': '0.6', 'shinies': '0.6', 'achievements': '0.5', 'items': '0.5', 'news': '0.5', 'support': '0.4'}
    urls = []
    for pid in PAGES:
        for lang in ('es', 'en'):
            alts = ''.join(f'<xhtml:link rel="alternate" hreflang="{l}" href="{SITE}{PATH[l][pid]}"/>' for l in ('es', 'en'))
            alts += f'<xhtml:link rel="alternate" hreflang="x-default" href="{SITE}{PATH["es"][pid]}"/>'
            urls.append(f'  <url><loc>{SITE}{PATH[lang][pid]}</loc><lastmod>{TODAY}</lastmod><priority>{PRI[pid]}</priority>{alts}</url>\n')
    open(os.path.join(ROOT, 'sitemap.xml'), 'w', encoding='utf-8').write(
        '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n' + ''.join(urls) + '</urlset>\n')

for lang in ('es', 'en'):
    guide(lang); pokedex(lang); legends(lang); shinies(lang); types_page(lang); moves_page(lang); items_page(lang); ach_page(lang); news(lang); support(lang)
game_en(); extra()
print('ok:', 2 * (len(PAGES) - 1), 'páginas + en/ (juego en inglés), 404, robots, sitemap')
