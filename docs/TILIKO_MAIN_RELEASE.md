# Tiliko — publicación principal de Mao Mao

Rama propuesta a `main`: `release/maomao-kyogre-main`.
**Página propia**: https://pokesurvivor-tiliko.pages.dev/
**Prueba anterior con Google**: https://pokesurvivor-tiliko-maomao-cloud-test.pages.dev/
**Fuente**: fork `Tiliko2803/pokesurvivor`, no se cambia `JPTER78/pokesurvivor`.

### Pokémon
- Mao Mao (`10001`), ★5, **Veneno/Planta**, **Picotazo Veneno** inicial.
- Ataque: **1.52**, equivalente al Kyogre del catálogo (`382`). Vida 110 y velocidad 112 sin alteraciones.
- Animaciones ampliadas de sprites existentes: reposo 4, caminar 6, atacar/disparar 5, daño 3, caída 5 fotogramas. Son expansiones en Canvas, no cambios al arte original.
- Código público reutilizable `MAO25`: se usa una vez por cada cuenta y no crea copias duplicadas.
- Pokédex → Especial; no entra en el gacha o generación aleatoria.

### Firebase
- Configurado **exclusivamente** para `pokesurvivor-tiliko` en la web principal indicada arriba y en el sitio de prueba aprobado.
- Nunca usar las credenciales ni reglas de `pokesurvivor-free` en la web Tiliko.
- **Google login:** agregar `pokesurvivor-tiliko.pages.dev` a Firebase Authentication → Configuración → Dominios autorizados.
- **Reglas de regalo:** el archivo `firestore.rules` del repo contiene las reglas probadas para el código, pero el despliegue de GitHub/Cloudflare **NO** las publica en Firebase. Antes del primer canje de cuenta real, respaldar las reglas vigentes, comparar el diff, revisar las pruebas de emulador, y usar https://pokesurvivor-tiliko.pages.dev/tools/migration/firebase-gift-rules.html para copiar el archivo completo a Firestore Database → Reglas del proyecto Tiliko. La migración única por `migrationGrants` sigue protegida; no reactivar permisos ni borrar `saves`.
- Antes de canjear, el usuario puede entrar con Google y revisar la colección. Un canje puede mostrar `permission-denied` hasta que se publiquen las reglas, y eso es esperado.

### Hosting

El fork todavía incluye un `CNAME` heredado con `pokesurvivor.com`: ese dominio **NO** pertenece a esta versión Tiliko. El sitio propio se sirve desde `pokesurvivor-tiliko.pages.dev` (Cloudflare Pages) y el SDK de Firebase rechaza cualquier otro dominio.

### Comprobaciones para fusionar a main
- `node --test tests/*.test.cjs` debe pasar.
- Emulador Firestore `demo-tiliko-migration` debe aprobar las suites de migración y regalos.
- `node tools/build.js --sin-seo` debe compilar.
- `main` debe seguir siendo descendiente del mismo historial, sin sobrescribir nuevos commits.
- Después de fusionar, Cloudflare Pages debe publicar la rama `main` bajo el dominio propio.

## Estado de integración

- Fusionado en `main` del fork mediante PR #1.
- Cloudflare Pages `pokesurvivor-tiliko.pages.dev` configurado para publicar desde **main**.
- Google requiere agregar el dominio anterior a los dominios autorizados de Firebase Tiliko.
- Los canjes `MAO25` en cuentas reales seguirán bloqueados hasta que se publiquen las reglas de regalos en Firebase Console (tras revisión y respaldo). No implica pérdida de progreso.
- El ataque de Mao Mao es `1.52`, idéntico al Kyogre del catálogo, sin modificar HP/velocidad.
