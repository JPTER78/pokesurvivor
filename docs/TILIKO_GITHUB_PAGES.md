# PokéSurvivor Tiliko — GitHub Pages

**Enlace:** https://tiliko2803.github.io/pokesurvivor/

El juego vive en el proyecto GitHub Pages del fork `Tiliko2803/pokesurvivor`, bajo el subdirectorio **/pokesurvivor/**. El dominio `tiliko2803.github.io` es el host (necesario como dominio autorizado en Firebase Authentication).

## Publicación

1. Entra en https://github.com/Tiliko2803/pokesurvivor/settings/pages
2. En **Build and deployment**, selecciona **Deploy from a branch**.
3. Usa la rama **main** y la carpeta **/(root)**, pulsa **Save**.
4. Si aparece un dominio personalizado heredado (`pokesurvivor.com`), **no lo utilices**: es del repositorio de origen. El archivo `CNAME` heredado fue retirado del fork.
5. Espera la publicación y abre https://tiliko2803.github.io/pokesurvivor/ (no el dominio sin ruta, que puede mostrar otro sitio o un 404).

## Progreso y Google

Firebase **pokesurvivor-tiliko** se utiliza SOLO para:
- `https://tiliko2803.github.io/pokesurvivor/`
- `https://pokesurvivor-tiliko.pages.dev/`
- `https://pokesurvivor-tiliko-maomao-cloud-test.pages.dev/`

Las demás rutas de github.io y sitios ajenos no se conectan. Asegúrate de que **tiliko2803.github.io** aparece en [Firebase Authentication → Configuración → Dominios autorizados](https://console.firebase.google.com/project/pokesurvivor-tiliko/authentication/settings).

No se toca `pokesurvivor-free` ni el repositorio original. El mismo inicio de sesión Google abre la partida Tiliko guardada en Firebase. **El código MAO25 requiere reglas Firestore en producción**: el archivo `firestore.rules` ya incorpora su validación, pero esas reglas no se publican automáticamente en Firebase y no deben copiarse sin respaldo/revisión.

## Versión y caché

El `index.html` de GitHub Pages carga los 74 módulos actuales de `dev.html` en orden. Esto evita publicar una versión obsoleta de `js/app.min.js` después de fusionar ramas en GitHub sin reconstruir el bundle. Se usa la versión del HTML para actualizar automáticamente sin cancelar partidas activas; el Service Worker renovó su caché. Como contrapartida, este modo transitorio expone los módulos JavaScript en vez de usar el empaquetado ofuscado. Para una publicación permanente de mayor rendimiento conviene automatizar `node tools/build.js --sin-seo` en CI y generar el bundle antes de publicar.

Mao Mao: **Veneno/Planta, Picotazo Veneno, ataque 1.52 (igual a Kyogre)**, animaciones V0.3 y código `MAO25`.

La rama `backup/main-before-github-pages-v0.5` conserva una copia del estado anterior de `main`.
