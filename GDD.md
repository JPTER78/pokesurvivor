# GDD — PokéSurvivor · Mundo Misterioso

> Documento de diseño vivo. Refleja el estado **actual** del juego; al final hay
> un registro de decisiones con fecha.

## 1. Concepto

- **Plataforma:** navegador. Se abre con doble clic en `index.html`, sin servidor.
- **Género:** bullet-heaven / horde survival + **roguelike** + **gacha de personajes**.
- **Referencias:** Survivor.io, Megabonk, Vampire Survivors.
- **Estética:** **Pokémon Mundo Misterioso** (sprites de PMD, cajas de diálogo
  azules, iconos pixel art, música de aldea).
- **El jugador es un Pokémon.** Hay **966 Pokémon** de las 9 generaciones.
- **Todo es local:** sprites, datos, fuente, música y guardado. El juego no hace
  ninguna petición a internet.

## 2. Flujo de pantallas

```
Login / Crear cuenta / Invitado
        │
        ├─ (primera vez) Test de personalidad ─> Compañero asignado
        │                                          ├─ ¡Vamos juntos!
        │                                          └─ Elegir otro (29 starters)
        ▼
Menú principal  (el mundo de fondo, con Pokémon salvajes paseando)
   ├─ Jugar      → run → resumen (+ Pokémonedas, shinies conseguidos) → menú
   ├─ Pokémon    → colección por región, elegir compañero (normal o shiny)
   ├─ Mejoras    → mejoras permanentes
   ├─ Gacha      → 9 banners, uno por región
   ├─ Amigos     → añadir por apodo, en línea, invitar → Sala (hasta 4) → partida en grupo
   └─ Ranking    → tiempo aguantado: Solo / Grupo × día, semana, mes, año, histórico
```

### 2.3 Multijugador cooperativo (hasta 4)
- **Amigos por apodo.** Las cuentas de nombre y contraseña usan su nombre; las
  de Google eligen un apodo único (su nombre real nunca se enseña).
- **Sala:** el que invita es el anfitrión; los amigos en línea reciben la
  invitación en el menú. El anfitrión empieza la partida para todos.
- **Conexión:** directa entre navegadores (WebRTC, estrella con el anfitrión);
  si la red no lo permite, por la Realtime Database (más lento, pero funciona).
- **Quién manda:** el anfitrión lleva enemigos, objetos, experiencia y reloj;
  cada jugador su Pokémon (posición, vida, ataques). Los golpes a enemigos se
  mandan al anfitrión; los ataques de los compañeros se ven como "fantasmas".
- **Experiencia compartida**; al subir de nivel cada uno elige su carta y el
  juego **no sigue hasta que eligen todos**.
- **Caer:** te quedas en el suelo; un compañero a tu lado 3 s te levanta con la
  mitad de vida. Se acaba cuando caéis todos.
- **Flechas** en el borde de la pantalla hacia los compañeros que no se ven
  (nombre y metros; roja si está caído).
- **Mensajes rápidos** (`js/ui/emotes.js`, desde el 16-10-2026): ¡Ayuda!,
  ¡Aquí!, ¡Grieta! y ¡Gracias! con las teclas 5-8 o el bocadillo del móvil
  (debajo de la pausa). Bocadillo encima del Pokémon 3 s y, si no se le ve,
  junto a su flecha. Uno cada 1,2 s (el anfitrión no reenvía más de uno por
  segundo de cada uno).
- **Qué va en cada envío del anfitrión** (no sólo en avisos sueltos, para que
  nada se quede descolocado si se pierde uno): reloj, nivel y experiencia del
  equipo, enemigos cercanos, quién está eligiendo, cartas de nivel, el acto /
  jefe / portal / modo infinito (`f.ac`) y el evento en curso (`f.es`).
  El rango del grupo va en el `start` (el más alto del grupo); el nivel del Pokémon de
  cada uno se ve en la sala. Las stats, objetos, bayas y habilidades de cada
  Pokémon los calcula su dueño.
- Dificultad: ×(1 + 0,75·(n−1)) enemigos y ×(1 + 0,3·(n−1)) vida; la
  experiencia del equipo se divide entre (1 + 0,6·(n−1)).
- La pausa no para el juego; si se va el anfitrión, la partida acaba para todos.

### 2.4 Ranking
- **Sólo el modo infinito** (desde el 16-10-2026, todas las tablas desde cero):
  el tiempo aguantado en él (tras ganar en Maestro), derrotados de desempate.
  Tablas `s_d…i`, `s_w…i`, `s_m…i` e `inf` (histórico). Pestañas **Solo / Grupo**; periodos **diario, semanal,
  mensual, anual e histórico** (hora de España); **todos o sólo amigos**;
  **filtro por Pokémon**; tu puesto abajo aunque no salgas en el top 50.
- Una entrada por jugador (o equipo) y tabla, sólo si mejora. En grupo sale
  el equipo entero en la misma fila (la sube el anfitrión).
- Anti-trampas básico: al empezar se apunta la hora del servidor y las reglas
  no aceptan un tiempo mayor que el tiempo real transcurrido.

### 2.1 Cuentas
- Entrar, crear cuenta o **jugar como invitado** (no se guarda nada).
- Provisional en `localStorage` detrás de `js/core/db.js`. Contraseñas con sal +
  SHA-256, pero es local: no es seguridad real.
- La sesión se recuerda al reabrir el juego.

### 2.2 Test de personalidad
- 8 preguntas estilo Mundo Misterioso; cada respuesta suma puntos de rasgo.
- El rasgo dominante decide el compañero entre los **29 iniciales**: starters de
  las 9 generaciones + Psyduck + Slowpoke. Se puede rechazar y elegir otro.

## 3. Combate

- El Pokémon **ataca solo** con el **movimiento activo** (1 de hasta 4).
- Cambias el activo con `1`–`4` o `Q`/`E`. Moverse: `WASD` / flechas. Pausa: `Esc`.
- Cada ataque reproduce la **animación de PMD** que toca: `Attack`, `Shoot` o `Charge`.
- **Apuntado:** lo que te está tocando > el jefe si está a tiro > el enemigo más
  cercano > (sin enemigos) la roca o cofre más cercano.
- **~575 movimientos** (desde el 16-10-2026): los 64 curados de `js/data/moves.js`
  más los originales de los juegos (`js/data/moves-gen.js`, de
  `tools/fetch_moves.py`), que copian la forma de un curado (`tpl`) con su daño,
  tipo y efectos (quemar, envenenar, frenar, drenar, retroceso, críticos, bajar
  ataque o defensa). 17 formas, 5 niveles cada uno. Cubren los **18 tipos**.
