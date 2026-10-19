/* ============ changelog.js — novedades del juego ============
 * Lo que ve la gente en el botón "Novedades" de la barra de arriba: cambios
 * de juego y fallos arreglados (nada de servidores ni bases de datos).
 * La fecha más nueva, arriba. En cada fecha, por apartados:
 *   new  lo nuevo · chg  cambios y ajustes · fix  fallos arreglados
 * Cada línea en español y en inglés.
 */
G.CHANGELOG = [
  { d: '2026-10-16', title: ['Gran actualización: actos, rangos y tu Pokémon', 'Big update: acts, ranks and your Pokémon'], new: [
    ['Adiós a la Sentencia de Arceus: la partida tiene ahora 3 actos de 10 minutos, cada uno en un bioma al azar. Al final de cada acto llega un jefe de zona y, al vencerlo, pasas al siguiente. El jefe del acto 3 es un legendario al azar con fases: si lo vences se abre un portal, crúzalo y has ganado.',
     'Farewell to the Judgment of Arceus: a run now has 3 acts of 10 minutes, each in a random biome. At the end of each act a zone boss arrives, and beating it takes you to the next act. The act 3 boss is a random legendary with phases: beat it and a portal opens; step through and you win.'],
    ['Rangos: Normal, Bronce, Plata, Oro y Maestro. Ganar una partida desbloquea el siguiente y eliges con cuál juegas debajo de Jugar (en grupo lo elige el anfitrión, hasta el más alto que tenga alguien del grupo; ganar te sube un rango desde el tuyo). Cada rango es más duro y da más monedas y experiencia.',
     'Ranks: Normal, Bronze, Silver, Gold and Master. Winning a run unlocks the next one and you choose which one to play under Play (in a group the host picks, up to the highest anyone in the group has; winning moves you up one rank from yours). Each rank is harder and gives more coins and experience.'],
    ['Modo infinito: tras vencer al jefe final en Maestro, quédate en vez de cruzar el portal. Sólo oleadas, cada vez más fuertes y sin límite. ¿Cuánto aguantas?',
     'Endless mode: after beating the final boss in Master, stay instead of stepping through the portal. Only waves, stronger and stronger with no limit. How long can you last?'],
    ['Dos biomas nuevos, con su música: Torre Lavanda (niebla, lápidas y fantasmas que atraviesan las paredes) y Desierto Ruta 111 (arenas movedizas que frenan, cactus y tormentas de arena).',
     'Two new biomes, with their own music: Lavender Tower (fog, gravestones and ghosts that go through walls) and Route 111 Desert (quicksand that slows you, cacti and sandstorms).'],
    ['Los Pokémon salvajes son sobre todo de los tipos del bioma: Fuego y Roca en el volcán, Fantasma y Veneno en la Torre Lavanda, Tierra en el desierto...',
     'Wild Pokémon are mostly of the biome’s types: Fire and Rock in the volcano, Ghost and Poison in Lavender Tower, Ground in the desert...'],
    ['Logros nuevos: Primera victoria, Maestro, Sin final (5 minutos en el modo infinito) y Guardián de zona. Quien tenía los de la Sentencia de Arceus, los conserva.',
     'New achievements: First victory, Master, No end (5 minutes in endless mode) and Zone keeper. If you had the Judgment of Arceus ones, you keep them.'],
    ['Eventos nuevos (como mucho uno por acto): Brote masivo (sólo sale una especie, con mucha más probabilidad de shiny), Pokémon errante (un legendario errante como Raikou o Suicune huye por el mapa: si lo alcanzas, premio grande), Apagón en la Torre Lavanda (sólo ves a tu alrededor, pero ganas más experiencia) y Espejismo en el desierto (un cofre que salta de sitio: tócalo antes de que desaparezca).',
     'New events (at most one per act): Mass outbreak (only one species shows up, with much higher shiny odds), Roaming Pokémon (a roaming legendary like Raikou or Suicune runs around the map: catch it for a big reward), Blackout in Lavender Tower (you only see around you, but earn more experience) and Mirage in the desert (a chest that keeps jumping around: touch it before it vanishes).'],
    ['En el mapa: árboles de bayas, distintos en cada bioma (pasa a su lado: te curan y te dan el poder de su baya 20 s: Lichi en el bosque, más daño; Aslac en el desierto, más velocidad; Chiri en el volcán, menos recarga; Gonlan en la cueva, menos daño recibido; Arabol en la Torre Lavanda, un poder al azar), y altares de riesgo (quédate a su lado y despiertan a un guardián con su séquito; si lo vences, mucho botín).',
     'On the map: berry trees, different in each biome (walk by: they heal you and give you their berry’s power for 20 s: Liechi in the forest, more damage; Salac in the desert, more speed; Custap in the volcano, less cooldown; Ganlon in the cave, less damage taken; Starf in Lavender Tower, a random power), and risk altars (stay next to one and it awakens a guardian with its escort; beat it for lots of loot).'],
    ['Jefes Alfa y Dominante: 1 de cada 5 jefes sueltos y legendarios de grieta sale en versión Alfa (enorme, ojos rojos, más vida y daño) o Dominante (aura dorada y llama a ayudantes). Sueltan más premio.',
     'Alpha and Totem bosses: 1 in 5 roaming bosses and rift legendaries comes as an Alpha (huge, red eyes, more HP and damage) or a Totem (golden aura, calls for help). They drop bigger rewards.'],
    ['Cada Pokémon de tu colección tiene su propio nivel (del 1 al 100), como en los juegos. Al acabar una partida, tu compañero gana la experiencia que has conseguido en ella y sube de nivel: los primeros niveles van muy deprisa. El nivel sube poco a poco su vida, su ataque y su velocidad.',
     'Every Pokémon in your collection has its own level (1 to 100), like in the main games. When a run ends, your partner earns the experience you got in it and levels up: the first levels go very fast. Its level slowly raises its HP, attack and speed.'],
    ['Stats de los juegos: los movimientos físicos usan el Ataque de tu Pokémon y los especiales su Ataque Especial. La Defensa reduce el daño de los golpes cuerpo a cuerpo y la Defensa Especial el de los disparos, rayos y zonas.',
     'Stats from the main games: physical moves use your Pokémon’s Attack and special moves its Special Attack. Defense reduces damage from melee hits, and Special Defense from shots, beams and zones.'],
    ['Los movimientos del mismo tipo que tu Pokémon hacen un 20 % más de daño, como en los juegos.',
     'Moves that share your Pokémon’s type deal 20% more damage, like in the main games.'],
    ['Naturalezas: cada Pokémon tiene la suya, que sube un stat un 10 % y baja otro un 10 %.',
     'Natures: every Pokémon has one, raising one stat by 10% and lowering another by 10%.'],
    ['Habilidades: cada Pokémon tiene una de sus habilidades de los juegos (a veces la oculta), con un efecto en la partida: Mar Llamas, Levitación, Nado Rápido, Electricidad Estática, Robustez, Intimidación y muchas más.',
     'Abilities: every Pokémon has one of its abilities from the main games (sometimes the hidden one), with an effect in the run: Blaze, Levitate, Swift Swim, Static, Sturdy, Intimidate and many more.'],
    ['En la colección ves el nivel, la naturaleza, la habilidad y los stats de cada Pokémon.',
     'In the collection you can see each Pokémon’s level, nature, ability and stats.'],
    ['Movimientos de los juegos: hay más de 500 movimientos originales y cada Pokémon tiene los suyos, los que aprende por nivel en el juego más reciente en que sale. En las cartas de la partida sólo salen los que tu Pokémon ya sabe, así que al subirlo de nivel aprende movimientos nuevos.',
     'Moves from the main games: there are over 500 original moves and every Pokémon has its own, the ones it learns by level in the latest game it appears in. The run cards only offer moves your Pokémon already knows, so leveling it up teaches it new moves.'],
    ['Empiezas la partida con el mejor movimiento de ataque que sepa tu Pokémon.',
     'You start the run with the best attacking move your Pokémon knows.'],
    ['Movimientos de estado, solos o dentro de un vínculo: Gruñido y Encanto hacen que los enemigos de alrededor peguen menos, Malicioso y Chirrido que reciban más daño, Onda Trueno, Somnífero o Hipnosis los frenan (no los duermen), Polvo Veneno los envenena, Paz Mental o Maquinación suben el Ataque Especial y Día Soleado, Danza Lluvia, Tormenta de Arena o Paisaje Nevado traen su clima.',
     'Status moves, on their own or inside a bond: Growl and Charm make nearby enemies hit softer, Leer and Screech make them take more damage, Thunder Wave, Sleep Powder or Hypnosis slow them down (they don’t put them to sleep), Poison Powder poisons them, Calm Mind or Nasty Plot raise Special Attack, and Sunny Day, Rain Dance, Sandstorm or Snowscape bring their weather.'],
    ['Efectos de los juegos en los ataques: los que drenan te curan un poco (Absorber, Puño Drenaje...), los de retroceso te quitan algo de vida (Doble Filo, Envite Ígneo...), algunos dan más críticos (Cuchillada, Tajo Aéreo...) y otros bajan el ataque o la defensa de los enemigos que golpean.',
     'Effects from the main games on attacks: draining moves heal you a little (Absorb, Drain Punch...), recoil moves cost you some HP (Double-Edge, Flare Blitz...), some land more critical hits (Slash, Air Slash...) and others lower the attack or defense of the enemies they hit.'],
    ['En la colección ves todos los movimientos de cada Pokémon: los que ya sabe y a qué nivel aprenderá los demás. Al acabar la partida, el resumen te dice qué movimientos ha aprendido al subir.',
     'In the collection you can see every move of each Pokémon: the ones it knows and the level it will learn the rest at. When a run ends, the summary tells you which moves it learned by leveling up.'],
    ['Tienda Kecleon (se abre tras tus 2 primeras partidas): Caramelos Exp. S, M y L y Caramelos Raros para subir de nivel a tus Pokémon. Más adelante también vende MT, Mentas y Cápsulas Habilidad. Aquí no se roba.',
     'Kecleon Shop (opens after your first 2 runs): Exp. Candies S, M and L and Rare Candies to level up your Pokémon. Later it also sells TMs, Mints and Ability Capsules. No stealing here.'],
    ['Cada movimiento es distinto, como en los juegos: su ritmo, su tamaño y su aspecto salen de sus PP, su potencia, su prioridad y su precisión, y los famosos tienen su efecto propio. Salmuera hace el doble a quien tenga menos de la mitad de vida, Desquite pega el doble si te acaban de golpear, Rodar crece al acertar seguido, Día de Pago suelta monedas, Nitrocarga te acelera… Lo dice la descripción de cada uno.',
     'Every move is different, like in the main games: its pace, size and look come from its PP, power, priority and accuracy, and the famous ones have their own effect. Brine deals double damage to targets below half HP, Revenge hits twice as hard if you were just hit, Rollout grows as it keeps landing, Pay Day drops coins, Flame Charge speeds you up… Each move’s description says what makes it special.'],
    ['Habilidades: unas 70 más con efecto propio (Vista Lince, Velo Arena, Gula, Bromista, Mudar, Cabeza Roca, Cálculo Final, Encadenado, Veleta…). Las que en los juegos son un lastre ahora son un intercambio: Ausente pega a golpes sueltos pero fuertes, Inicio Lento arranca lento y luego va a tope, Flaqueza pega más mientras tengas vida. Y Superguarda, Banco, Impostor y Cambio Táctico ya hacen lo suyo.',
     'Abilities: about 70 more with their own effect (Keen Eye, Sand Veil, Gluttony, Prankster, Shed Skin, Rock Head, Analytic, Skill Link, Moody…). The ones that are a drawback in the main games are now a trade-off: Truant hits slowly but hard, Slow Start starts weak and then goes all out, Defeatist hits harder while you still have HP. And Wonder Guard, Schooling, Imposter and Stance Change now do their thing.'],
    ['MT: enseñan a un Pokémon un movimiento que no aprende por nivel (de los que puede aprender en los juegos), y ese movimiento ya puede salirte en las cartas. Los jefes y los cofres con candado a veces sueltan una, casi siempre una que tu Pokémon puede aprender.',
     'TMs: they teach a Pokémon a move it doesn’t learn by level (among the ones it can learn in the main games), and that move can then show up in your cards. Bosses and locked chests sometimes drop one, almost always one your Pokémon can learn.'],
    ['Menta: cambia la naturaleza de un Pokémon por la que elijas. Cápsula Habilidad: elige otra de sus habilidades. La Cápsula Habilidad Oculta deja elegir también la oculta. Se abren con tu primera victoria.',
     'Mint: changes a Pokémon’s nature to the one you choose. Ability Capsule: pick another of its abilities. The Hidden Ability Capsule also lets you pick the hidden one. They unlock with your first victory.'],
    ['Mochila: guarda tus caramelos, MT, Mentas y Cápsulas, y los usas con el Pokémon que quieras. También desde la ficha de cada Pokémon en la colección.',
     'Bag: keeps your candies, TMs, Mints and Capsules, and you use them on any Pokémon you want. Also from each Pokémon’s card in the collection.'],
    ['8 objetos nuevos de los juegos (sigues llevando uno por partida): Periscopio (más críticos), Cinta Experto (más daño con los golpes muy eficaces), Cinta Fuerte y Gafas Especiales (más daño físico o especial), Seguro Debilidad (si te dan con algo muy eficaz, pegas más un rato), Globo Helio (flotas sobre el agua, la lava y las trampas hasta que te golpean), Polvo Brillo (esquivas algunos golpes) y Hierba Blanca (nada te frena).',
     '8 new items from the main games (you still carry one per run): Scope Lens (more crits), Expert Belt (more damage with super effective hits), Muscle Band and Wise Glasses (more physical or special damage), Weakness Policy (get hit by something super effective and you hit harder for a while), Air Balloon (float over water, lava and traps until you get hit), Bright Powder (dodge some hits) and White Herb (nothing slows you down).'],
    ['Mensajes rápidos en cooperativo: ¡Ayuda!, ¡Aquí!, ¡Grieta! y ¡Gracias! (teclas 5 a 8, o el botón del bocadillo en el móvil). Salen encima de tu Pokémon y, si tus amigos no te ven, junto a tu flecha en el borde de su pantalla.',
     'Quick messages in co-op: Help!, Over here!, Rift! and Thanks! (keys 5 to 8, or the speech bubble button on mobile). They show above your Pokémon and, if your friends can’t see you, next to your arrow at the edge of their screen.'],
    ['Misiones nuevas: vence a jefes de zona, llega al acto 2 o 3, sube niveles a tus Pokémon, enseña una MT, gana una partida y aguanta en el modo infinito. Las de cosas que aún no tienes (las MT o el modo infinito) no te salen hasta que las tengas.',
     'New missions: beat zone bosses, reach act 2 or 3, level up your Pokémon, teach a TM, win a run and survive in endless mode. Missions about things you don’t have yet (TMs or endless mode) won’t show up until you do.'],
    ['En la sala del cooperativo se ve el nivel del Pokémon de cada uno.',
     'The co-op lobby shows the level of everyone’s Pokémon.'],
    ['Avisos de primera vez: tu compañero te explica, en una caja de diálogo como en Mundo Misterioso, cada cosa nueva la primera vez que la ves (los actos, el jefe de zona, la tienda, las MT, los rangos, el modo infinito...). En solitario la partida se para mientras lees.',
     'First-time tips: your partner explains each new thing the first time you see it, in a dialogue box like in Mystery Dungeon (acts, zone bosses, the shop, TMs, ranks, endless mode...). In solo play the game pauses while you read.']
  ], chg: [
    ['Los altares de poder desaparecen del mapa: sus efectos (más daño, velocidad, menos recarga, imán) los dan ahora los árboles de bayas de cada bioma, que salen el doble.',
     'Power altars are gone from the map: their effects (more damage, speed, less cooldown, magnet) now come from each biome’s berry trees, which show up twice as often.'],
    ['Balance de los Pokémon: las naturalezas se notan de verdad (±10 % de daño o velocidad; antes apenas un 3 %), los Pokémon con mucha defensa aguantan como muros y pegan con su coraza (Shuckle, Steelix, Toxapex…), y ningún Pokémon rompe el juego (Slaking y Regigigas ya no son los más fuertes).',
     'Pokémon balance: natures really matter now (±10% damage or speed; before, barely 3%), high-defense Pokémon tank like walls and hit with their armor (Shuckle, Steelix, Toxapex…), and no Pokémon breaks the game (Slaking and Regigigas are no longer the strongest).'],
    ['Los Pokémon que ya tenías empiezan en el nivel 5, y más arriba cuanto más los hubieras mejorado (hasta el nivel 40).',
     'The Pokémon you already had start at level 5, and higher the more you had upgraded them (up to level 40).'],
    ['En el resumen de la partida, "Nivel" pasa a llamarse "Nivel de partida", para no confundirlo con el nivel de tu Pokémon.',
     'In the run summary, "Level" is now "Run level", so it is not confused with your Pokémon’s level.'],
    ['Danza Espada y Danza Dragón suben ahora el Ataque, que es el de los movimientos físicos. Para los especiales están Paz Mental, Maquinación y compañía.',
     'Swords Dance and Dragon Dance now raise Attack, which powers physical moves. Special moves have Calm Mind, Nasty Plot and friends.'],
    ['Las cartas de movimientos de estado salen menos que las de ataque y, como antes, como mucho llevas 2 en una partida.',
     'Status move cards show up less often than attack ones and, as before, you can carry at most 2 in a run.'],
    ['El logro Maestro de movimientos pide evolucionar 59 movimientos distintos, sean cuales sean.',
     'The Move master achievement asks you to evolve 59 different moves, whichever they are.'],
    ['Las Mejoras pasan a ser de tu cuenta: cuentan con todos tus Pokémon. Las de stats (Vitalidad, Fuerza, Zancada, Reflejos, Coraza y Síntesis) desaparecen, porque eso ya lo da el nivel, y se te devuelven todas las monedas que gastaste en ellas. De las demás te quedas con el nivel más alto que tuviera alguno de tus Pokémon y se te devuelve lo gastado en el resto. El Veto y los atajos siguen siendo de cada Pokémon.',
     'Upgrades now belong to your account: they count for all your Pokémon. Stat upgrades (Vitality, Strength, Stride, Reflexes, Armor and Synthesis) are gone, since your level does that now, and you get back every coin you spent on them. For the rest you keep the highest level any of your Pokémon had, and you get back what you spent on the others. Veto and shortcuts are still per Pokémon.'],
    ['El logro Coleccionista de objetos pide ahora encontrar los 19 objetos (quien ya lo tenía, lo conserva).',
     'The Item collector achievement now asks you to find all 19 items (if you already had it, you keep it).'],
    ['El ranking sólo cuenta el tiempo aguantado en el modo infinito, y todas las tablas empiezan de cero.',
     'The leaderboard only counts the time survived in endless mode, and every board starts from scratch.'],
    ['Los biomas ya no cambian cada 4 minutos: hay uno por acto. Salen 2 jefes sueltos en cada acto y las grietas se abren durante los actos (no justo antes del jefe final).',
     'Biomes no longer change every 4 minutes: there is one per act. 2 roaming bosses show up in each act, and rifts open during the acts (not right before the final boss).']
  ], fix: [
    ['Partidas en dos aparatos: lo gastado en uno (un Caramelo, tickets del gacha...) ya no vuelve desde el otro, y las monedas ganadas en los dos se suman. Cerrar sesión justo después de guardar ya no pierde lo último.',
     'Playing on two devices: what you spend on one (a Candy, gacha tickets...) no longer comes back from the other, and coins earned on both add up. Logging out right after saving no longer loses the latest progress.'],
    ['Cooperativo: la partida ya no se queda esperando para siempre a quien no ha llegado a entrar o se ha desconectado (se le saca a los 15-45 s) y puedes salir mientras esperas; "Continuar" en la pausa ya no te suelta mientras otro elige; un corte corto de internet ya no cierra la partida; la sala muestra el rango y el nivel al día.',
     'Co-op: the game no longer waits forever for someone who never joined or got disconnected (they are dropped after 15-45 s) and you can leave while waiting; "Continue" in the pause menu no longer lets you move while someone else is choosing; a short internet drop no longer ends the game; the room shows up-to-date ranks and levels.'],
    ['Cooperativo, para los invitados: ya funcionan sus movimientos de clima, Humedad, Autoestima, romper escudos, Día de Pago, los ataques que pegan más a enemigos con estado y las monedas de un shiny repetido; los jefes Alfa ya no les pegan de más.',
     'Co-op, for guests: their weather moves, Damp, Moxie, shield breaking, Pay Day, moves that hit harder against statused enemies and the coins from a repeated shiny now work; Alpha bosses no longer hit them too hard.'],
    ['Combate: los potenciadores ya no se pierden al recibir un golpe con Armadura Frágil o Aguante; la Banda Focus y Robustez ya no se anulan con la siguiente zona avisada ni cuentan la pausa; un jefe debilitado que se enfurece ya no se queda debilitado para siempre; Chaleco Asalto y Coraza se suman bien; las torretas cuentan tu tipo y tu habilidad; Potencia Bruta ya no empuja; Agallas, Respondón y compañía funcionan con cualquier frenazo; ya no sale el objeto que llevas.',
     'Combat: boosts are no longer lost when you take a hit with Weak Armor or Stamina; Focus Sash and Sturdy are no longer cancelled by the next marked zone and no longer count paused time; an enraged boss under a weakening effect no longer stays weakened forever; Assault Vest and Armor cards stack properly; turrets count your type and ability; Sheer Force no longer pushes; Defiant, Contrary and friends work with any slowdown; you no longer find the item you are already holding.'],
    ['Partida: una elección de objeto ya no pasa a la partida siguiente; la misión de jugar con un tipo sólo pide tipos que tienes; los manantiales y árboles gastados ya no se recargan al volver a una zona; el Pokémon perdido espera mientras estás en la grieta; el portal ya no sale en un muro; "¡Nuevo récord!" ya no sale con un empate; en inglés, la línea de arriba de la partida y los apodos ya no se traducen mal.',
     'Runs: an item choice no longer carries over into the next run; the play-with-a-type mission only asks for types you own; used springs and trees no longer refill when you come back to an area; the lost Pokémon waits while you are in the rift; the portal no longer appears inside a wall; "New record!" no longer shows on a tie; in English, the top line of the run and nicknames are no longer mistranslated.'],
    ['Seguridad: el ranking, los perfiles, las salas del cooperativo y los baneos están mejor protegidos contra trampas y contra quien intente colar cosas raras.',
     'Security: the leaderboard, profiles, co-op rooms and bans are better protected against cheating and against anyone trying to sneak in odd data.'],
    ['En inglés, algunos avisos salían con las palabras desordenadas ("A wild Pikachu shiny appeared!" en vez de "A wild shiny Pikachu appeared!").',
     'In English, some messages had their words out of order ("A wild Pikachu shiny appeared!" instead of "A wild shiny Pikachu appeared!").']
  ] },
  { d: '2026-10-14', title: ['Recupera tu cuenta con Gmail', 'Recover your account with Gmail'], new: [
    ['Si juegas con nombre y contraseña, puedes vincular tu Gmail: si un día olvidas la contraseña, entras con Google y es tu misma cuenta. Te lo ofrecemos al entrar.',
     'If you play with a name and password, you can link your Gmail: if you ever forget your password, sign in with Google and it is the same account. We offer it when you sign in.'],
    ['Móvil: ya puedes colocar los botones donde quieras. En Ajustes > Controles > Colocar los botones arrastras los ataques (con el objeto), la pausa y el joystick, que ahora también puede ser fijo en vez de aparecer donde pones el dedo.',
     'Mobile: you can now place the buttons wherever you want. In Settings > Controls > Place the buttons, drag the attacks (with the item), the pause button and the joystick, which can now also be fixed instead of appearing where you put your finger.']
  ], chg: [
    ['Las tablas de la semana y del mes del ranking empiezan de cero, como el histórico: ahora sólo cuentan partidas con la Sentencia de Arceus y todas las tablas cuadran entre sí.',
     'The weekly and monthly leaderboards start from scratch, like the all-time one: now only runs with the Judgment of Arceus count, and all boards match each other.'],
    ['Aviso importante: la única web oficial de PokéSurvivor es pokesurvivor.com. El juego es y será gratis: si alguna otra web te pide pagar (por tickets, monedas o lo que sea), no somos nosotros. Lo verás también al entrar y en el Aviso legal.',
     'Important: the only official PokéSurvivor website is pokesurvivor.com. The game is and always will be free: if any other website asks you to pay (for tickets, coins or anything else), it isn’t us. You will also see this when signing in and in the Legal notice.'],
    ['El código del juego pasa a una licencia no comercial (PolyForm Noncommercial 1.0.0): se puede seguir estudiando y modificando, pero nadie puede cobrar por él.',
     'The game’s code moves to a non-commercial license (PolyForm Noncommercial 1.0.0): you can still study and modify it, but nobody may charge for it.']
  ], fix: [
    ['Cooperativo: la partida ya no se queda parada con cada uno esperando a que el otro elija. Un objeto y las cartas de nivel ya no se tapan, y si la conexión pierde un aviso se arregla solo.',
     'Co-op: the game no longer freezes with each player waiting for the other to choose. An item and the level-up cards no longer cover each other, and if the connection drops a message it fixes itself.'],
    ['Cooperativo: al volver de una grieta, quien no era el anfitrión ya ve a todos los enemigos (antes algunos eran invisibles y sólo se veían sus ataques).',
     'Co-op: after coming back from a rift, players who are not the host can see every enemy again (some used to be invisible, with only their attacks showing).'],
    ['Amigos: si tu móvil u ordenador tiene la hora (o la zona horaria) mal puesta, tus amigos ya no salen siempre desconectados y sus invitaciones te llegan.',
     'Friends: if your phone or computer has the wrong time (or time zone), your friends no longer always show as offline and their invitations reach you.'],
    ['Los avisos grandes de la partida (un Gholdengo cerca, una marea...) ya salen siempre centrados.',
     'Big in-game announcements (a nearby Gholdengo, a swarm...) are always centered now.']
  ] },
  { d: '2026-10-13', title: ['La Sentencia de Arceus', 'The Judgment of Arceus'], new: [
    ['La Sentencia de Arceus: al llegar al minuto 30, Arceus baja del cielo y te lleva a las Ruinas del Juicio. Es invencible, te persigue cada vez más deprisa y lanza pilares de luz, rayos y ondas; si te toca, te quita casi media vida. Cada 5 segundos acude un legendario con el doble de vida y de daño que el anterior. ¿Cuánto aguantarás?',
     'The Judgment of Arceus: at minute 30, Arceus descends from the sky and takes you to the Ruins of Judgment. It is invincible, chases you faster and faster and casts pillars of light, beams and shockwaves; if it touches you, you lose almost half your HP. Every 5 seconds a legendary joins, each with twice the HP and damage of the previous one. How long can you last?'],
    ['Tres logros nuevos: La Sentencia (llega al minuto 30), Ante el Creador (aguanta 1 minuto ante Arceus) y Desafío divino (derrota a 3 legendarios ante Arceus en una partida).',
     'Three new achievements: The Judgment (reach minute 30), Before the Creator (survive 1 minute against Arceus) and Divine challenge (defeat 3 legendaries against Arceus in a single run).'],
    ['Música nueva para la pelea contra Arceus.', 'New music for the fight against Arceus.'],
    ['Botón para reportar marcas sospechosas en el ranking (la banderita de cada fila).',
     'A button to report suspicious records on the leaderboard (the little flag on each row).']
  ], chg: [
    ['El ranking histórico empieza de cero: ahora que las partidas acaban ante Arceus, las marcas de antes ya no se podrían alcanzar. Las tablas de hoy, de la semana y del mes siguen igual.',
     'The all-time leaderboard starts from scratch: now that runs end against Arceus, older records could no longer be reached. The daily, weekly and monthly boards are unchanged.'],
    ['Se quita el tiempo extra del minuto 60 (ya no se llega hasta ahí).',
     'Overtime from minute 60 is removed (runs no longer get that far).'],
    ['Desde el minuto 28 ya no se abren grietas, para que la Sentencia no te pille dentro de una.',
     'Rifts no longer open from minute 28 on, so the Judgment does not catch you inside one.'],
    ['Ranking protegido contra trampas: el servidor comprueba que cada marca se ha jugado de verdad. Nunca se pierde nada de lo que ganas jugando.',
     'Leaderboard protected against cheating: the server checks that every record was really played. You never lose anything you earn by playing.'],
    ['Se han quitado del ranking las marcas de más de 35 minutos: con la Sentencia de Arceus ya no son posibles.',
     'Records over 35 minutes have been removed from the leaderboard: with the Judgment of Arceus they are no longer possible.']
  ], fix: [
    ['Las tiradas del gacha, los Pokémon nuevos y los premios se guardan en la nube al momento. Si abriste el juego en otro aparato o navegador y te faltaba algo, vuelve a abrirlo donde lo conseguiste: se recupera solo.',
     'Gacha pulls, new Pokémon and rewards are saved to the cloud right away. If you opened the game on another device or browser and something was missing, open it again where you got it: it comes back on its own.']
  ] },
  { d: '2026-10-12', title: ['Tiempo extra y grietas con menos azar', 'Overtime and less random rifts'], new: [
    ['Tiempo extra: desde el minuto 60 los Pokémon salvajes se vuelven cada vez más fuertes (más vida y más daño), y cada vez más deprisa. Antes, con las mejoras al máximo, algunas partidas no acababan nunca; ahora las mejores rondarán la hora y media.',
     'Overtime: from minute 60 on, wild Pokémon keep getting stronger (more HP and more damage), faster and faster. Before, with maxed upgrades, some runs never ended; now the best ones will last about an hour and a half.'],
    ['El juego se actualiza solo cuando sale una versión nueva: si estás en el menú, a los 5 segundos; si estás jugando, al acabar la partida (sin perder nada).',
     'The game now updates itself when a new version is out: within 5 seconds if you are in the menu, or after your run if you are playing (without losing anything).'],
    ['Botón de Novedades (esta ventana) con todos los cambios del juego.',
     'A "What\'s new" button (this window) with every change to the game.'],
    ['Números más fáciles de leer: el 2, el 5 y el 8 ya no se confunden.',
     'Easier to read numbers: 2, 5 and 8 no longer look alike.'],
    ['Elige la versión normal o shiny de tu compañero desde el menú principal, debajo de él.',
     'Pick the normal or shiny version of your partner right from the main menu, under it.'],
    ['Mejoras nuevas para cada Pokémon: Golpe Crítico (+3 % de críticos por nivel, que hacen x1,5 de daño), Cambio de cartas (+1 cambio de las cartas de nivel por run) y Veto (bloquea movimientos para que no te salgan en las cartas; se eligen en Mejoras).',
     'New upgrades for each Pokémon: Critical Hit (+3% critical chance per level, crits deal x1.5 damage), Card reroll (+1 level-up card reroll per run) and Ban (block moves so they never show up in your cards; pick them in Upgrades).'],
    ['Atajos de movimientos (en Mejoras, para cada Pokémon): elige qué movimiento va siempre en cada hueco, por ejemplo Confusión siempre en el 1, para la memoria muscular.',
     'Move shortcuts (in Upgrades, for each Pokémon): choose which move always goes in each slot, for example Confusion always on 1, for muscle memory.']
  ], chg: [
    ['Avalancha hace menos daño (21 en vez de 26): derrotaba casi el doble que la media de los movimientos.',
     'Rock Slide deals less damage (21 instead of 26): it defeated almost twice as many as the average move.'],
    ['Los cambios de cartas de nivel ya no se ganan venciendo jefes: tienes 1 gratis por run y el resto se compra en Mejoras.',
     'Level-up card rerolls are no longer earned by defeating bosses: you get 1 free per run and can buy more in Upgrades.'],
    ['Los legendarios de grieta ya no dan siempre tickets x10: dan uno la mitad de las veces (antes daban 2 siempre y salían demasiados).',
     'Rift legendaries no longer always drop x10 tickets: they drop one half of the time (they used to always drop 2, which was too many).'],
    ['Cooperativo: si vuestras redes no consiguen conectar entre sí, la sala lo avisa y lo reintenta sola, en vez de jugar a tirones por un servidor lento.',
     'Co-op: if your networks cannot connect to each other, the room says so and keeps retrying, instead of playing laggy through a slow server.'],
    ['Hemos cambiado de servidores para que el juego siga siendo gratis: puede que tengas que volver a iniciar sesión (con la misma cuenta y contraseña, o con Google). Tu partida y tus Pokémon siguen igual.',
     'We moved to new servers so the game can stay free: you may need to sign in again (with the same account and password, or with Google). Your save and your Pokémon are unchanged.'],
    ['Gacha: los shiny ya no salen repetidos. Si te toca uno que ya tienes, sale otro de la misma rareza que te falte.',
     'Gacha: shinies no longer come out as duplicates. If you roll one you already have, you get another of the same rarity that you are missing.'],
    ['Grietas con menos azar: cada vez que no sale una, la siguiente es más probable (como mucho 2,5 minutos sin grieta).',
     'Less random rifts: every time one does not show up, the next one is more likely (at most 2.5 minutes without a rift).'],
    ['Los legendarios que aún no has vencido salen 4 veces más en las grietas.',
     'Legendaries you have not beaten yet show up 4 times as often in rifts.'],
    ['Los curanderos curan más cuanto más fuerte pegas, pero cada vez menos y con un tope (como mucho el 2,5x).',
     'Healers heal more the harder you hit, but with diminishing returns and a cap (2.5x at most).'],
    ['Ataques cuerpo a cuerpo más fuertes: mientras llevas uno activo recibes un 25 % menos de daño, llegan un 25 % más lejos y hacen un 20 % más de daño.',
     'Stronger melee attacks: while one is active you take 25% less damage, and they reach 25% further and deal 20% more damage.'],
    ['Cooperativo: al elegir con qué objeto quedarte, la partida se para para todos (antes seguía y te pegaban mientras elegías).',
     'Co-op: choosing which held item to keep now pauses the run for everyone (it used to keep going and you got hit while choosing).'],
    ['Cooperativo: mientras alguien elige una fusión, la partida se para para todos.',
     'Co-op: while someone is choosing a fusion, the run pauses for everyone.'],
    ['Cooperativo: si el anfitrión cambia de pestaña o se le para el juego, la partida se pausa para todos hasta que vuelva.',
     'Co-op: if the host switches tabs or their game stalls, the run pauses for everyone until they are back.'],
    ['Las runs de menos de 1 minuto ya no cuentan para el ranking.',
     'Runs shorter than 1 minute no longer count for the leaderboard.']
  ], fix: [
    ['Quitadas del ranking las marcas rotas por el fallo del minuto 84 (el reloj seguía corriendo con el juego parado) y alguna imposible. Si tenías una, tu próxima partida vuelve a contar.',
     'Removed broken records from the leaderboard caused by the minute 84 bug (the clock kept running while the game was frozen) and a few impossible ones. If you had one, your next run counts again.'],
    ['iPhone (Safari y Chrome): a veces no se podía cambiar de movimiento tocando los iconos, sobre todo con el otro dedo en el joystick. Además los botones quedan por encima de la barra de inicio.',
     'iPhone (Safari and Chrome): sometimes you could not switch moves by tapping the icons, especially with your other finger on the joystick. Buttons also sit above the home bar now.'],
    ['En las partidas de más de 84 minutos la pantalla se quedaba en negro, el juego se paraba o empezabas a subir de nivel sin fin. Ya puedes jugar todo lo que aguantes.',
     'In runs longer than 84 minutes the screen went black, the game froze or you kept levelling up forever. Now you can play for as long as you survive.'],
    ['Si el juego fallara, la partida se cierra sola y se guarda (tiempo, derrotados, récords y ranking) en vez de perderse.',
     'If the game ever crashes, the run ends by itself and is saved (time, defeated, records and leaderboard) instead of being lost.'],
    ['Las partidas muy largas a veces se tomaban por trampas y no contaban para el ranking.',
     'Very long runs were sometimes flagged as cheating and did not count for the leaderboard.'],
    ['Cooperativo: si el anfitrión cambiaba de pestaña, los enemigos se quedaban quietos y los demás jugaban con ventaja.',
     'Co-op: if the host switched tabs, enemies stood still and everyone else got a free advantage.'],
    ['iPhone: mantener el dedo en el joystick sacaba "Copiar / Seleccionar todo".',
     'iPhone: holding your finger on the joystick brought up "Copy / Select all".'],
    ['iPhone: a veces no salía la pantalla completa. Ahora el botón explica cómo tenerla (Compartir y "Añadir a pantalla de inicio").',
     'iPhone: fullscreen sometimes did not show up. Now the button explains how to get it (Share and "Add to Home Screen").']
  ] },
  { d: '2026-10-11', title: ['Vínculos', 'Bonds'], new: [
    ['Vínculos: al vencer a un legendario fusionas movimientos que se lanzan a la vez desde un solo hueco (hasta 4).',
     'Bonds: defeating a legendary lets you fuse moves that fire at the same time from a single slot (up to 4).'],
    ['Botón para cambiar las cartas de subir de nivel.',
     'A button to reroll the level-up cards.']
  ], chg: [
    ['Más grietas.', 'More rifts.'],
    ['Movimientos psíquicos y curanderos más flojos.', 'Weaker psychic moves and healers.'],
    ['Las mejoras de las cartas de nivel (velocidad, recarga, experiencia, imán, coraza y potencia) tienen un tope de veces.',
     'Level-up card upgrades (speed, cooldown, experience, magnet, armor and power) can only be taken a limited number of times.'],
    ['En el móvil, la ficha del Pokémon sale al lado; entrar es más rápido y el gacha x10 se puede cerrar.',
     'On mobile, the Pokémon details show alongside; logging in is faster and the x10 gacha can be closed.']
  ], fix: [
    ['Pantalla negra en partidas de más de una hora por llenarse la memoria de imágenes.',
     'Black screen in runs longer than an hour because image memory filled up.'],
    ['Los tickets se perdían si se cerraba la pestaña antes de acabar la partida: ahora se guardan al cogerlos.',
     'Tickets were lost if the tab closed before the run ended: now they are saved as soon as you pick them up.'],
    ['Una mejora comprada justo después de guardar se cobraba y no se apuntaba.',
     'An upgrade bought right after saving was charged but not applied.'],
    ['El juego se quedaba congelado para siempre si algo fallaba a mitad de partida.',
     'The game froze forever if something went wrong mid-run.']
  ] },
  { d: '2026-10-10', title: ['Más reto', 'More challenge'], new: [
    ['Jefes y legendarios con 4 ataques avisados que se enfurecen a media vida.',
     'Bosses and legendaries with 4 telegraphed attacks that get enraged at half health.'],
    ['12 movimientos nuevos y 8 formas de atacar nuevas: bumerán, cadena, minas, meteoros, torreta, embestida, rastro y abanico.',
     '12 new moves and 8 new ways to attack: boomerang, chain, mines, meteors, turret, dash, trail and spray.'],
    ['Eventos a mitad de partida (hordas de un tipo, hora dorada, Pokémon perdidos) y Meowth y Gholdengo que huyen cargados de monedas.',
     'Mid-run events (single-type hordes, golden hour, lost Pokémon) and Meowth and Gholdengo running away loaded with coins.'],
    ['Estatuas para los Pokémon grandes.', 'Statues for big Pokémon.']
  ], chg: [
    ['Más difícil: menos enemigos pero más duros.', 'Harder: fewer but tougher enemies.'],
    ['Subir de nivel es más lento, los tickets son más raros y los jefes dan ticket x10 una de cada tres veces.',
     'Levelling up is slower, tickets are rarer and bosses drop a x10 ticket one time in three.'],
    ['Carga más rápida.', 'Faster loading.']
  ], fix: [
    ['Los enemigos rezagados desaparecían delante de ti: ahora sólo fuera de la vista.',
     'Straggling enemies vanished in front of you: now only off-screen.'],
    ['Los menús y pantallas se montaban encima de la barra de arriba.',
     'Menus and screens overlapped the top bar.']
  ] },
  { d: '2026-10-09', title: ['Móvil e inglés', 'Mobile and English'], new: [
    ['Se puede jugar en móvil y tablet con joystick táctil, e instalar como app.',
     'Play on phones and tablets with a touch joystick, and install it as an app.'],
    ['El juego, en español y en inglés.', 'The game in English and Spanish.'],
    ['Pantalla de ajustes con calidad gráfica automática.', 'Settings screen with automatic graphics quality.']
  ], chg: [
    ['Menos enemigos en pantalla pero más fuertes.', 'Fewer but stronger enemies on screen.'],
    ['Gigadrenado pasa a ser Hierba Lazo (ya no cura).', 'Giga Drain becomes Grass Knot (no more healing).']
  ] },
  { d: '2026-10-08', title: ['Misiones, grietas y cooperativo', 'Missions, rifts and co-op'], new: [
    ['Misiones diarias y semanales, logros con medallas y títulos, y perfil público.',
     'Daily and weekly missions, achievements with medals and titles, and a public profile.'],
    ['Objetos equipables, evoluciones de movimientos y enemigos que curan, protegen, invocan o explotan.',
     'Held items, move evolutions and enemies that heal, shield, summon or explode.'],
    ['Grietas que llevan a 18 arenas legendarias, una por tipo, y clima que cambia la batalla.',
     'Rifts leading to 18 legendary arenas, one per type, and weather that changes the fight.'],
    ['Cooperativo con tu lista de amigos y ranking.', 'Co-op with your friends list and leaderboards.'],
    ['Mejoras para cada Pokémon, gacha tragaperras con tickets y tabla de tipos.',
     'Upgrades for each Pokémon, a slot-machine ticket gacha and a type chart.']
  ], chg: [
    ['Cámara más lejos y enemigos que rodean los obstáculos.', 'Camera further out and enemies that walk around obstacles.']
  ] },
  { d: '2026-10-07', title: ['Primera versión', 'First version'], new: [
    ['Primera versión pública de PokéSurvivor.', 'First public version of PokéSurvivor.']
  ] }
];
