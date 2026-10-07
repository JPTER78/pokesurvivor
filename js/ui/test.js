/* ============ test.js — test de personalidad y elección de compañero ============ */
G.TestUI = (() => {
  const $ = G.UI.$;
  let idx = 0, scores = {}, result = null, picked = null;

  function init() {
    $('res-ok').onclick = () => choose(result.dex);
    $('res-other').onclick = openStarters;
    $('starter-back').onclick = () => G.UI.show('scr-result');
    $('starter-ok').onclick = () => { if (picked) choose(picked); };
  }

  function start() {
    idx = 0; scores = {}; result = null;
    G.UI.chrome(false);
    G.UI.show('scr-test');
    render();
  }

  function render() {
    const Q = G.PERSONALITY_TEST;
    const q = Q[idx];
    $('test-bar').style.width = (idx / Q.length * 100) + '%';
    $('test-count').textContent = `Pregunta ${idx + 1} de ${Q.length}`;
    $('test-q').textContent = q.q;
    const box = $('test-a');
    box.innerHTML = '';
    q.a.forEach(a => {
      const b = document.createElement('button');
      b.className = 'answer';
      b.dataset.sfx = 'select';
      b.textContent = a.t;
      b.onclick = () => answer(a);
      box.appendChild(b);
    });
  }

  function answer(a) {
    for (const k in a.p) scores[k] = (scores[k] || 0) + a.p[k];
    idx++;
    if (idx < G.PERSONALITY_TEST.length) render();
    else showResult();
  }

  function showResult() {
    result = G.personalityResult(scores);
    const mon = G.DEX_BY[result.dex];
    $('res-trait').textContent = result.trait.charAt(0).toUpperCase() + result.trait.slice(1);
    $('res-text').textContent = G.TRAIT_TEXT[result.trait] || '';
    $('res-name').textContent = mon.name;
    G.UI.sprite($('res-stage'), mon.dex, { lively: true, scale: 4, hero: true });
    $('res-stage').style.setProperty('--stage-c', G.U.TYPE_COLOR[mon.types[0]]);
    G.UI.show('scr-result');
  }

  /** Abre la rejilla de starters. `fromMenu` = cambiar compañero inicial más tarde. */
  function openStarters() {
    picked = null;
    $('starter-ok').disabled = true;
    $('starter-info').textContent = 'Selecciona un Pokémon';
    const grid = $('starter-grid');
    grid.innerHTML = '';
    for (const s of G.STARTERS) {
      const mon = G.DEX_BY[s.dex];
      const cell = document.createElement('div');
      cell.className = 'cell' + (result && s.dex === result.dex ? ' on' : '');
      cell.appendChild(G.UI.spriteCanvas(s.dex, 92, 80, { scale: 2 }));
      cell.insertAdjacentHTML('beforeend', `<b>${mon.name}</b>`);
      cell.onclick = () => {
        grid.querySelectorAll('.cell').forEach(c => c.classList.remove('on'));
        cell.classList.add('on');
        picked = s.dex;
        const mv = G.Moves.BY_ID[s.start];
        $('starter-info').innerHTML = `${G.UI.typeChips(mon.types)} ${G.Icons.html('move:' + s.start, 16)} ${mv.name} · ${s.traits.join(', ')}`;
        $('starter-ok').disabled = false;
      };
      if (result && s.dex === result.dex) { picked = s.dex; $('starter-ok').disabled = false; }
      grid.appendChild(cell);
    }
    G.UI.show('scr-starters');
  }

  function choose(dex) {
    const save = G.DB.save;
    save.starter = dex;
    save.partner = dex;
    save.personality = result ? { trait: result.trait, scores } : null;
    G.DB.grant(dex, 'starter');
    G.DB.commit();
    G.UI.toast('¡' + G.DEX_BY[dex].name + ' se une a ti!');
    G.Flow.goMenu();
  }

  return { init, start };
})();
