// Timing graph (waveforms).

import { h, later, s } from './dom.js';
import { addExportButton } from './export-image.js';

export function createTiming(parent, signals, kinds, app) {
  const box = h('div', 'lg-timing', parent);
  const head = h('div', 'lg-title', box);
  h('span', '', head, 'Timing graph');
  const clearBtn = h('button', 'lg-small', head, 'clear');
  const host = h('div', 'lg-scroll', box);
  let t0 = performance.now(), last = 0, hist = {}, queued = false, svgEl = null;
  let lastVals = () => ({});
  addExportButton(head, app, () => svgEl, 'timing-graph');

  const schedule = () => { if (!queued) { queued = true; later(() => { queued = false; draw(); }); } };
  function begin(vals) {
    t0 = performance.now(); last = 0; hist = {};
    signals.forEach(n => { hist[n] = [[0, vals[n]]]; });
    schedule();
  }
  function record(sig, v) {
    if (!hist[sig]) return;
    const t = (performance.now() - t0) / 1000;
    hist[sig].push([t, v]);
    last = Math.max(last, t);
    schedule();
  }
  function draw() {
    host.textContent = '';
    const W = 640, LBL = 84, RH = 22, PAD = 10;
    const T = Math.max(1, last * 1.1 + 0.2);
    const H = signals.length * RH + 28;
    const x = t => LBL + (t / T) * (W - LBL - PAD);
    const svg = s('svg', { class: 'lg-svg', viewBox: `0 0 ${W} ${H}`, width: W, height: H }, host);
    svgEl = svg;
    const step = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20].find(st => T / st <= 10) || 20;
    for (let t = 0; t <= T + 1e-9; t += step) {
      s('line', { class: 'lg-grid', x1: x(t), x2: x(t), y1: 4, y2: H - 18 }, svg);
      s('text', { class: 'lg-muted', x: x(t), y: H - 6, 'text-anchor': 'middle' }, svg, (Math.round(t * 100) / 100) + 's');
    }
    signals.forEach((n, i) => {
      const top = 6 + i * RH + 3, bot = 6 + i * RH + RH - 5;
      const y = v => (v ? top : bot);
      s('text', { class: 'lg-label', x: LBL - 8, y: bot, 'text-anchor': 'end' }, svg, n);
      const pts = hist[n] || [];
      if (!pts.length) return;
      let d = `M${x(pts[0][0])},${y(pts[0][1])}`;
      for (let k = 1; k < pts.length; k++) d += ` H${x(pts[k][0])} V${y(pts[k][1])}`;
      d += ` H${x(T)}`;
      s('path', { class: 'lg-wave ' + (kinds[n] || ''), d }, svg);
    });
  }
  clearBtn.addEventListener('click', () => begin(lastVals()));
  return { begin, record, setLastVals(fn) { lastVals = fn; } };
}
