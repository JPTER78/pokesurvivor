# Modo Desafíos V0.1 — entrega para revisión

Base: `fix/friend-lookup`, commit `d24abc0`. Trabajo: `feat/challenges-v0.1`, exclusivamente en el fork solicitado.
Antes de editar se verificó que la base incluye `383d0fc` (búsqueda de amigos con recuperación de perfiles sin índice y distinción de errores) y la configuración del proyecto Firebase solicitado. No se modificaron esos sistemas ni su configuración.

## Implementación

- Jugar abre Partida normal / Desafíos. Si ya hay una sala, se conserva el acceso directo a ella.
- Supervivencia Extrema: 600 segundos de tiempo real **activo**, en solitario, con compañero y mejoras actuales.
- Pausas, elecciones de cartas/objetos/vínculos y pestaña oculta no cuentan. Se usa el reloj monotónico, independiente del reloj de simulación y de los atajos de depuración. Intervalos de más de un segundo sin fotogramas se descartan para evitar contar una suspensión del navegador o del sistema operativo.
- Contacto, proyectiles enemigos y zonas/rayos enemigos reciben ×1,25 sobre el daño que ya resultaba de tipos, clima, defensa, cuerpo a cuerpo y mínimo de daño. Se conserva la invulnerabilidad y Banda Focus. Lava, trampas del escenario, curación, daño de ataques propios y partidas normales conservan su cálculo.
- Muerte (también dentro de una grieta), abandono, evento de desconexión o salida de página resuelven un fallo. El inicio sin conexión o dentro de una sala se rechaza. No se resuelve una victoria en eventos de cierre o reconexión.
- Victoria automática al llegar a 600 segundos, sólo vivo, visible, conectado según el navegador y pasando la comprobación de integridad existente. No se falsean partidas legítimas ni se modifica el anti-trampas.
- `save.challenges[id]` conserva `bestTime` y `completedAt` (primera finalización). La fusión toma el máximo del tiempo y la primera fecha positiva: conmutativa e idempotente, sin sumar premios. El historial de finalización es un registro por desafío; no se guarda una lista ilimitada de cada intento.
- No se llama a `Ranking.runStarted`, `submitSolo` ni `submitGroup` en desafíos. Tampoco se actualizan los récords normales de tiempo/nivel ni el contador de runs normales. Se mantienen monedas ordinarias, tickets, capturas y estadísticas de bajas. Los eventos de bajas/objetos/evoluciones y sus misiones siguen siendo compatibles; las misiones de finalización de partidas normales excluyen desafíos.
- Interfaz reutiliza `.box`, `.panel`, `.btn` y las utilidades de pantalla existentes. No se acoplan desafíos al sistema de premios de Misiones. Se conserva el requisito existente de jugar en horizontal en teléfonos.

## Por qué las 500 monedas están pendientes

`DB.commit()` guarda primero en local y programa la subida; no confirma inmediatamente una reclamación en el servidor. `DB.merge()` conserva las monedas de la copia más reciente y la sincronización usa una transacción del documento de guardado. Una bandera de premio en el cliente no prueba una victoria ni garantiza una concesión segura en dos dispositivos con copias antiguas.

Las reglas actuales comprueban propiedad y presupuestos de recursos; no validan la ejecución de este desafío ni una reclamación específica. Las 500 monedas se muestran como propuesta pendiente y **no se conceden**, incluso al repetir. No se añadieron backend, colección, permisos ni cambios a las reglas. El estado de finalización es progreso del cliente, no una prueba de victoria validada por servidor. Se conserva la política ordinaria de guardado y reintentos.

## Archivos

Fuentes modificadas: `js/game.js`, `js/entities/player.js`, `js/systems/combat.js`, `js/systems/hazards.js`, `js/systems/progress.js`, `js/core/db.js`, `js/ui/menu.js`, `js/ui/run-ui.js`, `js/ui/ui.js`, `js/main.js`, `dev.html`, `css/style.css`, `js/data/changelog.js`.

Nuevos: `js/systems/challenges.js`, `tests/challenges.test.cjs`, `tests/challenges-browser.cjs`, esta documentación.

`js/ui/ui.js` registra las dos pantallas para que se oculten al jugar; `js/main.js` detecta la ausencia del nuevo módulo al arrancar; `hazards.js` identifica los impactos de zonas enemigas. Son cambios necesarios fuera de los puntos principales del flujo.

Generados exclusivamente con `node tools/build.js`: `index.html`, `js/app.min.js`, `version.json`. El último es una salida automática del compilador, sin modificación de despliegue. No se tocaron configuración Firebase, autenticación, amigos/invitaciones, protocolo multijugador, administradores, reglas, workflows ni hosting.

## Validación ejecutada

`node --test tests/challenges.test.cjs`: **16 pruebas aprobadas**. Incluyen módulos reales con almacenamiento local y dobles de los subsistemas gráficos/red para el flujo de partida. Los 600 segundos se simulan; no se realizó una sesión física de diez minutos.

