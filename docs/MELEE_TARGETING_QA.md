# Apuntado cuerpo a cuerpo: validación y regresiones

## Motivo

Cuando hay un jefe cerca del jugador pero fuera del alcance del movimiento activo, el apuntado automático puede priorizarlo e impedir que el Pokémon golpee a enemigos que tiene al lado. Esto afecta especialmente a las configuraciones de **cuerpo a cuerpo**.

Relacionado con las incidencias **#186** y **#208**.

## Qué cambia

- **Objetivos alcanzables:** los movimientos cuerpo a cuerpo priorizan enemigos cuya zona de colisión se solapa con el radio del golpe.
- **Vínculos:** cada movimiento fusionado comprueba su alcance y utiliza un objetivo temporal, sin modificar el apuntado de los otros ataques.
- **Recargas:** no se consume la recarga completa si el apuntado automático sólo encuentra enemigos fuera de la zona de impacto.
- **Movimiento:** el ángulo se recalcula cuando un enemigo cambia de posición entre fotogramas.
- **Comportamiento conservado:** se mantiene el apuntado manual, la prioridad de los jefes para ataques a distancia y la selección de objetos destructibles.

No se alteran el daño, las estadísticas, las oleadas, las recompensas ni la duración normal de las recargas.

## Pruebas automatizadas

Ejecutar desde la raíz del repositorio:

```powershell
node --check js/entities/player.js
node --check js/systems/combat.js
node --test tests/melee-targeting.test.cjs tests/melee-collision.test.cjs
node --test tests/*.test.cjs
```

Los tests utilizan los módulos reales `player.js` y `combat.js` en un entorno aislado de Node.js, con simulaciones deterministas de colisiones, movimiento y efectos. Cubren el alcance, los radios de los enemigos, las fronteras de los arcos, la entrada y salida de enemigos, los cambios de dirección, las fusiones, las recargas, el apuntado manual, el cooperativo y los objetos destructibles. También comprueban la muerte de un enemigo entre movimientos vinculados y el cruce del arco por ±π. Los escenarios prolongados usan enemigos con vida suficiente para no confundir muerte con pérdida de objetivo.

**Alcance de la validación:** estas pruebas verifican la lógica, no sustituyen las partidas en navegador ni permiten concluir que los FPS o la conexión multijugador no se vean afectados.

## Comprobación manual como invitado

Desde la raíz, ejecutar `py -m http.server 8000` y abrir `http://localhost:8000/dev.html`.

1. Elegir un Pokémon con un ataque cuerpo a cuerpo, acercarse y alejarse de grupos de enemigos y comprobar que no se queda sin atacar al entrar en alcance.
2. Enfrentarse a un jefe rodeado de enemigos normales: cuerpo a cuerpo debe seguir golpeando a objetivos próximos.
3. Alternar movimientos a distancia y cuerpo a cuerpo durante la partida y comprobar la prioridad de cada uno.
4. Moverse junto a paredes, pasillos y objetos destructibles; revisar que las colisiones y el daño al entorno se mantienen.
5. Probar el apuntado manual y volver al automático, sin direcciones bloqueadas.
6. Cuando sea posible, repetir con movimientos fusionados y una partida cooperativa.
7. Revisar posibles ataques vacíos, recargas anómalas y tirones en oleadas con muchos enemigos.

## Lo que deliberadamente no cambia

Los ataques cuerpo a cuerpo utilizan una intersección circular y un arco, sin comprobar si una pared bloquea el golpe. Esta PR no introduce una nueva mecánica de oclusión: sería una modificación de combate independiente de la corrección del apuntado.

## Revisión previa a la PR

- 80 pruebas de la suite raíz superadas con Node.js 24, incluidas 44 de apuntado y colisiones.
- Sintaxis de los archivos de juego modificados comprobada con `node --check`.
- Empaquetado de producción con `node tools/build.js` superado en una copia temporal. El bundle, las páginas y la huella de publicación no se incluyen en esta rama: se generan al publicar según `CLAUDE.md`.
- Novedad ES/EN incluida, con traducciones y diccionarios regenerados para los otros cinco idiomas.
- Revisado el diff de código: sin nuevos `console.log`, `debugger`, dependencias ni archivos de depuración. Se conservan las pruebas y esta guía porque documentan y protegen el cambio.

La revisión manual de esta iteración fue de código y escenarios. Sigue pendiente la partida de invitado y la prueba cooperativa descritas arriba; no se afirma validación visual ni de FPS en navegador.
