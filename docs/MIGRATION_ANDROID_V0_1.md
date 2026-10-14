# Migración Android V0.1 — prueba aislada

Rama experimental: test/save-migration-v0.1, derivada de test/challenges-cloudflare.
Sitio: https://pokesurvivor-tiliko-migracion-test.pages.dev/
Guía Android: https://pokesurvivor-tiliko-migracion-test.pages.dev/tools/migration/

## Alcance

1. El exportador (tools/migration/pokesurvivor-export.user.js) se ejecuta dentro de pokesurvivor.com mediante un marcador JavaScript de Brave o un gestor de userscripts en Firefox. Lee exclusivamente la copia del navegador de ese origen (ps.cloud o ps.save), previa selección, y descarga JSON.
2. El importador (js/ui/save-transfer.js) se abre desde Ajustes > Cuenta. Solo funciona para una cuenta LOCAL fuera de una partida. Revisa formato, versión, colección y recursos, y muestra una vista previa antes de confirmar.
3. Antes de cambiar el guardado receptor, crea respaldo local ps.transfer.backup.<timestamp>. Conserva el nombre de la cuenta receptora y fusiona colecciones y estadísticas.

## Separación estricta

NO desplegar en producción ni fusionar con main, fix/friend-lookup o feat/challenges-v0.1.

Esta rama hereda js/core/firebase-config.js con G.FIREBASE_CONFIG = null. Cloudflare aborta la compilación si se activa Firebase. Ninguna cuenta o partida de servidor se modifica mediante esta prueba.

La migración futura de Firebase original a Firebase Tiliko necesitará una vía autenticada de servidor para evitar falsas marcas antitrampas. NO está implementada.

## Privacidad y límites

- No compartas el JSON. Contiene nombre, Pokémon, monedas y estadísticas personales del juego. El exportador no lee contraseñas ni tokens.
- Un dominio no puede acceder directamente al localStorage de otro, de ahí el marcador explícito dentro del sitio original.
- Si exportas desde Firefox, inicia sesión allí primero para descargar la copia sincronizada; Firefox no puede leer una copia guardada solo en Brave.
- No borres datos del navegador original ni del juego público.
- Validar el formato en local no prueba que una partida sea legítima; NO se autoriza importación en nube.
- Brave puede bloquear marcadores javascript o la política del sitio puede bloquear scripts externos; existe alternativa en Firefox Android / Violentmonkey.

## Pruebas de compilación

node --test tests/save-transfer.test.cjs
node --test tests/challenges.test.cjs
node tools/build.js --sin-seo
