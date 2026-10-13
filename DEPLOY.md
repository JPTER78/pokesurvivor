# Guía de despliegue: anti-trampas del ranking

Paso a paso para publicar los cambios de la PR de anti-trampas (resumen de partida,
grabación, reglas del ranking más estrictas, consola protegida). Pensada para quien
publica el juego; no hace falta conocer el código. Tiempo: ~30 minutos.

> **Orden que no se puede cambiar:** primero las reglas (`firebase deploy --only
> firestore`), después el juego (`git push`). Con el juego nuevo y las reglas viejas,
> las marcas del ranking se rechazan hasta que se despliegan las reglas.

Documentación del diseño: [docs/anticheat.md](docs/anticheat.md).

---

## 0. Requisitos (una vez)

| Qué | Para qué | Cómo |
|---|---|---|
| Node 20 o superior | build, generador de reglas, tests | <https://nodejs.org> |
| Python 3 | `tools/make_seo_pages.py` | ya lo usas para publicar |
| Java 21 o superior | emulador de Firestore (sólo para los tests) | <https://adoptium.net>; comprobar con `java -version` |
| `firebase-tools` | desplegar las reglas | `npm i -g firebase-tools` |
| Sesión en Firebase | desplegar | `firebase login` (con la cuenta dueña del proyecto) |
| Proyecto | a dónde se despliega | el repo ya trae `.firebaserc` con **pokesurvivor-free**. Comprobar: `firebase use` debe decir `pokesurvivor-free` |

> Nunca actives Identity Platform ni nada que lo active (ver `CLAUDE.md`). Desplegar
> sólo `firestore` no lo toca; **no** despliegues `functions`.

Carpeta aparte para las librerías de los tests (no se añade nada al repo):

```
mkdir %TEMP%\ps-test && cd %TEMP%\ps-test           (Windows)
mkdir /tmp/ps-test && cd /tmp/ps-test               (Mac / Linux)
npm init -y
npm i firebase-tools @firebase/rules-unit-testing firebase
```

---

## 1. Traer los cambios y ponerlos sobre `main`

```
git fetch origin
git checkout main && git pull
git merge --no-ff <rama de la PR>        # o el botón "Merge" de la PR en GitHub y luego git pull
```

Si prefieres rebasar la rama sobre `main` antes de fusionar:

```
git checkout <rama de la PR>
git rebase origin/main
```

Conflictos habituales (si `main` ha cambiado mientras tanto):

* `js/net/ranking.js`, función `store()`: conserva la línea de `main`
  `if ((known[key] || 0) >= entry.t) return;` y deja **después** las dos líneas del resumen
  (`let sm = ...` y `if (sm && !(await withReplay())) { failed = true; return; }`).
* `firestore.rules`: quédate con lo de `main` en los topes que ya existan (`d.t <= 2100`, la
  cuenta admin, el tope de guardado de la partida) y mantén de la PR `sm`, `smValid` y la
  colección `replays`.
* `js/data/changelog.js`: conserva las dos novedades.

Los archivos compilados (`index.html`, `js/app.min.js`, `version.json`) **no** vienen en la
PR: se generan en el paso 5.

---

## 2. Decidir la fecha de transición y regenerar las reglas

Las marcas del ranking llevan ahora un resumen de la partida y una grabación. Las pestañas
que aún no se han actualizado mandan marcas sin ellos; por eso, hasta una fecha, las reglas
aceptan las dos cosas. La fecha está al principio de `tools/make_rules.js`:

```js
const DEPLOY_PREVISTO = '2026-10-20';                 // día en que piensas desplegar
const SM_OBLIGATORIO  = ... addDays(DEPLOY_PREVISTO, 7)   // 7 días después (UTC)
```

1. Pon en `DEPLOY_PREVISTO` el día real de despliegue (o fija la fecha con la variable de
   entorno `SM_OBLIGATORIO=AAAA-MM-DD`, sin tocar el archivo).
2. Regenera: `node tools/export_data.js`. Escribe `firestore.rules` (entre `<logros>` y
   `<resumen>`) y avisa si la calibración del daño ya no vale (paso 8).