- **Qué puede usar cada Pokémon**: su lista de aprendizaje por nivel (juego más
  reciente en que sale, `js/data/learnsets.js`) hasta su nivel permanente, más
  lo enseñado con MT (`save.ptm`, fase 4). Empieza con el mejor de ataque que
  sabe (`G.Moves.bestStart`: potencia × STAB, sin los que cuestan vida).
- **Estado** (no hacen daño): potenciadores (Ataque = físicos, At. Esp. =
  especiales, Defensa, Velocidad, regeneración), `debuff` alrededor (pegan menos,
  reciben más, frenar, veneno, quemadura; dormir y paralizar = frenar) y `weather`
  (su clima, si no hay otro). Solos o en un vínculo. Como mucho 2 por partida;
  en cada tanda de cartas entran como mucho 2 candidatos y pesan menos.
- Al subir de nivel: **1 de 3 cartas**.

## 4. Mundo

Arena abierta e infinita, generada con ruido determinista y pintada en pixel art
desde código (16 px por tile, ×2).

| Elemento | Efecto |
|---|---|
| Formaciones rocosas | Bloquean a quien camina y a los proyectiles |
| Agua | Ralentiza (×0,6 jugador, ×0,55 enemigos) |
| Lava (bioma volcán) | Quema a quien la pisa — se puede atraer a los enemigos |
| Árboles / cristales | Bloquean; dan cobertura contra disparos enemigos |
| Rocas | Se rompen; sueltan XP, monedas o bayas |
| Cofres | Se rompen; buen botín de monedas |
| Hierba alta | Se corta con cualquier ataque; a veces suelta algo |
| **Manantial** | Cura mientras estás encima; se agota y se recarga solo en ~45 s |
| **Cofre con candado** | Quédate 3,5 s a su lado (aunque te ataquen): monedas, 1-3 tickets (15% un ×10) y experiencia para subir un nivel |
| **Trampas** | Veneno, pegajosa (te frena) o explosiva; saltan al pisarlas, también con los enemigos |
| **Grieta** | Rara (cada 30 s, 14% desde el minuto 1:15; dura 45 s). Te lleva a la arena de un legendario |

- **Voladores, fantasmas y jefes** ignoran el terreno.
- **5 biomas**, cada uno con su música y los tipos de sus salvajes: Bosque
  Umbrío (Planta, Bicho, Volador), Cueva Cristal (Roca, Tierra, Hielo), Volcán
  Ceniza (Fuego, Roca, Dragón), **Torre Lavanda** (Fantasma, Veneno, Psíquico;
  niebla, lápidas y los fantasmas atraviesan paredes) y **Desierto Ruta 111**
  (Tierra, Roca, Siniestro; arenas movedizas que frenan, cactus, tormentas de
  arena). Uno sorteado por acto, sin repetir; el cambio es un **fundido** de
  2,6 s entre la paleta vieja y la nueva (suelo y objetos).

### 4.0a Estructura de la partida (desde el 16-10-2026, `js/systems/acts.js`)
Sustituye a la Sentencia de Arceus (se quitó entera).
- **3 actos de 10 min.** Jefes sueltos a los 3 y 7 min de cada acto (6 franjas
  en `BOSS_SLOTS`). En el minuto 10, **jefe de zona** (no legendario, de los
  tipos del bioma; 12.000 / 40.000 PV × rango). Las oleadas siguen; al vencerlo,
  siguiente acto. A los 3 min de combate se enfurece (×1,5 daño, ×1,25 velocidad).
- **Jefe final** (acto 3): un legendario al azar (120.000 PV × rango), con fases
  al 66 % (llama aliados y se pone escudo) y al 33 % (más aliados, más daño).
  Suena el tema que era de la Sentencia. Al vencerlo: **portal**; cruzarlo = ganar.
  Tras la victoria ya no salen enemigos (salvo en el modo infinito).
- **Rangos** (`save.rank`): Normal, Bronce, Plata, Oro, Maestro; vida ×1 / 1,35 /
  1,8 / 2,4 / 3,2, daño ×1 / 1,2 / 1,4 / 1,65 / 1,9, premio (monedas y exp. del
  Pokémon) ×1 / 1,25 / 1,5 / 1,8 / 2,2. Se elige con cuál jugar debajo de «Jugar»
  (`save.rpick`; sin elegir, el último desbloqueado). En grupo lo elige el anfitrión
  en la sala, hasta el más alto que tenga alguien del grupo (desde el 17-10-2026).
  Ganar desbloquea el siguiente al tuyo, uno solo aunque el grupo jugara uno más
  alto. Victoria: +400 × (1 + rango × 0,5) monedas.
- **Modo infinito** (sólo en Maestro): si no cruzas el portal en 20 s. Sin jefes,
  grietas ni eventos; enemigos ×(1 + min × 0,45) de vida, ×(1 + min × 0,2) de daño
  y ×(1,6 + min/2) de cantidad. Es lo único que cuenta para el ranking.
- Cooperativo: decide el anfitrión; el estado va en cada fotograma (`f.ac`).

### 4.0b Eventos e interactivos nuevos (desde el 16-10-2026)
- **Eventos** (`js/systems/events.js`; nunca dos a la vez, cada 4-5 min; de los
  nuevos, como mucho uno por acto): **Brote masivo** (40 s, una especie del tramo
  y del bioma, shiny ×12), **Pokémon errante** (un legendario errante —Raikou,
  Suicune, Latias, Uxie...— que huye 45 s; premio de jefe especial), **Apagón**
  (sólo Torre Lavanda, 30 s, sólo se ve alrededor, exp. ×1,5) y **Espejismo**
  (sólo desierto, 40 s, cofre que salta cada 3,5 s; tocarlo = botín de cofre grande).
- **Árbol de bayas** (`berrytree`): al pasar, cura un 30 % y da el poder de la baya
  de su bioma durante 20 s: Lichi (bosque, +40 % daño), Aslac (desierto, +40 %
  velocidad), Chiri (volcán, −30 % recarga), Gonlan (cueva, −25 % daño recibido) y
  Arabol (Torre Lavanda, uno de esos al azar o Imán ×4). Hojas y fruto de otro color
  en cada bioma. Vuelve a dar fruto a los 90 s. Cada uno el suyo. **Desde el
  20-10-2026 sustituyen a los altares de poder** (Furia, Rayo, Imán, Prisa), que se
  quitaron: su hueco en el mapa es ahora de los árboles (el doble que antes).
- **Altar de riesgo** (`riskaltar`): 2,5 s a su lado y despierta a un guardián
  (fuerte, de los tipos del bioma) y un séquito; al vencerlo, botín grande.
