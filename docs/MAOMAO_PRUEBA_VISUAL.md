# Maomao: prueba visual V0.1

Base: `test/migration-map-v0.2`, commit `5581535`.
Rama de trabajo: `feat/maomao-visual`.

## Probar

1. Servir esta rama como sitio estático: `python -m http.server 8765`.
2. Abrir `http://localhost:8765/?maomao=1` (compilada), o `http://localhost:8765/dev.html?maomao=1` (desarrollo).
3. Entrar como invitado y elegir un compañero inicial si se solicita.
4. En el menú, pulsar **Probar a Maomao**.
5. Mover con WASD/flechas o controles táctiles. Los ataques son automáticos; los movimientos nuevos se aprenden en las cartas y se cambian con los controles habituales.

La opción sólo se muestra con `?maomao=1`, Firebase desactivado, invitado y fuera de salas/partidas. No selecciona a Maomao como compañero guardado. Los recursos de la prueba viven sólo en la sesión de invitado y no se envían marcas al ranking. No incluye desbloqueo ni canje de regalos.

## Personaje

- ID reservado de prueba: 10001.
- Maomao, Veneno/Planta, rareza 5 (legendaria), sin bandera de legendario de grietas.
- Vida: 110; velocidad: 112; multiplicador base de ataque: 1.25. Valores provisionales, no balance definitivo.
- Comienza con Picotazo Veneno. Repertorio normal común + Veneno + Planta (16 movimientos disponibles, 4 huecos como siempre).
- No se añade a `G.DEX`: no aparece en gacha, salvajes, jefes, grietas ni rescates.
- Sin cambios a Firebase, reglas, importación, generación del mapa ni anticheat.

## Arte

Se usan exclusivamente recortes de la hoja suministrada. Siete PNG compatibles con el cargador existente, ocho filas por dirección y celdas de 40×44. El personaje usa seis animaciones; Hurt es una pose de respaldo para precarga. El generador está en `tools/prepare_maomao.py` y recibe la carpeta del paquete de poses aprobado (`Maomao-prueba-visual.zip`).

Limitaciones visibles:

- Caminar al frente reutiliza poses de quieta; derecha, izquierda y espalda usan ciclos de dos poses.
- Diagonales aproximadas mediante la orientación cardinal elegida.
- Ataques y caída reutilizan o reflejan las vistas disponibles; no representan ocho perspectivas dibujadas.
- Quedan algunos píxeles y efectos de la imagen original en los recortes; el combate mantiene sus efectos Pokémon actuales.
- Los nombres y efectos propios de boticaria, equilibrio, cooperativo y código de regalo quedan para otra versión.

## Verificación

- `node --test tests/*.test.cjs`: 38 pruebas (33 previas + 5 del personaje).
- `node tools/build.js`: compilación minificada/ofuscada correcta, conserva actualizador y version.json.
- `CHROMIUM_PATH=/ruta/chromium PLAYWRIGHT_MODULE=/ruta/playwright node tests/maomao-browser.cjs`.
- Navegador: 1100×720 y móvil táctil emulado 844×390; movimiento, ataque automático real contra un objetivo, cambio de movimientos, renderizado de animaciones en ocho filas, ausencia de errores JS y hojas 404, compañero original conservado, sin escrituras persistentes ni llamadas al ranking.
- Versión compilada: flujo real de invitado, ocho preguntas, selección de compañero y botón de Maomao, sin errores JavaScript.
- Android físico y cooperativo no validados. No se ha desplegado.
