# Plan de Implementación: Finalización de Arena, Recompensas Progresivas y Macro-Selector de Kanto

> **Goal:** Corregir el fin de partida tras vencer a Brock en la arena, implementar sistema de recompensas (primera vs repetida), añadir el 3er mini-jefe al minuto 9 para completar la fusión de 4 habilidades, y crear la macro-card desplegable con la progresión de los 8 gimnasios de Kanto.

---

### Tareas:

#### 1. Corrección del fin de arena (Brock) y eliminación de tickets excesivos
- **Archivos:** `js/systems/stages.js`, `js/entities/enemy.js`
- Quitar `e.legend = true` en Geodude y Onix para evitar que tiren el botín de las grietas legendarias (tickets ×1 y monedas masivas).
- En `js/systems/stages.js`: gestionar `gymState = 'won'` con un temporizador continuo en fotogramas (`winTimer = 2.0`), esperando de forma segura si el jugador está en pantalla de carta (`choice` / `levelup`) antes de invocar `G.Game.winStage`.

#### 2. Recompensas de primera victoria vs victoria repetible
- **Archivos:** `js/data/stages.js`, `js/game.js`, `js/ui/run-ui.js`
- En `stages.js`: definir `firstReward` (500 monedas, 1 ticket ×10, Medalla Roca) y `repeatReward` (150 monedas, 1 ticket normal).
- En `game.js`: verificar si la etapa ya fue completada antes (`save.stages[id]?.completed`). Si es primera vez, otorgar `firstReward` y guardar la medalla; si es repetida, otorgar `repeatReward`.
- En `run-ui.js`: mostrar en la pantalla de resumen si fue primera victoria o victoria repetida.

#### 3. Mini-jefe al minuto 9 (520s - 540s) para completar las 4 habilidades fusionadas
- **Archivos:** `js/data/stages.js`
- Añadir a `miniBosses`:
  - 180s (3:00): Pidgeotto Alfa (Dex #17) -> 1er Vínculo
  - 360s (6:00): Beedrill Enjambre (Dex #15) -> 2do Vínculo
  - 520s (8:40): Butterfree Alfa (Dex #12) -> 3er Vínculo (permite unir el 4to movimiento al grupo máximo de 4)

#### 4. Macro-card desplegable "Etapas de Kanto" con hoja de ruta de los 8 gimnasios
- **Archivos:** `js/data/stages.js`, `js/ui/menu.js`
- Añadir a `stages.js` los datos de los 8 gimnasios de Kanto con sus líderes, medallas y recompensas escalonadas.
- En `menu.js`: renderizar la macro-card "Región de Kanto" con selector desplegable (accordion) que muestra las 8 etapas, destacando la Etapa 1 jugable y las Etapas 2-8 con etiqueta "Próximamente".

#### 5. Compilación y Verificación
- Ejecutar `node tools/build.js` y probar funcionamiento.
