# Anti-trampas del ranking

Lo que hay hoy (fase 1) y el diseño de un verificador en el servidor (fase 2).

**Idea de fondo:** el juego corre en el navegador del jugador, así que nada del cliente es
infalible. Lo que se puede hacer es (1) que lo fácil —tocar cosas desde la consola— ya no
funcione, (2) que el servidor rechace lo imposible y lo que no cuadra, y (3) guardar cada
marca con lo necesario para **volver a jugarla y comprobarla**. Sólo (3) acaba con las
trampas de verdad; las otras dos suben el listón.

Reglas del proyecto que se respetan: nunca se borra nada de lo que el jugador gana jugando
(una partida marcada no sube al ranking, pero se guarda como siempre), no se activa nada que
cobre (plan Spark de Firebase: **nada de Cloud Functions**, que exigen plan de pago), y el
servidor sigue sin rechazar guardados de partida (sólo marca con `sus`).

---

## 1. Qué hay hoy

### Cliente

| Capa | Dónde | Qué hace |
|---|---|---|
| `G` fuera de la consola | `tools/build.js` | `js/app.min.js` va dentro de una función y `G` ya no es global: `G.Game.player` desde F12 da `ReferenceError`. `dev.html` deja `G` a la vista, así que **vuelve a `index.html` salvo en modo desarrollador**: en local, con `?dev=1` en la dirección **y** `localStorage.ps.dev = 1` (se pone a mano en la consola). Una partida con `G` expuesto fuera de ese modo **no sube al ranking**; en modo desarrollador sí, para poder probarlo. |
| Stats de sólo lectura | `js/entities/player.js` | `atkMul`, `spdMul`, `cdMul`, `dmgReduce`, `regenFlat`, `magnet`, `xpMul`, `coinMul`, `critChance`, `baseAtk`, `baseSpd`, `maxHp`, `hp`, `invuln`, `dead`, `item`, `buffs` y `power` son propiedades no configurables, sin escritura posible desde fuera. Escribir no cambia nada y marca la partida. |
| Stats calculados | `player.js`, `levelup.js`, `items.js`, `interact.js` | Los stats se recalculan **desde cero** a partir de sus fuentes (mejoras compradas, cartas de stat, objeto, altar). `addMaxHp` ya no existe; `takeStat(id)` sólo acepta cartas de `LevelUp.STATS`, respeta su tope y una carta por nivel como mucho. |
| Auditoría de movimientos | `js/data/moves.js` (`audit`) | Cada segundo se comprueba que cada movimiento vale lo que le toca por su nivel y evolución (se recalcula con `instance`). Si alguien tocó `dmg`, `cd`, `lvl`... se restaura y se marca la partida. |
| Partida marcada | `js/core/integrity.js` | Una partida marcada no sube al ranking, no bate récords, no da logros ni misiones y sus monedas se limitan a lo posible. Un aviso lo cuenta. Nunca se rompe el juego ni se borra nada. |
| Verosimilitud | `Integrity.check` | Al acabar, nivel, derrotados y monedas tienen que ser posibles para ese tiempo (mismos topes que el servidor). |
| Libro de la partida | `integrity.js` | Daño hecho, pico de daño a un enemigo en 1 s, daño recibido y vida máxima, en variables cerradas que sólo escribe el propio juego. De ahí sale el resumen del ranking (§2). |
| Grabación | `js/core/replay.js` | Semilla, Pokémon, mejoras, entradas y elecciones (§3). |

### Servidor (`firestore.rules`)

* `t` ≤ tiempo real desde que empezó la partida (`runs/{uid}`) + 30 s; ≤ 35 min (`MAX_T` en
  `js/core/integrity.js`, a juego con las reglas); nivel y derrotados con margen.
* La marca tiene que ser del mismo modo que la partida empezada: `s_…` con `mode = 's'`,
  `g_…` con `mode = 'g'`.
* Resumen de partida `sm` (§2) y grabación `replays/{uid}` (§3) enlazados por `sm.rid`.
* Lo de antes: la cuenta no puede estar marcada (`sus`), una marca sólo mejora.

### Límites (hay que decirlo claro)

* **Quien modifique el JS** (descargar `app.min.js`, parchearlo y servirlo, un proxy que lo
  cambie, un depurador que edite variables en un punto de parada) salta casi todo lo del
  cliente. Es el límite de cualquier juego en el navegador.
* Si se consigue un puntero al jugador (p. ej. un `setter` en `Object.prototype` que lo
  atrapa al construirse; se probó), las propiedades protegidas siguen sin dejarse tocar,
  pero **los métodos públicos se pueden llamar** (`heal`, `grantInvuln`, `equip`, `gainXp`,
  `G.Moves.levelUp`...) y otros datos (`kills`, `level`, `coins`, la lista de enemigos...)
  son editables. Las cartas tienen presupuesto, el resto no.
