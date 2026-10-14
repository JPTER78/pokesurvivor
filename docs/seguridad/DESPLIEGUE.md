# Seguridad: cómo publicar estos cambios

Este paquete toca el cliente (la web) **y** las reglas del servidor (Firestore y
Realtime Database). Las reglas no se publican con GitHub Pages: hay que subirlas
a mano, y el **orden** importa para no dejar a nadie sin cooperativo ni ranking.

## Orden

1. **Reglas de Firestore** (compatibles con el cliente actual y con el nuevo):
   `firebase deploy --only firestore:rules`
2. **Reglas de la Realtime Database** (versión de transición, aceptan los mensajes
   viejos y los nuevos): `firebase deploy --only database`
3. **La web** (`git push origin main`; el actualizador de `js/core/updater.js`
   hace que todos pasen a la versión nueva sin perder nada).
4. **Esperar a que se actualice la gente** (con unas horas sobra; el actualizador
   mira `version.json` cada 5 min y, en partida, espera a que acabe).
5. **Cerrar la transición**:
   - en `js/net/net.js` poner `ACCEPT_LEGACY = false`,
   - copiar `docs/seguridad/database.rules.strict.json` sobre `database.rules.json`,
   - `node tools/build.js && node tools/export_data.js && python tools/make_seo_pages.py`,
   - subir la web y después `firebase deploy --only database`.

Mientras no se haga el paso 5, el servidor sigue aceptando el formato viejo de
mensajes de la sala (texto con el remitente dentro), que es el que permite
hacerse pasar por otro jugador. Con el paso 5 ya no.

> Con las reglas de Firestore ya publicadas, los jugadores con una versión vieja del
> juego siguen funcionando salvo en una cosa: su "en línea" (presencia) no se
> actualiza hasta que se recarguen (la regla nueva ya no admite el id de la sala en
> `pres/`).

## Baneos

Los baneos nuevos se guardan en `bans/{uid}` (sólo los escribe y lee el admin). Los
antiguos (`saves/{uid}.ban`) siguen valiendo, y la pantalla de Moderación los pasa
sola a `bans/` la primera vez que se abre la lista "Baneados". Hasta ese momento,
una cuenta baneada de la forma antigua todavía podría borrar su partida y
recrearla para quitárselo.

## Comprobaciones antes de publicar

```bash
cd tools/tests-seguridad && npm install
npm run reglas && npm run reglas:estricta && npm run cliente
```

## Lo que NO arregla este paquete

El servidor sigue sin calcular las monedas, tickets ni el progreso: los guarda el
cliente (`saves/{uid}`). Los topes de las reglas sólo cortan valores absurdos. Para
que un jugador no pueda darse recursos hace falta una función de servidor que dé
las recompensas (Cloud Functions "callable", que requiere el plan Blaze pero **no**
Identity Platform) o mover esa lógica a un Worker de Cloudflare.
