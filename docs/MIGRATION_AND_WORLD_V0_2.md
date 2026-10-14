# Mejoras V0.2 — migración y rutas de escape

Rama experimental: `test/migration-map-v0.2` (base: `test/save-migration-v0.1`).

Esta versión introduce únicamente dos funciones: pasillos naturales en el mundo y una vía de migración única bajo autorización explícita del administrador. No se modifica la versión pública ni el Firebase original.

## 1. Mundo

Archivo: `js/world/world.js`.

- Pasillos serpenteantes sobre dos ejes separados aproximadamente 22 tiles.
- Ancho útil de varios tiles, evaluado de forma determinista por semilla/coordenadas.
- Se evita que paredes, líquidos o props sólidos aparezcan en los pasillos.
- Se conserva el ruido que genera el resto del terreno, junto con cofres, árboles, lagos y rocas.
- Las arenas de grietas conservan sus límites, columnas y su corredor central.
- No se añaden nuevos sistemas ni cálculos de ruta BFS en cada fotograma.
- Cada seed genera los mismos pasillos en multijugador; el mapa no depende del orden de carga de los chunks.

## 2. Importación autorizada a Firebase Tiliko

Archivos: `firestore.rules`, `js/core/db.js`, `js/ui/save-transfer.js`, `js/ui/settings-ui.js`.

**Estado:** IMPLEMENTADO EN CÓDIGO, pero **NO DESPLEGADO a Firebase Tiliko**. La versión de pruebas de Cloudflare continúa con `G.FIREBASE_CONFIG = null;`; ahí se puede probar el mapa y el importador local, no la nube.

Un archivo JSON creado en el teléfono **no es prueba de autenticidad**. Para prevenir abusos no hay una importación pública libre. El administrador revisa a qué usuario Tiliko se autoriza y crea manualmente un permiso temporal `migrationGrants/{uid}`.

### Procedimiento futuro para un administrador

1. Mantener a salvo una copia del JSON de la cuenta ORIGINAL. No subirlo a ningún servicio de terceros.
2. Hacer respaldo de las reglas actuales de Firebase **pokesurvivor-tiliko**. Confirmar que el proyecto NO es `pokesurvivor-free` (upstream). El archivo `.firebaserc` de esta rama ya apunta a `pokesurvivor-tiliko`.
3. Revisar y probar `firestore.rules` en el emulador y un proyecto Firebase de staging, antes de desplegarlo al servidor de Tiliko.
4. Solo con aprobación del titular, desplegar **únicamente** reglas Firestore del proyecto Tiliko: `npx firebase-tools deploy --only firestore:rules --project pokesurvivor-tiliko`. No desplegar Cloud Functions ni Realtime Database ni tocar upstream.
5. Buscar en Firebase Authentication el UID de la cuenta de Tiliko que recibirá los Pokémon. En Firestore verificar que existe `saves/{uid}` y que tiene progreso inicial sincronizado.
6. Crear mediante **Firebase Console** (o Admin SDK) un documento `migrationGrants/{uid}` con los campos `approved` (booleano `true`) y `expiresAt` (tipo **timestamp** de Firestore, por ejemplo dentro de las próximas 24 horas). Los usuarios normales no pueden crear ni editar este documento.
7. Publicar el importador de `js/ui/save-transfer.js` en una versión Tiliko **con Firebase de Tiliko** y con el consentimiento del usuario, sin cambiar la rama de producción hasta aprobar pruebas.
8. El titular inicia sesión en Tiliko (NO Invitado), abre **Ajustes → Cuenta → Importar respaldo JSON**, elige su exportación original y confirma el resumen. El importador guarda una copia de seguridad local antes de la transacción.
9. Firestore verifica el permiso, su vencimiento, el propio UID, la ausencia de una migración anterior y la coherencia básica del archivo; la escritura actualiza `migrationImported: true` en la partida y preserva el nombre y la fecha de registro Tiliko. Las fusiones futuras preservan este sello.
10. Comprobar `saves/{uid}`, colección, mejoras y que el guardado continúa sincronizando. Eliminar el documento de permiso concedido al finalizar o cuando expire.

**Importante:** Permitir la migración no convierte un JSON en prueba fiable de origen. El administrador debe aprobar **solo** cuentas y partidas propias/consentidas. Los rankings y reglas normales siguen comprobando tiempo y recursos; no se borra una marca `sus` preexistente. Una migración fallida no toca la partida: la transacción se confirma antes de reemplazar la copia local.

## 3. Seguridad del despliegue

- `main`, `fix/friend-lookup`, `feat/challenges-v0.1` y `test/challenges-cloudflare` permanecen sin modificaciones.
- La rama de pruebas conserva Firebase DESACTIVADO y Cloudflare comprueba eso antes de compilar.
- `.firebaserc` apunta a `pokesurvivor-tiliko`, nunca a `pokesurvivor-free`.
- Los permisos de importación se restringen al propietario del documento de guardado y solo puede concederlos Firebase Console/Admin SDK.
- Los tests de Node verifican vías de escape, determinismo de semillas, arena, rechazos, migración una vez, conservación de progreso y que las reglas conservan el bloqueo del ranking.
- **Prueba con Firebase Emulator de las reglas:** pendiente; los tests de reglas de la compilación son inspecciones estructurales, no sustituyen un emulador.

## 4. Probar desde Android

Abrir `https://pokesurvivor-tiliko-mejoras-test.pages.dev/`, crear una cuenta **local**, usar el importador JSON de Ajustes si ya tienes el respaldo del PokéSurvivor original, y probar el modo Desafíos con un Pokémon mejorado. Jugar varios intentos y comprobar si se forman esquinas de las que es imposible salir. El modo local no sincroniza con Firebase.

La guía de exportación móvil sigue disponible en `/tools/migration/`.
