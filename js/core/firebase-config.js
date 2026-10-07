/* ============ firebase-config.js — conexión con tu proyecto de Firebase ============
 * Pega aquí la configuración de tu app web de Firebase (Consola de Firebase >
 * Configuración del proyecto > Tus apps > SDK setup and configuration > Config).
 * Los pasos completos están en docs/FIREBASE.md.
 *
 * Estos datos NO son secretos: Firebase los diseña para ir en la web. Lo que
 * protege las partidas son las reglas de Firestore (firestore.rules).
 *
 * Si se pone a null, el juego funciona en modo local (sólo en el navegador).
 */
G.FIREBASE_CONFIG = {
  apiKey: 'AIzaSyBDTxXlQA2ylUSP885q_5T-NpgVjSeaCo8',
  authDomain: 'pokemon-survivors-jpter.firebaseapp.com',
  projectId: 'pokemon-survivors-jpter',
  storageBucket: 'pokemon-survivors-jpter.firebasestorage.app',
  messagingSenderId: '51846841769',
  appId: '1:51846841769:web:b5662e751d494e0a8130b8'
};

/* Ejemplo de cómo debe quedar:
G.FIREBASE_CONFIG = {
  apiKey: 'AIza...',
  authDomain: 'tu-proyecto.firebaseapp.com',
  projectId: 'tu-proyecto',
  storageBucket: 'tu-proyecto.firebasestorage.app',
  messagingSenderId: '1234567890',
  appId: '1:1234567890:web:abc123'
};
*/
