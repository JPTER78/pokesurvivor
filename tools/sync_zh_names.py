#!/usr/bin/env python3
"""Sync Traditional Chinese Pokemon/move names from a pinned PokeAPI snapshot."""
import ast
import csv
import io
import json
import re
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
COMMIT = "5ee47a9a9c1229632ec4b473a9c1c53026e005dd"
BASE = f"https://raw.githubusercontent.com/PokeAPI/pokeapi/{COMMIT}/data/v2/csv/"
LANG = 4  # zh-Hant, zh-TW


def csv_rows(filename):
    with urllib.request.urlopen(BASE + filename, timeout=30) as response:
        return list(csv.DictReader(io.StringIO(response.read().decode("utf-8-sig"))))


def js_pairs(text):
    token = r'("(?:\\.|[^"\\])*"|\'(?:\\.|[^\'\\])*\')'
    pattern = re.compile(token + r"\s*:\s*" + token, re.S)
    return {ast.literal_eval(key): ast.literal_eval(value) for key, value in pattern.findall(text)}


def norm(text):
    import unicodedata
    return "".join(ch for ch in unicodedata.normalize("NFKD", text.casefold())
                   if not unicodedata.combining(ch) and ch.isalnum())


def main():
    move_name_rows = csv_rows("move_names.csv")
    ability_name_rows = csv_rows("ability_names.csv")
    ability_ids = {int(r["id"]): r["identifier"] for r in csv_rows("abilities.csv")}
    zh_abilities = {int(r["ability_id"]): r["name"] for r in ability_name_rows
                    if int(r["local_language_id"]) == LANG}
    en_abilities = {int(r["ability_id"]): r["name"] for r in ability_name_rows
                    if int(r["local_language_id"]) == 9}
    zh_species = {int(r["pokemon_species_id"]): r["name"] for r in csv_rows("pokemon_species_names.csv")
                  if int(r["local_language_id"]) == LANG}
    zh_moves = {int(r["move_id"]): r["name"] for r in move_name_rows
                if int(r["local_language_id"]) == LANG}
    en_moves = {int(r["move_id"]): r["name"] for r in move_name_rows
                if int(r["local_language_id"]) == 9}
    move_ids = {int(r["id"]): r["identifier"] for r in csv_rows("moves.csv")}
    en_dict = js_pairs((ROOT / "js/data/lang-en.js").read_text(encoding="utf-8"))
    es_to_en = en_dict

    pokedex_text = (ROOT / "js/data/pokedex.js").read_text(encoding="utf-8")
    dex = [{"dex": int(n), "name": name} for n, name in re.findall(r'\{"dex":(\d+),"name":"([^"\\]*(?:\\.[^"\\]*)*)"', pokedex_text)]
    current_path = ROOT / "js/data/lang-zh-TW.js"
    current_text = current_path.read_text(encoding="utf-8")
    translations = js_pairs(current_text)

    species_audit = []
    for p in dex:
        number, name = p["dex"], p["name"]
        zh = zh_species.get(number)
        if not zh:
            raise SystemExit(f"Missing PokeAPI zh-Hant species {number} ({name})")
        species_audit.append({"dex": number, "game_name": name, "key": name,
                              "source_species_id": number, "zh_hant_name": zh})
        translations[name] = zh

    move_pattern = re.compile(r"\{\s*id:\s*'([^']+)'\s*,\s*name:\s*'([^']+)'", re.M)
    move_audit = []
    source_moves_by_en = {norm(name): mid for mid, name in en_moves.items()}
    moves_text = (ROOT / "js/data/moves.js").read_text(encoding="utf-8")
    move_rows = move_pattern.findall(moves_text)
    for game_id, game_name in move_rows:
        english = es_to_en.get(game_name, "")
        canonical_id = source_moves_by_en.get(norm(english)) if english else None
        zh = zh_moves.get(canonical_id) if canonical_id else None
        status = "canonical_match" if zh else "custom_or_unmatched"
        if zh:
            translations[game_name] = zh
        move_audit.append({"game_id": game_id, "game_name": game_name, "english_name": english or None,
                           "role": "base", "parent_game_id": None,
                           "source_move_id": canonical_id,
                           "source_identifier": move_ids.get(canonical_id) if canonical_id else None,
                           "zh_hant_name": zh, "status": status,
                           "game_slug_matches_source": bool(canonical_id and game_id == move_ids[canonical_id]),
                           "note": None if zh else "No defensible canonical move match; kept existing game translation."})

    evo_text = moves_text[moves_text.index("const EVO = {"):moves_text.index("// Lo que gana al evolucionar")]
    evo_rows = re.findall(r"'([^']+)'\s*:\s*\['([^']+)'\s*,", evo_text)
    for parent_id, game_name in evo_rows:
        english = es_to_en.get(game_name, "")
        canonical_id = source_moves_by_en.get(norm(english)) if english else None
        zh = zh_moves.get(canonical_id) if canonical_id else None
        status = "canonical_match" if zh else "custom_or_unmatched"
        ability_id = 68 if game_name == "Enjambre" else None
        if zh:
            translations[game_name] = zh
        else:
            zh = zh_abilities.get(ability_id) if ability_id else translations.get(game_name)
            if zh:
                translations[game_name] = zh
        move_audit.append({"game_id": parent_id + "#evolution", "game_name": game_name,
                           "english_name": english or None, "role": "evolution", "parent_game_id": parent_id,
                           "source_move_id": canonical_id, "source_identifier": move_ids.get(canonical_id) if canonical_id else None,
                           "source_ability_id": ability_id,
                           "source_ability_identifier": ability_ids.get(ability_id) if ability_id else None,
                           "source_ability_english_name": en_abilities.get(ability_id) if ability_id else None,
                           "source_ability_zh_hant_name": zh_abilities.get(ability_id) if ability_id else None,
                           "zh_hant_name": zh, "status": status,
                           "game_slug_matches_source": None,
                           "note": ("Game-created evolution label derived from canonical ability Swarm (ID 68); ability name source-backed, not a canonical move."
                                    if ability_id else None if status == "canonical_match" else "Game-created evolution label; no defensible canonical move match, existing translation retained.")})

    # Keep all existing UI translations and keys, replacing only Pokemon/move labels.
    lines = ["/* Traditional Chinese (Taiwan); names synced from pinned PokeAPI data. */", "G.I18n.add({"]
    lines.extend("  " + json.dumps(k, ensure_ascii=False) + ": " + json.dumps(v, ensure_ascii=False) + ","
                 for k, v in translations.items())
    lines.append("}, 'zh-TW');")
    current_path.write_text("\n".join(lines) + "\n", encoding="utf-8")

    source = {"repository": "https://github.com/PokeAPI/pokeapi", "commit": COMMIT,
              "language_id": LANG, "language": "zh-hant", "locale": "zh-TW",
              "csv_urls": {f: BASE + f for f in ["pokemon_species_names.csv", "move_names.csv", "pokemon_species.csv", "moves.csv", "ability_names.csv", "abilities.csv"]},
              "note": "PokeAPI is community-maintained. These names are source-backed, not officially audited by The Pokemon Company."}
    manifest = {"source": source, "species": species_audit, "moves": move_audit}
    (ROOT / "docs/zh-TW-names.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Synced {len(species_audit)} species; {sum(m['status']=='canonical_match' for m in move_audit)}/{len(move_audit)} canonical move/evolution names; {len(translations)} dictionary keys.")


if __name__ == "__main__":
    main()
