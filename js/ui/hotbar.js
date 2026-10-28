/* Shared HUD/editor geometry. Indicator slots never register input handlers. */
G.Hotbar = {
  layout(w, h, n, mega, safe = {}, spot = null, reserve = n) {
    const left = (safe.left || 0) + 6, right = (safe.right || 0) + 6;
    const count = reserve + 1 + (mega ? 1 : 0), gap = 9, itemGap = 18;
    const gaps = itemGap + (reserve - 1 + (mega ? 1 : 0)) * gap;
    const size = Math.min(54, Math.floor((w - left - right - gaps) / count));
    const width = count * size + gaps;
    const x = G.U.clamp((spot ? spot[0] * w : w / 2) - width / 2, left, w - right - width);
    const bottom = h - size - 6 - (safe.bottom || 0);
    const y = G.U.clamp(spot ? spot[1] * h - size / 2 : bottom - 12, 24 + (safe.top || 0), bottom);
    const sx = x + size + itemGap;
    return { x, y, sx, size, gap, width, totalW: n * size + (n - 1) * gap,
      megaX: sx + n * (size + gap) };
  }
};
