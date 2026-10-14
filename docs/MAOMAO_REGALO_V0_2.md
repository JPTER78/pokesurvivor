# Mao Mao — Código de regalo reutilizable (V0.2)

Rama: `feat/maomao-gift-v0.2`, basada en `test/friend-lookup-maomao-v0.1`. No modifica `main` ni `fix/friend-lookup`.

## Reglas del regalo

- Código: **MAO25** (cinco caracteres; se aceptan minúsculas y espacios externos).
- Código **reutilizable entre distintas cuentas**: tú y un amigo pueden canjear el mismo código.
- Cada cuenta recibe **una sola Mao Mao**; si ya existe, muestra «Ya conseguido» y no duplica el premio.
- Pokémon **10001**, Veneno/Planta, rareza ★5, ataque inicial **Picotazo Veneno**.
- Aparece en el menú «Código de regalo» y, una vez obtenido, en **Pokémon → Especial**. Desde ahí se elige como compañera y se mejora.
- **No** aparece en los banners, salvajes, grietas, rescates ni en la lista aleatoria global de Pokémon.
- Las partidas con Mao Mao no envían marcas a los rankings hasta que el personaje custom esté balanceado.
- `?maomao=1` conserva la prueba visual como invitado; esa prueba no entrega permanentemente al Pokémon.

## Pruebas locales (sin Firebase)

1. Abrir la rama en su sitio de Cloudflare separado: https://pokesurvivor-tiliko-maomao-gift-test.pages.dev/.
2. Crear una cuenta local del navegador (sin datos reales).
3. Pulsar **Código de regalo**.
4. Escribir **MAO25** y canjear; comprobar «Pokémon → Especial».
5. Salir y volver a entrar con la misma cuenta local; el regalo debe seguir en la colección.
6. Intentar canjear de nuevo: no se concede duplicado.
7. Crear una segunda cuenta local y repetir: el mismo código vuelve a funcionar.
8. Elegir Mao Mao en «Pokémon → Especial» y jugar; su ataque inicial será Picotazo Veneno.

**Importante:** en este sitio de pruebas Firebase sigue **DESACTIVADO** para no modificar datos reales. Estas pruebas se guardan únicamente en el navegador y no usan tu cuenta de Google.

## Preparación para la nube Tiliko (PENDIENTE DE ACTIVACIÓN)

El código de la rama incluye `firestore.rules` con validación servidor del canje. Ninguna regla se aplica a producción automáticamente. Antes de habilitar una web con Firebase para jugadores reales:

1. Ejecutar las pruebas de reglas reales de Firestore en Emulator Suite (no basta con pruebas JavaScript).
2. Revisar el diff de las reglas contra las reglas **actuales** de `pokesurvivor-tiliko`; no sobrescribir cambios de producción recientes.
3. Publicar **sólo las reglas aprobadas** en Firebase Console del proyecto de Tiliko, nunca en `pokesurvivor-free`.
4. Crear una **web de pruebas con dominio separado** que use Firebase `pokesurvivor-tiliko`, con dominio autorizado en Authentication para Google.
5. Entrar con una cuenta real, canjear una vez y verificar `saves/{uid}.save.gifts.maomao == 'MAO25'` y `save.owned['10001'].from == 'gift'`.
6. Volver a iniciar sesión y comprobar que sigue allí y que no se duplica.
7. Sólo con la comprobación aprobada, decidir la publicación en la rama de producción Tiliko.

### Seguridad

Las reglas niegan crear cuentas que ya incluyan 10001, impiden añadirlo en guardados normales e impiden cambiar o borrar su sello de regalo. La transacción de canje solo puede añadir `owned['10001']`, `gifts.maomao` y `updated`. Todo requiere iniciar sesión en la cuenta propietaria. No hay código administrador ni secretos en el navegador: el código de regalo es un **código promocional público**, no una contraseña. El usuario deberá respetar el proyecto Firebase que corresponda a su fork.