3. `git diff firestore.rules` debe mostrar la fecha nueva en `smObligatorio()`.

Después de esa fecha una marca sin resumen ni grabación se rechaza (es lo previsto).

---

## 3. Tests de las reglas con el emulador

Desde la **raíz del repo**:

```
node tools/export_data.js                  # crea tools/cache/gamedata.json si no existe
```

Windows (PowerShell):

```
$env:NODE_PATH = "$env:TEMP\ps-test\node_modules"
& "$env:TEMP\ps-test\node_modules\.bin\firebase.cmd" emulators:exec --only firestore --project demo-ps "node tools/test_rules.js"
```

Mac / Linux:

```
NODE_PATH=/tmp/ps-test/node_modules /tmp/ps-test/node_modules/.bin/firebase emulators:exec --only firestore --project demo-ps "node tools/test_rules.js"
```

La primera vez descarga el emulador (~60 MB). Debe terminar con **`25 bien, 0 mal`** (26 si usas `SAMPLE`, ver abajo). Si
alguno falla, no despliegues: las reglas no son las que se probaron. (Los mensajes
`evaluation error ... for 'create'` que saca el emulador son los rechazos esperados, no
errores.)

Opcional, con una partida real: `SAMPLE=archivo.json` (lo que el juego manda a
`Ranking.submitSolo`) añade un test con ella.

---

## 4. Desplegar las reglas (ANTES del push)

```
firebase deploy --only firestore
```

* Sólo `firestore` (reglas e índices). **No** `--only functions` ni sin `--only`.
* Comprueba en la consola de Firebase → Firestore Database → **Reglas** que la fecha de
  publicación es la de ahora y que aparece `function smValid`.

---

## 5. Compilar, commit de los compilados y push (el mismo día)

```
node tools/build.js && node tools/export_data.js && python tools/make_seo_pages.py
```

(En Mac / Linux, `python3`.) `build.js` genera `index.html`, `js/app.min.js` y
`version.json`; el último es lo que hace que los jugadores se actualicen solos (en el menú,
a los 5 segundos; jugando, al acabar la partida).

Comprueba antes de subir:

* `git status`: deben cambiar `index.html`, `js/app.min.js`, `version.json`, `en/index.html`
  (y poco más; si `make_seo_pages.py` cambia muchas páginas sólo por saltos de línea, descarta
  esos cambios con `git checkout -- <páginas>`).
* Abre `index.html` en el navegador, juega 1 minuto y comprueba en F12 que escribir `G` da
  `ReferenceError` (el juego ya no es accesible desde la consola).

```
git add index.html js/app.min.js version.json en/index.html
git commit -m "Regenerar index.html, js/app.min.js y version.json"
git push origin main
```

**El push va el mismo día que el despliegue de las reglas** (idealmente en los minutos
siguientes). Si pasan días entre uno y otro, las marcas de los jugadores se rechazan o van
sin resumen hasta que se haga.

---

## 6. Comprobar en producción que funciona

Con una cuenta de prueba (no la de admin), en la web publicada, **después** de que se
actualice (recarga la página con Ctrl+F5):

1. Juega una partida de más de **60 segundos** (las más cortas no suben al ranking) y
   termínala (también vale abandonar).
2. Debe salir el aviso "¡Nueva mejor marca…!". F12 → Consola: no debe haber líneas
   `[Ranking] grabación:` ni `no se pudo guardar`.
3. Consola de Firebase → Firestore Database → Datos:
   * `replays/{uid de la cuenta}`: debe existir, con `rid`, `t` (los segundos jugados),
     `mode` (`s`), `v` (la huella de `app.min.js`), `n` > 0 y `log` con texto.
   * `lb/s_all2/e/{uid}`: la marca, con un campo **`sm`** (`px`, `up`, `cs`, `dd`, `pk`,
     `dt`, `mh` y `rid`). El `rid` de `sm` debe ser **igual** al de `replays/{uid}`.
   * `runs/{uid}`: `mode` = `s`.
4. Firestore → pestaña **Reglas** → *Monitor*: no debe haber una avalancha de "Denegado"
   en `lb` después del despliegue.
