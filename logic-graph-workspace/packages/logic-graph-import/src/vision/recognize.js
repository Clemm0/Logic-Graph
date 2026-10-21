// The recognizer pipeline: image -> netlist text.

import { dilateErase, findHoles, foregroundMask, labelComponents, rowEdges, runLengths, strokeWidth } from './image.js';
import { classify, detectArc, holeMask } from './shapes.js';

/* ═══════════════════════════ Local circuit recognizer ═══════════════════════════
   A small classical computer-vision pipeline (no model, no network):
   1. find the ink (anything clearly different from the background colour)
   2. holes enclosed by ink = candidate gate bodies / bubbles / boxes
   3. classify holes by comparing their shape with templates (AND, OR, triangle, box)
   4. detect negation bubbles and the extra curve of XOR
   5. erase gates, bubbles and boxes: what is left are wires (crossings without a dot stay separate)
   6. read which wires touch which gate pins and build the netlist
   Works best on clean, high-contrast schematics (like the PNG export of Logic Graph).
   Signal names are not read (there is no OCR): inputs become a, b, c ... */

export const LETTERS = 'abcdefghijklmnopqrstuvwxz'.split('');

export const TYPE_OF = { AND: ['AND', 'NAND'], OR: ['OR', 'NOR'], XOR: ['XOR', 'XNOR'], BUF: ['BUF', 'NOT'] };

export const DUAL = { AND: 'OR', OR: 'AND', BUF: 'BUF' };

