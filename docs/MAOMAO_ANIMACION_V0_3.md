# Mao Mao V0.3 — Animaciones más fluidas

**Rama aislada:** `feat/maomao-animation-v0.3`, nacida de `feat/maomao-gift-v0.2`.
**Prueba local con cuenta del navegador:** https://pokesurvivor-tiliko-maomao-anim-test.pages.dev/

## ¿Qué cambia?

Los siete PNG originales de Mao Mao (40 × 44 px por celda y 8 direcciones) se conservan **sin modificarlos**. El navegador genera una hoja temporal por animación utilizando exclusivamente esos fotogramas y movimientos sutiles de 1–2 píxeles, sin suavizado de bordes.

| Animación | Antes | V0.3 | Efecto |
|---|---:|---:|---|
| Quieta (Idle) | 1 | 4 | Respiración |
| Caminar (Walk) | 2 | 6 | Elevación de pasos y balanceo |
| Ataque (Attack) | 3 | 5 | Anticipación y recuperación |
| Proyectil (Shoot) | 3 | 5 | Lanzamiento más continuo de Picotazo Veneno |
| Cargar (Charge) | 2 | 4 | Balanceo discreto |
| Recibir daño (Hurt) | 1 | 3 | Pequeña reacción al impacto |
| Caer (Faint) | 3 | 5 | Transición y caída progresiva |

La secuencia conserva las ocho filas de dirección del formato PMD. Las diagonales usan una inclinación mínima: **son aproximaciones** y no reemplazan la necesidad futura de dibujar diagonales originales.

## Rendimiento y seguridad

- Las variantes se crean una vez al cargar cada hoja y se almacenan como `Canvas` en caché.
- Al liberar la hoja, el motor libera también el `Canvas` y sus metadatos derivados.
- Si la expansión falla o falta memoria, se utiliza la hoja original, sin interrumpir la partida.
- Sólo se activa para el Pokémon reservado `10001` (Mao Mao); el resto usa el motor original.
- No cambia rareza ★5, Veneno/Planta, estadísticas, Picotazo Veneno, regalos `MAO25`, datos de guardado, gacha ni clasificaciones.
- La configuración Firebase sigue **desactivada** en esta página: la prueba sólo usa datos locales del navegador.
- No modificar `main`, `fix/friend-lookup`, el Firebase original ni las reglas Firebase Tiliko de producción.

## Verificación

El despliegue ejecuta `node --test tests/*.test.cjs` y pruebas del emulador Firestore para migración y regalos antes de construir la web con `node tools/build.js --sin-seo`. La prueba `tests/maomao-animation.test.cjs` comprueba ciclos, ocho direcciones, carga de hojas ampliadas, preservación del resto de Pokémon y recuperación segura de hojas originales.

## Prueba en Android

1. Entra al sitio aislado desde Brave, con la misma cuenta **local** de prueba que ya tengas allí o crea una nueva.
2. Si Mao Mao todavía no está conseguida en ese origen, introduce el código reutilizable `MAO25` desde el menú **Código de regalo**.
3. Ve a **Pokémon → Especial**, elígela y juega una partida.
4. Prueba caminar recto y en diagonal, lanzar Picotazo Veneno, detenerse y recibir golpes. Comprueba fluidez visual, ausencia de saltos grandes y buen rendimiento.
5. Compárala con la V0.2 para decidir si conviene suavizar más el movimiento antes de publicar nada fuera del entorno de pruebas.
