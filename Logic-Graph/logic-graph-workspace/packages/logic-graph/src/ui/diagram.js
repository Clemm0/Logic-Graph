// The interactive circuit diagram (wires, gates, bubbles, lamps, bit sprites).

import { baseRep, bubbleForms, matchedBubbleNets } from '../core/bubbles.js';
import { createSim } from '../core/sim.js';
import { h, later, s } from './dom.js';
import { addExportButton } from './export-image.js';
import { ANIM_MS, BUBBLE_R, GATE_W, LEFT, gatePath, layout, planRoutes, solveGap, wireChannel } from './layout.js';

// ctx: { title, app, exportName, hspacing:{px}|{pct}, vgap, bubbles, anim, getDelay, onToggle(name), onChange(sig,v) }
export function createDiagram(c, parent, ctx) {
  const flips = new Set();            // gates flipped by hand in bubble view
  let reps = null, matched = new Set();
  const computeReps = () => { if (ctx.bubbles) { reps = bubbleForms(c, flips); matched = matchedBubbleNets(c, reps); } };
  computeReps();
  const repOf = g => (reps ? reps.get(g) : baseRep(g));
  const fan = {};
  c.gates.forEach(g => g.ins.forEach(n => { fan[n] = (fan[n] || 0) + 1; }));

  const sim = createSim(c, ctx.getDelay,
    (sig, v) => { paint(); spawn(sig, v); if (ctx.onChange) ctx.onChange(sig, v); },
    () => paint());

  const box = h('div', 'lg-diagram', parent);
  const head = h('div', 'lg-title', box);
  h('span', '', head, ctx.title || 'Circuit');
  let svgEl = null;
  if (ctx.bubbles) {
    h('span', 'lg-muted-text', head, '  click a gate to flip its symbol ');
    h('button', 'lg-small', head, 'reset').addEventListener('click', () => { flips.clear(); computeReps(); draw(); paint(); });
  }
  addExportButton(head, ctx.app, () => svgEl, ctx.exportName || 'circuit');
  const scroll = h('div', 'lg-scroll', box);
  let hgap = ctx.hspacing.px || 90;
  let wires = [], dots = [], inBoxes = {}, outBoxes = {}, lamps = [], sprites = [], spriteLayer = null, raf = 0;

  function draw() {
    scroll.textContent = '';
    wires = []; dots = []; inBoxes = {}; outBoxes = {}; lamps = []; sprites = [];
    let L = layout(c, { hgap, vgap: ctx.vgap });
    const plan = planRoutes(c, L, hgap);
    if (plan.lanes) L = layout(c, { hgap, vgap: ctx.vgap, topPad: 8 + 6 * plan.lanes });   // room for the detour lanes
    const svg = s('svg', { class: 'lg-svg', viewBox: `0 0 ${L.width} ${L.height}`, width: L.width, height: L.height }, scroll);
    svgEl = svg;
    if (ctx.hspacing.pct > 100) svg.style.maxWidth = 'none';
    const wireLayer = s('g', {}, svg);
    const gateLayer = s('g', {}, svg);
    spriteLayer = s('g', {}, svg);
    const srcPoint = n => (c.driver[n]
      ? { x: c.driver[n].x0 + GATE_W, y: c.driver[n].cy }
      : { x: LEFT, y: L.cy[n] });
    const addWire = (sig, d) => wires.push({ sig, el: s('path', { class: 'lg-wire', d }, wireLayer) });

    // wires into gates (+ input bubbles)
    c.order.forEach(g => {
      const r = repOf(g), n = g.ins.length;
      g.ins.forEach((sig, i) => {
        const a = srcPoint(sig);
        const py = g.cy - g.H / 2 + g.H * (i + 1) / (n + 1);
        const mx = wireChannel(g, i, hgap);
        const endx = r.ins[i] ? g.x0 - 2 * BUBBLE_R : g.x0;
        const route = plan.routes.get(g.out + ':' + i);
        if (route) {
          const ly = 6 + 6 * route.lane, c1 = a.x + 20 + 4 * (route.lane % 3);   // not at +10: that is where fan-out dots sit
          addWire(sig, `M${a.x},${a.y} H${c1} V${ly} H${mx} V${py} H${endx}`);
        } else {
          addWire(sig, `M${a.x},${a.y} H${mx} V${py} H${endx}`);
        }
        if (r.ins[i]) {
          s('circle', { class: 'lg-bubble' + (matched.has(sig) ? ' match' : ''), cx: g.x0 - BUBBLE_R, cy: py, r: BUBBLE_R }, gateLayer);
        }
      });
    });
    Object.keys(fan).forEach(n => {
      if (fan[n] > 1) {
        const a = srcPoint(n);
        dots.push({ sig: n, el: s('circle', { class: 'lg-dot', cx: a.x + 10, cy: a.y, r: 3.5 }, wireLayer) });
      }
    });

    // inputs
    c.inputs.forEach(n => {
      const y = L.cy[n];
      s('text', { class: 'lg-label', x: LEFT - 30, y: y + 4, 'text-anchor': 'end' }, gateLayer, n);
      const rect = s('rect', { class: 'lg-box in', x: LEFT - 24, y: y - 10, width: 24, height: 20, rx: 4 }, gateLayer);
      const text = s('text', { class: 'lg-boxtext', x: LEFT - 12, y: y + 4, 'text-anchor': 'middle' }, gateLayer, '0');
      rect.addEventListener('click', () => ctx.onToggle(n));
      inBoxes[n] = { rect, text };
    });

    // gates
    c.order.forEach(g => {
      const r = repOf(g);
      const grp = s('g', { transform: `translate(${g.x0},${g.cy - g.H / 2})` }, gateLayer);
      const flippable = ctx.bubbles && !r.fixed;
      const body = s('path', { class: 'lg-gate' + (flippable ? ' flip' : ''), d: gatePath(r.shape, g.H) }, grp);
      if (flippable) body.addEventListener('click', () => { if (flips.has(g)) flips.delete(g); else flips.add(g); computeReps(); draw(); paint(); });
      if (r.shape === 'XOR') s('path', { class: 'lg-gate-extra', d: `M-7,0 Q7,${g.H / 2} -7,${g.H}` }, grp);
      if (r.out) {
        s('circle', { class: 'lg-bubble' + (matched.has(g.out) ? ' match' : ''), cx: 52 + BUBBLE_R, cy: g.H / 2, r: BUBBLE_R }, grp);
        addWire(g.out, `M${g.x0 + 52 + 2 * BUBBLE_R},${g.cy} H${g.x0 + GATE_W}`);
      } else {
        addWire(g.out, `M${g.x0 + 52},${g.cy} H${g.x0 + GATE_W}`);
      }
      s('text', { class: 'lg-muted', x: 26, y: g.H + 12, 'text-anchor': 'middle' }, grp, g.type);
      if (c.used.has(g.out)) s('text', { class: 'lg-muted', x: GATE_W + 4, y: g.H / 2 - 7 }, grp, g.out);
      if (ctx.anim) lamps.push({ g, body, el: s('circle', { class: 'lg-lamp v0', cx: 26, cy: -9, r: 4.5 }, grp) });
    });

    // primary outputs
    c.outputs.forEach(n => {
      const g = c.driver[n], x = g.x0 + GATE_W;
      addWire(n, `M${x},${g.cy} H${x + 20}`);
      const rect = s('rect', { class: 'lg-box', x: x + 20, y: g.cy - 10, width: 24, height: 20, rx: 4 }, gateLayer);
      const text = s('text', { class: 'lg-boxtext', x: x + 32, y: g.cy + 4, 'text-anchor': 'middle' }, gateLayer, '0');
      s('text', { class: 'lg-label', x: x + 52, y: g.cy + 4 }, gateLayer, n);
      outBoxes[n] = { rect, text };
    });
  }

  function paint() {
    const v = sim.vals;
    wires.forEach(w => w.el.classList.toggle('on', !!v[w.sig]));
    dots.forEach(d => d.el.classList.toggle('on', !!v[d.sig]));
    const setBox = (b, val) => {
      b.rect.classList.toggle('on', !!val);
      b.text.classList.toggle('on', !!val);
      b.text.textContent = String(val);
    };
    c.inputs.forEach(n => { if (inBoxes[n]) setBox(inBoxes[n], v[n]); });
    c.outputs.forEach(n => { if (outBoxes[n]) setBox(outBoxes[n], v[n]); });
    // animation mode: a gate that is working shows the value it is about to produce
    lamps.forEach(l => {
      const w = sim.working(l.g);
      const val = w !== null ? w : v[l.g.out];
      l.el.setAttribute('class', `lg-lamp ${val ? 'v1' : 'v0'}${w !== null ? ' work' : ''}`);
      const flippable = ctx.bubbles && !repOf(l.g).fixed;
      l.body.setAttribute('class', 'lg-gate' + (flippable ? ' flip' : '') + (w !== null ? (w ? ' w1' : ' w0') : ''));
    });
  }

  // little bits travelling along the wires of a signal that just changed
  function spawn(sig, v) {
    if (!ctx.anim || !spriteLayer || typeof requestAnimationFrame !== 'function') return;
    wires.forEach(w => {
      if (w.sig !== sig || sprites.length > 240) return;
      let len;
      try { len = w.el.getTotalLength(); } catch (e) { return; }
      if (!(len > 0)) return;
      const g = s('g', { class: 'lg-sprite v' + v }, spriteLayer);
      s('circle', { r: 6.5 }, g);
      s('text', { y: 3.5, 'text-anchor': 'middle' }, g, String(v));
      sprites.push({ el: g, path: w.el, len, t0: performance.now() });
    });
    if (!raf && sprites.length) raf = requestAnimationFrame(step);
  }
  function step(now) {
    raf = 0;
    for (let i = sprites.length - 1; i >= 0; i--) {
      const sp = sprites[i];
      const k = Math.min(1, Math.max(0, (now - sp.t0) / ANIM_MS));
      const pt = sp.path.getPointAtLength(k * sp.len);
      sp.el.setAttribute('transform', `translate(${pt.x},${pt.y})`);
      if (k >= 1) { sp.el.remove(); sprites.splice(i, 1); }
    }
    if (sprites.length) raf = requestAnimationFrame(step);
  }

  draw();
  paint();

  // "100%" spacing: stretch the horizontal gaps so the drawing spans that share of the width
  if (ctx.hspacing.pct && typeof ResizeObserver !== 'undefined') {
    let lastW = 0, pending = false;
    new ResizeObserver(entries => {
      const w = entries[0].contentRect.width;
      if (!w || Math.abs(w - lastW) < 2 || pending) return;
      lastW = w; pending = true;
      later(() => {
        pending = false;
        hgap = solveGap(c, ctx.vgap, w * ctx.hspacing.pct / 100);
        draw(); paint();
      });
    }).observe(scroll);
  }
  return { sim, paint, getSvg: () => svgEl };
}
