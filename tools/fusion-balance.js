/* Modelo de "potencia" de un movimiento, para equilibrar las fusiones.
 *   node tools/fusion-balance.js        -> tabla: cada fusión (nivel 1) frente a su mejor origen (nivel 5, evolucionado)
 *   require('./fusion-balance.js')      -> { EFF, hits, power }  (lo usa tools/test.js)
 *
 * power(m) = daño × impactos esperados por lanzamiento / recarga. Los impactos
 * esperados dependen de la familia: una nova de 22 proyectiles no acierta 22
 * veces, y un aura golpea a todo lo que tiene cerca en cada tic. Es una
 * aproximación para comparar, no una simulación.
 */
const EFF = {
  projectile: m => Math.min(m.count || 1, 3) * (1 + 0.3 * Math.min(m.pierce || 0, 2)),
  cone:       m => Math.min(m.count || 1, 5) * (1 + 0.3 * Math.min(m.pierce || 0, 2)),
  nova:       m => Math.min(m.count || 1, 6) * (1 + 0.3 * Math.min(m.pierce || 0, 2)),
  boomerang:  m => Math.min(m.count || 1, 3) * 2,                       // ida y vuelta
  chain:      m => { let s = 0; for (let i = 0; i < (m.count || 1); i++) s += Math.pow(0.85, i); return s; },
  meteor:     m => (m.count || 1) * 0.8,
  mine:       m => (m.count || 1) * 0.7,
  turret:     m => (m.count || 1) * ((m.dur || 6) / (m.rate || 0.6)) * 0.8,  // disparos por colocación
  aura:       () => 3,
  melee:      m => (m.arc >= 6 ? 4 : 2.5),
  beam:       () => 3,
  dash:       () => 3,
  orbit:      m => (m.count || 1) * 0.6,                                  // por cada rehit (cd)
  trail:      m => (m.dur || 3) * 1.2                                     // tics × objetivos, con solape
};

function hits(m) { return (EFF[m.kind] || (() => 1))(m); }
function power(m) { return m.dmg * hits(m) / m.cd; }

module.exports = { EFF, hits, power };

if (require.main === module) {
  const fs = require('fs'), vm = require('vm'), path = require('path');
  const ROOT = path.join(__dirname, '..');
  const G = {};
  const sb = { G, window: {}, Math, Object, Array, Set, Map, JSON, Error, console };
  sb.window = sb;
  vm.createContext(sb);
  for (const f of ['js/core/util.js', 'js/data/moves.js', 'js/data/fusions.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sb);
  const pad = (s, n) => String(s).padEnd(n);
  console.log(pad('fusión', 20) + pad('kind', 11) + pad('nv.1', 8) + pad('nv.5', 8) + pad('mejor origen (nv.5 evo)', 34) + 'ratio nv.1');
  for (const f of G.Fusions.LIST) {
    const src = f.pair.map(id => { const m = G.Moves.instance(id, 5); G.Moves.evolve(m); return { id, p: power(m) }; }).sort((a, b) => b.p - a.p)[0];
    const p1 = power(G.Moves.instance(f.id, 1)), p5 = power(G.Moves.instance(f.id, 5));
    console.log(pad(f.id, 20) + pad(f.kind, 11) + pad(p1.toFixed(0), 8) + pad(p5.toFixed(0), 8) + pad(src.id + ' ' + src.p.toFixed(0), 34) + (p1 / src.p).toFixed(2));
  }
}
