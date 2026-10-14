/* PokéSurvivor Tiliko — versión propia con Google + Mao Mao.
 * Firebase SOLO en dominios HTTPS controlados por Tiliko:
 * Cloudflare Tiliko y GitHub Pages en /pokesurvivor/.
 * Nunca se conecta al Firebase original pokesurvivor-free.
 * En cualquier otro dominio usa modo local.
 */
G.FIREBASE_CONFIG = (location.protocol === 'https:' &&
  (location.hostname === 'pokesurvivor-tiliko.pages.dev' ||
   location.hostname === 'pokesurvivor-tiliko-maomao-cloud-test.pages.dev' ||
   (location.hostname === 'tiliko2803.github.io' &&
    (location.pathname === '/pokesurvivor' ||
     location.pathname.startsWith('/pokesurvivor/')))))
  ? {
  apiKey: 'AIzaSyBO_-FdM_k9kUIWxqpUEQc03a9IKWbJaao',
  authDomain: 'pokesurvivor-tiliko.firebaseapp.com',
  projectId: 'pokesurvivor-tiliko',
  storageBucket: 'pokesurvivor-tiliko.firebasestorage.app',
  messagingSenderId: '66123917149',
  appId: '1:66123917149:web:43aeada37f7ce9a3e36ab4',
  databaseURL: 'https://pokesurvivor-tiliko-default-rtdb.europe-west1.firebasedatabase.app'
}
  : null;
