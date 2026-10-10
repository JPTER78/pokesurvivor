# SEO y dominio pokesurvivor.com

Todo lo técnico ya está preparado en el código. Falta lo que sólo puedes hacer tú
(comprar el dominio, configurar el DNS y dar de alta la web en Google).

## Qué hay preparado

| Archivo | Para qué |
|---|---|
| `index.html` | Título y descripción pensados para búsquedas ("juego Pokémon gratis online", "estilo Survivor.io"), dirección canónica, tarjetas para redes (Open Graph / Twitter), datos estructurados `VideoGame` (gratis, 1-4 jugadores, navegador/Android/iOS) y un texto real mientras carga (con `<h1>`). |
| `guia/` | Guía con cómo se juega, características, consejos y **preguntas frecuentes** (con datos `FAQPage`, que Google puede enseñar desplegables en los resultados). |
| `pokedex/` | Los 966 Pokémon jugables con sus tipos y sprites: atrae búsquedas tipo "juego con Pikachu gratis". |
| `404.html` | Página de "no existe" con enlaces al juego (GitHub Pages la usa sola). |
| `robots.txt` | Permite rastrear todo menos `tools/` y `docs/`, e indica el sitemap. |
| `sitemap.xml` | Las páginas que hay que indexar. |
| `assets/og-image.jpg` | La imagen que sale al compartir el enlace (1200×630). |
| `manifest.webmanifest`, iconos | App instalable, icono en el navegador y en el móvil. |

Las páginas se regeneran con `python tools/make_seo_pages.py` (por ejemplo, si
cambian los Pokémon o las características).

> **Importante:** las direcciones canónicas ya apuntan a `https://pokesurvivor.com/`.
> No publiques estos cambios hasta que el dominio funcione, o Google intentará
> indexar un dominio que todavía no existe.

## 1. Dominio

Los pasos para poner en marcha pokesurvivor.com (DNS en Cloudflare, GitHub Pages,
Firebase y el paso final) están en [DOMINIO.md](DOMINIO.md).

## 2. Google Search Console (lo más importante)

1. Entra en <https://search.google.com/search-console> con tu cuenta de Google.
2. **Añadir propiedad → Dominio** → `pokesurvivor.com`.
3. Google te da un registro **TXT**: añádelo en el DNS (nombre `@`) y pulsa Verificar
   (puede tardar unos minutos).
4. **Sitemaps** → enviar `sitemap.xml`.
5. **Inspección de URL** → `https://pokesurvivor.com/` → **Solicitar indexación**.
   Repite con `/guia/` y `/pokedex/`.

Bing (y con él DuckDuckGo y Ecosia): <https://www.bing.com/webmasters> → "Importar
desde Google Search Console".

## 3. Lo que más posiciona (fuera de la web)

Google sube las webs que otras webs enlazan y que la gente busca por su nombre:

- **Tráiler en YouTube** con el enlace en la primera línea de la descripción y el
  título "PokéSurvivor – Juego Pokémon gratis en el navegador".
- **itch.io**: crea una página del juego (gratis, en la categoría HTML5) con enlace.
- **Reddit**: r/PokemonROMhacks, r/incremental_games, r/WebGames, r/survivorslikes
  (lee sus normas; a muchos les gustan los fan games gratuitos sin anuncios).
- **Discord**: servidores de fan games de Pokémon y de "survivors-like".
- **TikTok / Shorts** con clips de 15 s (shinies, legendarios, cooperativo).
- Pide a quien lo juegue que lo enlace o lo comparta: cada enlace cuenta.

## 4. Con el tiempo

- Revisa en Search Console las **búsquedas** que te traen visitas y añade a la guía
  respuestas a esas dudas.
- Cada novedad grande: una entrada nueva (por ejemplo `novedades/`) y al sitemap.
- Las páginas cargan rápido (Lighthouse: guía y Pokédex 100/100/100/100).

## Aviso

"Pokémon" es una marca registrada. El nombre PokéSurvivor y el dominio pueden
atraer avisos de The Pokémon Company; el aviso legal y el carácter gratuito y
sin ánimo de lucro ayudan, pero no eliminan ese riesgo.

## Cómo se trabaja ahora (importante)

- **Se edita `dev.html`** (y los `js/`), no `index.html`. `dev.html` carga cada script
  por separado para programar; `index.html` es la versión para publicar, con todo en
  un solo `js/app.min.js` (la portada carga mucho más rápido).
- Antes de probar la versión final o de publicar:

```
node tools/build.js            # dev.html -> index.html + js/app.min.js
node tools/export_data.js      # datos del juego para las páginas
python tools/make_seo_pages.py # páginas en español e inglés, en/index.html, sitemap
```

## Idiomas

- El juego sale en **inglés o español** según el idioma del navegador y se cambia en
  Ajustes → Gráficos → Idioma. `/en/` abre el juego en inglés.
- Textos en inglés: `js/data/lang-en.js` (clave = el texto en español). Si añades un
  texto nuevo al juego, añade también su traducción ahí.
- Páginas: guía, Pokédex, legendarios, shinies, tipos, movimientos, objetos, logros y
  novedades, cada una en los dos idiomas y enlazadas entre sí (hreflang).