- **Jefes Alfa / Dominante** (20 % de los jefes sueltos y legendarios de grieta):
  Alfa ×1,3 tamaño, ×1,5 vida, ×1,25 daño, aura y ojos rojos; Dominante ×1,3 vida,
  aura dorada, llama a 3 ayudantes cada 14 s. Ambos ×1,5 exp. y botín grande
  (objeto, ticket ×10, 60 % MT, monedas). En cooperativo se ven igual en todos
  (`'ne'` lleva si es Alfa o Dominante); los ayudantes los llama el anfitrión.
- **Grieta → arena:** zona redonda cerrada en el bioma *Grieta Distorsión*,
  contra un **legendario** (2 min). Ganas: ticket ×10 extra, 3 tickets y
  monedas, y vuelves donde estabas. Pierdes (caéis todos o se acaba el tiempo):
  vuelves sin premio con el 30% de vida. Mientras, los enemigos del mapa esperan.

### 4.0 Arenas de la grieta (una por tipo)
El legendario te espera en la arena de **uno de sus dos tipos, al azar**. Cada
arena tiene su paleta, su decoración, su terreno y su clima, y suena un tema
propio ("rift"). El legendario choca con paredes y columnas como tú y no puede
salir del círculo.

| Tipo | Arena | Terreno | Clima |
|---|---|---|---|
| Normal | Pradera Eterna | columnas | — |
| Fuego | Volcán Ígneo | ríos de lava (quema) | sol |
| Agua | Gruta Marina | charcos (frenan) | lluvia |
| Planta | Selva Esmeralda | ciénaga (frena mucho), árboles | — |
| Eléctrico | Central Voltio | charcos con descarga | lluvia |
| Hielo | Glaciar Eterno | placas de hielo (resbalas) | nieve |
| Lucha | Dojo Ancestral | muchas columnas | — |
| Veneno | Ciénaga Tóxica | charcos de veneno | — |
| Tierra | Desierto Rojo | arenas movedizas | arena |
| Volador | Pico Celeste | árboles-nube | — |
| Psíquico | Templo Mental | cristales rosas, columnas | — |
| Bicho | Bosque Colmena | ciénaga, mucha hierba | — |
| Roca | Cantera Antigua | muchas columnas y rocas | arena |
| Fantasma | Cementerio Sombrío | árboles muertos | niebla |
| Dragón | Santuario Dragón | llamas dracónicas (queman) | — |
| Siniestro | Callejón Oscuro | columnas | — |
| Acero | Fortaleza de Acero | muchas columnas | — |
| Hada | Bosque Encantado | árboles rosas, fuentes | — |

Inmunidades al terreno: Fuego a la lava, Veneno/Acero al veneno,
Eléctrico/Tierra a la descarga, Hielo al hielo. El legendario no sufre su arena.

### 4.1 Climas (evento raro)
Desde el minuto 2, cada minuto hay un 18% de que llegue un clima (~1 minuto):

| Clima | Efecto |
|---|---|
| Sol abrasador | Fuego ×1,5 · Agua ×0,5 |
| Lluvia | Agua ×1,5 · Eléctrico ×1,2 · Fuego ×0,5 |
| Tormenta de arena | Roca, Tierra y Acero ×1,3; el resto pierde un 1,2% de vida cada 2 s (nunca KO) |
| Nevada | Hielo ×1,5; el resto pierde vida igual y va un 10% más lento |
| Niebla | Fantasma, Hada y Psíquico ×1,3; la viñeta se cierra un poco |

Afecta a todos (tú y los enemigos). Cada bioma prefiere unos climas. Lo visual
es suave: tinte leve y pocas partículas pixel. En grupo lo decide el anfitrión.

### 4.2 Tabla de tipos (suavizada)
La de los juegos, pero ×1,6 / ×0,6 / ×0,3 en vez de ×2 / ×0,5 / ×0 (con un
solo ataque activo, una inmunidad total dejaría enemigos imposibles). Dos
tipos se multiplican, con tope ×0,3–×2,4. Tus ataques usan el tipo del
movimiento; los enemigos, su tipo principal (o el de su disparo). Número
amarillo cuando es muy eficaz; gris si no (sin texto, para no cargar la pantalla).

## 5. Enemigos

- **De todas las generaciones.** 6 tramos por total de stats base; en cada run se
  sortea un elenco de 7 Pokémon por tramo, así cada partida es distinta.
- IA según tipos: persecución, embestida telegrafiada (`Charge` → `Attack`),
  disparo a distancia o tanque.
- **Jefes sueltos** (2 por acto, ver 4.0a): Pokémon fuertes **no legendarios**
  (pseudolegendarios, Slaking...) al azar, cada vez más fuertes; 1 de cada 3
  suelta un **ticket ×10**. Los legendarios salen en las grietas y como jefe final.
- **Según el bioma:** el 65 % de los salvajes son de los tipos del bioma del acto. Durante un combate de jefe las oleadas bajan al 25%, no
  hay mareas y suena el tema de jefe.
- Mareas cada ~45 s. Tope de **280** enemigos a la vez; al llegar al tope, los
  que siguen saliendo son élite (×1,6 vida y experiencia, ×1,25 daño).
- **Pathfinding:** campo de distancias (BFS) alrededor de cada jugador; los que
  caminan rodean rocas, paredes y charcos peligrosos. Sólo vuelan por encima
  los que **flotan en su sprite** (`hv` en sprites-meta, tools/hover_flags.py):
  Rowlet o Pidgey caminan aunque sean Voladores; Gastly o Zubat flotan.

### 5.1 Personalidades
En cada run, cada tramo de enemigos trae al menos 2 con personalidad (1 en el
primero, para ir aprendiendo). Los ataques "con aviso" se ven antes en el suelo.

| Personalidad | Quién | Qué hace |
|---|---|---|
| Curandero | Chansey, Blissey, Audino, Clefairy... | Cura un 15% a los de alrededor cada 3,5 s |
| Escudo | Shuckle, Bronzong, Mr. Mime, Bastiodon... | Escudo del 35% de vida a 6 compañeros |
| Invocador | Nidoqueen, Vespiquen, Golbat, Gyarados... | Llama a 2 de su manada (Nidoran, Combee...) |
| Kamikaze | Voltorb, Electrode, Koffing, Geodude... | Se acerca y explota (aviso de 1 s) |
| Rayo | Eléctrico, Psíquico, Dragón, Hielo (algunos) | Rayo con franja de aviso |
| Zonas | Fuego, Tierra, Veneno (algunos) | Círculos bajo tus pies que estallan |
| Abanico | Agua, Planta, Bicho, Hada (algunos) | 3 disparos en abanico (5 más adelante) |
| Saltador | Lucha, Tierra, Normal, Roca (algunos) | Salta y cae donde estabas |

