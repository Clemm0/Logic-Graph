// Gate shape templates and the classifier that matches holes against them; XOR-arc detection.


export const GRID = 24;

export function polyMask(points) {
  const m = new Uint8Array(GRID * GRID);
  for (let gy = 0; gy < GRID; gy++) for (let gx = 0; gx < GRID; gx++) {
    const px = (gx + 0.5) / GRID, py = (gy + 0.5) / GRID;
    let inside = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const [xi, yi] = points[i], [xj, yj] = points[j];
      if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) inside = !inside;
    }
    m[gy * GRID + gx] = inside ? 1 : 0;
  }
  return m;
}

export const quad = (p0, c, p1, k = 14) => Array.from({ length: k }, (_, i) => { const t = (i + 1) / k; return [(1 - t) ** 2 * p0[0] + 2 * t * (1 - t) * c[0] + t * t * p1[0], (1 - t) ** 2 * p0[1] + 2 * t * (1 - t) * c[1] + t * t * p1[1]]; });

export const norm = pts => pts.map(([x, y]) => [x / 52, y / 44]);

export const TEMPLATES = (() => {
  const and = [[0, 0], [30, 0]];
  for (let a = -90; a <= 90; a += 10) and.push([30 + 22 * Math.cos(a * Math.PI / 180), 22 + 22 * Math.sin(a * Math.PI / 180)]);
  and.push([30, 44], [0, 44]);
  const or = [[0, 0], ...quad([0, 0], [32, 0], [52, 22]), ...quad([52, 22], [32, 44], [0, 44]), ...quad([0, 44], [14, 22], [0, 0])];
  return {
    AND: polyMask(norm(and)),
    OR: polyMask(norm(or)),
    BUF: polyMask(norm([[0, 0], [52, 22], [0, 44]])),
    BOX: polyMask([[0, 0], [1, 0], [1, 1], [0, 1]]),
    DOT: polyMask(Array.from({ length: 40 }, (_, i) => [0.5 + 0.5 * Math.cos(i * Math.PI / 20), 0.5 + 0.5 * Math.sin(i * Math.PI / 20)])),
  };
})();

export function holeMask(hole, holeId, W) {
  const m = new Uint8Array(GRID * GRID);
  for (let gy = 0; gy < GRID; gy++) for (let gx = 0; gx < GRID; gx++) {
    const x = Math.min(hole.x1, Math.floor(hole.x0 + (gx + 0.5) * hole.w / GRID));
    const y = Math.min(hole.y1, Math.floor(hole.y0 + (gy + 0.5) * hole.h / GRID));
    m[gy * GRID + gx] = holeId[y * W + x] === hole.id ? 1 : 0;
  }
  return m;
}

export function classify(mask) {
  let best = null, bs = 0;
  for (const k of Object.keys(TEMPLATES)) {
    let inter = 0, uni = 0;
    for (let i = 0; i < mask.length; i++) { const a = mask[i], b = TEMPLATES[k][i]; if (a && b) inter++; if (a || b) uni++; }
    const iou = uni ? inter / uni : 0;
    if (iou > bs) { bs = iou; best = k; }
  }
  return { shape: best, score: bs };
}

// OR-shaped body with a second curve a few pixels to its left = XOR / XNOR
export function detectArc(g, fg, W, sw) {
  const { hole, edges } = g;
  const lim = Math.max(4 * sw, Math.round(0.3 * hole.w)), body = 3 * sw + 1;
  let arc = 0, plain = 0; const offs = [];
  for (let y = Math.round(hole.y0 + 0.15 * hole.h); y <= Math.round(hole.y1 - 0.15 * hole.h); y++) {
    const xl = edges.xl[y - hole.y0];
    let x = xl - 1, k = 0;
    while (x >= 0 && fg[y * W + x] && k <= body) { x--; k++; }
    if (k > body) continue;                                   // wire running into the gate: ambiguous row
    let gap = 0;
    while (x >= 0 && !fg[y * W + x] && gap <= lim) { x--; gap++; }
    if (gap > lim) plain++;
    else if (x >= 0) { arc++; offs.push(xl - x); }
  }
  if (arc >= 5 && arc > plain) { offs.sort((a, b) => a - b); return offs[offs.length >> 1]; }
  return 0;
}
