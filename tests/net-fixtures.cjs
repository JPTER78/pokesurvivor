// Synthetic traffic following coop.js hostFrame/myState/enemyList/event layouts.
function frame(enemies = 100, events = 12, tick = 0) {
  const state = [1234, -567, 1.57, 1, 243, 300, 0, 'ember', 4, 108, -0.85, 1.25, 0, 0, 7];
  return {
    k: 'f', t: 1200.25 + tick, lv: 35, xp: 1543.75, xn: 1900, ki: 4567, bo: 12, co: 891,
    tk: [5, 1], p: { host_012345678901234567890123: state, mate_012345678901234567890123: [...state] },
    e: Array.from({ length: enemies }, (_, i) => [i + 1024, 1400 + i * 3, -870 + i * 2, 150 + i * 17, i % 7, i % 8, i % 8]),
    ev: Array.from({ length: events }, (_, i) => ['d', i + 1024, 54 + i, i % 2]),
    ja: [1200, -900, 2, 4], ho: ['皮卡丘 🐾', 'Aarón'], lu: [7, 35]
  };
}
const client = () => ({ k: 'f', p: [1234, -567, 1.57, 1, 243, 300, 0, 'ember', 4, 108, -0.85, 1.25, 0, 0, 7], ev: [['h', 1089, 54, 0, 0, false, 'fire']] });
module.exports = { frame, client };