## 6. Shinies

- **Salvajes:** cada enemigo tiene **1/4096** de salir shiny (también los jefes).
  Brilla, tiene el doble de vida, da ×5 de experiencia, no desaparece aunque te
  alejes y una flecha en el borde de la pantalla te indica dónde está.
  **Si lo derrotas, te lo quedas** (y la versión normal si no la tenías). Si ya
  tenías ese shiny, +300 monedas.
- **Gacha:** 1 de cada 100 tiradas sale shiny. Shiny repetido = triple de monedas.
- **Colección:** en la ficha de un Pokémon cuyo shiny tienes hay un selector
  **Normal / Shiny**; eliges compañero en la versión que quieras.
- 958 de los 966 Pokémon tienen sprite shiny auténtico de SpriteCollab.

## 7. Progresión

### 7.0 Nivel de cada Pokémon (desde el 16-10-2026)
- Cada Pokémon de la colección tiene su **nivel (1-100)**, distinto del nivel de
  la partida. Al acabar una partida gana la experiencia conseguida en ella, con el
  **ritmo de crecimiento de su especie** (tablas de los juegos, `G.EXP_TABLE`).
  Una partida de 10 min lleva a un Pokémon nuevo al Nv. ~17; una de 30 min, al ~33.
- **Stats** (`js/systems/mons.js`): iguales a los de antes en el Nv. 1; el nivel
  sube vida y ataque hasta +50 % y velocidad hasta +10 % en el Nv. 100.
  **Físico/especial**: los movimientos físicos usan Ataque y los especiales
  At. Esp. (clase de `js/data/moves-gen.js`); Defensa y Def. Esp. reducen de
  −10 % a +30 % el daño de su clase (`(Def − 70) / 450`; hasta el 19-10-2026, /400 y
  +20 %), más hasta +8 % por nivel (cuerpo a cuerpo = físico; disparos, rayos
  y zonas = especial). **STAB** ×1,2. **Muros:** el ataque físico usa el 45 % de la
  Defensa si es mayor que el Ataque (y el especial, el 45 % de la Def. Esp.), como
  Plancha Corporal: así Shuckle o Toxapex no son inútiles.
- **Naturaleza** (×1,1 / ×0,9 al ataque de su clase y a la velocidad finales; ±5 %
  de reducción en defensa; hasta el 19-10-2026 multiplicaba el stat base y apenas
  se notaba) y **habilidad** (1 de cada 20, la oculta): al azar pero fijas por cuenta
  y Pokémon (semilla = creación de la partida + nº), así no hace falta guardarlas.
- **Habilidades** (`js/data/ability-fx.js`): unas 170 con efecto propio; el resto,
  +8 % con su tipo principal. **Regla de balance del dueño (19-10-2026):** como en
  los juegos, los legendarios son más fuertes, pero nadie rompe el juego ni queda
  inútil.
  - Una habilidad mala (Ausente, Inicio Lento, Flaqueza, Entusiasmo) es un
    **intercambio**, y el Pokémon conserva su punto fuerte.
  - Una muy buena va con un punto débil (Potencia en Azumarill, que tiene poco
    Ataque; Superguarda en Shedinja, con 1 de PS).
  - Las pequeñas o de vez en cuando suman además la genérica (`plusGeneric`), así
    nadie salió perdiendo.
  - Comprobación: con cualquiera de sus habilidades, cada Pokémon queda dentro de la
    franja de fuerza de su rareza (script de balance, ver el historial del 19-10-2026).
- Guardado: `pxp` (experiencia, se fusiona con el máximo), `pnat`/`pabil`
  (elegidas a mano, fase 4). Las partidas de antes: Nv. 5 + niveles de mejora (máx. 40).
- Datos de los juegos (listas de aprendizaje, MT, habilidades, stats) generados
  por `tools/fetch_moves.py` desde las tablas CSV de PokeAPI.

### 7.0b Tienda Kecleon, Mochila y MT (desde el 16-10-2026)
- **Tienda Kecleon** (menú, `js/data/shop.js` + `js/ui/shop-ui.js`), se abre poco a
  poco: tras 2 partidas (caramelos: Exp. S 800 exp. · 50, M 3.000 · 180, L 10.000 · 550,
  Raro +1 Nv. · 150), con la primera MT (MT: 300 + potencia × 6, las de estado 400) y,
  hasta que haya victorias (fase 6), tras vencer al primer legendario de grieta
  (Menta 1.500, Cápsula Habilidad 1.500, Cápsula Habilidad Oculta 5.000). No se roba.
- **Mochila**: `save.bag` (caramelos, Menta, Cápsulas) y `save.tms` (cada MT se
  gasta al enseñarla). Se usa desde la Mochila o desde la ficha de la colección.
  Lo enseñado va a `save.ptm[dex]` y entra en `G.Moves.poolFor`.
- **MT como botín**: jefes (20 %) y cofres con candado (10 %). Cuál, lo decide quien
  la coge: 80 % una que su Pokémon puede aprender y aún no sabe.
- Fusión entre aparatos: Mochila de la versión más reciente (como las monedas);
  `ptm` unión.

### 7.1 Pokémonedas
Al terminar una run: `tiempo/5 + derrotados/4 + 80 por jefe + monedas recogidas`,
multiplicado por la mejora Fortuna. Cuenta nueva: 500 de regalo.

Las monedas sirven para las **mejoras**; el gacha va con tickets.

### 7.2 Mejoras permanentes — de la cuenta (desde el 16-10-2026)
Imán, Sabiduría, Fortuna, Repertorio, Golpe Crítico y Cambio de cartas cuentan con
todos los Pokémon (`save.aupg`). El Veto sigue siendo de cada Pokémon
(`save.pupg[dex].ban`). Las de stats se quitaron (lo da el nivel) y se devolvieron
sus monedas (migración v5 en `js/core/db.js`, `G.Upgrades.spent`).

### 7.2-antes Mejoras permanentes — de cada Pokémon (hasta el 16-10-2026)
Vitalidad, Fuerza, Zancada, Reflejos, Coraza, Síntesis, Imán, Sabiduría, Fortuna
y **Repertorio (empezar con 2 movimientos)**. Cada Pokémon tiene las suyas y
sólo cuentan cuando juegas con él (en la pantalla de Mejoras se elige cuál).
Las que se compraron cuando eran de la cuenta pasaron al compañero de entonces.

