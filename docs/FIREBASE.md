# Configurar Firebase (base de datos y cuentas)

Con esto las partidas se guardan en la nube y se pueden seguir en cualquier
ordenador. Todo es **gratis** (plan Spark de Firebase). Se tarda unos 10 minutos.

Mientras no lo hagas, el juego funciona igual que antes, guardando sólo en el
navegador.

## 1. Crear el proyecto

1. Entra en <https://console.firebase.google.com> con tu cuenta de Google.
2. **Crear un proyecto** → ponle nombre (p. ej. `pokesurvivor`).
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
- `localhost` ya viene puesto, para probar en tu ordenador.

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

Unas 50.000 lecturas y 20.000 escrituras al día y 1 GB de datos. Cada partida
ocupa unos pocos KB y se guarda tras cada run o compra, así que da para
bastantes cientos de jugadores diarios. Si algún día se queda corto, Firebase
simplemente rechaza escrituras hasta el día siguiente (no cobra nada sin que
actives tú un plan de pago).

## Para desarrolladores: emulador

Para probar sin tocar el proyecto real (necesita Java 21):

```
npx firebase-tools emulators:start --project demo-ps --only auth,firestore
```

y en `firebase-config.js` usa
`{ apiKey: 'demo', projectId: 'demo-ps', authDomain: 'demo-ps.firebaseapp.com', appId: 'demo', emulator: true }`.
