// Karnaugh maps (SVG with group outlines).

import { cubeLatex } from '../core/minimize.js';
import { h, math, s } from './dom.js';
import { addExportButton } from './export-image.js';

export const KGRAY = k => (k === 0 ? [0] : k === 1 ? [0, 1] : [0, 1, 3, 2]);

export const KCOLORS = ['#e5484d', '#3b82f6', '#30a46c', '#f5a524', '#8e4ec6', '#12a594'];

// Positions (in Gray order) of a grid axis that a cube covers, as cyclic arcs.
// An arc that continues past the edge of the map (wrap-around) is split in two with `open` sides.
export function kmapArcs(cube, n, startVar, count) {
  const size = 1 << count, g = KGRAY(count), pos = [];
  for (let p = 0; p < size; p++) {
    let ok = true;
    for (let j = 0; j < count && ok; j++) {
      const bit = 1 << (n - 1 - (startVar + j));
      if (cube.mask & bit) continue;
      if (((cube.v & bit) ? 1 : 0) !== ((g[p] >> (count - 1 - j)) & 1)) ok = false;
    }
    if (ok) pos.push(p);
  }
  if (!pos.length) return [];
  if (pos.length === size) return [{ a: 0, b: size - 1, openA: false, openB: false }];
  const runs = [];
  let st = pos[0], prev = pos[0];
  for (let i = 1; i < pos.length; i++) {
    if (pos[i] === prev + 1) prev = pos[i]; else { runs.push([st, prev]); st = pos[i]; prev = pos[i]; }
  }
  runs.push([st, prev]);
  if (runs.length > 1 && runs[0][0] === 0 && runs[runs.length - 1][1] === size - 1) {
    return runs.map((r, i) => ({ a: r[0], b: r[1], openA: i === 0, openB: i === runs.length - 1 }));
  }
  return runs.map(r => ({ a: r[0], b: r[1], openA: false, openB: false }));
}

// Outline with optional open sides (square corners where a side is open, rounded otherwise)
export function outlinePath(x, y, w, hh, r, oL, oR, oT, oB) {
  const rTL = !oT && !oL ? r : 0, rTR = !oT && !oR ? r : 0, rBR = !oB && !oR ? r : 0, rBL = !oB && !oL ? r : 0;
  const d = [];
  if (!oT) d.push(`M${x + rTL},${y} L${x + w - rTR},${y}`);
  if (rTR) d.push(`M${x + w - rTR},${y} A${rTR},${rTR} 0 0 1 ${x + w},${y + rTR}`);
  if (!oR) d.push(`M${x + w},${y + rTR} L${x + w},${y + hh - rBR}`);
  if (rBR) d.push(`M${x + w},${y + hh - rBR} A${rBR},${rBR} 0 0 1 ${x + w - rBR},${y + hh}`);
  if (!oB) d.push(`M${x + w - rBR},${y + hh} L${x + rBL},${y + hh}`);
  if (rBL) d.push(`M${x + rBL},${y + hh} A${rBL},${rBL} 0 0 1 ${x},${y + hh - rBL}`);
  if (!oL) d.push(`M${x},${y + hh - rBL} L${x},${y + rTL}`);
  if (rTL) d.push(`M${x},${y + rTL} A${rTL},${rTL} 0 0 1 ${x + rTL},${y}`);
  return d.join(' ');
}

// Rectangles (grid units) that make up one group in one slice of the map.
export function kmapPieces(cube, n, gridVars, rowVars, colVars, extra, slice) {
  for (let j = 0; j < extra; j++) {
    const bit = 1 << (n - 1 - (gridVars + j));
    if (cube.mask & bit) continue;
    if (((cube.v & bit) ? 1 : 0) !== ((slice >> (extra - 1 - j)) & 1)) return [];
  }
  const rows = kmapArcs(cube, n, 0, rowVars), cols = kmapArcs(cube, n, rowVars, colVars);
  const out = [];
  rows.forEach(ra => cols.forEach(ca => out.push({
    r0: ra.a, r1: ra.b, c0: ca.a, c1: ca.b, oT: ra.openA, oB: ra.openB, oL: ca.openA, oR: ca.openB,
  })));
  return out;
}