* Un `hp` que se cura o una invulnerabilidad pedida a mano en bucle desde un puntero
  capturado no se distingue de la legítima: sólo la repetición en el servidor (fase 2) lo pilla.
* El resumen lo escribe el cliente: quien falsifique la petición a Firestore puede mandar
  un resumen coherente. Por eso hace falta la grabación y, después, el verificador.
* Los topes de daño son **cotas**, no un cálculo exacto: dejan fuera lo imposible, no lo
  "demasiado bueno".

---

## 2. Resumen de partida (`sm`) y sus cotas

Se sube dentro de cada marca del ranking (`lb/{tabla}/e/{id}.sm`):

| Campo | Qué es | De dónde sale |
|---|---|---|
| `px` | Pokémon del que sube la marca (en grupo, el del anfitrión) | `pl.dex` |
| `up` | nivel de cada mejora permanente comprada (sólo las > 0) | `Upgrades.perks().lv` (ya recortado al tope) |
| `cs` | cuántas veces se cogió cada carta de stat (`hp`, `atk`, `spd`, `cd`, `def`, `rgn`, `mag`, `xp`) | contador privado de `Player.takeStat` |
| `dd` | daño de golpes hecho (con tipos y críticos, sin recortar al sobrante) | libro, en `Combat.hit` y proyectiles |
| `pk` | pico de daño a UN enemigo en una ventana de 1 s | libro (`Integrity.tick`) |
| `dt` | daño recibido (el que de verdad quitó vida) | libro, en `Player.hurt` |
| `mh` | vida máxima | libro |
| `rid` | id de la grabación subida | `Replay.rid` |

Las reglas (`smValid` en `firestore.rules`) exigen:

1. **Forma:** sólo esos campos, enteros no negativos, `px` es un Pokémon que existe y está en
   el equipo de la marca, `up` y `cs` sólo con ids conocidos y dentro de su tope
   (Fuerza ≤ 10, Potencia ≤ 40, Carrera ≤ 8...) y, además, **no más cartas de stat que niveles + 2** (el juego deja nivel + 1; el margen cubre que en grupo el nivel del anfitrión llegue tarde).
2. **Vida máxima exacta:** `mh = vida base del Pokémon + 8·up.hp + 20·cs.hp` (±1). Los 8 y los 20 salen de los datos del juego al generar las reglas (`Upgrades.perks` y la carta Vigor). **Para añadir un objeto que dé vida** basta una línea, `mods: { hp: N }` en `js/data/items.js`, y volver a generar las reglas (`node tools/export_data.js`): la cota sube sola en N. Lo mismo para objetos y altares de ataque y recarga.
3. **Pico de daño acotado:** `pk ≤ PK · A · 3,6 · crit · 4 / R`, con
   * `PK` = daño máximo a un enemigo por segundo y punto de ataque, **medido** con todos los
     movimientos al máximo y evolucionados (`tools/calibrate_dps.js`, ×2 de margen),
   * `A` = ataque base del Pokémon · (1 + 0,04·up.atk) · 1,1^cs.atk · 2,8 (objeto ×1,4 y altar ×2)
     · mejor Danza de ataque,
   * 3,6 = ventaja de tipo máxima (2,4) por clima (1,5), `crit` = 1,5 si compró Golpe Crítico,
   * 4 = movimientos lanzados a la vez (fusión),
   * `R` = recarga mínima = (1 − 0,03·up.cd) · 0,92^cs.cd · 0,48 (Garra Rápida ×0,8, altar ×0,6).
4. **Daño total acotado por el pico:** `dd ≤ pk · t · 100` (como mucho ~100 enemigos distintos por segundo).
5. **No invulnerable:** con `t ≥ 300 s`, `dt ≥ 1`.
6. **Grabación:** `rid` es el de `replays/{uid}`, y esa grabación es del mismo `t`.

Los datos por Pokémon (vida y ataque base) van en las reglas como texto de 3 cifras por
Pokémon, porque una lista de ~1.000 números revienta el tope de 1.000 expresiones por
petición. Lo escribe `tools/make_rules.js` (lo llama `tools/export_data.js`) entre las marcas
`<resumen>`; no se edita a mano.

