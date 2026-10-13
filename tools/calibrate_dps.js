/* Mide cuánto daño puede hacer cada movimiento (al máximo y evolucionado) y
 * escribe tools/anticheat_calib.json, que tools/make_rules.js mete en
 * firestore.rules (resumen de partida del ranking: pico de daño por segundo).
 *
 *   npm i puppeteer-core            (sólo para esto; no es del juego)
 *   node tools/calibrate_dps.js     (tarda ~12 min: abre Chrome y juega cada movimiento)
 *   node tools/export_data.js       (regenera las reglas con lo medido)
 *
 * Hay que repetirlo si cambian los movimientos, sus mejoras o la fórmula de daño.
 * Cómo: carga dev.html, empieza una partida de invitado, se queda sin enemigos
 * salvo un muñeco inmóvil de vida enorme pegado al jugador, le da cada
 * movimiento y lee el libro de la partida (G.Integrity): pico de daño a un
 * enemigo en 1 s, dividido entre el ataque del jugador, el multiplicador de
 * tipo y la recarga (el servidor lo vuelve a multiplicar por lo que dan las
 * mejoras). CHROME=/ruta/a/chrome para elegir el navegador.
 */
const fs = require('fs'), path = require('path'), http = require('http');
const ROOT = path.join(__dirname, '..');
const OUT = process.env.OUT || path.join(__dirname, 'anticheat_calib.json');
const MARGIN = 2;                          // el pico real puede caer mejor repartido en las ventanas que lo medido
const sleep = ms => new Promise(r => setTimeout(r, ms));

function serve() {
  const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.css': 'text/css' };
  return new Promise(res => {
    const s = http.createServer((req, rs) => {
      const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'dev.html');
      fs.readFile(f.startsWith(ROOT) ? f : '', (e, d) => { if (e) { rs.writeHead(404); rs.end(); } else { rs.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); rs.end(d); } });
    }).listen(0, '127.0.0.1', () => res(s));
  });
}

(async () => {
  const puppeteer = require('puppeteer-core');
  const srv = await serve();
  const b = await puppeteer.launch({ executablePath: process.env.CHROME || '/usr/local/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
  const pg = await b.newPage();
  await pg.setViewport({ width: 1280, height: 800 });
  await pg.goto(`http://127.0.0.1:${srv.address().port}/dev.html`);
  await sleep(3500);
  const ev = (f, a) => pg.evaluate(f, a);
  await ev(() => document.getElementById('btn-guest').click()); await sleep(800);
  for (let i = 0; i < 40; i++) { if (!await ev(() => !!document.querySelector('#test-a .answer') && document.getElementById('scr-test').getClientRects().length > 0)) break; await ev(() => document.querySelector('#test-a .answer').click()); await sleep(120); }
  await sleep(500);
  await ev(() => { const e = document.getElementById('res-ok'); if (e && e.getClientRects().length) e.click(); }); await sleep(900);
  await ev(() => document.querySelector('.menu-item.play').click()); await sleep(1500);

  await ev(() => {
    G.Spawner.update = () => {}; G.Events.update = () => {}; G.Rift.update = () => {}; G.Weather.update = () => {};
    window.__setup = (id, dist) => {
      const p = G.Game.player;
      // El muñeco empuja al jugador al chocar: se vuelve a dejar a los dos en su sitio cada fotograma.
      if (!window.__home) window.__home = [p.x, p.y];
      [p.x, p.y] = window.__home;
      G.EnemyMgr.clear(); G.Projectiles.clear(); G.Combat.clearFields();
      p.heal(1e6, true);
      p.moves = []; p.slots = []; p.active = 0; p.bind = {};
      p.addMove(id);
      const m = p.moves[0];
      while (G.Moves.levelUp(m));
      G.Moves.evolve(m);
      window.__m = m;
      const e = new G.Enemy(G.Enemies.BOSSES[0], p.x + 34, p.y, { hp: 1e8, spd: 0, dmg: 0 }, true);
      e.dmg = 0; e.spd = 0; e.maxHp = e.hp = 1e15; e.types = [];      // sin tipos: ni ventaja ni inmunidad
      G.EnemyMgr.add(e);
      window.__e = e;
      clearInterval(window.__iv);
      const d = dist || 34;
      window.__iv = setInterval(() => { [p.x, p.y] = window.__home; if (G.Game.state === 'levelup') G.RunUI.pick(0); else if (G.Game.state === 'choice') { const c = document.querySelector('#item-cards .card'); if (c && c.getClientRects().length) c.click(); else G.RunUI.pickBond(0); } e.x = p.x + d; e.y = p.y; e.kx = e.ky = 0; e.dmg = 0; p.heal(1e6, true); }, 16);
      G.Integrity.begin();
    };
  });
  const ids = await ev(() => G.Moves.ALL.map(m => m.id));
  const moves = {};
  let pkUnit = 0, atkBuff = 1;
  // FROM=id TO=id para repartir el trabajo en varios procesos (y OUT=archivo para cada uno)
  const from = Math.max(0, ids.indexOf(process.env.FROM || ids[0])), to = process.env.TO ? ids.indexOf(process.env.TO) + 1 : ids.length;
  for (const id of ids.slice(from, to)) {
    const kind = await ev(i => G.Moves.BY_ID[i].kind, id);
    if (kind === 'buff') {
      moves[id] = await ev(i => { window.__setup(i); const m = window.__m; return { kind: m.kind, stat: m.stat, amount: m.amount, stacks: m.stacks | 0 }; }, id);
      if (moves[id].stat === 'atk') atkBuff = Math.max(atkBuff, 1 + moves[id].amount * moves[id].stacks);
      continue;
    }
    let best = null;
    for (const mul of [0, 0.9, 0.5]) {                      // pegado al jugador, y a la distancia de los orbes/ondas
      await ev(([i, f]) => { window.__setup(i); if (f) window.__setup(i, (window.__m.radius || 60) * f); }, [id, mul]);
      await sleep(6500);
      const r = await ev(() => { const p = G.Game.player, sm = G.Integrity.summary(p), m = window.__m, e = window.__e;
        return { kind: m.kind, atk: p.atk, pk: sm.pk, dd: sm.dd, type: G.Types.mult(m.type, e.types) * G.Weather.mult(m.type), cd: m.cd, dmg: m.dmg, count: m.count || 0 }; });
      r.unit = r.pk / r.atk / r.type;
      if (!r.pk) r.diag = await ev(() => ({ state: G.Game.state, dead: G.Game.player.dead, time: Math.round(G.Game.st.time), n: G.EnemyMgr.all().length, hp: Math.round(G.Game.player.hp), x: Math.round(G.Game.player.x), ex: Math.round(window.__e.x), dd: G.Integrity.summary(G.Game.player).dd }));
      if (!best || r.unit > best.unit) best = r;
    }
    moves[id] = best;
    pkUnit = Math.max(pkUnit, best.unit);
    console.log(id, best.kind, 'pk', best.pk, 'unidad', best.unit.toFixed(1), best.diag ? JSON.stringify(best.diag) : '');
  }
  await b.close(); srv.close();
  fs.writeFileSync(OUT, JSON.stringify({ about: 'generado por tools/calibrate_dps.js', pkUnit: +pkUnit.toFixed(2), margin: MARGIN, atkBuff: +atkBuff.toFixed(3), moves }, null, 1));
  console.log('ok: pkUnit', pkUnit.toFixed(1), 'atkBuff', atkBuff, '->', OUT);
})();
