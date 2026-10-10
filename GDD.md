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
- Dificultad: ×(1 + 0,75·(n−1)) enemigos y ×(1 + 0,3·(n−1)) vida; la
  experiencia del equipo se divide entre (1 + 0,6·(n−1)).
- La pausa no para el juego; si se va el anfitrión, la partida acaba para todos.

### 2.4 Ranking
- Tiempo aguantado. Pestañas **Solo / Grupo**; periodos **diario, semanal,
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
- **52 movimientos** en 7 familias (proyectil, cuerpo a cuerpo, rayo, orbes,
  nova, aura, potenciador), 5 niveles cada uno. Cubren los **18 tipos**.
- El pool de cada Pokémon sale de sus tipos + el pool normal común.
- Los potenciadores no hacen daño: entras, acumulas y vuelves a uno de ataque.
  Nunca se ofrecen más de 2.
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
| **Altar de poder** | Al tocarlo, 25 s de Furia (daño ×2), Rayo (+45% velocidad), Imán (×4) o Prisa (−40% recarga); luego se apaga |
| **Manantial** | Cura mientras estás encima; se agota y se recarga solo en ~45 s |
| **Cofre con candado** | Quédate 3,5 s a su lado (aunque te ataquen): monedas, 1-3 tickets (15% un ×10) y experiencia para subir un nivel |
| **Trampas** | Veneno, pegajosa (te frena) o explosiva; saltan al pisarlas, también con los enemigos |
| **Grieta** | Rara (cada 30 s, 14% desde el minuto 1:15; dura 45 s). Te lleva a la arena de un legendario |

- **Voladores, fantasmas y jefes** ignoran el terreno.
- **3 biomas** que rotan cada 4 minutos, cada uno con su música:
  Bosque Umbrío, Cueva Cristal, Volcán Ceniza. El cambio es un **fundido**
  de 2,6 s entre la paleta vieja y la nueva (suelo y objetos).
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
- **5 jefes** (min. 3, 6, 9, 12, 15): Pokémon fuertes **no legendarios**
  (pseudolegendarios, Slaking...) al azar, cada vez más fuertes; cada uno suelta
  un **ticket ×10**. Los legendarios sólo salen en las grietas. Durante un combate de jefe las oleadas bajan al 25%, no
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

### 7.1 Pokémonedas
Al terminar una run: `tiempo/5 + derrotados/4 + 80 por jefe + monedas recogidas`,
multiplicado por la mejora Fortuna. Cuenta nueva: 500 de regalo.

Las monedas sirven para las **mejoras**; el gacha va con tickets.

### 7.2 Mejoras permanentes — de cada Pokémon
Vitalidad, Fuerza, Zancada, Reflejos, Coraza, Síntesis, Imán, Sabiduría, Fortuna
y **Repertorio (empezar con 2 movimientos)**. Cada Pokémon tiene las suyas y
sólo cuentan cuando juegas con él (en la pantalla de Mejoras se elige cuál).
Las que se compraron cuando eran de la cuenta pasaron al compañero de entonces.

### 7.2a Objetos equipables (uno por run)
Restos, Cinta Elección, Garra Rápida, Banda Focus, Cascabel Concha, Moneda
Amuleto, Huevo Suerte, Vidasfera, Pañuelo Elección, Casco Dentado y Chaleco
Asalto. Los sueltan **todos los jefes**, los cofres con candado (50%) y a veces
los normales (8%). Si ya llevas uno, eliges (en solitario el juego se para).

### 7.2c Evolución de movimientos
Un movimiento al nivel máximo evoluciona si en esa run has cogido su mejora de
condición (Ascuas + Potencia → Llamarada, Burbuja + Carrera → Surf...): sale
una **carta dorada** (siempre, si está lista). Los 47 de ataque evolucionan.

### 7.2d Misiones, logros y perfil
- **3 diarias + 2 semanales** (premio en tickets y monedas); una diaria se puede
  cambiar al día. Mismas misiones en cualquier ordenador (semilla por cuenta).
- **Logros** con medalla (bronce, plata, oro), premio y a veces **título**;
  uno por cada **legendario** vencido en una grieta.
- **Perfil público** (desde el ranking o la lista de amigos): 3 favoritos,
  título, mejores marcas y las 8 mejores medallas.

### 7.2b Tickets del gacha
- **Ticket** (×1): cada Pokémon derrotado tiene 1/260 de soltar uno; los cofres
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

## 10. Técnica

- HTML + CSS + JavaScript vanilla sobre Canvas 2D. Sin build, sin dependencias.
- **Sprites:** [SpriteCollab](https://github.com/PMDCollab/SpriteCollab), 966
  Pokémon × 7 animaciones × 8 direcciones, normal y shiny, en `assets/pokemon/`
  (76 MB, PNG con paleta sin pérdida). **CC BY-NC 4.0: uso no comercial y
  atribución** (114 artistas en `CREDITS.md`).
- **Datos:** stats y nombres en español bajados **una vez** de PokeAPI.
- **Fuente:** Pixelify Sans (OFL).
- Los ficheros generados se rehacen con los scripts de `tools/`.

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
  de monedas): ×1 de Pokémon normales (1/260), ×10 de jefes y legendarios.
- **Jefes casuales no legendarios**; los legendarios, sólo en las **grietas**
  (arena aparte; perder te devuelve sin premio). En grupo viajáis todos.
- **Altares, manantiales, cofres con candado y trampas**, en pixel art propio.
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
