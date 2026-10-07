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
  apiKey: 'AIzaSyD4YpfZCVUmJJbWPLPmYo6Lyxhsg0wMAKc',
  authDomain: 'pokesurvivor-jpter.firebaseapp.com',
  projectId: 'pokesurvivor-jpter',
  storageBucket: 'pokesurvivor-jpter.firebasestorage.app',
  messagingSenderId: '955377776652',
  appId: '1:955377776652:web:213d0107d3c36aa0fe5629'
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