export function renderKmaps(parent, c, all, exprs, ctx) {
  const n = c.inputs.length;
  if (n < 2 || n > 6) { h('div', 'lg-note', parent, 'Karnaugh maps are drawn for 2 to 6 inputs.'); return null; }
  const gridVars = Math.min(n, 4), rowVars = Math.floor(gridVars / 2), colVars = gridVars - rowVars, extra = n - gridVars;
  const nR = 1 << rowVars, nC = 1 << colVars;
  const CW = 46, CH = 38, LBLW = 64, HDRH = 44;
  const bits = (v, k) => (k ? v.toString(2).padStart(k, '0') : '');
  const cellIndex = (rg, cg, slice) => {
    let m = 0;
    const put = (val, startK, count) => { for (let j = 0; j < count; j++) m |= ((val >> (count - 1 - j)) & 1) << (n - 1 - (startK + j)); };
    put(rg, 0, rowVars); put(cg, rowVars, colVars); put(slice, gridVars, extra);
    return m;
  };
  const actives = [];

  exprs.forEach(e => {
    const blk = h('div', 'lg-kmap-block', parent);
    const head = h('div', 'lg-title', blk);
    h('span', '', head, `Karnaugh map: ${e.name}`);
    if (e.cov.const !== undefined) { h('div', 'lg-note', blk, `${e.name} is constant ${e.cov.const}`); return; }
    h('span', 'lg-muted-text', head, e.cov.exact ? '  minimal cover ' : '  near-minimal cover ');
    const svgs = [];
    addExportButton(head, ctx.app, () => svgs[0], 'karnaugh-' + e.name);
    const maps = h('div', 'lg-kmaps', blk);

    for (let slice = 0; slice < (1 << extra); slice++) {
      const holder = h('div', 'lg-kmap-holder', maps);
      const W = LBLW + nC * CW + 8, H = HDRH + nR * CH + 8;
      const svg = s('svg', { class: 'lg-svg lg-kmap', viewBox: `0 0 ${W} ${H}`, width: W, height: H }, holder);
      svgs.push(svg);
      s('line', { class: 'lg-kline', x1: 0, y1: 0, x2: LBLW, y2: HDRH }, svg);
      s('text', { class: 'lg-klabel', x: LBLW - 6, y: 15, 'text-anchor': 'end' }, svg, c.inputs.slice(rowVars, gridVars).join(''));
      s('text', { class: 'lg-klabel', x: 6, y: HDRH - 7 }, svg, c.inputs.slice(0, rowVars).join(''));
      KGRAY(colVars).forEach((cg, j) => s('text', { class: 'lg-kcode', x: LBLW + (j + 0.5) * CW, y: HDRH - 8, 'text-anchor': 'middle' }, svg, bits(cg, colVars)));
      KGRAY(rowVars).forEach((rg, i) => s('text', { class: 'lg-kcode', x: LBLW - 8, y: HDRH + (i + 0.5) * CH + 4, 'text-anchor': 'end' }, svg, bits(rg, rowVars)));

      KGRAY(rowVars).forEach((rg, i) => KGRAY(colVars).forEach((cg, j) => {
        const m = cellIndex(rg, cg, slice), val = all[m][e.name];
        const rect = s('rect', { class: 'lg-kcell', x: LBLW + j * CW, y: HDRH + i * CH, width: CW, height: CH }, svg);
        s('text', { class: 'lg-kval' + (val ? ' one' : ''), x: LBLW + (j + 0.5) * CW, y: HDRH + (i + 0.5) * CH + 5, 'text-anchor': 'middle' }, svg, String(val));
        rect.addEventListener('click', () => ctx.onPick(m));
        actives.push({ rect, m });
      }));

      e.cov.cover.forEach((cb, gi) => {
        const color = KCOLORS[gi % KCOLORS.length], inset = 3 + (gi % 3) * 3;
        kmapPieces(cb, n, gridVars, rowVars, colVars, extra, slice).forEach(p => {
          const x0 = LBLW + p.c0 * CW + (p.oL ? 0 : inset), x1 = LBLW + (p.c1 + 1) * CW - (p.oR ? 0 : inset);
          const y0 = HDRH + p.r0 * CH + (p.oT ? 0 : inset), y1 = HDRH + (p.r1 + 1) * CH - (p.oB ? 0 : inset);
          s('rect', { class: 'lg-kfill', x: x0, y: y0, width: x1 - x0, height: y1 - y0, rx: 8, fill: color }, svg);
          s('path', { class: 'lg-kgroup', d: outlinePath(x0, y0, x1 - x0, y1 - y0, 8, p.oL, p.oR, p.oT, p.oB), stroke: color }, svg);
        });
      });
      if (extra) s('text', { class: 'lg-kcode', x: W - 6, y: 14, 'text-anchor': 'end' }, svg, c.inputs.slice(gridVars).join('') + '=' + bits(slice, extra));
    }
    const legend = h('div', 'lg-legend', blk);
    e.cov.cover.forEach((cb, gi) => {
      const item = h('span', 'lg-legend-item', legend);
      h('span', 'lg-swatch', item).style.background = KCOLORS[gi % KCOLORS.length];
      math(cubeLatex(c, cb), item);
    });
  });
  return { markActive(idx) { actives.forEach(a => a.rect.classList.toggle('lg-kactive', a.m === idx)); } };
}