### 7.2a Objetos equipables (uno por run)
Restos, Cinta Elección, Garra Rápida, Banda Focus, Cascabel Concha, Moneda
Amuleto, Huevo Suerte, Vidasfera, Pañuelo Elección, Casco Dentado y Chaleco
Asalto; desde el 16-10-2026 también Periscopio (+12 % críticos), Cinta Experto
(+25 % muy eficaz), Cinta Fuerte / Gafas Especiales (+20 % físico / especial),
Seguro Debilidad (+50 % 10 s al recibir un muy eficaz), Globo Helio (flotas hasta
el primer golpe; se rehincha a los 25 s), Polvo Brillo (esquiva 10 %) y Hierba
Blanca (nada te frena). 19 en total. Los sueltan **todos los jefes**, los cofres con candado (50%) y a veces
los normales (8%). Si ya llevas uno, eliges (en solitario el juego se para).

### 7.2c Evolución de movimientos
Un movimiento al nivel máximo evoluciona si en esa run has cogido su mejora de
condición (Ascuas + Potencia → Llamarada, Burbuja + Carrera → Surf...): sale
una **carta dorada** (siempre, si está lista). Los de ataque evolucionan; los de
los juegos, en el más fuerte de su tipo y forma (`evo` en `moves-gen.js`). El
logro "Maestro de movimientos" pide 59 distintos (lo que había curados).

### 7.2c-bis Cada movimiento, distinto (desde el 17-10-2026)
Antes un movimiento de los juegos era una copia de su plantilla con otro daño
(Salmuera = Pistola Agua, misma animación y mismas características). Ahora cada
uno sale de sus datos originales (`moves-gen.js`: `pp`, `acc`, `pri`, `hits`,
`fl`, `up`; `profile()` y `SIG` en `js/data/moves.js`):
- **PP** = ritmo: muchos PP, golpes seguidos y flojos; pocos, lentos y fuertes
  (el daño por segundo apenas cambia). **Potencia** = tamaño. **Prioridad** = sale
  disparado. **Nunca falla** = persigue; **impreciso** = más grande y disperso.
  **Golpes múltiples** = más disparos (o golpes) más pequeños.
- **Banderas:** sonido atraviesa a todos, puño empuja más, mordisco más críticos,
  pulso más alcance. **Sube tus stats al golpear** (Nitrocarga, Puño Incremento...).
- **Efecto propio** de 60 famosos (`combat.js`, `sigMul` / `sigHit`):
  Salmuera ×2 a quien tenga menos de la mitad de vida, Carga Tóxica ×2 a
  envenenados, Desquite / Alud ×2 si te acaban de golpear, Inversión más cuanta
  menos vida tengas, Salpicar más cuanta más, Rodar / Cortefuria crecen al acertar
  seguido, Antiaéreo ×2 a los que vuelan, Día de Pago suelta monedas, Demolición
  rompe escudos, Superdiente quita el 30 % de la vida que quede (no a jefes), Ida y
  Vuelta da un acelerón, Bola Clima ×2 con clima...
- **Aspecto propio** (`vfx.js`, `visOfGen`): forma de su tipo elegida por su nombre
  y nunca la de su plantilla; sonido = notas, pulso = anillos, mordisco = fauces,
  puño o patada = impacto, garra o corte = zarpazo; la mitad, con estela.
- La descripción de cada uno dice lo que lo distingue (en español e inglés).
- Comprobado: de los 489 de daño, ningún Pokémon aprende dos idénticos (quedaban
  3 parejas, retocadas a mano en `EXTRA`: Fuego Sagrado, Sofoco, Mil Temblores).

### 7.2d Misiones, logros y perfil
- **3 diarias + 2 semanales** (premio en tickets y monedas); una diaria se puede
  cambiar al día. Mismas misiones en cualquier ordenador (semilla por cuenta).
- Desde el 16-10-2026 también: jefes de zona, llegar al acto 2-3, subir niveles
  a tus Pokémon, enseñar una MT, ganar partidas y aguantar en el modo infinito.
  Las de sistemas que aún no tienes no salen (`when` en `js/data/missions.js`:
  MT sólo si ya has visto una, ganar desde 5 partidas, infinito sólo en Maestro).
- **Logros** con medalla (bronce, plata, oro), premio y a veces **título**;
  uno por cada **legendario** vencido en una grieta.
- **Perfil público** (desde el ranking o la lista de amigos): 3 favoritos,
  título, mejores marcas y las 8 mejores medallas.

### 7.2b Tickets del gacha
- **Ticket** (×1): cada Pokémon derrotado tiene 1/400 de soltar uno; los cofres
  con candado dan 1-3.
- **Ticket ×10**: los jefes, el legendario de la grieta (2) y, a veces, los
  cofres con candado.
- En grupo los tickets son del equipo: todos se llevan los que se recogen.

### 7.3 Gacha — un banner por región
Kanto, Johto, Hoenn, Sinnoh, Teselia, Kalos, Alola, Galar y Paldea, cada uno con
**sus Pokémon, sus 3 destacados y su propio pity**.

| Rareza | Prob. | Repetido devuelve |
|---|---|---|
| Común | 45% | 15 |
| Poco común | 30% | 30 |
| Rara | 17% | 60 |
| Épica | 6,5% | 120 |
| Legendaria | 1,5% | 300 |
| *Shiny* | *1% (cualquier rareza)* | *×3* |

- Tirada ×1: 1 ticket · ×10: **10 tickets normales o 1 ticket ×10** (dos botones,
  eliges con qué pagar), con **al menos una
  Épica** garantizada. Los repetidos siguen dando monedas.
- **Animación: tragaperras pixel art** (palanca, 3 rodillos, bombillas). Los
  símbolos son la rareza: Poké, Super, Ultra, Lujo y Master Ball
  (Legendaria) y la estrella roja (shiny); con Épica o mejor el último rodillo se hace
  esperar. La ×10 son 10 tiradas rápidas que caen a la bandeja. Clic = acelerar.
- **Pity:** a las 70 tiradas sin Legendaria en un banner, la siguiente lo es.
- Algunas regiones tienen rarezas casi vacías (Galar sólo tiene 4 Poco comunes);
  si una rareza no tiene Pokémon en ese banner, sale la más cercana.

## 8. Música y sonido

Compuesto para el juego y tocado por un sintetizador Web Audio (flauta, marimba,
guitarra punteada, bajo, pad, lead y batería, con reverb). Cero ficheros.

