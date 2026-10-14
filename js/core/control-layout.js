/* Shared geometry for HUD, touch controls and their placement editor.
 * Saved centers remain normalized to the full canvas, safe insets only move UI. */
G.ControlLayout = (() => {
  const S = 54, GAP = 9, ITEM_GAP = 18;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(Math.max(lo, hi), v));
  function center(x, y, width, height, w, h, sa, margin = 6, top = margin) {
    return { x: clamp(x, sa.left + margin + width / 2, w - sa.right - margin - width / 2),
             y: clamp(y, sa.top + top + height / 2, h - sa.bottom - margin - height / 2) };
  }
  function bar(w, h, sa, p, count = 4, reserved = count) {
    const total = count * S + (count - 1) * GAP;
    const width = S + ITEM_GAP + reserved * S + (reserved - 1) * GAP;
    const x = p ? p[0] * w : (w - total) / 2 - S - ITEM_GAP + width / 2;
    const y = p ? p[1] * h : h - sa.bottom - 18 - S / 2;
    const c = center(x, y, width, S, w, h, sa, 6, 24);
    return { x: c.x - width / 2, y: c.y - S / 2, width, height: S, attackX: c.x - width / 2 + S + ITEM_GAP };
  }
  function pause(w, h, sa, p) {
    const c = center(p ? p[0] * w : w - sa.right - 32, p ? p[1] * h : sa.top + 32, 40, 40, w, h, sa, 4, 10);
    return { x: c.x - 20, y: c.y - 20, width: 40, height: 40 };
  }
  function stick(w, h, sa, p, r) {
    return center(p[0] * w, p[1] * h, r * 2, r * 2, w, h, sa, 4);
  }
  return { S, GAP, ITEM_GAP, center, bar, pause, stick };
})();
