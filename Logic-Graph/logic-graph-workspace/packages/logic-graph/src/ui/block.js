// Renders a whole ```logic block (ties every part together).

import { finishRenderMath } from 'obsidian';
import { ANALYSIS_MAX_INPUTS } from '../core/constants.js';
import { nm } from '../core/latex.js';
import { buildExpressions } from '../core/minimize.js';
import { parse } from '../core/parser.js';
import { reduceCircuit } from '../core/reduce.js';
import { truthTable } from '../core/sim.js';
import { METHOD_LABEL } from '../core/synthesize.js';
import { parseSpacing } from '../settings/settings.js';
import { copy, toLatexSource, toMermaid } from './copy.js';
import { createDiagram } from './diagram.js';
import { h, math } from './dom.js';
import { renderHelp } from './help.js';
import { renderKmaps } from './kmap.js';
import { renderTable, tableToMarkdown } from './table.js';
import { createTiming } from './timing.js';

export function renderBlock(src, el, plugin) {
  const S = plugin.settings, app = plugin.app;
  const wrap = h('div', 'lg-wrap', el);
  let c;
  try { c = parse(src, { maxInputs: S.maxInputs, maxGates: S.maxGates }); }
  catch (e) { h('div', 'lg-error', wrap, e.message); return; }

  const O = c.opts;
  if (O.help) renderHelp(wrap, plugin);
  if (c.empty) return;

  const part = (name, def) => (O.hide.has(name) ? false : O.show.has(name) ? true : def);
  const analyzable = c.inputs.length <= ANALYSIS_MAX_INPUTS;
  const all = analyzable ? truthTable(c) : null;
  const exprs = buildExpressions(c, all);

  const bubbles = O.bubbles !== null ? O.bubbles : S.bubblePushing;
  const method = O.simplify !== null ? (O.simplify === 'off' ? null : O.simplify) : (S.expSimplify ? S.simplifyMethod : null);
  const compact = O.compact !== null ? O.compact : S.collapseDontCare;
  const view = O.timing || S.timingView;
  let delaySec = O.delay !== null ? O.delay : (S.delayEnabled ? S.delaySeconds : 0);
  if (O.timing && delaySec === 0) delaySec = 1;               // a @timing-* line implies delays
  const getDelay = () => (delaySec < 0 ? Math.random() * 5 : delaySec);
  const showGraph = delaySec !== 0 && (view === 'graph' || view === 'both') && part('timing', true);
  const anim = delaySec !== 0 && (view === 'animation' || view === 'both');
  const hspacing = parseSpacing(S.hSpacing) || { px: 90 };

  const inputState = {};
  c.inputs.forEach(n => { inputState[n] = 0; });
  const diagrams = [];
  let mainDiagram = null, timing = null, table = null, kmaps = null;

  function highlight() {
    const idx = c.inputs.reduce((a, n) => a * 2 + (inputState[n] ? 1 : 0), 0);
    if (table) table.markActive(idx);
    if (kmaps) kmaps.markActive(idx);
  }
  function setInputs(patch) {
    if (timing && mainDiagram && mainDiagram.sim.pending() === 0) timing.begin(mainDiagram.sim.vals);
    Object.assign(inputState, patch);
    diagrams.forEach(d => d.sim.setInputs(patch));
    highlight();
  }
  const toggle = n => setInputs({ [n]: inputState[n] ? 0 : 1 });
  const pickIndex = m => {
    const patch = {};
    c.inputs.forEach((n, k) => { patch[n] = (m >> (c.inputs.length - 1 - k)) & 1; });
    setInputs(patch);
  };
  const base = { app, hspacing, vgap: S.vSpacing, bubbles, anim, getDelay, onToggle: toggle };

  // 1. main diagram (+ timing graph)
  if (part('diagram', true)) {
    const holder = h('div', '', wrap);
    mainDiagram = createDiagram(c, holder, Object.assign({}, base, {
      title: 'Circuit', exportName: 'circuit',
      onChange: (sig, v) => { if (timing) timing.record(sig, v); },
    }));
    if (showGraph) {
      const kinds = {};
      c.inputs.forEach(n => { kinds[n] = 'in'; });
      c.outputs.forEach(n => { kinds[n] = 'out'; });
      timing = createTiming(holder, [...c.inputs, ...c.middles, ...c.outputs], kinds, app);
      timing.setLastVals(() => mainDiagram.sim.vals);
      timing.begin(mainDiagram.sim.vals);
    }
    diagrams.push(mainDiagram);
  }

  // 2. experimental: reduced circuit (checked against the original)
  if (method && part('diagram', true)) {
    if (!analyzable && method !== 'structural') {
      h('div', 'lg-note', wrap, `"${method}" needs at most ${ANALYSIS_MAX_INPUTS} inputs. "structural" works at any size.`);
    } else {
      let r = null;
      try { r = reduceCircuit(c, all, method); } catch (e) { h('div', 'lg-note', wrap, 'Reduction failed: ' + e.message); }
      if (r) {
        const chosen = method === 'best' ? ` (${r.method})` : '';
        Object.keys(r.consts).forEach(o => h('div', 'lg-note', wrap, `${o} reduces to the constant ${r.consts[o]}`));
        if (r.verified === 'FAILED') {
          h('div', 'lg-error', wrap, 'The reduced circuit did not match the original, so it is not shown. Please report this circuit.');
        } else if (r.circuit && !(r.method === 'structural' && r.after.gates >= r.before.gates)) {
          const check = r.verified === 'exact' ? 'checked on all inputs' : 'checked on 4096 random inputs';
          diagrams.push(createDiagram(r.circuit, wrap, Object.assign({}, base, {
            title: `Reduced, ${METHOD_LABEL[r.method]}${chosen}: ${r.before.gates} to ${r.after.gates} gates (${check})`,
            exportName: 'circuit-reduced',
          })));
          if (r.after.gates > r.before.gates) h('div', 'lg-note', wrap, 'This form has more gates than your circuit: two-level logic can be larger (parity/XOR circuits are the classic case). Try "structural" or "best".');
        } else if (r.method === 'structural') {
          h('div', 'lg-note', wrap, `No structural reduction found: ${r.before.gates} gates is already minimal for these rewrite rules (double NOT, NOT into NAND/NOR, merged cascades, absorption, shared gates, buffers).`);
        }
      }
    }
  }

  // 3. expressions
  if (part('expr', S.showExpr)) {
    const box = h('div', 'lg-expr', wrap);
    exprs.forEach(e => {
      const same = e.raw === e.min;
      if (e.raw && !same) math(`${nm(e.name)} = ${e.raw}`, h('div', 'lg-expr-row', box));
      if (e.min !== null) {
        const r2 = h('div', 'lg-expr-row', box);
        math(`${nm(e.name)} = ${e.min}`, r2);
        if (e.raw && !same) h('span', 'lg-expr-tag', r2, e.cov.exact === false ? ' simplified (near-minimal)' : ' simplified');
      } else if (!e.raw) {
        h('div', 'lg-note', box, `${e.name}: expression too long to display`);
      }
    });
    if (!analyzable) h('div', 'lg-note', box, `More than ${ANALYSIS_MAX_INPUTS} inputs: only the structural expression is shown.`);
    if (typeof finishRenderMath === 'function') finishRenderMath();
  }

  // 4. Karnaugh maps
  if (analyzable && part('kmap', S.showKmap)) {
    const kb = h('div', 'lg-kmap-wrap', wrap);
    kmaps = renderKmaps(kb, c, all, exprs, { app, onPick: pickIndex });
    if (typeof finishRenderMath === 'function') finishRenderMath();
  }

  // 5. truth table
  const showTable = part('table', S.showTable);
  if (analyzable && showTable) {
    table = renderTable(wrap, c, all, compact);
    table.trs.forEach((tr, i) => tr.addEventListener('click', () => {
      const patch = {};
      c.inputs.forEach(n => { const p = table.rows[i].pattern[n]; patch[n] = p === 'X' ? inputState[n] : p; });
      setInputs(patch);
    }));
  } else if (!analyzable && showTable) {
    h('div', 'lg-note', wrap, `Truth table hidden: more than ${ANALYSIS_MAX_INPUTS} inputs (2^${c.inputs.length} rows). The diagram is still interactive.`);
  }
  highlight();

  // 6. copy buttons
  const actions = h('div', 'lg-actions', wrap);
  const btn = (label, fn) => h('button', '', actions, label).addEventListener('click', () => copy(fn()));
  if (table) btn('Copy table (Markdown)', () => tableToMarkdown(table.colNames, table.rows.map(r => r.cells)));
  if (analyzable) btn('Copy expressions (LaTeX)', () => toLatexSource(exprs));
  btn('Copy diagram (Mermaid)', () => toMermaid(c));
}