| Tema | Dónde | Estilo |
|---|---|---|
| Aldea | Menús | Fa mayor, 100 bpm con swing, flauta y marimba |
| Bosque | Run (bosque) | Re menor aventurero, 122 bpm |
| Cueva | Run (cueva) | La menor misterioso, 92 bpm, campanitas |
| Volcán | Run (volcán) | Mi frigio tenso, 132 bpm |
| Torre Lavanda | Run (torre) | La menor lento e inquietante, 76 bpm, campanas |
| Desierto | Run (desierto) | Mi frigio, 116 bpm, flauta |
| Final | Jefe final | Re menor frigio solemne, 140 bpm (era el de la Sentencia) |
| Jefe | Combate de jefe | Mi menor intenso, 150 bpm |

- Efectos para botones, cada familia de ataque (con tono según el tipo),
  golpes, caídas, experiencia (sube de tono en racha), monedas, nivel, jefe,
  shiny, roturas, gacha (caída, sacudidas, estallido según rareza).
- Volumen de música y efectos y botón de silencio en la barra superior y en la
  pausa; se recuerda en el navegador.
- Medido: los 5 temas a la par (RMS 0,075–0,09), sin saturar ni con jefe + combate.

## 9. Interfaz

- **Sin emojis.** Iconos pixel art dibujados en código (`js/ui/icons.js`):
  cada movimiento lleva el **emblema de su tipo** (18) + una **insignia de su
  familia**; más corazón, guante, bota, reloj, escudo, brote, imán, libro,
  moneda, cartas, baya, bomba, estrella, destello shiny, corona, Poké Ball…
- Siempre a múltiplos enteros de su resolución, para que el píxel quede nítido.
- **Avisos de primera vez** (`js/ui/tips.js`, desde el 16-10-2026): caja de
  diálogo de Mundo Misterioso abajo, con tu compañero hablando y el texto
  escribiéndose solo (clic, toque, Intro o Espacio sigue; Esc cierra). Cada uno
  sale una vez por cuenta (`save.told`, se junta entre aparatos).
  - Menú: primera partida terminada (nivel del Pokémon), Tienda Kecleon, primera
    MT, primera victoria (rangos, Mentas y Cápsulas) y rango Maestro (modo infinito).
  - Partida: el primero (actos), en grupo (levantar y mensajes rápidos), jefe de
    zona, jefe final, grieta y jefe Alfa/Dominante a la vista. En solitario la
    partida se para mientras lees (estado `tip`); en grupo no, y cada página se
    pasa sola a los 8 s.
- **Guía de la web** (`guia/`, `en/guide/`, con `tools/make_seo_pages.py`):
  cómo es una partida (actos, jefes, rangos, modo infinito), tu Pokémon entre
  partidas (nivel, movimientos, tienda, MT) y preguntas frecuentes. La página
  de movimientos lista los 575 con su clase (física, especial o estado).
  `tools/export_data.js` carga el catálogo generado (`moves-gen.js`,
  `learnsets.js`) y el diccionario inglés entero.

## 10. Técnica

