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
// Proyecto pokesurvivor-free (desde el 12-10-2026): autenticación normal de Firebase,
// SIN Identity Platform, así las cuentas son gratis sin límite. ¡No pulsar nunca
// "Actualizar a Identity Platform" en su consola! (El viejo era pokesurvivor-jpter.)
G.FIREBASE_CONFIG = {
  apiKey: 'AIzaSyBO_-FdM_k9kUIWxqpUEQc03a9IKWbJaao',
  authDomain: 'pokesurvivor-tiliko.firebaseapp.com',
  projectId: 'pokesurvivor-tiliko',
  storageBucket: 'pokesurvivor-tiliko.firebasestorage.app',
  messagingSenderId: '66123917149',
  appId: '1:66123917149:web:43aeada37f7ce9a3e36ab4'
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
