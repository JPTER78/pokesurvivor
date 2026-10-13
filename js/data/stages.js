/* ============ stages.js — etapas y gimnasios por regiones ============
 * Define las etapas temáticas con duración de 10 minutos, elenco de Pokémon
 * propio de cada ruta y combate final en la arena del líder de gimnasio.
 */
G.Stages = (() => {
  const LIST = [
    {
      id: 'kanto_1',
      name: 'Etapa 1: Bosque Verde & Gimnasio Plateada',
      subtitle: 'Ruta 1, Bosque Verde y Líder Brock',
      region: 'Kanto',
      gymNum: 1,
      leader: 'Brock',
      badge: 'Medalla Roca',
      badgeIcon: '🪨',
      badgeImg: 'assets/gyms/kanto_1_badge.png',
      leaderImg: 'assets/gyms/kanto_1_leader.png',
      duration: 600, // 10 minutos
      biome: 0,      // 0: Bosque Umbrío (tiles.js)
      hpMul: 0.85,
      dmgMul: 1.1,
      xpMul: 1.4,
      available: true,
      firstReward: { coins: 250, t1: 10, badge: 'roca' },
      repeatReward: { coins: 75, t1: 1 },

      // Elenco de Pokémon salvajes según el avance en la etapa (segundos)
      tiers: [
        {
          from: 0,
          bst: [180, 270],
          mons: [16, 19, 10, 13] // Pidgey, Rattata, Caterpie, Weedle
        },
        {
          from: 180,
          bst: [200, 330],
          mons: [11, 14, 25, 29, 32] // Metapod, Kakuna, Pikachu, Nidoran♀, Nidoran♂
        },
        {
          from: 360,
          bst: [300, 420],
          mons: [21, 41, 17, 12, 15] // Spearow, Zubat, Pidgeotto, Butterfree, Beedrill
        }
      ],

      // Mini-jefes intermedios: cada uno otorga 1 Vínculo para fusionar habilidades
      miniBosses: [
        {
          at: 180, // Minuto 3:00
          dex: 17,
          name: 'Pidgeotto Alfa',
          hp: 1100,
          dmg: 22,
          xp: 280,
          behavior: 'charger'
        },
        {
          at: 360, // Minuto 6:00
          dex: 15,
          name: 'Beedrill Enjambre',
          hp: 1900,
          dmg: 26,
          xp: 420,
          behavior: 'chase'
        },
        {
          at: 520, // Minuto 8:40 (otorga el 3er vínculo para fusionar los 4 movimientos)
          dex: 12,
          name: 'Butterfree Alfa',
          hp: 2500,
          dmg: 28,
          xp: 550,
          behavior: 'fan'
        }
      ],

      // Combate final al minuto 10: Arena de tipo Roca contra el equipo de Brock
      gym: {
        leaderName: 'Líder Brock',
        arenaType: 'rock',
        arenaName: 'Gimnasio Plateada',
        introText: '¡El Líder Brock te desafía con Geodude y Onix!',
        team: [
          {
            dex: 74, // Geodude
            name: 'Geodude de Brock',
            hp: 2400,
            dmg: 28,
            xp: 600,
            behavior: 'charger',
            shotDmg: 15,
            shotCd: 1.2
          },
          {
            dex: 95, // Onix
            name: 'Onix de Brock',
            hp: 3800,
            dmg: 32,
            xp: 1200,
            behavior: 'tank',
            shotDmg: 18,
            shotCd: 1.0
          }
        ]
      }
    },
    {
      id: 'kanto_2',
      name: 'Etapa 2: Monte Moon & Gimnasio Celeste',
      subtitle: 'Monte Moon, Ruta 24 y Líder Misty',
      region: 'Kanto',
      gymNum: 2,
      leader: 'Misty',
      badge: 'Medalla Cascada',
      badgeIcon: '💧',
      badgeImg: 'assets/gyms/kanto_2_badge.png',
      leaderImg: 'assets/gyms/kanto_2_leader.png',
      available: false,
      firstReward: { coins: 350, t1: 10, badge: 'cascada' },
      repeatReward: { coins: 100, t1: 1 }
    },
    {
      id: 'kanto_3',
      name: 'Etapa 3: Ruta 6 & Gimnasio Carmín',
      subtitle: 'Cueva Diglett, S.S. Anne y Líder Lt. Surge',
      region: 'Kanto',
      gymNum: 3,
      leader: 'Lt. Surge',
      badge: 'Medalla Trueno',
      badgeIcon: '⚡',
      badgeImg: 'assets/gyms/kanto_3_badge.png',
      leaderImg: 'assets/gyms/kanto_3_leader.png',
      available: false,
      firstReward: { coins: 500, t1: 20, badge: 'trueno' },
      repeatReward: { coins: 150, t1: 2 }
    },
    {
      id: 'kanto_4',
      name: 'Etapa 4: Túnel Roca & Gimnasio Azulona',
      subtitle: 'Túnel Roca, Ruta 7 y Líder Erika',
      region: 'Kanto',
      gymNum: 4,
      leader: 'Erika',
      badge: 'Medalla Arcoíris',
      badgeIcon: '🌿',
      badgeImg: 'assets/gyms/kanto_4_badge.png',
      leaderImg: 'assets/gyms/kanto_4_leader.png',
      available: false,
      firstReward: { coins: 650, t1: 20, badge: 'arcoiris' },
      repeatReward: { coins: 200, t1: 2 }
    },
    {
      id: 'kanto_5',
      name: 'Etapa 5: Ruta Ciclista & Gimnasio Fucsia',
      subtitle: 'Ruta 17, Zona Safari y Líder Koga',
      region: 'Kanto',
      gymNum: 5,
      leader: 'Koga',
      badge: 'Medalla Alma',
      badgeIcon: '💜',
      badgeImg: 'assets/gyms/kanto_5_badge.png',
      leaderImg: 'assets/gyms/kanto_5_leader.png',
      available: false,
      firstReward: { coins: 800, t1: 20, badge: 'alma' },
      repeatReward: { coins: 250, t1: 2 }
    },
    {
      id: 'kanto_6',
      name: 'Etapa 6: Silph S.A. & Gimnasio Azafrán',
      subtitle: 'Edificio Silph S.A. y Líder Sabrina',
      region: 'Kanto',
      gymNum: 6,
      leader: 'Sabrina',
      badge: 'Medalla Pantano',
      badgeIcon: '👁️',
      badgeImg: 'assets/gyms/kanto_6_badge.png',
      leaderImg: 'assets/gyms/kanto_6_leader.png',
      available: false,
      firstReward: { coins: 1000, t1: 30, badge: 'pantano' },
      repeatReward: { coins: 300, t1: 3 }
    },
    {
      id: 'kanto_7',
      name: 'Etapa 7: Mansión Pokémon & Gimnasio Canela',
      subtitle: 'Ruta 20, Mansión Pokémon y Líder Blaine',
      region: 'Kanto',
      gymNum: 7,
      leader: 'Blaine',
      badge: 'Medalla Volcán',
      badgeIcon: '🔥',
      badgeImg: 'assets/gyms/kanto_7_badge.png',
      leaderImg: 'assets/gyms/kanto_7_leader.png',
      available: false,
      firstReward: { coins: 1250, t1: 30, badge: 'volcan' },
      repeatReward: { coins: 350, t1: 3 }
    },
    {
      id: 'kanto_8',
      name: 'Etapa 8: Calle Victoria & Gimnasio Verde',
      subtitle: 'Gimnasio de Ciudad Verde y Líder Giovanni',
      region: 'Kanto',
      gymNum: 8,
      leader: 'Giovanni',
      badge: 'Medalla Tierra',
      badgeIcon: '🌍',
      badgeImg: 'assets/gyms/kanto_8_badge.png',
      leaderImg: 'assets/gyms/kanto_8_leader.png',
      available: false,
      firstReward: { coins: 1500, t1: 50, badge: 'tierra' },
      repeatReward: { coins: 400, t1: 4 }
    }
  ];

  const BY_ID = {};
  for (const s of LIST) BY_ID[s.id] = s;

  let currentStageId = null;

  return {
    LIST,
    BY_ID,
    get(id) { return BY_ID[id] || null; },
    get current() { return currentStageId ? BY_ID[currentStageId] : null; },
    set current(id) { currentStageId = id; },
    clearCurrent() { currentStageId = null; }
  };
})();
