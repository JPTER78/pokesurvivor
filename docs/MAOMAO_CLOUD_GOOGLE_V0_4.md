# Mao Mao con Google — rama cloud aislada V0.4

**Rama:** `test/maomao-cloud-v0.4`, basada en `feat/maomao-animation-v0.3`, sin modificar `main` ni `fix/friend-lookup`.
**Página:** https://pokesurvivor-tiliko-maomao-cloud-test.pages.dev/

## Implementación

- Cuenta real: Google → Firebase `pokesurvivor-tiliko`.
- **Solo** el host `pokesurvivor-tiliko-maomao-cloud-test.pages.dev`, mediante HTTPS, activa Firebase. Otros dominios o accesos locales no se conectan.
- Mao Mao ★5, Veneno/Planta, **Picotazo Veneno** inicial, 7 animaciones con fotogramas intermedios, multiplicador de ataque **1.35** (+8 % sobre 1.25); vida 110, velocidad 112 sin cambios.
- En el menú aparece **Código de regalo**; `MAO25` es público y reutilizable entre usuarios, pero cada cuenta lo canjea **una sola vez**.
- Se añade a **Pokémon → Especial**; el Pokémon custom nunca entra a gacha, encuentros salvajes ni listados globales aleatorios.
- **MUY IMPORTANTE:** esta web usa el Firebase Tiliko REAL para iniciar sesión y jugar. Si no se han publicado las reglas Firestore del regalo, canjear el código debe fallar con permiso denegado. No atribuirlo a error del jugador.

## Activación necesaria en Firebase Console — proyecto SOLO Tiliko

1. Antes de acceder con Google, autorizar este dominio exacto en [Firebase Authentication → Configuración → Dominios autorizados](https://console.firebase.google.com/project/pokesurvivor-tiliko/authentication/settings):
   `pokesurvivor-tiliko-maomao-cloud-test.pages.dev` (sin `https://`).
2. Hacer **copia de seguridad de las reglas Firestore actuales**. Confirmar que es el proyecto `pokesurvivor-tiliko` y nunca `pokesurvivor-free`.
3. Esperar a que el despliegue pase **tests JavaScript y tests del emulador Firestore**. Con resultado correcto y solo tras revisión de diferencias, usar la página de copiado en móvil:
   https://pokesurvivor-tiliko-maomao-cloud-test.pages.dev/tools/migration/firebase-gift-rules.html
4. Pegar **todo** el contenido en [Firestore Database → Reglas](https://console.firebase.google.com/project/pokesurvivor-tiliko/firestore/rules) y publicarlo **solo después de comparar con la configuración vigente**. La rama incorpora las medidas originales de seguridad de migración V0.3 y las nuevas de regalos.
5. Entrar en la web con **la misma cuenta de Google** que tiene la partida Tiliko. Verificar en Ajustes → Cuenta que es `Guardado en la nube`.
6. Canjear `MAO25`, comprobar que la colección muestra el especial y que la partida se mantiene tras refrescar.
7. Firestore `saves/{uid}` debe reflejar `save.owned['10001']` y `save.gifts.maomao = 'MAO25'`. Nunca compartir el UID ni la copia de la partida públicamente.
8. Probar el mismo código en una segunda cuenta (opcional) y el canje repetido sin premio duplicado.

## Lo que NO se hizo

- No se publicaron reglas en Firebase Console de producción desde GitHub o Cloudflare.
- No se ejecutó ningún canje en cuentas reales, ni se modificó el progreso importado del usuario.
- No se modificó la rama estable `main`, el Firebase original ni los proyectos de Cloudflare de migración/animaciones/regalos anteriores.

## Seguridad y publicación

El código de regalo no es contraseña secreta: es un código promocional público. La regla Firestore `authorizedGift()` limita el canje a la recompensa exacta, protege el sello de entrega e impide añadir 10001 mediante escrituras normales. Las pruebas del emulador utilizan un proyecto de demostración `demo-tiliko-migration`, no el de producción.