`tests/challenges-browser.cjs`: **aprobado** en Chromium táctil, 844×390 y 640×360. Usa los scripts reales de `dev.html`; intercepta la configuración Firebase sólo en el navegador de prueba y bloquea todas las peticiones externas. Comprueba navegación, selección, HUD, joystick, pausa, reanudación, abandono, recarga del progreso, partida normal posterior, evento offline y pagehide. Sin errores JavaScript; sin desbordamiento horizontal; botón Comenzar de 44 px de alto.

`node tools/build.js`: **aprobado**, 69 scripts empaquetados y ofuscados. Comprobaciones de sintaxis del módulo, flujo de juego y bundle: aprobadas. Diff sin errores de espacios usando `git -c core.whitespace=cr-at-eol diff --check`, respetando los finales CRLF existentes.

| Comprobación solicitada | Evidencia / alcance |
| --- | --- |
| Normal conserva daño y duración | Prueba de daño real y flujo normal que sigue activo después de 600 s; conserva envío al ranking en una run limpia. |
| +25 % hostil | Fórmula de Player y rutas reales de contacto, proyectil y zona; resistencia, defensa, mínimo e invulnerabilidad. |
| Muerte antes de 10 min | Prueba de resolución prematura y muerte en grieta antes de su recuperación. |
| Abandono sin premio | Prueba de resolución y recorrido real de pausa → abandonar en navegador. |
| Victoria a 600 s una vez | Reloj simulado y finalización automática integrada; repetición de finish sin efecto. |
| Repetición sin premio | Monedas sin cambio en el módulo; premio explícitamente deshabilitado. |
| Mejor marca al recargar | Commit/login local reales y recarga de página en navegador. |
| Fusión de dos copias | DB.merge real: máximo, primera finalización, idempotencia y conmutatividad. |
| Fuera del ranking | Espías en las llamadas de inicio/envío del flujo integrado. |
| Normal y cooperativo | Inicio normal real en navegador; inicio cooperativo con dobles. Sala entre dispositivos pendiente. |
| Móvil | Dos tamaños Chromium táctil; joystick y pausa/reanudación. Android físico pendiente. |
| Build | Comando estándar completado correctamente. |

**No se probaron servicios Firebase reales**, reglas desplegadas ni una sala multijugador real. No se escribieron datos de producción. La detección de pérdida de conexión usa `navigator.onLine` y su evento; una caída exclusiva de Firebase con el navegador aún conectado se gestiona por el guardado habitual. Un cierre forzado del proceso puede impedir `pagehide` y el guardado final; nunca completa el desafío por sí mismo. Invitados conservan las marcas sólo durante su sesión, como el guardado ordinario.

## Repetir las pruebas

Las pruebas Node no necesitan dependencias:

```sh
node --test tests/challenges.test.cjs
node tools/build.js
```

Para la comprobación de navegador, usar una instalación de Playwright de herramientas externas al repositorio y un Chromium disponible. No se añade ninguna dependencia al juego:

```sh
# Terminal 1, desde la raíz del repositorio:
python -m http.server 8765 --bind 127.0.0.1

# Terminal 2:
PLAYWRIGHT_MODULE=/ruta/a/playwright CHROMIUM_PATH=/ruta/a/chromium node tests/challenges-browser.cjs
PLAYWRIGHT_MODULE=/ruta/a/playwright CHROMIUM_PATH=/ruta/a/chromium MOBILE_WIDTH=640 MOBILE_HEIGHT=360 node tests/challenges-browser.cjs
```

El script guarda una captura en `/tmp/challenges-mobile.png` (configurable con `CHALLENGES_SCREENSHOT`). No abrir un servidor HTTP local contra la configuración real para pruebas de escritura: el script anterior aplica aislamiento de Firebase.

## Prueba manual para revisión

Usar una cuenta **local de pruebas** abriendo `dev.html` como archivo (`file://`, modalidad local prevista por el juego), o un entorno de pruebas Firebase ya autorizado. No usar una cuenta de producción para estas verificaciones. En HTTP, utilizar el aislamiento de red/configuración del fixture de navegador o un emulador autorizado sin cambiar la configuración comprometida en el repositorio.

1. Seleccionar un Pokémon y comprar una mejora. Entrar en Jugar → Partida normal y verificar movimiento, ataques, pausa y salida.
2. Jugar → Desafíos: revisar reglas, marca y premio pendiente; comenzar. En Android, girar a horizontal y comprobar joystick, cambio de movimientos, pausa y reanudación.
3. Morir y luego abandonar otro intento: resultado fallido, mejor marca conservada y sin 500 monedas adicionales. Recargar después del resultado y verificar la marca.
4. Completar diez minutos activos, excluyendo pausas/elecciones: cierre automático, éxito y primera finalización. Repetir: no se conceden 500 monedas en ninguno de los casos. Las monedas ordinarias de la partida sí se guardan.
5. Salir de la página y perder conexión en intentos separados: nunca victoria. Volver a una partida normal: sin indicador/modificador de desafío.
6. En un entorno autorizado, comprobar sincronización desde dos copias de la cuenta, ausencia de marcas de desafío en el ranking y una sala normal entre dos dispositivos. Desde una sala, Jugar debe seguir abriendo el lobby; no iniciar desafíos dentro de ella.

Entrega sin despliegue, PR ni fusión. La rama queda local para revisión; no se ha publicado en GitHub.
