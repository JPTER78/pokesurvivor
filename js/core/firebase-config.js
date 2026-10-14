/* Prueba con Google de Mao Mao + regalos + animaciones V0.3.
 * Firebase solo está habilitado en este dominio HTTPS de Cloudflare.
 * Cualquier otro host, GitHub preview o archivo local funciona SIN nube.
 * No fusionar este archivo a main, fix/friend-lookup ni upstream.
 */
G.FIREBASE_CONFIG = (location.protocol === 'https:' &&
  location.hostname === 'pokesurvivor-tiliko-maomao-cloud-test.pages.dev')
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