5. Una marca que se rechaza no se pierde: queda en el navegador (`localStorage`, clave
   `ps.rk.q.<uid>`) y se reintenta al entrar y antes de la siguiente partida.
6. Prueba de trampa (opcional): en F12 escribe `G.Game.player` → `ReferenceError`.

---

## 7. Rollback

Si las marcas honestas empiezan a rechazarse o algo no funciona:

**Reglas** (lo urgente: dejan de rechazar marcas):

```
git log --oneline -- firestore.rules                 # busca el commit anterior a la PR
git checkout <commit previo> -- firestore.rules
firebase deploy --only firestore
git checkout main -- firestore.rules                 # (deja el repo como estaba; o haz commit del rollback)
```

También sirve la consola: Firestore → Reglas → historial → *Restaurar* una versión anterior.

Con las reglas viejas, el juego nuevo mandaría marcas con el campo `sm` y se rechazarían
("campo desconocido"): si vuelves a las reglas viejas, **vuelve también el juego**:

```
git revert <commit de los compilados> && git push origin main
```

(`version.json` cambia y los jugadores se actualizan solos.) Las grabaciones ya subidas
(`replays/*`) pueden quedarse; no estorban.

Los datos de los jugadores no se tocan en ningún caso: una partida marcada o una marca
rechazada nunca borra nada de la partida guardada.

---

## 8. Si cambia el balance del juego

Las reglas calculan las cotas del resumen a partir de los datos del juego. Cada vez que
cambie algo de lo siguiente hay que regenerar las reglas, pasar los tests y desplegar
(pasos 2 a 5):

| Cambio | Qué hacer |
|---|---|
| Un **objeto** nuevo o con otros efectos (`js/data/items.js`), un altar (`js/systems/interact.js`), mejoras (`js/data/upgrades.js`) o cartas de stat (`js/systems/levelup.js`) | `node tools/export_data.js`. Ejemplo: un objeto que da vida es **una línea**, `mods: { hp: 30 }`, y la cota de vida máxima sube sola. |
| Stats de los Pokémon (`tools/fetch_pokedex.py`) | `node tools/export_data.js` (la tabla de vida y ataque va en las reglas). |
| Un movimiento nuevo, o cambiar daño, recarga, mejoras o evolución de uno; la tabla de tipos; la fórmula de daño de `js/systems/combat.js` | **Recalibrar**: `node tools/calibrate_dps.js` (ver abajo) y luego `node tools/export_data.js`. |
| Tiempo máximo de una partida (hoy 35 min) | Cambiar `MAX_T` en `js/core/integrity.js`, `d.t <= 2100` en `validEntry` y `request.resource.data.t <= 2100` en `replays` (`firestore.rules`). |
| Cartas de stat por nivel | `Player.takeStat` (`js/entities/player.js`) y `CARD_SLACK` en `tools/make_rules.js`. |

`node tools/export_data.js` avisa con **`AVISO: han cambiado movimientos, tipos...`** si la
calibración ya no vale, y **falla** si hay un movimiento sin calibrar.

**Recalibrar el daño** (`tools/calibrate_dps.js`, ~15-25 min, abre Chrome y juega cada
movimiento contra un muñeco):

```
cd (carpeta ps-test) && npm i puppeteer-core
cd (raíz del repo)
NODE_PATH=<carpeta ps-test>/node_modules CHROME="<ruta a chrome>" node tools/calibrate_dps.js
node tools/export_data.js
git diff tools/anticheat_calib.json firestore.rules
```

Después, tests (paso 3), reglas (paso 4), compilar y push (paso 5).

---

## Modo desarrollador (para probar en local)

`dev.html` deja `G` a la vista de la consola, así que **vuelve a `index.html`** salvo si
estás en local, la dirección lleva `?dev=1` y has puesto una vez en la consola
`localStorage.ps.dev = 1`. Ej.: `http://localhost:8000/dev.html?dev=1`. Sólo en ese modo
las partidas con `G` expuesto cuentan para el ranking (para poder probarlo). En cualquier
otro caso, una partida con `G` expuesto no sube al ranking.
