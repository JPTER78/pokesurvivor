# Anti-trampas del ranking y la economía — notas

**Fecha:** 2026-10-20
**Alcance de este PR:** lo que un cliente modificado puede falsear en el
**ranking** (tiempo, nivel/derrotados, nombre) y en la **economía** (monedas y
tickets), y que **no** cubre ya el PR #144.

Este documento explica el porqué de los cambios en `firestore.rules`. Describe
qué permite cada regla, **no** cómo abusar de ella.

---

## 1. De dónde viene el problema

El juego es **cliente-autoritativo**: el navegador calcula las monedas y el
resultado de la partida y los sube tal cual. El código es **público** y se puede
ejecutar modificado **dentro de la web real** (sustituyendo `js/app.min.js` desde
el navegador), así que todo lo que corre en el cliente —incluido `clean()` en
`js/game.js`— lo controla quien juega. **Las reglas de Firestore
(`firestore.rules`) son la única defensa real.**

Sin Cloud Functions (plan de pago, que el proyecto no usa) el servidor no puede
recalcular una partida, así que estos cambios **frenan y acotan**, no validan la
partida de verdad.

---

## 2. Qué cambia este PR (y qué deja a #144)

Este PR toca **sólo `firestore.rules`** y añade lo que #144 no trae. Lo demás se
deja a #144, que ya va en la misma dirección.

| Hueco | Aquí | #144 |
|---|---|---|
| Monedas/tickets: **ritmo de crecimiento** por guardado (`base + ritmo·s`) | **Sí** | No (sólo pone topes absolutos) |
| Ranking: **tope de tiempo** 2700 → 2460 (41:00) | **Sí** | No |
| Ranking: **coherencia nivel↔derrotados** | **Sí** | No |
| Ranking (solitario): **nombre = apodo real** (`profiles/{uid}`) | **Sí** | No |
| Baneo evadible → colección `bans/{uid}` | — | **Sí** |
| Topes absolutos de monedas/tickets | — | **Sí** |
| Forma/tamaño de `names`, `dex`, `shiny`, perfil, XSS | — | **Sí** |

> Si #144 entra antes, este PR se rehace encima (conflictos de texto esperables
> en `saneSave` y `validEntry`).

### Detalle de los cambios
- **Monedas y tickets (`saneSave`):** el saldo no puede crecer entre dos
  guardados más de `base + ritmo·(segundos desde el guardado anterior)`. Margen
  holgado para no estorbar al juego legítimo (partidas largas, fundir el progreso
  de varios aparatos sin conexión), pero impide saltar de golpe a millones.
  **Es un freno, no un muro:** un tramposo paciente aún puede inflar poco a poco,
  y ganar ~10 000 monedas en una partida es indistinguible de jugar bien.
- **Ranking — tope de tiempo:** la Sentencia de Arceus deja KO hacia el minuto
  40, así que por encima de ~41 min es casi seguro trampa. Con 45 min las marcas
  falsas se amontonaban justo en el tope.
- **Ranking — coherencia:** la experiencia sale sobre todo de derrotar enemigos
  (los jugadores legales rondan 60–90 derrotados por nivel). Las marcas escritas
  a mano con nivel alto y pocos derrotados (p. ej. 345 / 2345) se rechazan.
- **Ranking — nombre:** en solitario, `names[0]` debe ser el apodo real del
  jugador, así nadie sube una marca con el nombre de otro.

**Los valores marcados `AJUSTAR`** llevan números conservadores; hay que fijarlos
con datos reales: la mejor marca legal (tope de tiempo) y el máximo de monedas
por partida (freno de monedas).

---

## 3. Lo que NO resuelve

- Una partida con **invencibilidad** que se pare por debajo del tope sigue
  pareciendo legal (el servidor no ve la partida). Sólo se cierra validando la
  **repetición**, lo que exige que el juego sea determinista (hoy usa
  `Math.random` por todas partes): es un trabajo grande, pero es la única defensa
  fuerte sin servidor de pago.
- **Compañeros de grupo inventados** y la **ventana de inicio por partida**
  (`runs/{uid}` se escribe una vez por sesión) quedan pendientes.
- Las cuentas gratis e ilimitadas permiten abrir una nueva tras un baneo.

Mientras tanto, conviene **detectar** desde Moderación (`js/ui/mod-ui.js`):
marcas por encima de ~41 min, nombres que no cuadran con el perfil, grupos con
uids sin perfil o nunca en línea, y nivel/derrotados incoherentes.

---

## 4. Validación

Probado con el **emulador de Firestore** (`@firebase/rules-unit-testing`). Casos
que **deben pasar a rechazarse** y legales que **siguen aceptándose**:

| Caso | Esperado | Resultado |
|---|---|---|
| Subir el saldo de 1 000 a 30 000 tras una partida | pasa | ✅ |
| Saltar a 10 000 000 de monedas de golpe | rechaza | ✅ |
| Tickets t1 a 1 000 000 de golpe | rechaza | ✅ |
| Marca de 2 400 s (40:00) | pasa | ✅ |
| Marca de 2 700 s (45:00) | rechaza | ✅ |
| Nivel 345 con 2 345 derrotados | rechaza | ✅ |
| Nivel 207 con 12 453 derrotados | pasa | ✅ |
| Marca en solitario con el nombre propio | pasa | ✅ |
| Marca en solitario con el nombre de otro | rechaza | ✅ |

9/9. (El arnés de prueba no se incluye en el repo: #144 ya añade
`tools/tests-seguridad`, donde deben integrarse estos casos.)

---

## 5. Despliegue

1. **Calibrar** los valores `AJUSTAR` en `firestore.rules`.
2. Probar con el emulador (ver #144, `tools/tests-seguridad`) y desplegar:
   `firebase deploy --only firestore:rules`.
3. Build y publicar con el flujo normal (`CLAUDE.md`).

> Cambios de **servidores/seguridad**: sin entrada en `js/data/changelog.js`.