export function recognize(img) {
  const notes = [];
  const { width: W, height: H } = img;
  const fg = foregroundMask(img);
  const sw = strokeWidth(fg, W, H);
  const { holeId, holes } = findHoles(fg, W, H);

  /* 1. classify holes */
  const gates = [], smalls = [];
  let unknown = 0;
  const cls = holes.map(hole => (hole && hole.area >= 5 ? classify(holeMask(hole, holeId, W)) : null));
  // the biggest clean gate-shaped hole tells us the drawing scale
  let gateRef = 0;
  holes.forEach((hole, i) => { if (hole && cls[i] && ['AND', 'OR', 'BUF'].includes(cls[i].shape) && cls[i].score >= 0.85 && hole.area > gateRef) gateRef = hole.area; });
  const gateMin = Math.max(30 * sw * sw, 0.2 * gateRef);
  holes.forEach((hole, i) => {
    if (!hole || !cls[i]) return;
    const { shape, score } = cls[i];
    if (shape === 'DOT' && score >= 0.8 && (!gateRef || hole.area <= 0.2 * gateRef)) { smalls.push(hole); return; }
    if (hole.area < gateMin || hole.w < 6 * sw || hole.h < 6 * sw) return;
    if (shape === 'BOX' && gateRef && hole.area > 0.7 * gateRef) { unknown++; return; }   // a loop of wires, not an I/O box
    if (score >= 0.78 && shape !== 'DOT') gates.push({ hole, shape, score, edges: rowEdges(hole, holeId, W), outBubble: false, inBubbles: [] });
    else unknown++;
  });
  const boxes = gates.filter(g => g.shape === 'BOX');
  const real = gates.filter(g => g.shape !== 'BOX');
  if (!real.length) return { text: '', lines: [], notes: ['No gates found. Use a clean, high-contrast picture with standard gate shapes.'], stats: { gates: 0 } };
  if (unknown) notes.push(`${unknown} closed shape(s) did not look like a gate and were ignored.`);

  /* 2. bubbles and XOR arcs */
  const bubbles = smalls.filter(b => b.w / b.h > 0.6 && b.w / b.h < 1.7 && b.area / (b.w * b.h) > 0.55);
  const used = new Set();
  real.forEach(g => {
    const { hole, edges } = g;
    bubbles.forEach(b => {
      if (used.has(b) || b.area > 0.15 * hole.area) return;
      const row = Math.min(hole.y1, Math.max(hole.y0, Math.round(b.cy))) - hole.y0;
      const gapOut = b.x0 - edges.xr[row], gapIn = edges.xl[row] - b.x1, tol = 0.8 * b.w + 3 * sw + 3;
      if (Math.abs(b.cy - hole.cy) <= 0.28 * hole.h && gapOut <= tol && gapOut >= -3) { g.outBubble = true; g.bubble = b; used.add(b); }
      else if (b.cy >= hole.y0 - sw && b.cy <= hole.y1 + sw && gapIn <= tol + 0.2 * hole.w && gapIn >= -3 && b.cx < hole.cx) { g.inBubbles.push(b); used.add(b); }
    });
    g.arc = (g.shape === 'OR') ? detectArc(g, fg, W, sw) : 0;
    if (g.arc) g.shape = 'XOR';
  });

  /* 3. erase everything that is not a wire */
  const ink = fg.slice(), R = sw + 2;
  real.forEach(g => dilateErase(ink, g.hole.id, holeId, g.hole, W, H, R));
  bubbles.forEach(b => { if (used.has(b)) dilateErase(ink, b.id, holeId, b, W, H, R); });
  real.filter(g => g.arc).forEach(g => {
    const { hole, edges } = g;
    for (let y = Math.max(0, hole.y0 - sw); y <= Math.min(H - 1, hole.y1 + sw); y++) {
      const k = Math.min(hole.y1, Math.max(hole.y0, y)) - hole.y0, xa = edges.xl[k] - g.arc;
      for (let x = Math.max(0, xa - sw - 1); x <= Math.min(W - 1, xa + sw + 1); x++) ink[y * W + x] = 0;
    }
  });
  // solid blobs (filled I/O boxes, big dots): not wires
  { const { comp, stats } = labelComponents(ink, W, H);
    stats.slice(1).forEach(st => {
      const bw = st.x1 - st.x0 + 1, bh = st.y1 - st.y0 + 1;
      if (bw >= 5 * sw && bh >= 5 * sw && st.area >= 30 * sw * sw && st.area / (bw * bh) > 0.8) for (let y = st.y0; y <= st.y1; y++) for (let x = st.x0; x <= st.x1; x++) if (comp[y * W + x] === st.id) ink[y * W + x] = 0;
    }); }

  /* 4. wire crossings without a dot: cut, then reconnect straight through */
  const crossings = [];
  { const rl = runLengths(ink, W, H), arm = 2 * sw + 3, rad = 2 * sw, cand = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!ink[i] || rl.L[i] - 1 < arm || rl.R[i] - 1 < arm || rl.U[i] - 1 < arm || rl.D[i] - 1 < arm) continue;
      let c = 0, t = 0;
      for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) {
        if (dx * dx + dy * dy > rad * rad) continue;
        const xx = x + dx, yy = y + dy; t++;
        if (xx >= 0 && yy >= 0 && xx < W && yy < H && ink[yy * W + xx]) c++;
      }
      if (c / t < 0.7) cand[i] = 1;
    }
    const seen = new Uint8Array(W * H);
    for (let s0 = 0; s0 < W * H; s0++) {
      if (!cand[s0] || seen[s0]) continue;
      const st = [s0]; seen[s0] = 1; let sx = 0, sy = 0, k = 0;
      while (st.length) {
        const i = st.pop(), x = i % W, y = (i / W) | 0; sx += x; sy += y; k++;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue; const j = yy * W + xx; if (cand[j] && !seen[j]) { seen[j] = 1; st.push(j); } }
      }
      crossings.push({ x: Math.round(sx / k), y: Math.round(sy / k) });
    }
    const rc = Math.ceil(2 * sw + 1);
    crossings.forEach(c => { for (let dy = -rc; dy <= rc; dy++) for (let dx = -rc; dx <= rc; dx++) { const xx = c.x + dx, yy = c.y + dy; if (dx * dx + dy * dy <= rc * rc && xx >= 0 && yy >= 0 && xx < W && yy < H) ink[yy * W + xx] = 0; } });
    crossings.rc = rc; }

  /* 5. wire components */
  const { comp, stats } = labelComponents(ink, W, H);
  stats.slice(1).forEach(st => {
    const bw = st.x1 - st.x0 + 1, bh = st.y1 - st.y0 + 1;
    if (st.area < Math.max(8, 3 * sw * sw) || (bw < 5 * sw && bh < 5 * sw)) for (let y = st.y0; y <= st.y1; y++) for (let x = st.x0; x <= st.x1; x++) if (comp[y * W + x] === st.id) { comp[y * W + x] = 0; ink[y * W + x] = 0; }
  });
  const uf = new Map();
  const find = a => {
    let r = a;
    while (uf.has(r) && uf.get(r) !== r) r = uf.get(r);
    while (a !== r) { const nx = uf.get(a); uf.set(a, r); a = nx; }
    return r;
  };
  const union = (a, b) => { if (!a || !b) return; const ra = find(a), rb = find(b); if (ra !== rb) uf.set(ra, rb); };
  const near = (x, y, dx, dy) => { for (let k = 0; k <= 4; k++) { const xx = x + dx * k, yy = y + dy * k; if (xx >= 0 && yy >= 0 && xx < W && yy < H && comp[yy * W + xx]) return comp[yy * W + xx]; } return 0; };
  crossings.forEach(c => { const d = crossings.rc + 1;
    union(near(c.x, c.y - d, 0, -1), near(c.x, c.y + d, 0, 1));
    union(near(c.x - d, c.y, -1, 0), near(c.x + d, c.y, 1, 0)); });
  const rl = runLengths(ink, W, H);
  const minRun = Math.max(6 * sw, 10);

  /* 6. pins: which wire touches the left (inputs) and right (output) of each gate */
  const pinsOf = (g, side) => {
    const { hole, edges } = g, hits = [];
    const bub = side < 0 ? g.inBubbles.length ? Math.max(...g.inBubbles.map(b => b.w)) : 0 : g.outBubble ? g.bubble.w : 0;
    const lim = 3 * sw + 8 + bub + (side < 0 ? g.arc + 3 * sw : 0) + Math.round(0.3 * hole.w);
    const y0 = side < 0 ? hole.y0 - sw : Math.round(hole.cy - 0.25 * hole.h), y1 = side < 0 ? hole.y1 + sw : Math.round(hole.cy + 0.25 * hole.h);
    for (let y = Math.max(0, y0); y <= Math.min(H - 1, y1); y++) {
      const k = Math.min(hole.y1, Math.max(hole.y0, y)) - hole.y0;
      let x = side < 0 ? edges.xl[k] - 1 : edges.xr[k] + 1;
      for (let d = 0; d <= lim && x >= 0 && x < W; d++, x += side) {
        const i = y * W + x;
        if (comp[i]) {
          const run = side < 0 ? rl.L[i] : rl.R[i];
          const vertical = rl.U[i] + rl.D[i] - 1;            // a corner of another wire runs vertically through its end
          if (run >= minRun && vertical <= 2 * sw + 2) hits.push({ y, c: find(comp[i]) });
          break;
        }
      }
    }
    const pins = [];
    hits.forEach(h => { const last = pins[pins.length - 1]; if (last && last.c === h.c && h.y - last.y1 <= 1) { last.y1 = h.y; } else pins.push({ c: h.c, y0: h.y, y1: h.y }); });
    return pins.map(p => ({ c: p.c, y: (p.y0 + p.y1) / 2 }));
  };
  real.forEach(g => { g.inPins = pinsOf(g, -1); g.outPins = pinsOf(g, 1); });

  /* 7. netlist */
  const driver = new Map();      // net -> gate
  const netGates = [];
  real.sort((a, b) => a.hole.x0 - b.hole.x0 || a.hole.y0 - b.hole.y0);
  real.forEach(g => {
    if (!g.outPins.length) { notes.push(`A gate near (${Math.round(g.hole.cx)},${Math.round(g.hole.cy)}) has no readable output wire and was skipped.`); return; }
    if (!g.inPins.length) { notes.push(`A gate near (${Math.round(g.hole.cx)},${Math.round(g.hole.cy)}) has no readable input wires and was skipped.`); return; }
    g.outNet = g.outPins.sort((a, b) => Math.abs(a.y - g.hole.cy) - Math.abs(b.y - g.hole.cy))[0].c;
    if (driver.has(g.outNet)) { notes.push('Two gates seem to drive the same wire (a wire crossing may have been mistaken for a connection); one was skipped.'); return; }
    driver.set(g.outNet, g); netGates.push(g);
  });
  // name the nets
  const consumed = new Set();
  netGates.forEach(g => g.inPins.forEach(p => consumed.add(p.c)));
  const leftmost = net => { let best = null; stats.slice(1).forEach(st => { if (find(st.id) === net && (!best || st.lx < best.lx)) best = st; }); return best ? best.ly : 0; };
  const inputs = [...consumed].filter(n => !driver.has(n)).sort((a, b) => leftmost(a) - leftmost(b));
  const outputs = netGates.filter(g => !consumed.has(g.outNet)).map(g => g.outNet);
  const name = new Map();
  inputs.forEach((n, i) => name.set(n, i < LETTERS.length ? LETTERS[i] : 'in' + (i + 1)));
  outputs.sort((a, b) => driver.get(a).hole.cy - driver.get(b).hole.cy).forEach((n, i) => name.set(n, outputs.length === 1 ? 'y' : 'y' + (i + 1)));
  let w = 0; netGates.forEach(g => { if (!name.has(g.outNet)) name.set(g.outNet, 'w' + (++w)); });

  const lines = []; let extra = 0;
  netGates.forEach(g => {
    let ins = g.inPins.slice().sort((a, b) => a.y - b.y);
    const bub = ins.map(p => g.inBubbles.some(b => Math.abs(b.cy - p.y) <= Math.max(6, 0.14 * g.hole.h)) ? 1 : 0);
    let shape = g.shape, out = g.outBubble ? 1 : 0;
    const names = ins.map(p => name.get(p.c));
    if (shape === 'XOR') { out ^= bub.reduce((a, b) => a + b, 0) & 1; }
    else if (bub.length && bub.every(b => b === 1)) { shape = DUAL[shape]; out ^= 1; }
    else bub.forEach((b, i) => { if (b) { const nn = 'n' + (++extra); lines.push(`(${names[i]}) NOT (${nn})`); names[i] = nn; } });
    if (shape === 'BUF' && names.length !== 1) { notes.push('A one-input gate was read with several inputs; skipped.'); return; }
    if (shape !== 'BUF' && names.length < 2) { notes.push(`A ${shape} gate was read with a single input wire; skipped.`); return; }
    lines.push(`(${names.join(',')}) ${TYPE_OF[shape][out]} (${name.get(g.outNet)})`);
  });
  if (boxes.length) notes.push(`${boxes.length} box(es) were treated as input/output boxes and ignored.`);
  notes.push('Signal names are not read from the picture; check the generated names and the wiring.');
  const debug = real.map(g => ({ shape: g.shape, x: Math.round(g.hole.cx), y: Math.round(g.hole.cy), w: g.hole.w, h: g.hole.h, outBubble: g.outBubble, nIn: g.inBubbles.length, inPins: (g.inPins || []).map(p => Math.round(p.y)), outPins: (g.outPins || []).map(p => Math.round(p.y)), arc: g.arc }));
  return { debug, text: lines.join('\n'), lines, notes, stats: { gates: netGates.length, inputs: inputs.length, outputs: outputs.length, strokeWidth: sw } };
}
