#!/usr/bin/env python3
"""Rebuild reviewed Simplified Chinese names from cached, pinned source tables."""
import csv
import datetime
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / 'tools/cache/localization'
def table(name):
    rows = list(csv.DictReader((CACHE / (name + '.csv')).open(encoding='utf-8')))
    key = next(iter(rows[0]))
    result = {}
    for row in rows:
        result.setdefault(int(row[key]), {})[row['local_language_id']] = row['name']
    return result

if __name__ == '__main__':
    species, moves, items, types, regions = [table(n) for n in ['pokemon_species_names','move_names','item_names','type_names','region_names']]
    official = {int(p['zukan_id']): p['pokemon_name'] for p in json.loads((CACHE / 'official-pokedex.json').read_text(encoding='utf-8'))['pokemons'] if int(p['zukan_sub_id']) == 0}
    dex = [json.loads(m[1]) for m in re.finditer(r'^\s*(\{"dex".*\}),?$', (ROOT / 'js/data/pokedex.js').read_text(encoding='utf-8'), re.M)]
    names, audited, corrections = {}, {}, []
    for p in dex:
        d = p['dex']
        if d not in official or '12' not in species[d]:
            raise ValueError(f'Missing official or candidate name for #{d}')
        zh = official[d]
        names[p['name']] = zh
        audited[d] = {'source': p['name'], 'zh': zh}
        if zh != species[d]['12']:
            corrections.append({'dex': d, 'candidate': species[d]['12'], 'official': zh})
    context = {}
    for group, data in [('move', moves), ('item', items), ('type', types), ('region', regions)]:
        out = {}
        for ident, row in data.items():
            if '7' in row and '12' in row:
                out[row['7']] = row['12']
        context[group] = out
    # Project labels that omit accents/words, and original terms, are explicit.
    context['move'].update({'Enjambre':'虫群'})
    context['region'].update({'Kanto':'关都','Johto':'城都','Hoenn':'丰缘','Sinnoh':'神奥','Teselia':'合众','Unova':'合众','Kalos':'卡洛斯','Alola':'阿罗拉','Galar':'伽勒尔','Paldea':'帕底亚','Hisui':'洗翠'})
    context['form'] = {'Normal':'普通', 'Shiny':'异色', 'shiny':'异色'}
    # Only names actually used in the game enter the global fragment dictionary.
    move_source = (ROOT / 'js/data/moves.js').read_text(encoding='utf-8')
    labels = set(re.findall(r"name: '([^']+)'", move_source)) | set(re.findall(r"'[^']+': \['([^']+)'", move_source))
    es_moves = {k.casefold():v for k,v in context['move'].items()}
    english = dict(re.findall(r"'([^']+)'\s*:\s*'([^']+)'", (ROOT / 'js/data/lang-en.js').read_text(encoding='utf-8')))
    en_moves = {v['9'].casefold():v['12'] for v in moves.values() if '9' in v and '12' in v}
    used_moves = {}
    for label in sorted(labels):
        zh = es_moves.get(label.casefold()) or en_moves.get(english.get(label, '').casefold())
        if not zh:
            raise ValueError('Unmapped move label: ' + label)
        used_moves[label] = zh
        if label != 'Psíquico': names[label] = zh
    context['move'] = used_moves
    for group in ['type','region']:
        names.update(context[group])
    item_source = (ROOT / 'js/data/items.js').read_text(encoding='utf-8')
    en_items = {v['9'].casefold():v['12'] for v in items.values() if '9' in v and '12' in v}
    context['item'] = {label:context['item'].get(label) or en_items[english[label].casefold()] for label in re.findall(r"name: '([^']+)'", item_source)}
    names.update(context['item'])
    for label in ['Gigadrenado','Síntesis','Imán','Baya Zidra','Tormenta de arena']:
        translated = en_moves.get(english[label].casefold()) or en_items.get(english[label].casefold())
        if not translated: raise ValueError('Unmapped dictionary term: ' + label)
        names[label] = translated
    # Name collisions with common UI labels must remain contextual.
    names['Normal'] = '一般'
    context['type'].update({'Normal':'一般'})
    context['pokemon'] = {str(d): v['zh'] for d,v in audited.items()}
    evo = dict(re.findall(r"'([^']+)': \['([^']+)'", move_source))
    move_ids = {ident:{'source':label,'zh':context['move'][label], 'evolution':{'source':evo[ident],'zh':context['move'][evo[ident]]} if ident in evo else None} for ident,label in re.findall(r"id: '([^']+)', name: '([^']+)'",move_source)}
    item_ids = {ident:{'source':label,'zh':context['item'][label]} for ident,label in re.findall(r"id: '([^']+)', name: '([^']+)'",item_source)}
    audit = {'checked':'2026-10-13', 'pokeapiRevision':'81d20919845b6a445969b9265aab5cec6b04cece', 'officialUrl':'https://pokedex.pokemon.cn/play/pokedex/api/v1', 'corrections':corrections, 'species':audited, 'movesById':move_ids, 'itemsById':item_ids, 'contexts':context, 'inputManifest':json.loads((CACHE / 'manifest.json').read_text(encoding='utf-8'))}
    dest = ROOT / 'tools/localization'
    dest.mkdir(parents=True, exist_ok=True)
    (dest / 'zh-cn-terms.json').write_text(json.dumps(audit, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    result = '/* Generated by tools/make_zh_names.py. Names verified by national dex ID; see docs/LOCALIZATION.md. */\n'
    result += 'G.I18n.add('+json.dumps(names, ensure_ascii=False, indent=2)+", 'zh-CN');\n"
    for group, data in context.items():
        result += 'G.I18n.add('+json.dumps(data, ensure_ascii=False, indent=2)+", 'zh-CN', '"+group+"');\n"
    (ROOT / 'js/data/lang-zh-cn-names.js').write_text(result, encoding='utf-8')
    print(json.dumps({'officialSpecies':len(audited), 'moveLabels':len(labels), 'corrections':corrections}, ensure_ascii=False))
