/* One coordinate space: the visible app area, in CSS pixels. The backing
 * store is only a rendering detail; input never uses physical pixels. */
G.Viewport = (() => {
  let canvas, root, probe, notify, metrics = null, raf = 0, timers = [];
  const listeners = new Set();
  const positive = n => Number.isFinite(n) && n > 0;

  function area(win, doc) {
    const vv = win.visualViewport;
    // Pinch zoom must magnify the existing layout, not relayout the game.
    if (vv && positive(vv.width) && positive(vv.height) && Math.abs((vv.scale || 1) - 1) < 0.01) {
      return { width: vv.width, height: vv.height, left: vv.offsetLeft || 0, top: vv.offsetTop || 0 };
    }
    return { width: win.innerWidth || doc.clientWidth, height: win.innerHeight || doc.clientHeight, left: 0, top: 0 };
  }

  function resolution(width, height, pixelRatio) {
    const dpr = Math.min(1.5, positive(pixelRatio) ? pixelRatio : 1);
    const bw = Math.max(1, Math.round(width * dpr)), bh = Math.max(1, Math.round(height * dpr));
    return { width, height, dpr, bw, bh, scaleX: bw / width, scaleY: bh / height };
  }

  function clientToLocal(clientX, clientY, rect, width, height) {
    if (!positive(rect.width) || !positive(rect.height)) return null;
    return { x: (clientX - rect.left) * width / rect.width,
             y: (clientY - rect.top) * height / rect.height };
  }

  function toLocal(event, element = canvas, width = metrics.width, height = metrics.height) {
    return clientToLocal(event.clientX, event.clientY, element.getBoundingClientRect(), width, height);
  }

  function readSafe() {
    const cs = getComputedStyle(probe);
    return { top: parseFloat(cs.paddingTop) || 0, right: parseFloat(cs.paddingRight) || 0,
             bottom: parseFloat(cs.paddingBottom) || 0, left: parseFloat(cs.paddingLeft) || 0 };
  }

  // Idempotent: never reset the canvas context or write styles when unchanged.
  function resize() {
    const a = area(window, document.documentElement);
    if (!positive(a.width) || !positive(a.height)) return false;
    for (const [k, v] of Object.entries({ width: a.width, height: a.height, left: a.left, top: a.top })) {
      const px = v + 'px';
      if (root.style[k] !== px) root.style[k] = px;
    }
    const rect = canvas.getBoundingClientRect();
    if (!positive(rect.width) || !positive(rect.height)) return false;
    const next = { ...resolution(rect.width, rect.height, window.devicePixelRatio), left: rect.left, top: rect.top, safe: readSafe() };
    const changed = !metrics || ['width', 'height', 'dpr', 'left', 'top'].some(k => next[k] !== metrics[k]) ||
      Object.keys(next.safe).some(k => next.safe[k] !== metrics.safe[k]);
    if (canvas.width !== next.bw) canvas.width = next.bw;
    if (canvas.height !== next.bh) canvas.height = next.bh;
    if (!changed) return false;
    metrics = next;
    notify(next);
    listeners.forEach(fn => fn(next));
    return true;
  }

  function queue() {
    if (!raf) raf = requestAnimationFrame(() => { raf = 0; resize(); });
  }

  // WebKit can settle in several stages after rotation/restoring a Web App.
  // Coalesce event bursts; all delayed revalidation lives here.
  function refresh() {
    queue();
    timers.forEach(clearTimeout);
    timers = [120, 400].map(ms => setTimeout(queue, ms));
  }

  function init(cv, onResize) {
    canvas = cv; root = document.getElementById('app'); notify = onResize;
    probe = document.createElement('div');
    probe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;' +
      'padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
    root.appendChild(probe);
    resize();
    for (const ev of ['resize', 'orientationchange', 'pageshow']) addEventListener(ev, refresh);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', refresh);
      window.visualViewport.addEventListener('scroll', refresh);
    }
    if (typeof ResizeObserver !== 'undefined') {
      new ResizeObserver(() => {
        const r = canvas.getBoundingClientRect();
        // Observe CSS geometry, never the backing store. Write on the next frame.
        if (!metrics || r.width !== metrics.width || r.height !== metrics.height) queue();
      }).observe(canvas);
    }
    refresh();
  }

  return { init, resize, refresh, area, resolution, clientToLocal, toLocal,
    on(fn) { listeners.add(fn); }, get size() { return metrics; },
    safeArea() { return metrics.safe; } };
})();
