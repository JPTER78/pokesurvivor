# Plan de Implementación: Sistema de Etapas — Etapa 1: Bosque Verde & Gimnasio de Brock

> **Para agentes de desarrollo:** REQUERIDO: Usar `executing-plans` para implementar este plan tarea por tarea. Cada paso usa la sintaxis de casillas (`- [ ]`) para seguimiento.

El objetivo de este plan es transformar el bucle de juego actual (modo infinito sin final con enemigos aleatorios de 9 generaciones) en un **Sistema de Etapas estructurado estilo *Vampire Survivors***, comenzando con la **Etapa 1: Bosque Verde & Gimnasio Plateada**.

---

## Decisiones de Diseño y Especificaciones

1. **Duración de la etapa:** 10 minutos (600 segundos).
2. **Elenco temático (Roster):**
   - Min 0-3 (Ruta 1): Pidgey (#16), Rattata (#19), Caterpie (#10), Weedle (#13).
   - Min 3-6 (Bosque Verde): Metapod (#11), Kakuna (#14), Pikachu (#25), Nidoran♀ (#29), Nidoran♂ (#32).
   - Min 6-10 (Acercamiento a Plateada): Pidgeotto (#17), Butterfree (#12), Beedrill (#15), Zubat (#41).
3. **Mini-jefes (Drop de objetos equipables y tickets):**
   - Minuto 3:00: Pidgeotto Alfa (#17).
   - Minuto 6:30: Butterfree (#12) / Beedrill (#15).
4. **Grietas (Vínculos / Fusión de habilidades):**
   - Se mantienen activas; aparecen entre el minuto 4:00 y 5:30 para conseguir la fusión de ataques antes del clímax.
5. **Combate Final (Minuto 10:00 — Gimnasio de Brock):**
   - Se transporta a una **Arena cerrada de tipo Roca** (usando la arquitectura de arena de `G.World.setArena` y guardando/limpiando los mobs comunes con `G.EnemyMgr.stash()`).
   - Salen **Geodude (#74)** y **Onix (#95)** al mismo tiempo.
   - Multiplicadores del combate de Brock: **1.8 de Daño** y **1.8 de Vida** (equivalente a 5 minutos de dificultad del modo infinito, accesible para la primera etapa).
6. **Condición de Victoria:**
   - Al derrotar a ambos jefes, se activa la victoria (`endRun(false)`), otorgando la **Medalla Roca 🪨**, Pokémonedas de recompensa y desbloqueando la siguiente etapa.
7. **Compatibilidad:**
   - El Modo Infinito actual se conserva como opción en el menú.

---

## Archivos Afectados

- **Crear** `js/data/stages.js`: Definición de etapas, enemigos por minuto, jefes, bioma, recompensas y medallas.
- **Modificar** `js/systems/spawner.js`: Adaptar el generador de enemigos para respetar el elenco y los multiplicadores de la etapa activa.
- **Modificar** `js/systems/stages.js`: Sistema de control de la etapa en curso, activación del combate de gimnasio en arena y detección de victoria.
- **Modificar** `js/game.js`: Flujo de inicio de run con etapa, integración del loop de 10 min y llamada a victoria.
- **Modificar** `js/ui/menu.js`: Selector en el menú principal para elegir "Etapa 1: Gimnasio de Brock" o "Modo Infinito".
- **Modificar** `js/ui/run-ui.js`: Pantalla de victoria con la Medalla Roca al completar la etapa.
- **Modificar** `dev.html`: Inclusión de los nuevos scripts (`stages.js`).
- **Compilar** `tools/build.js`: Regenerar `index.html` y `js/app.min.js`.

---

## Tareas

- [x] **Tarea 1: Crear `js/data/stages.js` con la definición de la Etapa 1**
  - [x] Crear el objeto `G.Stages` con la configuración completa de la Etapa 1 (`kanto_1`):
    - `id: 'kanto_1'`, `name: 'Bosque Verde · Gimnasio Plateada'`, `badge: 'Medalla Roca'`.
    - `duration: 600` (10 minutos).
    - `biome: 'forest'`.
    - `hpMul: 0.9`, `dmgMul: 1.2` (escalado justo y accesible).
    - `roster`: Lista temporal de Pokémon con dex y comportamientos.
    - `miniBosses`: Pidgeotto (180s) y Beedrill/Butterfree (390s).
    - `gymBoss`: Geodude (#74) y Onix (#95) con `hpMul: 1.8` y `dmgMul: 1.8`.
  - [x] Añadir métodos auxiliares `G.Stages.get(id)` y `G.Stages.all()`.

- [x] **Tarea 2: Integrar el soporte de Etapas en `js/systems/spawner.js`**
  - [x] Añadir referencia a `activeStage` en el spawner.
  - [x] Si hay una etapa activa, seleccionar los enemigos desde el `roster` de la etapa según el segundo actual de la partida, en lugar del sorteo aleatorio entre las 9 generaciones.
  - [x] Ajustar la vida y daño de los enemigos normales usando los multiplicadores de la etapa en vez de los multiplicadores brutales del modo infinito.
  - [x] Lanzar los mini-jefes definidos en la etapa a los tiempos correspondientes (min 3:00 y min 6:30).

- [x] **Tarea 3: Implementar la Lógica de Gimnasio y Victoria en `js/systems/stages.js` y `js/game.js`**
  - [x] Crear `js/systems/stages.js` (`G.StageMgr`) para coordinar el evento del minuto 10.
  - [x] Al llegar al segundo 600:
    - Activar la arena cerrada de roca: `G.World.setArena({ tx, ty, r: 12, type: 'rock' })`.
    - Limpiar enemigos normales con `G.EnemyMgr.stash()`.
    - Spawnear simultáneamente a Geodude y Onix con los multiplicadores de 1.8.
    - Cambiar música a batalla de jefe (`G.Audio.music('boss')`).
    - Anuncio en pantalla: *"¡El Líder Brock te desafía con Geodude y Onix!"*.
  - [x] Monitorear la muerte de ambos jefes de gimnasio:
    - Cuando ambos mueren, invocar `G.Game.winStage(stage)`.
    - En `G.DB.save`, registrar la medalla y marcar la etapa como completada.

- [x] **Tarea 4: Añadir selector de Etapas en el Menú y Pantalla de Victoria**
  - [x] En `js/ui/menu.js`:
    - Al pulsar "Jugar", mostrar un modal interactivo para seleccionar la Etapa:
      - **Etapa 1: Gimnasio de Brock (10 min)** — *Recomendado*
      - **Modo Infinito Tradicional (Supervivencia)**
  - [x] En `js/ui/run-ui.js`:
    - En `showOver(data)`, si la partida terminó en victoria (`data.wonStage`):
      - Mostrar un banner dorado: **¡VICTORIA! ¡MEDALLA ROCA OBTENIDA! 🪨**.
      - Mostrar la medalla pixel art y el premio de Pokémonedas.

- [x] **Tarea 5: Conectar scripts en `dev.html`, compilar y verificar**
  - [x] Añadir `<script src="js/data/stages.js"></script>` y `<script src="js/systems/stages.js"></script>` en `dev.html`.
  - [x] Ejecutar `node tools/build.js` para compilar `index.html` y `app.min.js`.
  - [x] Verificar con el navegador local que el selector aparece, la partida inicia en el Bosque Verde con Pokémon de Kanto, y la arena de Brock funciona como se diseñó.