Ejemplo con los números de hoy: un Scorbunny (ataque 1,09) sin mejoras ni cartas puede
declarar hasta ~2·10⁶ de pico de daño por segundo; en partidas reales de prueba salen
unos cientos. Las cotas son **muy amplias a propósito** (cada factor es el peor caso y se
multiplican): dejan fuera lo imposible por órdenes de magnitud, no un "×2 de daño". Lo
que sí es exacto es la vida máxima y que las mejoras y cartas estén dentro de sus topes.

> Hay que **repetir `tools/calibrate_dps.js`** y `tools/export_data.js` si cambia algún
> movimiento (daño, recarga, mejoras, evolución), el daño base, la tabla de tipos o las cartas
> y mejoras, y volver a desplegar las reglas.

### Transición

Hasta la fecha `SM_OBLIGATORIO` (UTC; constante al principio de `tools/make_rules.js`, por defecto
**7 días después de `DEPLOY_PREVISTO`**, hoy 27-10-2026; se cambia ahí o con
`SM_OBLIGATORIO=AAAA-MM-DD node tools/export_data.js`) las marcas sin `sm` ni grabación se siguen
aceptando, para las pestañas sin actualizar. Después son obligatorios. Orden de publicación: **primero las reglas** (`firebase deploy --only
firestore`), luego el juego (`git push`). Con el juego nuevo y las reglas viejas, las marcas
se rechazan (campo `sm` desconocido) hasta que se despliegan.

Pruebas de las reglas: `tools/test_rules.js` (emulador de Firestore; instrucciones en su
cabecera). Cubre una marca honesta, la partida real que el juego manda (opcional,
`SAMPLE=archivo.json`), el caso más cargado para el tope de 1.000 expresiones por petición
(grupo de 4 con todas las mejoras y cartas) y cada trampa. Si se añaden comprobaciones a
`smValid`, hay que volver a pasarlo: las reglas **fallan cerradas** al pasarse del tope,
es decir, rechazarían marcas honestas.

Para mirar una grabación: `node tools/replay_decode.js grabacion.json`.

---

## 3. Grabación de la partida (`replays/{uid}`)

`js/core/replay.js` registra, en tiempo de partida (segundos de juego, al milisegundo):

* **Cabecera:** versión del juego (la huella de `app.min.js`), semilla del mundo, Pokémon,
  variocolor, mejoras, movimientos iniciales, atajos y vetos, modo y nº de jugadores.
* **Entradas:** cada cambio del joystick o las teclas (cuantizado a 1/127), cartas elegidas
  (hash de 16 bits de su clave), cambios de cartas, objeto elegido, fusiones, cambios de
  movimiento y abandonar.
* **Puntos de control** cada 30 s: nivel, derrotados, posición, vida y experiencia, para saber
  en qué momento una repetición se separa de la partida real.

Formato: eventos `[Δt en ms (varint), código, a (zigzag varint), b (zigzag varint)]` en
base64url. Tope de ~90 KB sin codificar (se marca `trunc`); lo normal, 10-40 KB en una
partida de 30 min.

**Cuándo se sube:** una vez por partida, **sólo si alguna tabla del ranking va a escribirse**
(`Ranking.store`), antes de la primera escritura, y la marca la cita con `sm.rid`. La
subida se reintenta con espera creciente (0, 1,5 y 4 s). Si sigue fallando, la marca **no se pierde**:
se guarda con su grabación en una cola de `localStorage` (`ps.rk.q.<uid>`, como mucho 2 marcas y 3 días) y se
reintenta al entrar y antes de empezar otra partida (para que `runs/{uid}` aún tenga la hora de ésa).
A la 3.ª vez va en formato antiguo (sin resumen), válido hasta `SM_OBLIGATORIO`. Se guarda **una por jugador**
(la última que subió una marca) y se borra al borrar la cuenta. Sólo la leen su dueño, el
admin y el verificador (credenciales de servicio).

**Coste:** ≤ 1 escritura extra por partida que mejora una tabla, y ≤ ~120 KB por jugador
que alguna vez haya puntuado: con 10.000 jugadores, ~1 GB como mucho, que es el tope gratuito.
Si hace falta, bajar `MAX_BYTES` o guardar sólo la grabación de quien entra en el top 50.

### Lo que falta para que sea REPRODUCIBLE

Hoy la grabación **registra** pero no basta para repetir la partida bit a bit, porque la
simulación no es determinista:

1. ~96 llamadas a `Math.random()` en simulación (enemigos, aparición, críticos, cartas, botín...).
2. Pasos de tiempo variables (`dt` = lo que tarda cada fotograma, con tope 1/30).
3. Relojes de pared dentro de la simulación (`performance.now()` en órbitas, banda focus, Arceus).
4. Funciones trigonométricas (`Math.sin/cos/atan2/hypot`, ~180 usos) que pueden diferir
   en la última cifra entre motores (V8, SpiderMonkey, JavaScriptCore).