- HTML + CSS + JavaScript vanilla sobre Canvas 2D. Sin build, sin dependencias.
- **Sprites:** [SpriteCollab](https://github.com/PMDCollab/SpriteCollab), 966
  Pokémon × 7 animaciones × 8 direcciones, normal y shiny, en `assets/pokemon/`
  (76 MB, PNG con paleta sin pérdida). **CC BY-NC 4.0: uso no comercial y
  atribución** (114 artistas en `CREDITS.md`).
- **Datos:** stats y nombres en español bajados **una vez** de PokeAPI.
- **Fuente:** Pixelify Sans (OFL).
- Los ficheros generados se rehacen con los scripts de `tools/`.
- **Pruebas:** `?todo` (en cualquier dirección en modo local que no sea la web
  oficial: `ps.localhost`, un túnel o la copia https://pokesurvivor-pruebas.vercel.app;
  con `localhost` o `127.0.0.1` el juego usa la nube) lo desbloquea todo al entrar: Pokémon y shinies al
  Nv. 100, monedas y tickets, rango Maestro, mejoras, Mochila y MT
  (`js/core/dev-unlock.js`). En la web publicada no hace nada.
- **Seguridad** (revisión del 16-10-2026):
  - Todo lo que escriben otros jugadores (ranking, perfil, amistades, sala,
    moderación) entra en el HTML escapado y los números pasan por `Number()`;
    además las reglas lo comprueban campo a campo (`firestore.rules`): la fila
    del resumen del ranking es idéntica a la marca validada, el perfil sólo lleva
    números, Pokémon y logros, y los nombres son los apodos de los perfiles.
  - Apodos: 3-16 letras (con tildes y ñ), números o `_`, también en las reglas.
  - Ranking: el tiempo del modo infinito tiene que caber en lo que ha durado la
    partida (t + 25 min), en solitario hace falta el rango Maestro, y nadie del
    equipo puede estar en `bans/{uid}` (sólo lo escribe el admin; antes bastaba
    con borrar la partida para quitarse `saves/{uid}.ban`).
  - Cooperativo (`database.rules.json`): el remitente va en la ruta
    (`q2/{para}/{de}/…`, sólo puedes escribir como tú); el anfitrión escribe la
    lista de admitidos (`ok`, como mucho 3 uids: 4 con él) y sólo entran ellos;
    los datos de cada miembro se comprueban; mensajes de menos de 20.000
    caracteres. La sala ya no va en `pres/`. (La ruta vieja `q` y las salas sin
    `ok` siguen aceptándose para quien tenga abierta una versión anterior:
    se pueden quitar más adelante.)
  - TURN: como mucho 6 claves por cuenta y hora (caché de Cloudflare, gratis).
  - CSP en `dev.html` (pasa a `index.html`): sólo código de la web y de
    Firebase/Google, nada escrito dentro de la página (`js/boot-lang.js` y
    `js/pages.js` salieron del HTML por eso).
  - Partida guardada: el servidor comprueba también el rango y que los datos
    nuevos (nivel, Mochila, MT, naturalezas, habilidades...) sean mapas de
    tamaño razonable; el juego los limpia al cargar (`db.js` sanitize).
  - Pruebas de las reglas con el emulador de Firebase (casos buenos y malos).

## 11. Pendiente

- [ ] Efectividades de tipo en el daño
- [ ] Gráficos propios para los proyectiles (ahora son orbes de color)
- [ ] Movimientos propios por Pokémon (ahora salen de sus tipos)
- [ ] Controles táctiles / mando
- [ ] 59 Pokémon sin sprite en SpriteCollab (sobre todo gen 5, 8 y 9)

---

## Registro de decisiones

**2026-10-07 · primera versión**
- Stack vanilla + Canvas. 1 movimiento activo que se cambia con 1–4. Combate primero.

**2026-10-07 · segunda versión**
- Todo en local: fuera la API en tiempo de ejecución.
- Sprites de Mundo Misterioso (SpriteCollab) con animaciones de ataque.
- Tiles pintados en código (los de PMD sólo existen ripeando la ROM).
- Mapa: **arena abierta con obstáculos** (no salas y pasillos estrictos de PMD).
- Guardado: `localStorage` detrás de una capa de datos única.

**2026-10-07 · tercera versión**
- **Todas las generaciones** (966 con sprite). Gacha: **un banner por región**.
- **Shinies:** 1/4096 salvaje, 1/100 en gacha; el compañero se elige en versión
  normal o shiny desde la colección.
- **Música compuesta en código** (no se puede usar la de Nintendo) + efectos.
- **Fuera los emojis**: iconos pixel art propios.

**2026-10-07 · arreglo de combate**
- Bug: los proyectiles nacían en el borde del Pokémon y avanzaban hasta 8 unidades
  por fotograma, así que **los enemigos pegados al jugador eran inmunes** a todos
  los movimientos de proyectil (en un survivor, casi siempre hay alguno pegado).
  Ahora nacen en el centro y la colisión es barrida (todo el tramo del fotograma).
  En la simulación de 10 min se pasó de 0 a 1 jefe derrotado por partida.
- Vídeos de demostración en `videos/` (jefe, shiny salvaje, shiny en el gacha).

**2026-10-07 · efectos y retoques visuales**
- **Ataques con sprites pixel art** (`js/entities/vfx.js`): 23 formas (llama,
  gota, burbuja, hoja, rayo, cristal, roca, lodo, aguijón, estrella, viento,
  telaraña, onda, media luna, sonido, impacto, zarpazo, mandíbulas, flecha,
  esfera, bola sombra, corazón...) pintadas con la paleta de cada tipo y con
  contorno como los sprites de PMD. Rayos como chorros (llamas, agua, zigzag
  eléctrico, cristales), golpes como medialuna pixelada con extra (mandíbulas,
  zarpazo, impacto, hojas/plumas), auras y potenciadores con partículas del
  tipo, estelas (ascuas, gotas, burbujas de veneno, polvo...). Los disparos
  enemigos usan el tipo del enemigo y llevan un aro rojo en el suelo.
- **Mismo tamaño de píxel en toda la interfaz** (×2): los legendarios grandes
  parecían de otro estilo porque se dibujaban a ×1. Los jefes, en múltiplos de 0,5.
- **Shiny:** gema pixel art como marca y centelleos de píxeles animados.
- **Compañero del menú:** recuadro oscuro con borde del color de su tipo.
- **Apuntado:** los ataques a distancia priorizan al jefe; los cuerpo a cuerpo,
  lo que tienes pegado.

**2026-10-07 · base de datos y publicación**
- **Firebase** (Authentication + Firestore): cuentas con nombre + contraseña o
  Google; la partida se sigue en cualquier ordenador. Copia local para jugar
  sin conexión, escucha en tiempo real de otros ordenadores y **fusión** al
  sincronizar (colecciones unidas, máximos en mejoras/estadísticas, monedas y
  compañero de la versión más reciente). Reglas: cada jugador sólo accede a
  `saves/{su uid}`. Las cuentas locales antiguas se suben al entrar con el
  mismo nombre y contraseña. Probado con el emulador oficial en dos navegadores.
- Sin configuración o abierto con doble clic, sigue en modo local.
- **Aviso legal y privacidad** con contacto para retirar contenido y botón
  para borrar la cuenta. Código abierto (MIT) en GitHub (JPTER78).
- Medidas que NO se aplican a petición: renombrar sin "Pokémon" y quitar los
  sprites ripeados de los juegos (los de CHUNSOFT).

**2026-10-08 · nuevo nombre**
- El juego pasa a llamarse **PokéSurvivor** (sin "Pokémon" en el nombre, como
  PokéRogue o Showdown). Repositorio: `pokesurvivor`.
- Firebase: proyecto nuevo **`pokesurvivor-jpter`** (Firestore en eur3, correo/
  contraseña y Google activos, dominios `jpter78.github.io` y `localhost`). Los
  proyectos `pokemon-survivors-jpter` y `asdaad-9e84f` se borraron (30 días
  recuperables en Google Cloud).

**2026-10-09 · móvil y ajustes**
- **Jugable en móvil y tablet, en horizontal** (en vertical sale "Gira el
  móvil" y la partida se pausa). **Joystick flotante**: aparece donde pones el
  dedo. Los iconos de ataque se tocan para cambiarlo (en PC también con clic) y
  hay botón de pausa. Al cambiar de app, la partida se pausa sola.
- La cámara asegura un alto mínimo de mundo en pantallas muy anchas.
- Interfaz compacta en pantallas bajas (menú en dos columnas, barra superior
  pequeña, la línea de créditos pasa a Ajustes → Acerca de).
- **Ajustes** (PC y móvil): sonido; gráficos (calidad Auto/Alta/Media/Baja,
  números de daño, menos sacudidas y destellos, FPS, pantalla completa);
  controles (tamaño del joystick, teclas); cuenta (apodo fijo, nube, cerrar
  sesión, borrar); acerca de (versión, créditos, aviso legal, contacto).
- **Calidad automática**: baja efectos si el juego va a menos de 45 FPS.
- **Instalable como app** (PWA: icono, pantalla completa, abre sin conexión).
- Arreglos: el orbe extra de los movimientos de órbita al mejorarlos; sonido
  que no arrancaba en móvil; los invocadores respetan el tope de enemigos;
  aviso claro si un archivo del juego no llega a cargar.

**2026-10-09 · gastar lo mínimo de Firebase (plan gratuito)**
- **Ranking con resumen**: un documento `lbs/{tabla}` con el top 50 por
  tabla (1 lectura por pestaña en vez de ~52) y caché de 10 min en el
  navegador; las marcas propias se recuerdan para no leer antes de escribir.
  El filtro por Pokémon queda **sólo en el histórico** (la mitad de escrituras).
- **"En línea" aproximado** por Firestore (`pres/`, latido cada 10 min, se lee
  al abrir Amigos o la sala) e **invitaciones por Firestore** (`inv/`). La
  Realtime Database sólo se conecta dentro de una sala: el tope de 100
  conexiones del plan gratis ya no limita a los jugadores normales.
- **Guardado en la nube** como mucho cada 30 s (y al cerrar), sin escucha en
  vivo del propio documento; perfil público como mucho cada 10 min.
- Medido en el emulador: ver todo el ranking dos veces pasó de 1.275 a 20
  lecturas; terminar una partida de 12 a 3.
- Menos Pokémon en pantalla pero más fuertes (×0,45 de cantidad, ×2,1 vida,
  ×1,35 daño, ×2,6 experiencia) y sin textos de "¡Muy eficaz!".

**2026-10-08 · multijugador, amigos y ranking**
- **Cooperativo hasta 4** con **lista de amigos** (no códigos de sala ni salas
  públicas). Experiencia compartida y **cartas que esperan a todos**; un caído
  se **revive** quedándose a su lado.
- Conexión **WebRTC directa** con señalización por la **Realtime Database**
  (nueva instancia `pokesurvivor-jpter-default-rtdb`, europe-west1), y **relé**
  por esa misma base de datos si no se puede conectar directo. Sin servidor
  propio ni TURN de pago.
- **Apodo único** para amigos y ranking; las cuentas de Google lo eligen al
  entrar (privacidad: no se enseña su nombre real).
- **Ranking de tiempo aguantado**: Solo / Grupo, diario a histórico, amigos,
  por Pokémon, tu puesto. El grupo sale entero en una fila.
- Aviso de privacidad: en grupo los navegadores se conectan directamente y
  pueden verse la IP (como en una videollamada).

**2026-10-08 · mejoras por Pokémon, tickets, grietas e interactivos**
- **Mejoras de cada Pokémon** (no de la cuenta); las ya compradas pasan al
  compañero actual. Las monedas quedan sólo para mejoras.
- **Gacha con tickets** que se ganan jugando (sin regalo inicial ni conversión
  de monedas): ×1 de Pokémon normales (1/260), ×10 de legendarios (siempre) y jefes (1 de cada 3).
- **Jefes casuales no legendarios**; los legendarios, sólo en las **grietas**
  (arena aparte; perder te devuelve sin premio). En grupo viajáis todos.
- **Árboles de bayas, manantiales, cofres con candado y trampas**, en pixel art propio.
- **Fundido** entre biomas en vez del cambio brusco.
- Pokédex: campo `leg` (legendario o singular) de PokeAPI.

**2026-10-08 · climas, tabla de tipos y tragaperras**
- **Climas** como evento raro (sol, lluvia, arena, nieve, niebla), visual suave.
- **Tabla de tipos suavizada** en los dos sentidos.
- Gacha con **tragaperras pixel art** en vez de la Poké Ball.

**2026-10-08 · arenas por tipo**
- Bug: los legendarios (jefes = voladores) atravesaban las rocas de la arena y
  no se les podía disparar (Celebi). Ahora chocan y no salen del círculo.
- 18 arenas de grieta, una por tipo, con terreno que afecta y clima propio;
  tema musical nuevo para la grieta.

**2026-10-08 · iconos más Pokémon**
- Shiny: **estrella roja** con destello (como la marca de shiny de los juegos),
  en vez de la gema.
- Rareza: ya no hay estrellas; cada rareza es su **Poké Ball** — Poké (Común),
  Super (Poco común), Ultra (Rara), Lujo (Épica) y **Master (Legendaria)**.

**2026-10-08 · cámara, rendimiento e IA**
- Cámara un 20% más lejos (768 de ancho de mundo en vez de 640).
- Rendimiento: el destello al golpear usaba `ctx.filter` (×95 más caro que una
  silueta blanca precalculada, que es lo que se usa ahora); tope de 70 números
  de daño; resolución interna ×1,5 como mucho; menos trabajo fuera de pantalla;
  tope de 280 enemigos con élites al llegar al tope.
- Los enemigos rodean obstáculos; vuelan sólo los que flotan en su sprite.

**2026-10-08 · misiones, logros, objetos, evoluciones y enemigos con personalidad**
- Misiones 3+2, logros con premio y título, perfil público (todos lo ven).
- Objetos equipables de un solo uso por run (cofres y jefes).
- Evolución de movimientos: nivel máximo + condición, carta dorada.
- Enemigos con personalidad: curanderos, escudos, invocadores y ataques con
  aviso (rayos, zonas, kamikazes, abanico, saltos). Ajustados con un piloto
  automático: la supervivencia media es parecida a la de antes (89 s frente a 60 s).

**2026-10-10 · últimos detalles antes de la web**
- Los Pokémon de tipo Agua no se frenan en el agua ni en el pantano.
- Se sube de nivel la mitad de rápido (experiencia por nivel ×2).
- Menos enemigos a la vez (tope 64) pero bastante más duros. Los que se quedan
  atrás mientras corres se desvanecen y vuelven a salir por delante, así no se
  forma la cola detrás y no se puede huir sin más. Un "corredor" por tramo
  (rápido y frágil, va a donde vas a estar).
- Jefes y legendarios con 4 ataques avisados (pisotón, embestida o salto, y dos
  de lejos según su tipo: lluvia de zonas, rayos en abanico, anillo o abanico
  de disparos). Alternan entre ir a por ti y pelear de lejos, y por debajo de
  la mitad de vida se enfurecen. Más vida (×1,35) y daño (×1,2).
- Grietas: flecha grande que late, con distancia y tiempo, y aviso propio al
  abrirse.
- Pantalla "Pulsa para empezar" (el navegador no deja sonar sin tocar nada) y
  música también en el inicio de sesión y en las preguntas de personalidad.
- 8 formas nuevas de atacar con los mismos gráficos: bumerán, cadena, minas,
  meteoros, torreta, embestida, rastro y abanico corto. 7 movimientos pasan a
  ellas (mismo id) y hay 12 nuevos (64 en total).
- Anti-trampas: el servidor rechaza nivel y derrotados imposibles para el
  tiempo; el juego vigila reloj, vida, velocidad, ataque, nivel, monedas y las
  herramientas de prueba. Si algo no cuadra, la partida no cuenta para el
  ranking ni los récords.
- Eventos a mitad de partida cada 4-5 min (systems/events.js): horda de un tipo
  (30 s), hora dorada (30 s, doble de experiencia y monedas) y Pokémon perdido
  (lo llevas a la marca; cura, monedas, ticket y 1 de cada 5 se une a ti).
  Duendes del tesoro 1-2 por partida: Meowth (monedas) o Gholdengo (ticket ×10;
  Gimmighoul no tiene sprite). Huyen y se escapan a los 15 s. En grupo, todo
  compartido.
- Más tarde (10-10): subir de nivel otra vez la mitad de rápido (experiencia
  por nivel ×4 respecto al original) y tickets ×1 más raros (1/400 en vez de 1/260).
  Misiones de nivel 8/12/15 y logros de nivel 15 y 30 (antes 12/16/20, 20 y 40).
