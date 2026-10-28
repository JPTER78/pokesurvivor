/* ============ changelog.js — novedades del juego ============
 * Lo que ve la gente en el botón "Novedades" de la barra de arriba: cambios
 * de juego y fallos arreglados (nada de servidores ni bases de datos).
 * La fecha más nueva, arriba. En cada fecha, por apartados:
 *   new  lo nuevo · chg  cambios y ajustes · fix  fallos arreglados
 * Cada línea en español y en inglés.
 */
G.CHANGELOG = [
  { d: '2026-10-28', title: ["Halloween, un día más", "Halloween, one more day"], chg: [
    ["El evento de Halloween dura un día más: del 30 de octubre al 2 de noviembre (hora de España).",
     "The Halloween event lasts one more day: from October 30 to November 2 (Spain time)."]
  ], fix: [
    ["Durante Halloween, unos segundos después de abrir el juego (y al empezar o acabar el evento), la tienda, el gacha u otra pantalla del menú se cerraban solos y te devolvían al menú. Ya no.",
     "During Halloween, a few seconds after opening the game (and when the event starts or ends), the shop, the gacha or another menu screen closed by itself and sent you back to the menu. Not anymore."]
  ]},
  { d: '2026-10-27', title: ["Cooperativo más estable", "Steadier co-op"], new: [
    ["Móvil y tableta: nuevo joystick «Anclado» (Ajustes → Controles → Colocar los botones). Aparece donde pones el dedo y se queda en ese sitio mientras lo mantienes, aunque alejes el dedo; al levantarlo y tocar en otro sitio, aparece allí. El «Flotante» de siempre sigue al dedo y sigue siendo el que viene puesto.",
     "Mobile and tablet: new \"Anchored\" joystick (Settings → Controls → Place the buttons). It appears where you put your finger and stays in that spot while you hold it, even if you move your finger away; lift it and touch somewhere else, and it appears there. The usual \"Floating\" one follows your finger and is still the default."]
  ], fix: [
    ["Armadura Frágil, Impasible y Cobardía ya no te quitan las cargas de Agilidad (u otra subida de velocidad mejor) al recibir un golpe: antes las dejaban en una.",
     "Weak Armor, Steadfast and Rattled no longer remove your Agility charges (or any better speed boost) when you get hit: they used to drop them to one."],
    ["El Chaleco Asalto ya no cuenta para el tope del 70 % de las cartas Coraza: con las cartas al máximo, el chaleco suma encima. Y si te lo quitas, no pierdes lo de las cartas.",
     "The Assault Vest no longer counts toward the 70% cap of the Armor cards: with the cards maxed, the vest adds on top. And if you take it off, you keep what the cards gave you."],
    ["En ventanas muy alargadas (muy anchas y bajas), los enemigos ya no se quedan dando vueltas fuera de la pantalla sin acercarse: parecía que no salía ninguno.",
     "In very elongated windows (very wide and short), enemies no longer keep looping off screen without coming closer: it looked as if none were spawning."],
    ["Test inicial: los rasgos de tu personalidad («Paciente», «Tenaz»…) salían en español en todos los idiomas. Ya salen traducidos.",
     "Starting quiz: your personality traits (\"Patient\", \"Tenacious\"…) were shown in Spanish in every language. They are translated now."],
    ["Ranking de daño a Arceus: «Sólo amigos» enseña también a los amigos que no están en el top 50 (en Histórico); en el Histórico se guarda tu mejor daño aunque esa partida no mejore tu tiempo; y si una partida no puede entrar en el ranking, ahora te lo dice.",
     "Arceus damage leaderboard: \"Friends only\" also shows friends outside the top 50 (in All-time); All-time keeps your best damage even if that run does not beat your time; and if a run cannot enter the leaderboard, it now tells you."],
    ["Ranking: desde la noche del 26 de octubre, muchas partidas no entraban en el ranking (en el perfil sí salían). Ahora el juego insiste más al prepararlas para el ranking y entran como siempre.",
     "Leaderboard: since the night of October 26, many runs did not make it into the leaderboard (they did show in your profile). The game now tries harder when preparing them for the leaderboard and they get in as usual."],
    ["Móvil: al tocar «Cambiar opciones» en las cartas de nivel, a veces se elegía sola una de las cartas nuevas; y en el vínculo, tras elegir el primer movimiento, se unía solo el que quedara debajo del dedo en vez del que tocabas. Ahora sólo se elige la carta que tocas.",
     "Mobile: tapping \"Change options\" on the level-up cards sometimes picked one of the new cards by itself; and in a bond, after choosing the first move, whichever move ended up under your finger was joined instead of the one you tapped. Now only the card you tap is chosen."],
    ["Cooperativo: con algunas redes sólo se podía jugar si hacía de anfitrión una persona concreta; con otro anfitrión, los demás se quedaban «reconectando» todo el rato. Ahora, si la conexión directa no sale, se prueba la conexión por servidor de cualquiera de los dos (no sólo la del anfitrión), y se prepara ya al entrar en la sala para no perder tiempo.",
     "Co-op: on some networks you could only play when one particular person was the host; with someone else hosting, the others kept \"reconnecting\" forever. Now, if the direct connection does not work, the server connection of either player is tried (not just the host's), and it is prepared as soon as you join the room so no time is lost."],
    ["Cooperativo: con una conexión lenta, un jugador podía ver la partida minutos tarde (hasta más de 4 minutos por detrás de los demás), y en la Sentencia de Arceus era un caos. Ahora, si la conexión no da para más, el juego espera a que se ponga al día en vez de amontonar lo que falta por llegar: como mucho, la partida se para un momento («esperando al anfitrión»), pero va siempre al día.",
     "Co-op: with a slow connection, a player could see the run minutes late (more than 4 minutes behind the others), and Arceus's Judgment turned into chaos. Now, if the connection cannot keep up, the game waits for it to catch up instead of piling up what has yet to arrive: at worst the run pauses for a moment (\"waiting for the host\"), but it is always up to date."]
  ]},
  { d: '2026-10-27', title: ['20 ataques populares, objetos de apoyo y Pulsera Z', '20 popular moves, support items and Z-Ring'], new: [
    ['20 ataques muy usados en los juegos que aún no estaban: Puño Fuego, Puño Trueno, Puño Hielo, Cascada, Acua Jet, Hoja Aguda, Voltiocambio, Placaje Eléctrico, Excavar, Cola Férrea, Recuperación, Paz Mental... cada uno con su evolución.',
     '20 moves that are very common in the games and were still missing: Fire Punch, Thunder Punch, Ice Punch, Waterfall, Aqua Jet, Leaf Blade, Volt Switch, Volt Tackle, Dig, Iron Tail, Recover, Calm Mind... each with its evolution.'],
    ['Objetos de apoyo: salen en las cartas de subir de nivel y se pueden llevar hasta 6 a la vez, cada uno con hasta 5 niveles: Cinta Experto, Polvo Veloz, Hierba Única, Periscopio, Mineral Evolutivo, Más PS, Miel, Raíz Grande, Refleluz, Revivir, Repartir Experiencia, Pepita, Lodo Negro y Lupa. Se ven arriba a la izquierda y en el resumen de la pausa.',
     'Support items: they show up in the level-up cards and you can carry up to 6 at once, each with up to 5 levels: Expert Belt, Quick Powder, Power Herb, Scope Lens, Eviolite, HP Up, Honey, Big Root, Light Clay, Revive, Exp. Share, Nugget, Black Sludge and Wide Lens. They show at the top left and in the pause summary.'],
    ['Objeto nuevo, Pulsera Z: todos tus movimientos se lanzan a la vez.',
     'New item, Z-Ring: all your moves fire at once.']
  ] },
  { d: '2026-10-26', title: ["Halloween se acerca", "Halloween is coming"], new: [
    ["Evento de Halloween del 30 de octubre al 2 de noviembre (hora de España). Lo que trae, lo descubrirás jugando.",
     "Halloween event from October 30 to November 2 (Spain time). What it brings, you will find out by playing."],
    ["En la pantalla principal, una cuenta atrás: desde dos semanas antes, cuánto falta para Halloween; durante el evento, cuánto queda.",
     "On the main screen, a countdown: from two weeks before, how long until Halloween; during the event, how long is left."]
  ], fix: [
    ["Móvil: al entrar con tu usuario, el teclado ya no lo corrige ni le pone mayúsculas por su cuenta (con un nombre poco común, el autocorrector lo cambiaba y salía «Usuario o contraseña incorrectos»).",
     "Mobile: when you log in with your username, the keyboard no longer autocorrects it or adds capitals on its own (with an unusual name, autocorrect changed it and you got \"Wrong username or password\")."],
    ["Móvil: el joystick ya no se atasca al subir de nivel. Si tocabas una carta con un dedo mientras sujetabas el joystick con el otro, la carta no se elegía y todo se quedaba parado con las cartas abiertas. Ahora se elige al levantar el dedo sobre ella, haya otro dedo en la pantalla o no (también las de objeto y vínculo). Y si el móvil no se entera de que has soltado el dedo, el joystick se suelta solo en cuanto no queda ningún dedo en la pantalla.",
     "Mobile: the joystick no longer gets stuck when you level up. If you tapped a card with one finger while holding the joystick with the other, the card was not chosen and everything stayed frozen with the cards open. Now it is chosen when you lift your finger on it, whether or not another finger is on the screen (item and bond cards too). And if the phone misses that you lifted your finger, the joystick lets go by itself as soon as no finger is left on the screen."],
    ["La barra de arriba (monedas, tickets, caramelos, tu nombre y los botones) cabe en cualquier pantalla. Antes, con todo puesto, en muchas pantallas (también tabletas) las monedas y los tickets se salían por la izquierda y los botones se partían en dos líneas. Ahora, si no hay sitio, los botones se quedan sólo con su icono, tu nombre se recorta y las cantidades muy grandes salen en corto (10 M).",
     "The top bar (coins, tickets, candy, your name and the buttons) fits on any screen. Before, with everything showing, on many screens (tablets too) the coins and tickets went off the left edge and the buttons split into two lines. Now, when space is short, the buttons keep only their icon, your name is shortened and very large amounts are shown short (10M)."],
    ["Móvil: el botón «atrás» (o el gesto de volver) ya no te saca del juego. En plena partida la pausa, en una pantalla del menú vuelve al menú y sólo en el menú principal sale de la web. Y si bajas la cortina de avisos u otra app se pone por encima, la partida también se pausa (jugando solo).",
     "Mobile: the \"back\" button (or the back gesture) no longer takes you out of the game. During a run it pauses, on a menu screen it goes back to the menu, and only on the main menu does it leave the site. And if you pull down the notification shade or another app opens on top, the run also pauses (when playing solo)."],
    ["Móvil: los avisos del centro de la pantalla (los de las esferas, por ejemplo) se salían por los dos lados y no se podían leer. Ahora se parten en líneas y caben.",
     "Mobile: the messages in the middle of the screen (the orb ones, for example) went off both sides and could not be read. Now they wrap and fit."],
    ["Móvil: los avisos de abajo (logros y mensajes) ya no se quedan con los toques. Mientras se veían, tapaban los ataques y no se podía cambiar de ataque.",
     "Mobile: the notices at the bottom (achievements and messages) no longer catch your taps. While they were showing, they covered your moves and you could not switch moves."],
    ["En la pausa, la Defensa y la Defensa Especial de los Pokémon con naturaleza salían con decimales de más (55.00000000000001).",
     "In the pause screen, Defense and Special Defense of Pokémon with a nature showed extra decimals (55.00000000000001)."],
    ["Móvil: en las cartas de nivel y de objeto ya no queda un «·» suelto al final (era el de las teclas, que en el móvil no salen). En horizontal, la frase del título ya no tapa el botón Jugar, y en la ficha de la colección los botones de Menta, Cápsula y MT vuelven a su tamaño.",
     "Mobile: the level-up and item cards no longer end with a stray \"·\" (it belonged to the keyboard keys, which are not shown on mobile). In landscape, the title tagline no longer covers the Play button, and in the collection page the Mint, Capsule and TM buttons are back to their size."]
  ]},
  { d: '2026-10-25', title: ['Tickets y Pokémon iguales en todos tus aparatos', 'The same tickets and Pokémon on all your devices'], new: [
    ['Al acabar la partida, sola o en grupo, sale el resumen: cada ataque con el daño que ha hecho y su daño por segundo, el daño total y tu objeto. En grupo, también el de cada compañero, con una pestaña por jugador.',
     'When a run ends, solo or in a group, you get the summary: each move with the damage it dealt and its damage per second, your total damage and your item. In a group, also each teammate’s, with one tab per player.'],
    ['Móvil: vuelve «Apuntar a mano» (Ajustes → Accesibilidad), ahora con un segundo joystick: el dedo en la mitad derecha de la pantalla apunta tus ataques y el de la izquierda te mueve. Al soltarlo, vuelven a apuntar solos.',
     'Mobile: "Manual aim" is back (Settings → Accessibility), now with a second joystick: your finger on the right half of the screen aims your moves and the one on the left moves you. When you lift it, they aim on their own again.']
  ], chg: [
    ['Ranking por Pokémon: ahora cuentan las partidas de 10 minutos o más (antes 5). Los demás rankings siguen desde 2 minutos.',
     'Per-Pokémon ranking: runs now count from 10 minutes (it was 5). The other rankings still count from 2 minutes.'],
    ['Perfil público: tus récords y medallas les llegan a los demás como mucho cada 6 horas (antes cada 2). Tú los ves siempre al momento.',
     'Public profile: your records and medals reach other players at most every 6 hours (it was every 2). You always see them right away.']
  ], fix: [
    ['Móvil: con las cartas de nivel, de objeto o de vínculo abiertas ya puedes coger el joystick tocando fuera del recuadro, y al cerrarse sales andando sin tener que levantar el dedo, como con el teclado o el mando.',
     'Mobile: with the level-up, item or bond cards open you can now grab the joystick by touching outside the box, and when they close you walk off without lifting your finger, like with a keyboard or controller.'],
    ['Móvil en vertical: en la barra de arriba no se veían las monedas, los tickets ni tu nombre (con tantos botones no cabía y se salía por la izquierda). Ahora va en dos líneas y se ve todo.',
     'Mobile in portrait: the top bar did not show your coins, tickets or name (with so many buttons it did not fit and went off the left edge). Now it uses two lines and everything is visible.'],
    ['Gacha con mando: al pasar las animaciones pulsando A seguido, se volvía a tirar sin querer (tras «Continuar» quedaba elegido el botón de tirar) y se gastaban tickets a montones. Ahora los botones de tirar nunca se eligen solos: hay que ir a ellos.',
     'Gacha with a controller: skipping the animations by pressing A repeatedly pulled again by accident (after "Continue" the pull button was selected) and tickets were spent in bulk. Now the pull buttons are never selected on their own: you have to move to them.'],
    ['Gacha con mando: ya se pueden elegir «Saltar» y «Continuar» en la tirada (B también continúa).',
     'Gacha with a controller: you can now select "Skip" and "Continue" during a pull (B also continues).'],
    ['Esferas con mando: en cada casilla pone X (usar la elegida) o Y (pasar a otra) en vez de las teclas 5-8 del teclado.',
     'Orbs with a controller: each slot now shows X (use the selected one) or Y (switch) instead of the keyboard keys 5-8.'],
    ['Cooperativo: los Pokémon con Sequía, Llovizna, Chorro Arena o Nevada ponen su clima también si no son el anfitrión (antes sólo funcionaba el del creador de la sala).',
     'Co-op: Pokémon with Drought, Drizzle, Sand Stream or Snow Warning now set their weather even if they are not the host (before, only the room creator’s worked).'],
    ['Cooperativo: la partida ya no se queda parada para todos si se pierde el aviso de que alguien ha terminado de elegir carta, objeto o vínculo (pasaba con un corte momentáneo de la conexión): ahora se comprueba en cada mensaje.',
     'Co-op: the run no longer freezes for everyone if the message that someone finished choosing a card, item or bond gets lost (it happened with a momentary connection drop): it is now checked in every message.'],
    ['Guardado en la nube: si pulsabas Guardar poco después de otro Guardar, el juego decía «Se guarda en la nube en X s» y, si salías antes de ese tiempo, no se subía nunca (en el otro aparato no estaban los tickets). Ahora la espera es mucho más corta y, si sales del juego con un Guardar pendiente, se sube al salir.',
     'Cloud save: if you pressed Save shortly after another Save, the game said "Saving to the cloud in X s" and, if you left before that, it was never uploaded (your tickets were missing on the other device). Now the wait is much shorter and, if you leave the game with a pending Save, it is uploaded as you leave.'],
    ['Móvil: al minimizar el juego, la música seguía sonando, y distorsionada. Ahora se para y vuelve al volver al juego.',
     'Mobile: when you minimized the game, the music kept playing, and distorted. Now it stops and comes back when you return to the game.'],
    ['Guardado en la nube: si conseguías tickets, monedas o Pokémon en un aparato y mientras tanto guardabas en otro, al volver al primero el juego creía que ya estaba todo guardado («Ya está todo guardado en la nube») y no lo subía: en el otro aparato no aparecían. Ahora se mira lo que falta de verdad y Guardar lo sube.',
     'Cloud save: if you got tickets, coins or Pokémon on one device and saved on another one in the meantime, back on the first one the game thought everything was already saved ("Everything is already saved in the cloud") and did not upload it, so it never showed up on the other device. Now it checks what is really missing and Save uploads it.'],
    ['Guardado en la nube: después de gastar en un aparato tickets o monedas que ya se habían gastado en otro, los tickets podían ir creciendo solos cada vez que guardabas, y luego bajar de golpe en el otro aparato. Ahora el saldo es el mismo en todos, y lo que ganes después no se descuenta.',
     'Cloud save: after spending on one device tickets or coins that had already been spent on another, your tickets could keep growing on their own every time you saved, and then suddenly drop on the other device. Now the balance is the same everywhere, and nothing you earn afterwards is taken away.'],
    ['Guardado en la nube: si al abrir el juego aún no había conexión (pasa a veces en el móvil), se jugaba con la copia guardada en ese aparato, que podía ser vieja, hasta pulsar Guardar: faltaba lo conseguido en otros aparatos. Ahora, en cuanto vuelve la conexión, se trae lo de la nube y se junta con lo tuyo.',
     'Cloud save: if there was no connection yet when the game opened (it sometimes happens on phones), you played with the copy stored on that device, which could be old, until you pressed Save: what you got on other devices was missing. Now, as soon as the connection is back, the cloud copy is brought in and merged with yours.'],
    ['Sentencia de Arceus: yendo muy rápido se podía salir de la arena, y ahí ni Arceus ni los legendarios te alcanzaban: se aguantaba para siempre. Ahora nadie sale de la arena.',
     'Arceus\'s Judgment: going very fast you could get out of the arena, where neither Arceus nor the legendaries could reach you, so you survived forever. Now nobody leaves the arena.'],
    ['Cooperativo: si a un compañero se le cortaba la conexión o se le apagaba el móvil, su Pokémon se quedaba quieto en el mapa y los enemigos y Arceus le seguían persiguiendo sin hacerle nada, así que los demás no recibían golpes. Ahora, a los 3 segundos sin noticias suyas, van a por los que siguen jugando.',
     'Co-op: if a teammate lost connection or their phone switched off, their Pokémon stood still on the map and enemies and Arceus kept chasing it without hurting it, so nobody else got hit. Now, after 3 seconds without hearing from them, they go after the players still in the game.'],
    ['Ranking: las mejores partidas (las de más de 12 derrotados por segundo) no se subían nunca, sin ningún aviso: el servidor las rechazaba enteras. Ahora siempre se suben.',
     'Ranking: the best runs (more than 12 defeated per second) were never uploaded, without any warning: the server rejected them entirely. Now they are always uploaded.'],
    ['Ranking: el semanal, el mensual y el histórico ya cuadran entre sí. Cada uno se cargaba por su cuenta y el histórico podía no tener todavía una marca que ya salía en el semanal.',
     'Ranking: weekly, monthly and all-time now match each other. Each one was loaded separately and all-time could still be missing a time already shown in weekly.'],
    ['Ranking de amigos: en diario, semanal y mensual sólo salen los amigos que están en el top 50; ahora lo dice en vez de «Todavía no hay marcas aquí». En Histórico salen todos.',
     'Friends ranking: daily, weekly and monthly only show friends who are in the top 50; it now says so instead of "No records here yet". All-time shows everyone.'],
    ['Ranking histórico: si tu marca no entraba en el top 50, el ranking seguía enseñando la vieja durante horas, y al mirar tu puesto una partida peor podía sustituir a la mejor que aún no se había subido. Ahora sale tu mejor marca al momento y no se pierde.',
     'All-time ranking: if your time did not make the top 50, the ranking kept showing your old one for hours, and checking your rank could let a worse run replace the better one that had not been uploaded yet. Now your best time shows up right away and is never lost.'],
    ['Con el juego abierto en dos pestañas del mismo navegador, lo conseguido o gastado en una ya no se pierde al usar la otra: las dos se pasan los cambios al momento.',
     'With the game open in two tabs of the same browser, what you get or spend in one is no longer lost when you use the other: both share their changes right away.']
  ]},
  { d: '2026-10-24', title: ['Ataques en la colección y ventanas del menú', 'Moves in the collection and menu windows'], chg: [
    ['Colección: los iconos de los ataques que puede aprender cada Pokémon son el doble de grandes y, al pasar el ratón (o al tocarlos en el móvil), dicen su tipo, si es físico o especial y lo que hace.',
     'Collection: the icons of the moves each Pokémon can learn are twice as big and, when you hover over them (or tap them on mobile), they show their type, whether they are physical or special, and what they do.'],
    ['Las ventanas del menú, Ajustes, Novedades y Apoyar se pueden cerrar pulsando fuera de ellas, además de con Volver o Cerrar.',
     "The menu windows, Settings, What's new and Support can be closed by clicking outside them, as well as with Back or Close."]
  ], fix: [
    ['Las ventanas de la Tienda Kecleon y de Novedades ya no se meten por debajo de la barra de arriba: ahora empiezan debajo de ella, como las demás.',
     "The Kecleon Shop and What's new windows no longer slide under the top bar: they now start below it, like the other windows."]
  ] },
  { d: '2026-10-23', title: ['Ranking de daño a Arceus y Tablas', 'Arceus damage ranking and Plates'], new: [
    ["Botón de YouTube arriba, junto a Novedades: lleva al canal del juego y, cuando hay directo, se pone rojo con «EN DIRECTO» y te lleva a verlo.",
     "YouTube button at the top, next to What's new: it takes you to the game's channel and, when there is a live stream, it turns red with \"LIVE\" and takes you to watch it."],
    ["Ranking partido en dos: a la izquierda, el daño que le has hecho a Arceus; a la derecha, el tiempo aguantado, como siempre. Las dos mitades se cargan a la vez. Todas las tablas empiezan de cero.",
     "The ranking is now split in two: on the left, the damage you dealt to Arceus; on the right, the time survived, as always. Both halves load at once. Every board starts from zero."],
    ["Sentencia de Arceus: ahora se le puede pegar. Es invencible y sólo recibe una pequeña parte del daño (cada vez menos), y los ataques le apuntan cuando no queda ningún legendario.",
     "Arceus's Judgment: you can now hit it. It is invincible and only takes a small part of the damage (less and less over time), and your attacks aim at it when no legendary is left."],
    ["Tablas: en cada partida Arceus lleva una al azar, que le da su tipo (se avisa al entrar en la arena). Ya no hay un tipo de ataque que sea siempre el mejor.",
     "Plates: in every run Arceus holds a random one, which gives it its type (you are told when you enter the arena). No move type is always the best anymore."]
  ], chg: [
    ["En el minuto 35, Arceus rompe el objeto de todos (Banda Focus incluida).",
     "At minute 35, Arceus breaks everyone's item (Focus Sash included)."],
    ["Los legendarios de la Sentencia ya no son el doble de fuertes que el anterior: cada uno tiene un 25 % más de vida y un 15 % más de daño, así que se pueden tumbar. Ya no hay límite de 45 minutos en el ranking.",
     "The Judgment legendaries are no longer twice as strong as the previous one: each one has 25% more HP and 15% more damage, so they can be taken down. There is no 45-minute limit in the ranking anymore."],
    ['Los movimientos evolucionados ya no cambian de nombre: se llaman igual con un «+» (Puño Meteoro pasa a Puño Meteoro +). Hacen lo mismo que antes y se siguen distinguiendo por el borde dorado.',
     'Evolved moves no longer change their name: they keep it with a "+" (Meteor Mash becomes Meteor Mash +). They work just like before and still stand out with their golden border.'],
    ["Puño Meteoro pega menos: 24 de daño en vez de 34 y una zona un poco más pequeña. Al máximo y evolucionado hacía casi el doble que Avalancha; ahora están a la par.",
     "Meteor Mash hits softer: 24 damage instead of 34 and a slightly smaller area. Maxed and evolved it dealt almost twice as much as Rock Slide; now they are on par."],
    ["En la Sentencia de Arceus, el veneno y las quemaduras quitan poco y siempre lo mismo a los legendarios (antes el veneno quitaba un % de su vida): envenenar y huir ya no sirve, hay que pegarles.",
     "In Arceus's Judgment, poison and burns deal a small, fixed amount to the legendaries (poison used to take a % of their HP): poisoning them and running away no longer works, you have to hit them."]
  ] },
  { d: '2026-10-22', title: ['Esferas de Mundo Misterioso, Amuletos Iris y gacha ×100', 'Mystery Dungeon orbs, Shiny Charms and ×100 gacha'], new: [
    ['Esferas de Mundo Misterioso: objetos de un solo uso que se encuentran durante la partida (cofres, jefes y, a veces, al derrotar a un Pokémon). Soporesfera, Ralentosfera y Rafagaesfera duermen, frenan o lanzan lejos a los enemigos; Focosfera, Luminosfera y Rapidosfera te dan crítico, más campo de visión o velocidad a ti y a los compañeros cercanos. Llevas hasta 4 distintas (3 de cada) y se usan con las teclas 5-8, tocando su casilla encima de los ataques o con X / Y en el mando. A los jefes y legendarios les afectan menos.',
     'Mystery Dungeon orbs: single-use items you find during the run (chests, bosses and sometimes when you defeat a Pokémon). Slumber Orb, Slow Orb and Blowback Orb put enemies to sleep, slow them down or blow them away; Focus Orb, Luminous Orb and Quick Orb give critical hits, a wider view or speed to you and nearby teammates. You carry up to 4 different ones (3 of each) and use them with keys 5-8, by tapping their slot above your moves, or with X / Y on a controller. Bosses and legendaries are less affected.'],
    ['Amuletos Iris: uno por región (Kanto, Johto, Hoenn, Sinnoh, Teselia, Kalos, Alola, Galar y Paldea). Al completar la Pokédex de una región (legendarios incluidos) te dan su Amuleto Iris y en su banner del gacha los shiny salen el doble: del 1 % al 2 %. Los tienes en la Mochila, con lo que te falta para cada uno. Si ya habías completado alguna región, el suyo ya es tuyo.',
     'Shiny Charms: one per region (Kanto, Johto, Hoenn, Sinnoh, Unova, Kalos, Alola, Galar and Paldea). Complete a region\'s Pokédex (legendaries included) to get its Shiny Charm, and shinies become twice as likely in its gacha banner: from 1% to 2%. You can find them in your Bag, along with how many you still need for each one. If you had already completed a region, its charm is already yours.'],
    ['Gacha: nueva tirada ×100, con 100 tickets normales o con 10 tickets ×10 (son diez ×10 seguidas, cada una con su Épica asegurada). La tragaperras gira 10 veces enseñando lo mejor de cada ×10 y al final ves un resumen (nuevos, shiny y Pokémonedas) con las cartas de mejor a peor. Para que quepa, ya no está la tirada ×1: se tira de 10 en 10 o de 100 en 100.',
     'Gacha: new ×100 pull, with 100 normal tickets or with 10 ×10 tickets (ten ×10 pulls in a row, each with its guaranteed Epic). The slot machine spins 10 times showing the best of each ×10, and at the end you get a summary (new, shiny and PokéCoins) with the cards sorted from best to worst. To make room, the ×1 pull is gone: you pull 10 or 100 at a time.'],
    ['Gacha: botón Saltar (o Esc) durante la animación: se acaba la tragaperras y salen todas las cartas de golpe.',
     'Gacha: Skip button (or Esc) during the animation: the slot machine ends and all the cards show up at once.']
  ], fix: [
    ['Cooperativo: a los invitados ya no les sale «La sala se ha cerrado» a mitad de partida (a veces a los pocos minutos o al entrar en una grieta) mientras los demás seguían jugando. Pasaba cuando su conexión con el servidor de las salas se cortaba un momento; ahora la partida sigue y la sala se recupera sola.',
     'Co-op: guests no longer get "The room has been closed" in the middle of a run (sometimes after a few minutes or when entering a rift) while the others kept playing. It happened when their connection to the rooms server dropped for a moment; now the run goes on and the room recovers on its own.'],
    ['Cooperativo: si se corta un momento la conexión con el anfitrión (un bache de la wifi o de los datos), el invitado ya no pierde la partida: se queda en pausa hasta 45 segundos mientras se vuelve a conectar y sigue jugando.',
     'Co-op: if the connection with the host drops for a moment (a Wi-Fi or mobile data hiccup), the guest no longer loses the run: it pauses for up to 45 seconds while reconnecting and then keeps playing.'],
    ['Cooperativo: si te quedas fuera de una partida mientras los demás siguen, ya no te sale «La sala se ha cerrado»: esperas en la sala y, cuando acaben, seguís juntos.',
     'Co-op: if you drop out of a run while the others keep playing, you no longer get "The room has been closed": you wait in the room and, when they finish, you play together again.']
  ]},
  { d: '2026-10-21', title: ['La gran actualización: Tienda Kecleon', 'The big update: Kecleon Shop'], new: [
    ['Mejora nueva: Tienda Kecleon (botón en el menú) con Mentas, Cápsulas Habilidad y 8 MT nuevas cada día. Cada Pokémon tiene ahora su naturaleza (±10 % a dos stats) y su habilidad, con efecto en la partida; se ven y se cambian en su ficha de la colección. Las MT enseñan para siempre ataques de fuera de sus tipos, pero sólo si los aprende en los juegos (Mewtwo puede aprender Bola Sombra; Psyduck no puede aprender Lanzallamas). Gracias a TheAdro7 por la idea y el trabajo de base.',
     'New: the Kecleon Shop (button in the menu) with Mints, Ability Capsules and 8 new TMs every day. Every Pokémon now has its own nature (±10% to two stats) and ability, with an effect in the run; you can see and change them on its page in the collection. TMs permanently teach moves outside its types, but only if it learns them in the games (Mewtwo can learn Shadow Ball; Psyduck cannot learn Flamethrower). Thanks to TheAdro7 for the idea and the groundwork.'],
    ['Mejora nueva, Segundo movimiento inicial: con Repertorio, se compra una vez por Pokémon y luego eliges gratis el segundo ataque con el que empiezas (o lo dejas al azar).',
     'New upgrade, Second starting move: with Repertoire, buy it once per Pokémon and then choose for free the second move you start with (or leave it random).'],
    ['Cooperativo: si vuestras redes no dejan conectaros directamente (pasa a veces con datos móviles y algunos routers), la partida ahora pasa por nuestro servidor y podéis jugar igual. Si conectáis directamente, todo sigue como antes. Hace falta haber iniciado sesión con una cuenta.',
     'Co-op: if your networks cannot connect to each other directly (it sometimes happens on mobile data and with some routers), the match now goes through our server and you can still play together. If you can connect directly, nothing changes. You need to be signed in with an account.'],
    ['Cooperativo: si caes, puedes mirar a un compañero que siga en pie mientras esperas a que te levanten. Pulsa el botón que sale debajo del aviso (o Q / E, o LB / RB en el mando) para pasar de uno a otro y volver a ti. Sólo cambia la cámara: no gasta más conexión.',
     'Co-op: if you go down, you can watch a teammate who is still standing while you wait to be revived. Press the button under the message (or Q / E, or LB / RB on a controller) to switch between them and back to yourself. Only the camera changes: it uses no extra connection.']
  ], fix: [
    ['Guardado en la nube: si jugabas en un aparato y guardabas, otro aparato con el juego abierto desde antes podía subir su copia vieja encima (al guardar o al actualizarse el juego) y en el otro no aparecían tus tickets ni tus Pokémon nuevos. Ahora, si la nube tiene algo más nuevo, se junta con lo tuyo antes de guardar y no se pierde nada.',
     'Cloud save: if you played and saved on one device, another device that still had the game open could upload its old copy over it (when saving or when the game updated), and your new tickets and Pokémon did not show up on the other one. Now, if the cloud has something newer, it is merged with yours before saving and nothing is lost.']
  ] },
  { d: '2026-10-20', title: ['Cooperativo más seguro y arreglos de ataques', 'Safer co-op and move fixes'], fix: [
    ['Cooperativo: un jugador con el juego trucado ya no puede colgar la partida de los demás mandando números imposibles (una experiencia infinita dejaba congelado al anfitrión y un efecto gigante, a los invitados).',
     'Co-op: a player with a tampered game can no longer freeze the others by sending impossible numbers (infinite experience froze the host and a giant effect froze the guests).'],
    ['Mejoras: al cambiar de compañero, la pantalla de mejoras se abre ya con el nuevo y no con el último que habías mirado.',
     'Upgrades: after changing your partner, the upgrades screen now opens on the new one instead of the last one you had looked at.'],
    ['Cooperativo: Viento Aciago, Bucle Arena y Torbellino de un invitado ya atraen a los enemigos (sólo atraían los del anfitrión).',
     'Co-op: a guest\'s Ominous Wind, Sand Tomb and Whirlpool now pull enemies in (only the host\'s did).'],
    ['Cooperativo: el Infortunio de un invitado ya hace su daño extra a los enemigos quemados, envenenados o frenados.',
     'Co-op: a guest\'s Hex now deals its extra damage to burned, poisoned or slowed enemies.'],
    ['Bomba Ácida, Bola Voltio, Bomba Germen, Rayo Señal, Joya de Luz, Bola Neblina, Energibola, Canto Helado, Sombra Vil y Beso Drenaje: al evolucionar, los disparos salían hacia los lados y no daban a nadie. Ahora salen hacia delante, y la mejora «+1 proyectil» ya añade uno (antes no añadía ninguno).',
     'Acid Spray, Electro Ball, Seed Bomb, Signal Beam, Power Gem, Mist Ball, Energy Ball, Ice Shard, Shadow Sneak and Draining Kiss: once evolved, the shots flew off to the sides and hit nothing. Now they go forward, and the "+1 projectile" upgrade really adds one (it added none before).'],
    ['Cooperativo: si a alguien se le cerraban las cartas de subida de nivel sin haber elegido (podía pasar eligiendo muy deprisa), ahora se le vuelven a abrir y los demás ya no se quedan esperándole.',
     'Co-op: if someone\'s level-up cards closed before they had picked (it could happen when picking very fast), they now open again and the others are no longer left waiting for them.']
  ], chg: [
    ['En el móvil ya no está la opción «Apuntar a mano» (no funcionaba con la pantalla táctil): los ataques siempre apuntan solos.',
     'On mobile the "Manual aim" option is gone (it did not work with the touch screen): moves always aim on their own.'],
    ['Ranking por Pokémon: ahora cuentan las partidas de 5 minutos o más (los demás rankings siguen desde 2 minutos).',
     'Per-Pokémon leaderboard: runs now count from 5 minutes on (the other leaderboards still from 2 minutes).'],
    ['Amigos: ya no se ve quién está en línea, y puedes invitar a una sala a cualquier amigo (si no entra, la invitación caduca sola a los 3 minutos).',
     'Friends: you no longer see who is online, and you can invite any friend to a room (if they do not join, the invite expires on its own after 3 minutes).'],
    ['Guardado en la nube: ahora la partida sólo se sube a la nube cuando pulsas el botón Guardar de arriba (y antes de una actualización del juego). En este navegador se sigue guardando todo al momento. Si juegas en otro aparato o vas a borrar los datos del navegador, pulsa Guardar antes.',
     'Cloud save: your game is now only uploaded to the cloud when you press the Save button at the top (and before a game update). Everything is still saved instantly in this browser. If you play on another device or are about to clear your browser data, press Save first.'],
    ['Las solicitudes de amistad nuevas se ven al abrir Amigos.',
     'New friend requests show up when you open Friends.']
  ] },
  { d: '2026-10-19', title: ['38 ataques nuevos', '38 new moves'], new: [
    ['38 ataques nuevos: ahora todos los tipos tienen 5 o más (Roca, Lucha, Dragón y Hada tenían sólo 2). Entre ellos Hiperrayo, Rayo Solar, Magnitud, Torbellino, Onda Trueno, Enfado, Carantoña, Golpe Bajo... cada uno con su evolución.',
     '38 new moves: every type now has 5 or more (Rock, Fighting, Dragon and Fairy had only 2). Among them Hyper Beam, Solar Beam, Magnitude, Whirlpool, Thunder Wave, Outrage, Play Rough, Sucker Punch... each with its evolution.'],
    ['Formas nuevas de atacar: disparos que persiguen al enemigo o rebotan entre ellos, rayos que se cargan, giros que golpean todo alrededor, ondas que avanzan por el suelo, remolinos que atraen a los enemigos, ondas que los apartan y zonas que los dejan aturdidos.',
     'New ways to attack: shots that chase enemies or bounce between them, beams you charge up, spins that hit everything around you, shockwaves that travel along the ground, vortexes that pull enemies in, waves that push them away and zones that stun them.'],
    ['Mejora nueva, Movimiento inicial: se compra una vez por Pokémon y luego eliges gratis con qué ataque empieza la partida.',
     'New upgrade, Starting move: buy it once per Pokémon and then choose for free which move it starts the run with.'],
    ['Idiomas nuevos: francés, italiano, portugués de Brasil, chino simplificado y chino tradicional, en Ajustes > Gráficos > Idioma. Gracias a quienes los tradujeron.',
     'New languages: French, Italian, Brazilian Portuguese, Simplified Chinese and Traditional Chinese, in Settings > Graphics > Language. Thanks to everyone who translated them.'],
    ['Una frase de broma en el título del menú principal, como las de Minecraft.',
     'A joke line on the main menu title, like the ones in Minecraft.']
  ], chg: [
    ['Los Pokémon de un solo tipo pegan un 20 % más con los ataques de su tipo, para compensar que tienen menos variedad.',
     'Single-type Pokémon deal 20% more damage with moves of their type, to make up for having less variety.'],
    ['Al aprender un ataque nuevo ya no se cambia solo a él: sigues con el que estabas usando y cambias cuando tú quieras.',
     'Learning a new move no longer switches to it on its own: you keep the one you were using and switch whenever you want.'],
    ['El juego sólo se puede jugar en su web oficial, pokesurvivor.com: si otra web lo mete dentro de la suya (por ejemplo, para ponerle anuncios alrededor), sale un aviso con un botón para ir a la oficial.',
     'The game can only be played on its official website, pokesurvivor.com: if another site embeds it in its own page (for example, to put ads around it), a notice appears with a button to go to the official one.']
  ], fix: [
    ['Movimiento inicial: ya se puede volver al ataque de serie aunque no sea de su tipo (por ejemplo Confusión en Psyduck).',
     'Starting move: you can now go back to the default move even if it is not of its type (for example Confusion on Psyduck).'],
    ['Cooperativo: el jefe que tocaba al volver de una grieta podía salir a miles de metros, donde nadie lo encontraba, y la partida se quedaba sin más grietas. Ahora sale cerca, y si un jefe se queda lejísimos de todos, vuelve a aparecer cerca a los pocos segundos.',
     'Co-op: the boss due when coming back from a rift could appear thousands of metres away, where nobody could find it, and the run got no more rifts. Now it appears nearby, and if a boss ends up very far from everyone, it shows up close again after a few seconds.'],
    ['Al recargar, a veces la página nueva se juntaba con los estilos viejos guardados en el navegador (por ejemplo, la frase del título salía en grande pegada a «PokéSurvivor»). Ya no pasa.',
     'When reloading, the new page sometimes got mixed with the old styles saved in the browser (for example, the title line showed up big and stuck to "PokéSurvivor"). That no longer happens.']
  ] },
  { d: '2026-10-18', title: ['Físico y especial, mando, botón Guardar y rankings desde cero', 'Physical and special, controller, Save button and fresh leaderboards'], new: [
    ['Ataques físicos y especiales, como en los juegos: cada Pokémon tiene su Ataque, Ataque Especial, Defensa y Defensa Especial. Los ataques físicos pegan con su Ataque y los especiales con su Ataque Especial: Machamp pega fuerte con Golpe Kárate y flojo con Bola Sombra. Con los de su lado bueno pega lo mismo que antes. Al subir de nivel, cada carta dice si el ataque es físico o especial y cuánto rinde con tu Pokémon, y en la colección se ven todas sus estadísticas.',
     'Physical and special moves, like in the games: every Pokémon has its Attack, Special Attack, Defense and Special Defense. Physical moves use its Attack and special moves its Special Attack: Machamp hits hard with Karate Chop and weakly with Shadow Ball. With moves on its strong side it hits as hard as before. When leveling up, each card says whether the move is physical or special and how well it works with your Pokémon, and the collection shows all its stats.'],
    ['Danza Espada y Danza Dragón suben sólo el Ataque (físico), como en los juegos, y llega Maquinación, que sube el Ataque Especial y la puede aprender cualquier Pokémon. Al subir de nivel, los ataques del lado bueno de tu Pokémon salen el doble de a menudo.',
     'Swords Dance and Dragon Dance now raise only (physical) Attack, like in the games, and Nasty Plot arrives, raising Special Attack, learnable by any Pokémon. When leveling up, moves on your Pokémon’s strong side show up twice as often.'],
    ['Resumen de la partida en la pausa: cada ataque con su categoría, el daño que lleva hecho y su daño por segundo; tus estadísticas con todo lo que has subido; y el objeto y las cartas de mejora que llevas.',
     'Run summary in the pause screen: each move with its category, the damage it has dealt and its damage per second; your stats with everything you have raised; and your item and the upgrade cards you have.'],
    ['Las defensas también cuentan (un poco): los enemigos se defienden de tus ataques físicos con su Defensa y de los especiales con su Defensa Especial, y cada enemigo te pega con su lado fuerte, que paras con tu Defensa o tu Defensa Especial.',
     'Defenses count too (a little): enemies resist your physical moves with their Defense and special moves with their Special Defense, and each enemy hits you with its strong side, which you block with your Defense or Special Defense.'],
    ['Ya se puede jugar con mando (Xbox, PlayStation, Switch y la mayoría de mandos USB o Bluetooth): moverte, cambiar de ataque, pausar, elegir cartas y manejar todos los menús, con vibración al recibir daño. Se configura en Ajustes > Controles.',
     'You can now play with a controller (Xbox, PlayStation, Switch and most USB or Bluetooth controllers): move, switch attacks, pause, pick cards and use every menu, with vibration when you take damage. Set it up in Settings > Controls.'],
    ['Colección: buscador por nombre o número, pestaña con todas las generaciones, filtros que se combinan (tengo / me faltan, varias rarezas a la vez, shiny, favoritos y tipo) y orden por número, nombre, rareza, recién conseguidos o más usados. Y favoritos: márcalos en la ficha de cada Pokémon; van con tu cuenta, en todos tus aparatos.',
     'Collection: search by name or number, a tab with every generation, filters that combine (owned / missing, several rarities at once, shiny, favorites and type) and sorting by number, name, rarity, recently caught or most played. Plus favorites: mark them on each Pokémon’s page; they go with your account, on all your devices.'],
    ['Nueva pestaña Accesibilidad en Ajustes con «Apuntar a mano»: tus ataques van hacia el ratón o hacia donde empujes el stick derecho del mando, en vez de al enemigo más cercano. Viene desactivado.',
     'New Accessibility tab in Settings with “Manual aim”: your attacks go towards the mouse or wherever you push the controller’s right stick, instead of the nearest enemy. It is off by default.'],
    ['Botón Guardar arriba a la derecha: sube tu partida a la nube al momento. Úsalo antes de cerrar el juego o de cambiar de aparato.',
     'Save button at the top right: it uploads your game to the cloud right away. Use it before closing the game or switching devices.']
  ], chg: [
    ['Las cartas de nivel, de vínculo y de objeto no se pueden elegir durante un momento al aparecer (se ven apagadas): pulsar 1-4 o tocar la pantalla para cambiar de ataque en plena pelea ya no elige una carta sin querer.',
     'Level-up, bond and item cards can’t be picked for a moment after they appear (they look dimmed): pressing 1-4 or tapping to switch attacks mid-fight no longer picks a card by accident.'],
    ['Con mando ya se pueden elegir en la colección los Pokémon que aún no tienes, y en el móvil las pestañas de Ajustes caben en una fila que se desliza.',
     'With a controller you can now select the Pokémon you don’t have yet in the collection, and on mobile the Settings tabs fit in one row that scrolls sideways.'],
    ['La partida se guarda en la nube automáticamente cada 10 minutos.',
     'Your game is saved to the cloud automatically every 10 minutes.'],
    ['Ranking histórico: si estás por debajo del puesto 1.000, sale «#1000+» en vez del número exacto.',
     'All-time leaderboard: if you are below rank 1,000, it shows “#1000+” instead of the exact number.'],
    ['Los Pokémon grandes (Onix, Gyarados, Wailord, Eternatus, los legendarios...) ya se pueden jugar bien: se ven algo más pequeños, aunque siguen siendo de los más grandes, y chocan como uno normal, así que caben por todos los pasillos y no reciben más golpes por su tamaño.',
     'Big Pokémon (Onix, Gyarados, Wailord, Eternatus, the legendaries...) are now properly playable: they look a bit smaller, while still being among the biggest, and collide like a normal one, so they fit through every corridor and don’t take extra hits because of their size.'],
    ['Como mucho hay 3 curanderos, 3 escuderos y 3 invocadores a la vez.',
     'There are at most 3 healers, 3 shielders and 3 summoners at a time.'],
    ['Los curanderos y escuderos ya no hacen inmatable a un jefe: lo que le curan y el escudo que le ponen van con el daño que le estás haciendo, y sólo recibe un escudo cada 6 segundos.',
     'Healers and shielders no longer make a boss unkillable: their healing and shields scale with the damage you are dealing to it, and it only gets one shield every 6 seconds.'],
    ['Sentencia de Arceus: la velocidad tiene un tope suave (lo que pase de cierto punto cuenta mucho menos) y los legendarios corren casi tanto como tú. Desde los 5 minutos de Sentencia Arceus acelera sin parar, y desde los 7 su toque quita cada vez más vida, hasta dejarte KO de un golpe hacia el minuto 40.',
     'Judgment of Arceus: speed has a soft cap (anything above a certain point counts much less) and legendaries run almost as fast as you. After 5 minutes of Judgment, Arceus keeps speeding up, and after 7 its touch takes more and more HP, until it knocks you out in one hit around minute 40.'],
    ['El veneno sigue quitando un porcentaje de la vida, pero contra enemigos con muchísima vida (los legendarios de la Sentencia) ese porcentaje es menor.',
     'Poison still takes a percentage of HP, but against enemies with huge HP (the Judgment legendaries) that percentage is smaller.'],
    ['Todos los rankings empiezan de cero (hoy, semana, mes, año e histórico): las marcas de huir de Arceus ya no se podrían alcanzar.',
     'All leaderboards start from scratch (daily, weekly, monthly, yearly and all-time): records from running away from Arceus could no longer be reached.']
  ], fix: [
    ['Seguridad: se ha cerrado un agujero por el que alguien podía meter código en su fila del ranking o en su perfil y hacer que se ejecutara en el navegador de quien los abría (a algunos les llevaba a un vídeo). Ahora todo lo que viene de otros jugadores se limpia, el servidor sólo deja guardar lo que debe, y el navegador no ejecuta nada que no sea del juego.',
     'Security: we closed a hole that let someone put code in their leaderboard row or profile and make it run in the browser of whoever opened them (some people were sent to a video). Now everything coming from other players is cleaned, the server only accepts what it should, and the browser runs nothing that isn’t part of the game.'],
    ['En el ranking ya salen en shiny los Pokémon de quien jugó con su shiny.',
     'The leaderboard now shows Pokémon in shiny form for players who played with their shiny.']
  ] },
  { d: '2026-10-15', title: ['Actualizaciones obligatorias', 'Required updates'], chg: [
    ['Cuando una actualización sea obligatoria (por ejemplo, para arreglar un fallo importante), la partida en curso se termina tras un aviso de 10 s y el juego se recarga. No pierdes nada: las monedas, los tickets, los récords y el ranking de esa partida se guardan como al abandonarla.',
     'When an update is required (for example, to fix an important bug), your current run ends after a 10 s notice and the game reloads. You lose nothing: that run’s coins, tickets, records and leaderboard entry are saved as if you had quit.']
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
    ['Jugar en dos aparatos (PC y móvil) ya no hace perder monedas ni tickets: antes, si uno tenía la partida abierta con datos viejos y guardaba, borraba lo ganado en el otro. Ahora se suma lo de los dos. Y al volver al juego tras un rato fuera, se trae lo conseguido en el otro aparato (Pokémon, shinies...) sin recargar.',
     'Playing on two devices (PC and phone) no longer loses coins or tickets: before, if one had the game open with old data and saved, it erased what you earned on the other. Now both are added up. And when you come back to the game after a while away, it brings in what you got on the other device (Pokémon, shinies...) without reloading.'],
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