5. El orden de iteración y el estado del DOM/`Input` entran a veces en la simulación.
6. En cooperativo, la simulación depende del anfitrión y de la red (fuera de alcance de la fase 2).

---

## 4. Fase 2: verificador en el servidor

### Objetivo

Para cada marca que entra en un top (o por muestreo), volver a jugar la grabación en un
simulador sin pantalla y comprobar que el resultado es el que se anunció.

### Dónde corre (sin gastar)

No en Cloud Functions (plan de pago). Un **script de Node** con `firebase-admin` y una cuenta
de servicio, lanzado por el dueño a mano o con un **GitHub Action programado** (gratis):

```
verifier/ (nuevo)
  run.js            lee replays/{uid} pendientes y las marcas que los citan, verifica, escribe veredictos
  sim.js            carga los mismos archivos del juego en un contexto aislado (como tools/export_data.js)
```

Veredicto: `verified/{rid} = { ok, t, reason, checkedAt }` (colección sólo de servidor). Si
`ok = false`: borrar la fila del ranking (`lb/…/e/{id}` y `lbs/{tabla}`) con las credenciales
de servicio, apuntarlo en `reports/` y marcar la cuenta (`saves/{uid}.sus = true`) sólo por
decisión del dueño (el servidor sigue sin rechazar guardados).

### Algoritmo

1. Leer la grabación y comprobar su `v` contra la versión de `version.json` en esa fecha (el
   verificador guarda la copia de cada `app.min.js` publicado: `git show <commit>:js/app.min.js`).
2. Crear el juego en un contexto `vm` **sin pantalla** (modo `headless`: sin canvas, sprites,
   audio ni efectos; los sprites aportan tamaños de cuerpo, hay que dejarlos).
3. Arrancar la partida con la cabecera: semilla, Pokémon, mejoras, atajos, vetos.
4. Avanzar con paso fijo, aplicando cada entrada en su instante; las cartas y objetos se
   resuelven por su hash.
5. En cada punto de control, comparar con lo grabado (nivel, derrotados, posición, vida,
   experiencia). La primera diferencia dice dónde y por qué se separa.
6. Al final, comparar `t`, `lv`, `kills`, `dd`, `dt`, `mh`. Se acepta con tolerancia pequeña
   (deriva de flotantes) y se rechaza si el tiempo repetido es menor que el anunciado o si
   los puntos de control divergen.

### Cambios que exige el juego (y su riesgo)

| Cambio | Detalle | Riesgo |
|---|---|---|
| Generador con semilla | `G.Rand` (p. ej. mulberry32) en lugar de `Math.random()` en todo lo que afecta a la partida; los efectos visuales siguen con `Math.random`. Semilla en la cabecera. | Medio: ~96 sitios, hay que separar bien simulación de efectos. |
| Paso fijo | Simular en pasos de 1/120 s con acumulador; dibujar con interpolación. La grabación guarda entradas por número de paso. | Alto para el tacto del juego (hoy `dt` variable). Probar a 60, 120 y 144 Hz. |
| Sin reloj de pared | Sustituir `performance.now()` en la simulación por el tiempo de partida. | Bajo. |
| Matemáticas reproducibles | Tablas propias de `sin/cos/atan2` o funciones sólo con `+ − × ÷ √` (IEEE 754 exacto) en la simulación. | Medio. |
| Entrada por pasos | `Input.axis()` y las pulsaciones se muestrean una vez por paso y se graban así. | Bajo. |
| Modo headless | Separar el estado de simulación del dibujo (`G.Game.update` ya no toca el canvas) y poder cargarlo en Node. | Medio. |
| Cooperativo | Fuera de la fase 2: se verifica sólo el solitario; las marcas de grupo se quedan con las cotas del resumen. | — |

### Hoja de ruta

1. **Determinismo de la simulación** con un test: dos ejecuciones con la misma semilla y las
   mismas entradas dan el mismo punto de control (en Chrome y en Node).
2. **Modo headless** y script `verifier/sim.js` que repite una grabación.
3. **Verificador** que sólo informa (no borra) durante unas semanas, para medir falsos positivos.
4. **Acciones automáticas** (borrar fila, avisar al dueño) con los falsos positivos en cero.
5. Después, exigir el veredicto antes de que una marca salga en el top público.

### Qué verifica y qué no

Verifica que *esas entradas* con *esa semilla y versión* dan *ese resultado*. No impide un
bot perfecto que juegue de verdad (eso es otro problema). Sí hace que no se pueda
falsificar una marca sin tener una grabación que la produzca.
