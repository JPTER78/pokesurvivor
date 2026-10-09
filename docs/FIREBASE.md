# Configurar Firebase (base de datos y cuentas)

Con esto las partidas se guardan en la nube y se pueden seguir en cualquier
ordenador. Todo es **gratis** (plan Spark de Firebase). Se tarda unos 10 minutos.

Mientras no lo hagas, el juego funciona igual que antes, guardando sólo en el
navegador.

## 1. Crear el proyecto

1. Entra en <https://console.firebase.google.com> con tu cuenta de Google.
2. **Crear un proyecto** → ponle nombre (p. ej. `pokesurvivor`). El identificador
   del proyecto se ve en la ventana de "Entrar con Google" y no se puede cambiar después.
3. Google Analytics: **desactívalo** (no hace falta y así no hay seguimiento).

## 2. Activar las cuentas

1. Menú izquierdo → **Compilación → Authentication** → **Comenzar**.
2. Pestaña **Método de inicio de sesión**:
   - **Correo electrónico/contraseña** → Habilitar → Guardar.
     (El juego usa nombre + contraseña; por dentro lo convierte en un
     correo interno al que nunca se envía nada.)
   - **Google** → Habilitar → elige tu correo de asistencia → Guardar.

## 3. Crear la base de datos

1. **Compilación → Firestore Database** → **Crear base de datos**.
2. Ubicación: una de Europa (p. ej. `eur3` o `europe-southwest1`). No se puede cambiar después.
3. Empieza en **modo de producción**.
4. Pestaña **Reglas**: borra lo que haya, pega **todo** el contenido del fichero
   [`firestore.rules`](../firestore.rules) de este proyecto y pulsa **Publicar**.

   Estas reglas hacen que cada jugador sólo pueda leer, escribir y borrar **su**
   partida. Sin ellas, cualquiera podría tocar las de los demás.

### 3b. Realtime Database (salas y multijugador)

1. **Compilación → Realtime Database** → **Crear base de datos** → ubicación
   **Bélgica (europe-west1)** → modo bloqueado.
2. Pestaña **Reglas**: pega el contenido de [`database.rules.json`](../database.rules.json).
3. Copia la URL que sale arriba (`https://...firebasedatabase.app`) y añádela a
   `firebase-config.js` como `databaseURL: '...'`.

Más rápido, con la herramienta de Firebase (sube las reglas de las dos bases
de datos y los índices del ranking de una vez):

```
npx firebase-tools deploy --only firestore,database --project TU-PROYECTO
```

## 4. Conectar el juego

1. Arriba a la izquierda, la rueda ⚙ → **Configuración del proyecto**.
2. Abajo, en **Tus apps**, pulsa el icono web **`</>`**.
3. Ponle un apodo (p. ej. `web`). **No** marques Firebase Hosting. → Registrar app.
4. Te enseña un bloque `const firebaseConfig = { ... }`. Copia lo que hay entre las llaves.
5. Abre [`js/core/firebase-config.js`](../js/core/firebase-config.js) y sustituye
   `G.FIREBASE_CONFIG = null;` por:

   ```js
   G.FIREBASE_CONFIG = {
     apiKey: '...',
     authDomain: '...firebaseapp.com',
     projectId: '...',
     storageBucket: '...',
     messagingSenderId: '...',
     appId: '...'
   };
   ```

   Estos datos **no son secretos**: Firebase los diseña para ir dentro de la web.
   Lo que protege las partidas son las reglas del paso 3.

## 5. Autorizar la web publicada

**Authentication → Configuración → Dominios autorizados → Agregar dominio**:

- `jpter78.github.io` (si lo publicas en GitHub Pages)
- `localhost`, para probar en tu ordenador (en proyectos nuevos ya no viene puesto).

Sin esto, "Entrar con Google" da el error *dominio no autorizado*.

## 6. Recomendado: limitar la clave

En <https://console.cloud.google.com/apis/credentials> (mismo proyecto), abre la
**Browser key** → *Restricciones de aplicaciones* → *Sitios web* y añade:

- `https://jpter78.github.io/*`
- `http://localhost:*`

Así nadie puede usar tu clave desde otra web.

## Probar en tu ordenador

La nube sólo funciona si el juego se abre desde un servidor (no con doble clic):

```
python -m http.server 8000
```

y abre <http://localhost:8000>. En la pantalla de inicio debe salir el botón
**Entrar con Google** y el texto *"Tu partida se guarda en la nube"*.
Arriba a la derecha, junto a tu nombre, un cuadradito **verde** indica que está
guardado en la nube (amarillo = guardando, rojo = sin conexión).

## Límites del plan gratis

Firestore: unas 50.000 lecturas y 20.000 escrituras al día y 1 GB de datos.
El juego está pensado para gastar lo mínimo (medido en el emulador):

| Acción | Lecturas | Escrituras |
|---|---|---|
| Ver una pestaña del ranking | 1 (0 si la viste hace menos de 10 min) | 0 |
| Ver tu puesto si no estás en el top 50 | 1 la primera vez en ese navegador | 0 |
| Terminar una partida | ~3 | ~3-9 (sólo donde mejoras) |
| Guardar la partida | 1 cada 30 s como mucho | 1 cada 30 s como mucho |
| Estar conectado | 0 | 1 cada 10 min (el "en línea") |
| Abrir Amigos o la sala | 1 por amigo (vale 1 min) | 0 |

Cómo se consigue:
- **Ranking**: cada tabla tiene un documento resumen `lbs/{tabla}` con el
  top 50 (las reglas comprueban que cada fila coincide con una marca validada
  contra trampas en `lb/{tabla}/e/{id}`). Lo leído se guarda 10 min en el
  navegador. El filtro por Pokémon sólo existe en el histórico.
- **Guardado**: la copia del navegador se guarda al momento; la nube recibe
  lo pendiente como mucho cada 30 s y siempre al ocultar o cerrar la pestaña.
  Si juegas en dos ordenadores a la vez, se fusiona al entrar y al subir.
- **Perfil público**: tras una partida se sube como mucho cada 10 min.

Realtime Database: **100 conexiones a la vez** y 10 GB de descarga al mes.
Sólo se conecta quien está **en una sala o partida en grupo** (el "en línea"
de los amigos y las invitaciones van por Firestore), así que el límite de
100 sólo cuenta a los que juegan en grupo en ese momento, no a todos los
jugadores. Las partidas en grupo van directas entre navegadores y no gastan
nada; sólo las que no pueden conectar directo pasan por aquí (unos 20-70 MB
por hora y jugador). Si algún día se queda corto, Firebase simplemente
rechaza operaciones hasta el día siguiente (no cobra nada sin que actives tú
un plan de pago).

## Para desarrolladores: emulador

Para probar sin tocar el proyecto real (necesita Java 21):

```
npx firebase-tools emulators:start --project demo-ps --only auth,firestore,database
```

y en `firebase-config.js` usa
`{ apiKey: 'demo', projectId: 'demo-ps', authDomain: 'demo-ps.firebaseapp.com', appId: 'demo', databaseURL: 'http://127.0.0.1:9000?ns=demo-ps-default-rtdb', emulator: true }`.
