# memory.md — contexto importante del proyecto

Notas para retomar el trabajo (humano o agente) sin releer todo. Actualízalo
cuando cambie algo de lo que hay aquí. La verdad de diseño está en `GDD.md`.

## Qué es

PokéSurvivor: bullet heaven (estilo Vampire Survivors / Survivor.io) con sprites
de Pokémon Mundo Misterioso. HTML + CSS + JS vanilla sobre Canvas 2D, sin build
para desarrollar y sin dependencias. Todo cuelga del global `G`. El código y
los textos del juego están en español; el inglés sale de un diccionario
(`js/data/lang-en.js`, clave = texto español exacto, `{x}` para huecos).

## Cómo se lanza y se prueba

- **Desarrollo:** `python -m http.server 8123` en la raíz y abrir
  `http://localhost:8123/dev.html` (carga cada script por separado). Se edita
  `dev.html`, nunca `index.html`.
- **Producción:** `node tools/build.js` genera `index.html` + `js/app.min.js`
  (terser por npx). `index.html` se puede abrir con doble clic.
- **Pruebas:** `node tools/test.js` (datos y lógica en un sandbox `vm`, sin
  navegador; 54 pruebas). Correrlas antes de cada commit.
- **Páginas estáticas (SEO):** `node tools/export_data.js` y luego
  `python tools/make_seo_pages.py` regeneran `movimientos/`, `guia/`, `en/`…
- **Equilibrio de fusiones:** `node tools/fusion-balance.js` imprime la tabla.
- **Ojo con la caché:** `sw.js` registra un service worker que cachea los
  scripts. Si ves código viejo tras cambiar algo: recarga forzada
  (Ctrl+Shift+R) o en DevTools → Application → Service Workers → Unregister
  y borrar Cache Storage.
  Además, python http.server no manda cabeceras de caché y Chrome reutiliza los
  scripts de la caché HTTP: en DevTools → Network marca "Disable cache", o haz
  fetch(url, { cache: "reload" }) de cada script antes de recargar.
- El sonido se guarda en `localStorage` (`ps.audio`); el juego arranca con
  música tras el primer clic.

## Estado del combate (rama `movimientos-a-la-vez`, octubre 2026)

- **Todos los movimientos aprendidos disparan a la vez** (4 huecos de serie; la
  mejora permanente Huecos de la tienda añade hasta 2 más), cada uno
  con su recarga y su propio objetivo (`G.Combat.aimFor`). El **enfocado**
  (teclas 1-6, Q/E, o tocar su icono) pega ×1,25 y decide a dónde mira el
  Pokémon. Cinta Elección impide cambiar el enfoque.
- **Pasivas:** hasta 4, nivel 1-5 (`js/data/passives.js`); sustituyen a las
  antiguas cartas de stat. Las evoluciones de movimientos piden LLEVAR la
  pasiva de su condición.
- **60 movimientos** de ataque en 14 familias; los potenciadores (buff) ya no
  existen. Cuerpo a cuerpo y embestida pegan ×1,4 de base.
  La embestida es de ida y vuelta (Player.startLunge): golpea el camino,
  invulnerable, y el Pokémon regresa a su sitio.
  La cámara sigue pl.anchor(): durante la embestida, el origen (no da bandazos),
  y las teclas siguen moviendo ese origen (si no, parecería cámara lenta).
- **Fusiones (vínculos):** cada legendario vencido da un vínculo. Fusiona dos
  movimientos que lleves, **los dos al nivel máximo**, en uno nuevo que ocupa
  un hueco. 30 recetas en `js/data/fusions.js`, cada uno de los 60 movimientos
  en una sola. La fusión **nace en nivel 1** ya ~15% por encima de su mejor
  origen al máximo y evolucionado (modelo de `tools/fusion-balance.js`, lo
  comprueba una prueba) y su escalera propia da +20% daño y −8% recarga por
  nivel. Sin receta posible, el vínculo da un Impulso (un movimiento al
  máximo). La pantalla avisa de los pares pendientes.
- **Reacciones elementales** (`js/systems/reactions.js`): Vapor (agua sobre
  quemado), Rotura (roca/acero/lucha/tierra sobre frenado, ×1,6), Detonación
  (fuego sobre envenenado), Conducción (eléctrico sobre empapado), Congelación
  (hielo sobre empapado). Estados nuevos: empapado (2,5 s, lo deja el agua) y
  congelado (1,2 s, no se mueve ni ataca). Pausa de 0,5 s por enemigo
  (`reactT`, por marca de tiempo: funciona también en las copias remotas).
- **Vida enemiga** escalada con la media de ataques del equipo:
  ×(1 + 0,4·(ataques − 1)), jefes 0,3 (`G.Spawner.powerK`).
- **Líquidos** (`js/world/liquid.js`): los de tipo Agua nadan (×1,15, +1
  vida/s, reciben +15% daño); los Voladores planean (sin frenazo ni resbalón,
  lava a la mitad, recargas +10%).

## Dónde está cada cosa

| Qué | Dónde |
|---|---|
| Catálogo y escaleras de movimientos, evoluciones, `register()` | `js/data/moves.js` |
| Pasivas / fusiones | `js/data/passives.js` / `js/data/fusions.js` |
| Recargas, apuntado por movimiento, `damage()` (único punto de daño), colisiones | `js/systems/combat.js` |
| Cómo se ejecuta cada familia (proyectil, rayo, minas…) y los campos del suelo | `js/systems/move-kinds.js` |
| Reacciones elementales | `js/systems/reactions.js` |
| Jugador: `moves`, `passives`, `focus`, `fuse()`, `packMoves/parseMoves` (coop) | `js/entities/player.js` |
| Cartas de nivel | `js/systems/levelup.js` |
| HUD (fila de 6 ataques + fila de pasivas) | `js/ui/hud.js` |
| Pantalla de fusión y cartas | `js/ui/run-ui.js` |
| Cooperativo: el estado manda toda la lista de movimientos (`mvs`) y bits de estado (1 quemado, 2 veneno, 4 escudo, 8 frenado, 16 empapado) | `js/net/coop.js` |
| Diseño y plan de este cambio | `docs/superpowers/specs/2026-10-11-multi-move-combat-design.md`, `docs/superpowers/plans/2026-10-11-multi-move-combat.md` |

## Convenciones

- Commits en español. Sin emojis en el juego (iconos pixel art en
  `js/ui/icons.js`).
- Un texto nuevo en español → su entrada en `lang-en.js` (hay pruebas que lo
  comprueban para movimientos, fusiones, pasivas y reacciones).
- Al añadir un script nuevo: tag en `dev.html` en orden de dependencias.
- Al cambiar datos o textos: regenerar páginas y hacer `node tools/build.js`
  antes de commit (index.html y app.min.js van al repositorio).

## Pendiente / ideas apuntadas

- Menores de la revisión: `powerK` cuenta también a los jugadores caídos;
  los enemigos de tipo Agua/Volador heredan los privilegios de los líquidos;
  el empuje se acumula mientras un enemigo está congelado; código muerto de
  los potenciadores en `vfx.js`, `audio.js` y `game.js`.
- Equilibrio real de fusiones y de `powerK` tras jugar de verdad: el margen
  del 15% y los factores por familia están en `tools/fusion-balance.js`.
