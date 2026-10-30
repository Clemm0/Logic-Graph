// Pixel-level steps: ink mask, stroke width, enclosed holes, components, run lengths.


export function foregroundMask(img) {
  const { width: W, height: H, data } = img;
  const n = W * H, r = new Uint8Array(n), g = new Uint8Array(n), b = new Uint8Array(n);
  for (let i = 0; i < n; i++) {                       // composite transparent pixels over white
    const a = data[i * 4 + 3] / 255;
    r[i] = data[i * 4] * a + 255 * (1 - a);
    g[i] = data[i * 4 + 1] * a + 255 * (1 - a);
    b[i] = data[i * 4 + 2] * a + 255 * (1 - a);
  }
  const hist = new Map();
  for (let i = 0; i < n; i += 3) {
    const k = ((r[i] >> 3) << 10) | ((g[i] >> 3) << 5) | (b[i] >> 3);
    hist.set(k, (hist.get(k) || 0) + 1);
  }
  let bestK = 0, bestC = -1;
  hist.forEach((c, k) => { if (c > bestC) { bestC = c; bestK = k; } });
  const br = ((bestK >> 10) << 3) + 4, bg = (((bestK >> 5) & 31) << 3) + 4, bb = ((bestK & 31) << 3) + 4;
  const fg = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    if (Math.max(Math.abs(r[i] - br), Math.abs(g[i] - bg), Math.abs(b[i] - bb)) > 60) fg[i] = 1;
  }
  return fg;
}

export function strokeWidth(fg, W, H) {
  const hist = new Array(17).fill(0);
  const count = len => { if (len >= 1 && len <= 16) hist[len]++; };
  for (let y = 0; y < H; y += 2) { let run = 0; for (let x = 0; x <= W; x++) { if (x < W && fg[y * W + x]) run++; else { count(run); run = 0; } } }
  for (let x = 0; x < W; x += 2) { let run = 0; for (let y = 0; y <= H; y++) { if (y < H && fg[y * W + x]) run++; else { count(run); run = 0; } } }
  let best = 2;
  for (let k = 2; k <= 16; k++) if (hist[k] > hist[best]) best = k;
  return hist[best] ? best : 1;
}

// Background regions not connected to the border = "holes" (inside gates, bubbles, boxes)
export function findHoles(fg, W, H) {
  const n = W * H, outer = new Uint8Array(n), stack = new Int32Array(n);
  let sp = 0;
  const push = i => { if (!fg[i] && !outer[i]) { outer[i] = 1; stack[sp++] = i; } };
  for (let x = 0; x < W; x++) { push(x); push((H - 1) * W + x); }
  for (let y = 0; y < H; y++) { push(y * W); push(y * W + W - 1); }
  while (sp) {
    const i = stack[--sp], x = i % W, y = (i / W) | 0;
    if (x > 0) push(i - 1); if (x < W - 1) push(i + 1); if (y > 0) push(i - W); if (y < H - 1) push(i + W);
  }
  const holeId = new Int32Array(n), holes = [null];
  for (let s0 = 0; s0 < n; s0++) {
    if (fg[s0] || outer[s0] || holeId[s0]) continue;
    const id = holes.length, hole = { id, area: 0, x0: W, y0: H, x1: 0, y1: 0 };
    holeId[s0] = id; sp = 0; stack[sp++] = s0;
    while (sp) {
      const i = stack[--sp], x = i % W, y = (i / W) | 0;
      hole.area++;
      if (x < hole.x0) hole.x0 = x; if (x > hole.x1) hole.x1 = x;
      if (y < hole.y0) hole.y0 = y; if (y > hole.y1) hole.y1 = y;
      const nb = [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1];
      for (const j of nb) if (j >= 0 && !fg[j] && !outer[j] && !holeId[j]) { holeId[j] = id; stack[sp++] = j; }
    }
    hole.w = hole.x1 - hole.x0 + 1; hole.h = hole.y1 - hole.y0 + 1;
    hole.cx = (hole.x0 + hole.x1) / 2; hole.cy = (hole.y0 + hole.y1) / 2;
    holes.push(hole);
  }
  return { holeId, holes };
}

/* ---- shape templates (same geometry the Logic Graph plugin draws) ---- */

// per-row left/right edge of a hole
export function rowEdges(hole, holeId, W) {
  const xl = [], xr = [];
  for (let y = hole.y0; y <= hole.y1; y++) {
    let l = -1, r = -1;
    for (let x = hole.x0; x <= hole.x1; x++) if (holeId[y * W + x] === hole.id) { if (l < 0) l = x; r = x; }
    xl.push(l); xr.push(r);
  }
  // fill gaps with the nearest valid row
  for (let i = 0; i < xl.length; i++) if (xl[i] < 0) { let k = i; while (k < xl.length && xl[k] < 0) k++; xl[i] = k < xl.length ? xl[k] : xl[i - 1]; xr[i] = k < xr.length ? xr[k] : xr[i - 1]; }
  return { xl, xr };
}

export function dilateErase(ink, id, holeId, hole, W, H, R) {
  const x0 = Math.max(0, hole.x0 - R), y0 = Math.max(0, hole.y0 - R), x1 = Math.min(W - 1, hole.x1 + R), y1 = Math.min(H - 1, hole.y1 + R);
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  let m = new Uint8Array(w * h);
  for (let y = hole.y0; y <= hole.y1; y++) for (let x = hole.x0; x <= hole.x1; x++) if (holeId[y * W + x] === id) m[(y - y0) * w + (x - x0)] = 1;
  for (let it = 0; it < R; it++) {
    const nm = m.slice();
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (m[y * w + x]) continue;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx >= 0 && yy >= 0 && xx < w && yy < h && m[yy * w + xx]) { nm[y * w + x] = 1; dy = 2; break; }
      }
    }
    m = nm;
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (m[y * w + x]) ink[(y + y0) * W + (x + x0)] = 0;
}

export function runLengths(ink, W, H) {
  const n = W * H, L = new Uint16Array(n), R = new Uint16Array(n), U = new Uint16Array(n), D = new Uint16Array(n);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; if (ink[i]) { L[i] = (x ? L[i - 1] : 0) + 1; U[i] = (y ? U[i - W] : 0) + 1; } }
  for (let y = H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) { const i = y * W + x; if (ink[i]) { R[i] = (x < W - 1 ? R[i + 1] : 0) + 1; D[i] = (y < H - 1 ? D[i + W] : 0) + 1; } }
  return { L, R, U, D };
}

export function labelComponents(ink, W, H) {
  const n = W * H, comp = new Int32Array(n), stack = new Int32Array(n), stats = [null];
  for (let s0 = 0; s0 < n; s0++) {
    if (!ink[s0] || comp[s0]) continue;
    const id = stats.length, st = { id, area: 0, x0: W, y0: H, x1: 0, y1: 0, lx: W, ly: 0 };
    let sp = 0; comp[s0] = id; stack[sp++] = s0;
    while (sp) {
      const i = stack[--sp], x = i % W, y = (i / W) | 0;
      st.area++;
      if (x < st.x0) st.x0 = x; if (x > st.x1) st.x1 = x; if (y < st.y0) st.y0 = y; if (y > st.y1) st.y1 = y;
      if (x < st.lx || (x === st.lx && y > st.ly)) { st.lx = x; st.ly = y; }
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        const j = yy * W + xx;
        if (ink[j] && !comp[j]) { comp[j] = id; stack[sp++] = j; }
      }
    }
    stats.push(st);
  }
  return { comp, stats };
}
