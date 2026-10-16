# PokéSurvivor para Android (consolas con mando)

Envoltorio nativo del juego web para consolas Android con mando (probado
pensando en las Retroid Pocket): el juego va entero dentro de la APK (sin
navegador; como invitado funciona sin conexión) y los botones de la consola
se mandan al juego (`js/core/gamepad.js`).

| Mando | En partida | En menús |
|---|---|---|
| Stick izq. / cruceta | Moverse | Mover el foco |
| Stick der. | Apuntar (al soltar, apuntado automático) | — |
| L / R (y L2 / R2) | Ataque anterior / siguiente | — |
| A | — | Pulsar |
| B | — | Volver |
| Start | Pausa | Volver / reanudar |

En PC, con mando (Gamepad API) funciona igual, y mantener el clic izquierdo
sobre el juego apunta al ratón.

Los botones de la tabla son los de serie. En **Ajustes > Controles > Mando >
Configurar** (`js/ui/pad-ui.js`) se cambian:

- **Repartos ya hechos** (`PRESETS` en `js/core/gamepad.js`): de serie, A y B
  al revés (consolas al estilo Nintendo), un botón por ataque (X/Y/B/A) y
  ataques en los gatillos.
- **Botón a botón** (`ACCIONES`): cada acción enseña sus botones; se toca uno
  para cambiarlo, «+» añade otro y «×» lo quita. También hay ataque 1-4
  directo. Arriba, una prueba dice qué botón se acaba de pulsar y qué hace.
- **Sticks**: zona muerta e intercambiarlos.
- **Restablecer**: todo como venía.

Se guarda en el dispositivo (`padMap`, `padDead`, `padSwap` en `G.Settings`).
Con mando, el HUD pone en cada ataque el botón que lo elige.

## Cómo funciona

- El juego se sirve desde `https://appassets.androidplatform.net/juego/`
  (`WebViewAssetLoader`): un origen https normal, así `localStorage` y
  Firebase funcionan como en la web. Carga `dev.html` (no hace falta
  compilar `app.min.js`).
- `MainActivity` lee los botones y sticks nativos y manda el estado completo
  al juego con `G.Pad.nativo({...})`, como mucho una vez por fotograma.
- `window.PSNativo` existe solo dentro de la app: el juego lo usa para no
  registrar el service worker y para avisar de que Google no deja iniciar
  sesión dentro de un WebView.

## Segunda pantalla (AYN Thor y otras consolas de dos pantallas)

Si la consola tiene otra pantalla, la app pone en ella un panel aparte
(`second.html` + `js/second/panel.js`) con un `Presentation`
(`SegundaPantalla.java`). El juego le manda un resumen de la partida unas 12
veces por segundo (`js/core/second.js`) y lo que se toca en el panel vuelve al
juego. La ventana del panel no coge el foco: el mando sigue yendo al juego.

Qué enseña lo elige el jugador, en **Ajustes > Controles > Segunda pantalla**
o tocando las pestañas del propio panel:

| Modo | Qué se ve |
|---|---|
| Datos | Vida, nivel, reloj, potenciadores, clima, jefe y lista de ataques |
| Mapa | Radar con enemigos, jefes, shinies, la grieta y los compañeros |
| Ataques | Botones grandes para cambiar de ataque con el dedo |
| Apagada | La app suelta la pantalla de abajo |

Además, al subir de nivel las cartas se pueden elegir tocándolas abajo
(se puede desactivar).

Para probarlo sin consola: abre `dev.html` en el navegador y, en Ajustes >
Controles, «Abrir el panel» (otra ventana; se hablan por `BroadcastChannel`).

Para añadir un modo: su nombre en `MODES` y sus datos en `resumen()`
(`js/core/second.js`), su pestaña en `second.html` y su dibujo en `pintar()`
(`js/second/panel.js`).

## Compilar

    cd android && gradle :app:assembleRelease    # SDK 34, Gradle 8.7, JDK 17+

- **Firma:** pon un keystore en `android/app/release.keystore` (no se sube
  al repositorio; las contraseñas están en `app/build.gradle`). Usa siempre
  el mismo para que las actualizaciones se instalen encima.
- **Autoactualización (opcional):**
  `gradle :app:assembleRelease -PurlActualizaciones=https://tu-web/version.json`.
  Ese JSON es `{"versionCode", "versionName", "apkUrl", "apkSha1"}`. Al abrir la
  app se comprueba; si hay versión nueva, se descarga, se verifica el SHA-1 y
  se abre el instalador. Sin la propiedad, la APK no se autoactualiza.
- **Siempre la build *release*:** la *debug* es depurable (con USB se podrían
  leer los datos de la app, incluida la sesión de Firebase).

La tarea `copiarJuego` mete en la APK el juego de la raíz del repositorio.

## Entrar con Google en la app

Hoy no es posible: el juego usa `signInWithPopup` y Google bloquea su inicio
de sesión dentro de los WebView. Las cuentas con nombre y contraseña y el modo
invitado funcionan. Para tenerlo habría que registrar la app Android
(`es.sund.pokesurvivor` + SHA-1 del keystore) en el proyecto de Firebase y hacer
el login de forma nativa (Credential Manager), pasando el token al juego con
`firebase.auth.GoogleAuthProvider.credential(idToken)`.

## Licencias

Código: MIT (ver `LICENSE`). Sprites: SpriteCollab, CC BY-NC 4.0 (uso NO
comercial y con atribución, `CREDITS.md`).
