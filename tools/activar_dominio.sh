#!/usr/bin/env bash
# Paso final del dominio pokesurvivor.com (ver docs/DOMINIO.md).
#   DRY=1 bash tools/activar_dominio.sh   ensayo: prepara todo, enseña qué se subiría y lo deja como estaba
#   bash tools/activar_dominio.sh         prepara y hace el commit (el push y GitHub Pages, aparte)
set -euo pipefail
cd "$(dirname "$0")/.."
DOMAIN=pokesurvivor.com

# 1. El juego con los bloques SEO, los datos y las páginas en los dos idiomas.
node tools/build.js
node tools/export_data.js
python tools/make_seo_pages.py

# 2. Dominio propio para GitHub Pages.
echo "$DOMAIN" > CNAME

FILES=(CNAME .gitignore index.html js/app.min.js 404.html robots.txt sitemap.xml assets/og-image.jpg
       apoyar en guia legendarios logros movimientos novedades objetos pokedex shinies tipos
       docs/SEO.md docs/DOMINIO.md tools/export_data.js tools/make_seo_pages.py tools/activar_dominio.sh)
git add "${FILES[@]}"
echo "--- se subiría:"
git diff --cached --stat | tail -5
git diff --cached --name-only | grep -c . | xargs echo "archivos:"

deshacer() { git reset -q; rm -f CNAME; node tools/build.js --sin-seo; }

# Nunca datos privados (este script no cuenta: contiene las palabras que busca).
if git diff --cached -- . ':(exclude)tools/activar_dominio.sh' | grep -qiE "jonathanclase78|assesingamerxd|CONTACTOS_CREADORES"; then
  echo "ERROR: hay datos privados en lo que se va a subir"; deshacer; exit 1
fi

if [ "${DRY:-0}" = "1" ]; then
  deshacer
  echo "--- ensayo terminado: todo como estaba"
  exit 0
fi

git commit -q -m "Dominio propio $DOMAIN: páginas en español e inglés, sitemap y CNAME"
echo "--- commit hecho. Falta: git push y, en GitHub Pages, el dominio y HTTPS."
