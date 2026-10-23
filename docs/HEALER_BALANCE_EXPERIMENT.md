# Balance de curanderos: pruebas y comparación

## Objetivo del ajuste

Cuando coinciden varios Pokémon curanderos, sus curaciones pueden acumularse sobre el mismo enemigo hasta superar el daño del jugador. Esta propuesta introduce un **límite compartido del 12 % de la vida máxima por objetivo cada 3,5 segundos de juego** para enemigos normales.

- **Curandero individual:** mantiene su curación habitual del 7 % mientras no alcance el límite. Con multiplicadores de ataque muy altos, el límite también puede afectarlo.
- **Varios curanderos:** consumen el mismo presupuesto por enemigo. La ventana comienza con la primera curación y se reinicia al curar tras 3,5 segundos; no es una ventana móvil. Dos tandas cercanas al final y al inicio de ventanas consecutivas pueden sumar hasta un 24 %.
- **Pausas:** la ventana utiliza el reloj de partida y no el tiempo real.
- **Jefes:** conservan el límite previo basado en el daño recibido por segundo.
- **Otros parámetros:** no se modifican vida, daño, apariciones, experiencia ni recompensas.

## Reproducir tests y benchmark

En PowerShell, desde la raíz del repositorio:

```powershell
git fetch origin
git switch fix/healer-stacking-benchmark
git pull --ff-only origin fix/healer-stacking-benchmark
node --test tests/*.test.cjs
node tools/bench-healers.cjs --baseline=origin/main --iterations=20000
```

La base predeterminada es `origin/main`; usa `--baseline=upstream/main` si ese remoto contiene la versión que quieres comparar. El comando funciona también desde otro directorio mediante la ruta al script.

Consulta `node tools/bench-healers.cjs --help` para ver las opciones. El benchmark ejecuta ambas versiones con los mismos escenarios y presenta los **PV recuperados** y el **coste de CPU por curación** como mediana de cinco muestras.

**Importante:** es una prueba de lógica y un microbenchmark; no mide FPS ni porcentaje de victorias. Las pequeñas diferencias de tiempo pueden variar entre equipos.

## Comprobarlo jugando como invitado

1. Ejecuta `py -m http.server 8000` desde la raíz.
2. Abre `http://localhost:8000/dev.html` y utiliza **modo invitado**.
3. Compara con `main` sin modificar, manteniendo el mismo Pokémon, movimientos, mejoras y ajustes gráficos; juega cada versión por separado.
4. Anota supervivencia, nivel, enemigos y jefes derrotados, FPS aproximados y grupos de curanderos difíciles de eliminar.

Revisa especialmente los minutos **3, 5, 6 y 10**. Conviene jugar varias partidas por versión porque aparecen enemigos y mejoras de forma aleatoria.

## Ventajas, riesgos y limitaciones

**Ventajas:** menor acumulación de curaciones, respeto a las pausas y mantenimiento del comportamiento de los jefes.

**Inconvenientes potenciales:** los grupos con muchos curanderos pueden resultar más fáciles y aumentar indirectamente la experiencia y la supervivencia. El 12 % es un valor experimental. La vida de los enemigos sigue escalando mucho hacia los minutos 5–6, así que esta corrección no elimina todos los picos de dificultad.

No requiere cambios en guardados, clasificaciones ni reglas de Firebase.


## Revisión del 23 de octubre de 2026

- 53 pruebas automáticas superadas: 13 de curación, 4 de la CLI y 36 existentes.
- Casos añadidos: presupuestos por objetivo, curaciones desfasadas, reloj detenido, ataque alto, jefes sin daño reciente, límite de vida y aviso visual del anfitrión.
- CLI comprobada desde otro directorio, con argumentos inválidos y con una referencia inexistente; los errores esperados no muestran trazas internas.
- Con 2.000 PV y ataque ×1,4, tres curaciones pasan de 472,5 a 240 PV (49,2 % menos).
- El microbenchmark muestra coste adicional por lanzamiento; no demuestra mejoras de FPS ni valida el equilibrio de una partida.
- Revisión manual del código: los enemigos remotos usan `netUpdate`; la simulación local/anfitrión ejecuta la curación. La prueba del aviso de red usa un doble, no una conexión real.

Pendiente de validación humana: partidas completas como invitado y en cooperativo, comparación de dificultad y curaciones a ambos lados de una ventana. Esta revisión no sustituye esas partidas.
