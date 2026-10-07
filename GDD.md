# GDD — Pokémon Survivors · Mundo Misterioso

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
   └─ Gacha      → 9 banners, uno por región
```

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

- **Voladores, fantasmas y jefes** ignoran el terreno.
- **3 biomas** que rotan cada 4 minutos, cada uno con su música:
  Bosque Umbrío, Cueva Cristal, Volcán Ceniza.

## 5. Enemigos

- **De todas las generaciones.** 6 tramos por total de stats base; en cada run se
  sortea un elenco de 7 Pokémon por tramo, así cada partida es distinta.
- IA según tipos: persecución, embestida telegrafiada (`Charge` → `Attack`),
  disparo a distancia o tanque.
- **5 jefes** (min. 3, 6, 9, 12, 15): legendarios y pseudolegendarios **al azar**,
  cada vez más fuertes. Durante un combate de jefe las oleadas bajan al 25%, no
  hay mareas y suena el tema de jefe.
- Mareas cada ~45 s. Tope de 420 enemigos.

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

### 7.2 Mejoras permanentes
Vitalidad, Fuerza, Zancada, Reflejos, Coraza, Síntesis, Imán, Sabiduría, Fortuna
y **Repertorio (empezar con 2 movimientos)**.

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

- Tirada ×1: 100 · ×10: 900, con **al menos una Épica** garantizada.
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

- [ ] Base de datos real (servidor) — sólo hay que reescribir `js/core/db.js`
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
