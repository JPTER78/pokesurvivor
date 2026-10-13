#!/usr/bin/env python3
"""Download pinned localization inputs; never runs in the browser."""
import concurrent.futures
import hashlib
import json
from pathlib import Path
import urllib.request

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / 'tools/cache/localization'
POKE_REV = '81d20919845b6a445969b9265aab5cec6b04cece'
INPUTS = {
    **{n: f'https://raw.githubusercontent.com/PokeAPI/pokeapi/{POKE_REV}/data/v2/csv/{n}'
       for n in ['pokemon_species_names.csv', 'move_names.csv', 'item_names.csv', 'type_names.csv', 'region_names.csv']},
    'official-index.html': 'https://pokedex.pokemon.cn/play/pokedex',
    'official-pokedex.json': 'https://pokedex.pokemon.cn/play/pokedex/api/v1',
    'official-list.js': 'https://pokedex.pokemon.cn/play/resources/pokedex/js/pokemon-list.js?20210224',
    'official-app.js': 'https://pokedex.pokemon.cn/play/resources/pokedex/js/app.js?20220707',
    'NotoSansSC-Regular.otf': 'https://raw.githubusercontent.com/notofonts/noto-cjk/main/Sans/SubsetOTF/SC/NotoSansSC-Regular.otf',
    'NotoSansSC-Bold.otf': 'https://raw.githubusercontent.com/notofonts/noto-cjk/main/Sans/SubsetOTF/SC/NotoSansSC-Bold.otf',
    'Noto-OFL.txt': 'https://raw.githubusercontent.com/notofonts/noto-cjk/main/Sans/LICENSE',
}

def fetch(pair):
    name, url = pair
    dest = CACHE / name
    if not dest.exists():
        req = urllib.request.Request(url, headers={'User-Agent': 'PokéSurvivor-localization/1.0'})
        with urllib.request.urlopen(req, timeout=90) as response:
            dest.write_bytes(response.read())
    return name, {'url': url, 'sha256': hashlib.sha256(dest.read_bytes()).hexdigest()}

if __name__ == '__main__':
    CACHE.mkdir(parents=True, exist_ok=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        manifest = dict(pool.map(fetch, INPUTS.items()))
    (CACHE / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print('Downloaded', len(manifest), 'localization inputs to', CACHE)
