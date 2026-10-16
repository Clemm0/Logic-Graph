'use strict';
const obsidian = require('obsidian');
const {
  Plugin, PluginSettingTab, Setting, Notice, FuzzySuggestModal,
  renderMath, finishRenderMath, requestUrl, arrayBufferToBase64,
} = obsidian;

/* ═══════════════════════════ Constants & settings ═══════════════════════════ */

const HARD_MAX_INPUTS = 32;
const HARD_MAX_GATES = 256;
const ANALYSIS_MAX_INPUTS = 12;   // truth table / K-map / simplification need 2^n rows
const MAX_GATE_FANIN = 6;
const ID_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

const DEFAULTS = {
  maxInputs: 12,
  maxGates: 64,
  showTable: true,
  showExpr: true,
  showKmap: false,
  collapseDontCare: false,
  delayEnabled: false,
  delaySeconds: 1,            // -1 = random 0..5 s per gate
  bubblePushing: false,
  expSimplify: false,         // experimental
  simplifyMethod: 'sop',      // sop | pos | nand | nor
  hSpacing: '90',             // "90" (px) or "100%" (spread over the page width)
  vSpacing: 16,
  apiKey: '',
  model: 'claude-sonnet-5-5',
};

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

function sanitizeSettings(raw) {
  const s = Object.assign({}, DEFAULTS, raw || {});
  s.maxInputs = clamp(Math.round(Number(s.maxInputs)) || DEFAULTS.maxInputs, 1, HARD_MAX_INPUTS);
  s.maxGates = clamp(Math.round(Number(s.maxGates)) || DEFAULTS.maxGates, 1, HARD_MAX_GATES);
  const d = Number(s.delaySeconds);
  s.delaySeconds = Number.isFinite(d) ? (d < 0 ? -1 : clamp(d, 0, 30)) : DEFAULTS.delaySeconds;
  const v = Number(s.vSpacing);
  s.vSpacing = Number.isFinite(v) ? clamp(Math.round(v), 0, 200) : DEFAULTS.vSpacing;
  if (!parseSpacing(s.hSpacing)) s.hSpacing = DEFAULTS.hSpacing;
  if (!['sop', 'pos', 'nand', 'nor'].includes(s.simplifyMethod)) s.simplifyMethod = 'sop';
  return s;
}

// "90" / "90px" -> {px:90};  "100%" -> {pct:100}
function parseSpacing(str) {
  const m = String(str).trim().match(/^(\d+(?:\.\d+)?)\s*(%|px)?$/i);
  if (!m) return null;
  const v = parseFloat(m[1]);
  return m[2] === '%' ? { pct: clamp(v, 10, 400) } : { px: clamp(Math.round(v), 40, 1000) };
}

/* ═══════════════════════════ Gate definitions ═══════════════════════════ */

const GATES = {
  AND:  { min: 2, shape: 'AND', inv: false, fn: v => v.every(x => x) },
  NAND: { min: 2, shape: 'AND', inv: true,  fn: v => !v.every(x => x) },
  OR:   { min: 2, shape: 'OR',  inv: false, fn: v => v.some(x => x) },
  NOR:  { min: 2, shape: 'OR',  inv: true,  fn: v => !v.some(x => x) },
  XOR:  { min: 2, shape: 'XOR', inv: false, fn: v => v.filter(x => x).length % 2 === 1 },
  XNOR: { min: 2, shape: 'XOR', inv: true,  fn: v => v.filter(x => x).length % 2 === 0 },
  NOT:  { min: 1, max: 1, shape: 'BUF', inv: true,  fn: v => !v[0] },
  BUF:  { min: 1, max: 1, shape: 'BUF', inv: false, fn: v => !!v[0] },
};
const SHAPE_FN = {
  AND: v => v.every(x => x),
  OR:  v => v.some(x => x),
  XOR: v => v.filter(x => x).length % 2 === 1,
  BUF: v => !!v[0],
};

/* ═══════════════════════════ Parser ═══════════════════════════ */

const PARTS = ['table', 'expr', 'diagram', 'kmap', 'timing'];

function applyDirective(line, n, o) {
  const m = line.match(/^@(\w+)\s*(.*)$/);
  if (!m) throw new Error(`Line ${n}: malformed directive`);
  const name = m[1].toLowerCase();
  const args = m[2].toLowerCase().split(/[,\s]+/).filter(Boolean);
  switch (name) {
    case 'hide':
    case 'show':
      if (!args.length) throw new Error(`Line ${n}: "@${name}" needs: ${PARTS.join(', ')}`);
      args.forEach(a => {
        if (!PARTS.includes(a)) throw new Error(`Line ${n}: cannot ${name} "${a}" (${PARTS.join(', ')})`);
        (name === 'hide' ? o.hide : o.show).add(a);
        (name === 'hide' ? o.show : o.hide).delete(a);
      });
      break;
    case 'simplify': {
      const a = args[0] || 'sop';
      if (a === 'off') o.simplify = 'off';
      else if (['sop', 'pos', 'nand', 'nor'].includes(a)) o.simplify = a;
      else throw new Error(`Line ${n}: "@simplify" takes sop, pos, nand, nor or off`);
      break;
    }
    case 'bubbles': o.bubbles = args[0] !== 'off'; break;
    case 'compact': o.compact = args[0] !== 'off'; break;
    case 'delay': {
      const a = args[0];
      if (a === 'off') o.delay = 0;
      else if (a === 'random') o.delay = -1;
      else {
        const x = Number(a);
        if (!a || !Number.isFinite(x) || x < -1 || x > 30) throw new Error(`Line ${n}: "@delay" takes seconds (0-30), random or off`);
        o.delay = x < 0 ? -1 : x;
      }
      break;
    }
    default: throw new Error(`Line ${n}: unknown directive "@${name}"`);
  }
}

// Orders gates topologically, finds outputs/middles. `inputs` may be given (synthesised circuits).
function assemble(gates, inputs) {
  const driver = {};
  gates.forEach(g => { driver[g.out] = g; });
  const used = new Set();
  gates.forEach(g => g.ins.forEach(x => used.add(x)));
  if (!inputs) {
    inputs = [];
    gates.forEach(g => g.ins.forEach(x => { if (!driver[x] && !inputs.includes(x)) inputs.push(x); }));
  }
  const known = new Set(inputs);
  const order = [];
  let pending = gates.slice();
  while (pending.length) {
    const ready = pending.filter(g => g.ins.every(x => known.has(x)));
    if (!ready.length) {
      throw new Error('Loop detected (combinational feedback) involving: ' + pending.map(g => g.out).join(', '));
    }
    ready.forEach(g => { known.add(g.out); order.push(g); });
    pending = pending.filter(g => !ready.includes(g));
  }
  const outputs = gates.map(g => g.out).filter(x => !used.has(x));
  const middles = gates.map(g => g.out).filter(x => used.has(x));
  return { gates, order, inputs, outputs, middles, driver, used };
}

// "(a,b) AND (c)"  ->  { type:'AND', ins:['a','b'], out:'c' }
function parse(src, limits) {
  limits = Object.assign({ maxInputs: DEFAULTS.maxInputs, maxGates: DEFAULTS.maxGates }, limits);
  const gates = [];
  const driver = {};
  const opts = { hide: new Set(), show: new Set(), simplify: null, bubbles: null, delay: null, compact: null };

  src.split('\n').forEach((raw, i) => {
    const line = raw.replace(/(#|\/\/).*$/, '').trim();
    if (!line) return;
    const n = i + 1;
    if (line[0] === '@') { applyDirective(line, n, opts); return; }

    const m = line.match(/^\(([^)]*)\)\s*([A-Za-z]+)\s*\(([^)]*)\)$/);
    if (!m) throw new Error(`Line ${n}: expected "(inputs) GATE (output)"`);

    const ins = m[1].split(/[,\s]+/).filter(Boolean);
    const outs = m[3].split(/[,\s]+/).filter(Boolean);
    const type = m[2].toUpperCase();
    const spec = GATES[type];

    if (!spec) throw new Error(`Line ${n}: unknown gate "${m[2]}". Available: ${Object.keys(GATES).join(', ')}`);
    if (outs.length !== 1) throw new Error(`Line ${n}: a gate needs exactly one output signal`);
    if (ins.length < spec.min) throw new Error(`Line ${n}: ${type} needs at least ${spec.min} input(s)`);
    if (spec.max && ins.length > spec.max) throw new Error(`Line ${n}: ${type} takes exactly ${spec.max} input`);
    if (ins.length > MAX_GATE_FANIN) throw new Error(`Line ${n}: at most ${MAX_GATE_FANIN} inputs per gate`);
    for (const x of [...ins, ...outs]) {
      if (!ID_RE.test(x)) throw new Error(`Line ${n}: invalid signal name "${x}"`);
    }
    const out = outs[0];
    if (ins.includes(out)) throw new Error(`Line ${n}: "${out}" feeds back into its own gate`);
    if (driver[out]) throw new Error(`Line ${n}: signal "${out}" is already driven by another gate`);
    if (gates.length >= limits.maxGates) {
      throw new Error(`Line ${n}: more than ${limits.maxGates} gates (raise "Max gates" in the plugin settings, up to ${HARD_MAX_GATES})`);
    }
    const gate = { type, ins, out, line: n };
    driver[out] = gate;
    gates.push(gate);
  });

  if (!gates.length) throw new Error('Empty circuit. Example: (a,b) AND (y)');
  const c = assemble(gates);
  if (c.inputs.length > limits.maxInputs) {
    throw new Error(`Too many inputs (${c.inputs.length}, max ${limits.maxInputs}). Raise "Max inputs" in the plugin settings (up to ${HARD_MAX_INPUTS}).`);
  }
  c.opts = opts;
  return c;
}

/* ═══════════════════════════ Evaluation ═══════════════════════════ */

function evaluate(c, inputVals) {
  const v = Object.assign({}, inputVals);
  c.order.forEach(g => { v[g.out] = +GATES[g.type].fn(g.ins.map(x => !!v[x])); });
  return v;
}

function truthTable(c) {
  const n = c.inputs.length;
  const rows = [];
  for (let i = 0; i < (1 << n); i++) {
    const ins = {};
    c.inputs.forEach((x, k) => { ins[x] = (i >> (n - 1 - k)) & 1; });
    rows.push(evaluate(c, ins));
  }
  return rows;
}

/* ═══════════════════════════ Delay simulation ═══════════════════════════ */

// Event-driven simulation with an inertial delay per gate (getDelay() -> seconds).
function createSim(c, getDelay, onChange) {
  const zero = {};
  c.inputs.forEach(n => { zero[n] = 0; });
  const vals = evaluate(c, zero);
  const timers = new Map();
  const consumers = {};
  c.gates.forEach(g => g.ins.forEach(n => { (consumers[n] = consumers[n] || []).push(g); }));

  function set(sig, v) {
    if (vals[sig] === v) return;
    vals[sig] = v;
    onChange(sig, v);
    (consumers[sig] || []).forEach(reeval);
  }
  function reeval(g) {
    const target = +GATES[g.type].fn(g.ins.map(x => !!vals[x]));
    const pend = timers.get(g);
    if (pend) { clearTimeout(pend); timers.delete(g); }
    if (target === vals[g.out]) return;
    const d = getDelay();
    if (!(d > 0)) { set(g.out, target); return; }
    timers.set(g, setTimeout(() => { timers.delete(g); set(g.out, target); }, d * 1000));
  }
  return {
    vals,
    setInputs(patch) { Object.keys(patch).forEach(n => set(n, patch[n])); },
    pending() { return timers.size; },
    dispose() { timers.forEach(t => clearTimeout(t)); timers.clear(); },
  };
}

/* ═══════════════════════════ Expressions (LaTeX) ═══════════════════════════ */

const nm = n => /^[A-Za-z]$/.test(n) ? n : `\\mathrm{${n.replace(/_/g, '\\_')}}`;

// Unsimplified expression following the circuit. p = precedence (OR 1 < XOR 2 < AND 3 < atom 5)
function rawLatex(c, sig) {
  const memo = new Map();
  const go = x => {
    if (memo.has(x)) return memo.get(x);
    const g = c.driver[x];
    let r;
    if (!g) r = { s: nm(x), p: 5 };
    else {
      const kids = g.ins.map(go);
      const join = (op, p) => kids.map(k => (k.p < p ? `\\left(${k.s}\\right)` : k.s)).join(op);
      const AND = () => join(' \\cdot ', 3), OR = () => join(' + ', 1), XOR = () => join(' \\oplus ', 2);
      switch (g.type) {
        case 'AND':  r = { s: AND(), p: 3 }; break;
        case 'OR':   r = { s: OR(), p: 1 }; break;
        case 'XOR':  r = { s: XOR(), p: 2 }; break;
        case 'NAND': r = { s: `\\overline{${AND()}}`, p: 5 }; break;
        case 'NOR':  r = { s: `\\overline{${OR()}}`, p: 5 }; break;
        case 'XNOR': r = { s: `\\overline{${XOR()}}`, p: 5 }; break;
        case 'NOT':  r = { s: `\\overline{${kids[0].s}}`, p: 5 }; break;
        default:     r = kids[0];
      }
    }
    if (r.s.length > 2000) throw new Error('too long');
    memo.set(x, r);
    return r;
  };
  return go(sig).s;
}

/* ═══════════════════════════ Quine–McCluskey ═══════════════════════════ */

const popcount = x => { let k = 0; while (x) { k += x & 1; x >>>= 1; } return k; };

// Prime implicants. v = fixed bits, mask = dash ("don't care") bits.
function primeImplicants(ones) {
  let cur = new Map(ones.map(m => [m + ':0', { v: m, mask: 0 }]));
  const primes = [];
  while (cur.size) {
    const groups = new Map();
    for (const t of cur.values()) {
      const k = t.mask + '|' + popcount(t.v);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(t);
    }
    const used = new Set(), next = new Map();
    for (const [k, list] of groups) {
      const [mask, p] = k.split('|').map(Number);
      const other = groups.get(mask + '|' + (p + 1));
      if (!other) continue;
      for (const a of list) for (const b of other) {
        const d = a.v ^ b.v;
        if (d && !(d & (d - 1))) {
          const t = { v: a.v & b.v, mask: a.mask | d };
          next.set(t.v + ':' + t.mask, t);
          used.add(a); used.add(b);
        }
      }
    }
    for (const t of cur.values()) if (!used.has(t)) primes.push(t);
    cur = next;
  }
  return primes;
}

// essential primes first, then greedy (near-minimal, not guaranteed optimal)
function chooseCover(primes, ones) {
  const covers = (p, m) => (m & ~p.mask) === p.v;
  const left = new Set(ones), chosen = [];
  ones.forEach(m => {
    const ps = primes.filter(p => covers(p, m));
    if (ps.length === 1 && !chosen.includes(ps[0])) chosen.push(ps[0]);
  });
  chosen.forEach(p => ones.forEach(m => { if (covers(p, m)) left.delete(m); }));
  while (left.size) {
    let best = null, bc = -1;
    primes.forEach(p => {
      if (chosen.includes(p)) return;
      let k = 0; left.forEach(m => { if (covers(p, m)) k++; });
      if (k > bc) { bc = k; best = p; }
    });
    chosen.push(best);
    [...left].forEach(m => { if (covers(best, m)) left.delete(m); });
  }
  return chosen.sort((a, b) => a.v - b.v || a.mask - b.mask);
}

// target 1: cover the ones (SOP). target 0: cover the zeros (used for POS / NOR-NOR).
function coverOf(all, out, target) {
  const idx = [];
  let count1 = 0;
  all.forEach((r, i) => {
    if (r[out]) count1++;
    if (r[out] === (target === 0 ? 0 : 1)) idx.push(i);
  });
  if (count1 === 0) return { const: 0 };
  if (count1 === all.length) return { const: 1 };
  return { ones: idx, cover: chooseCover(primeImplicants(idx), idx) };
}

function cubeLiterals(c, cube) {
  const n = c.inputs.length, out = [];
  c.inputs.forEach((name, k) => {
    const bit = 1 << (n - 1 - k);
    if (!(cube.mask & bit)) out.push({ name, neg: !(cube.v & bit) });
  });
  return out;
}
const litLatex = l => (l.neg ? `\\overline{${nm(l.name)}}` : nm(l.name));
const cubeLatex = (c, cube) => cubeLiterals(c, cube).map(litLatex).join(' \\cdot ');
const sopLatex = (c, cov) => (cov.const !== undefined ? String(cov.const) : cov.cover.map(cb => cubeLatex(c, cb)).join(' + '));

function buildExpressions(c, all) {
  return c.outputs.map(o => {
    let raw = null;
    try { raw = rawLatex(c, o); } catch (e) { raw = null; }
    if (raw && raw.length > 800) raw = null;
    let cov = null, min = null;
    if (all) { cov = coverOf(all, o, 1); min = sopLatex(c, cov); }
    return { name: o, raw, min, cov };
  });
}

/* ═══════════════════════════ Don't-care table compaction ═══════════════════════════ */

// Merge truth-table rows that have identical outputs and differ in one input -> rows with X.
function compactRows(c, all) {
  const n = c.inputs.length;
  let cur = all.map((r, i) => ({ v: i, mask: 0, key: c.outputs.map(o => r[o]).join('') }));
  let changed = true;
  while (changed) {
    changed = false;
    const groups = new Map();
    cur.forEach(t => {
      const k = t.mask + '|' + t.key;
      if (!groups.has(k)) groups.set(k, new Map());
      groups.get(k).set(t.v, t);
    });
    const next = [], used = new Set();
    for (const grp of groups.values()) {
      for (const t of grp.values()) {
        if (used.has(t)) continue;
        let merged = false;
        for (let b = 0; b < n && !merged; b++) {
          const bit = 1 << b;
          if (t.mask & bit) continue;
          const p = grp.get(t.v ^ bit);
          if (p && !used.has(p)) {
            used.add(t); used.add(p);
            next.push({ v: t.v & ~bit, mask: t.mask | bit, key: t.key });
            merged = changed = true;
          }
        }
        if (!merged) { used.add(t); next.push(t); }
      }
    }
    cur = next;
  }
  return cur.sort((a, b) => a.v - b.v || a.mask - b.mask);
}

/* ═══════════════════════════ Circuit synthesis (experimental simplification) ═══════════════════════════ */

const METHOD_LABEL = {
  sop: 'AND-OR (sum of products)',
  pos: 'OR-AND (product of sums)',
  nand: 'NAND-NAND',
  nor: 'NOR-NOR',
};

// Rebuilds the circuit from the minimised cover. Returns { circuit|null, consts }
function synthesize(c, all, method) {
  const names = new Set([...c.inputs, ...c.gates.map(g => g.out)]);
  const gensym = (base, numbered) => {
    if (!numbered && !names.has(base)) { names.add(base); return base; }
    let k = numbered ? 1 : 2, nme;
    do { nme = base + k++; } while (names.has(nme));
    names.add(nme);
    return nme;
  };
  const gates = [], cache = new Map(), nots = new Map(), consts = {};
  const addGate = (type, ins, out) => { gates.push({ type, ins, out, line: 0 }); return out; };
  const shared = (type, ins, prefix) => {
    const key = type + '|' + ins.join(',');
    if (!cache.has(key)) cache.set(key, addGate(type, ins, gensym(prefix, true)));
    return cache.get(key);
  };
  const notOf = name => {
    if (!nots.has(name)) nots.set(name, addGate('NOT', [name], gensym(name + '_n')));
    return nots.get(name);
  };
  const lit = l => (l.neg ? notOf(l.name) : l.name);
  const comp = l => ({ name: l.name, neg: !l.neg });
  const single = (type, L, out) => {
    if (L.length === 1) addGate(L[0].neg ? 'NOT' : 'BUF', [L[0].name], out);
    else addGate(type, L.map(lit), out);
  };
  const dual = method === 'pos' || method === 'nor';

  c.outputs.forEach(o => {
    const cov = coverOf(all, o, dual ? 0 : 1);
    if (cov.const !== undefined) { consts[o] = cov.const; return; }
    const cubes = cov.cover;
    const lits = cb => (dual ? cubeLiterals(c, cb).map(comp) : cubeLiterals(c, cb));
    if (cubes.length === 1) { single(dual ? 'OR' : 'AND', lits(cubes[0]), o); return; }
    if (method === 'sop') {
      addGate('OR', cubes.map(cb => { const L = lits(cb); return L.length === 1 ? lit(L[0]) : shared('AND', L.map(lit), 'p'); }), o);
    } else if (method === 'nand') {
      addGate('NAND', cubes.map(cb => {
        const L = lits(cb);
        return L.length === 1 ? (L[0].neg ? L[0].name : notOf(L[0].name)) : shared('NAND', L.map(lit), 'p');
      }), o);
    } else if (method === 'pos') {
      addGate('AND', cubes.map(cb => { const L = lits(cb); return L.length === 1 ? lit(L[0]) : shared('OR', L.map(lit), 's'); }), o);
    } else {
      addGate('NOR', cubes.map(cb => {
        const L = lits(cb);
        return L.length === 1 ? (L[0].neg ? L[0].name : notOf(L[0].name)) : shared('NOR', L.map(lit), 's');
      }), o);
    }
  });
  return { circuit: gates.length ? assemble(gates, c.inputs) : null, consts };
}

/* ═══════════════════════════ Bubble pushing ═══════════════════════════ */

const DUAL_SHAPE = { AND: 'OR', OR: 'AND', BUF: 'BUF' };

// Draws gates with De Morgan-equivalent symbols so inversion bubbles cancel where possible.
// Returns { reps: Map(gate -> {shape,out,ins[]}), netInv: {signal:1} }  (netInv: wire carries the inverted signal)
function bubblePush(c) {
  const reps = new Map();
  c.gates.forEach(g => {
    const sp = GATES[g.type];
    reps.set(g, { shape: sp.shape, out: +sp.inv, ins: g.ins.map(() => 0), fixed: sp.shape === 'XOR' });
  });
  const fan = {};
  c.gates.forEach(g => g.ins.forEach(n => { fan[n] = (fan[n] || 0) + 1; }));
  const cancels = () => {
    const list = [];
    c.gates.forEach(g => g.ins.forEach((n, i) => {
      const d = c.driver[n];
      if (d && fan[n] === 1 && reps.get(d).out && reps.get(g).ins[i]) list.push([d, g, i, n]);
    }));
    return list;
  };
  const cost = () => {
    let k = 0;
    reps.forEach(r => { k += r.out; r.ins.forEach(b => { k += b; }); });
    return k - 2 * cancels().length;
  };
  const flip = g => {
    const r = reps.get(g);
    r.shape = DUAL_SHAPE[r.shape]; r.out ^= 1; r.ins = r.ins.map(b => b ^ 1);
  };
  for (let iter = 0; iter < 40; iter++) {
    let improved = false;
    for (let i = c.order.length - 1; i >= 0; i--) {   // outputs first
      const g = c.order[i];
      if (reps.get(g).fixed) continue;
      const before = cost();
      flip(g);
      if (cost() < before) improved = true; else flip(g);
    }
    if (!improved) break;
  }
  const netInv = {};
  cancels().forEach(([d, g, i, n]) => { reps.get(d).out = 0; reps.get(g).ins[i] = 0; netInv[n] = 1; });
  return { reps, netInv };
}

// (used by tests) evaluate a bubble-pushed circuit and return true signal values
function evalBubbles(c, bp, inputVals) {
  const wire = Object.assign({}, inputVals);
  c.order.forEach(g => {
    const r = bp.reps.get(g);
    const ins = g.ins.map((n, i) => !!(wire[n] ^ r.ins[i]));
    wire[g.out] = +SHAPE_FN[r.shape](ins) ^ r.out;
  });
  const out = {};
  Object.keys(wire).forEach(k => { out[k] = wire[k] ^ (bp.netInv[k] || 0); });
  return out;
}

/* ═══════════════════════════ DOM helpers ═══════════════════════════ */

const SVGNS = 'http://www.w3.org/2000/svg';
function h(tag, cls, parent, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  if (parent) parent.appendChild(e);
  return e;
}
function s(tag, attrs, parent, text) {
  const e = document.createElementNS(SVGNS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (text !== undefined) e.textContent = text;
  if (parent) parent.appendChild(e);
  return e;
}
const later = fn => (typeof requestAnimationFrame === 'function' ? requestAnimationFrame(fn) : setTimeout(fn, 0));

function math(latex, parent) {
  if (typeof renderMath === 'function') parent.appendChild(renderMath(latex, false));
  else parent.appendChild(document.createTextNode(latex));
}

/* ═══════════════════════════ Layout ═══════════════════════════ */

const LEFT = 90, GATE_W = 60, TOP = 30;

function gatePath(shape, H) {
  const r = H / 2;
  switch (shape) {
    case 'AND': return `M0,0 H${52 - r} A${r},${r} 0 0 1 ${52 - r},${H} H0 Z`;
    case 'OR':
    case 'XOR': return `M0,0 Q32,0 52,${r} Q32,${H} 0,${H} Q14,${r} 0,0 Z`;
    default:    return `M0,0 L52,${r} L0,${H} Z`;   // BUF / NOT triangle
  }
}

// geo: { hgap (px between gate columns), vgap (px between gates in a column) }
function layout(c, geo) {
  const COLW = GATE_W + geo.hgap, SP = 40 + geo.vgap, GAP = geo.vgap;
  const level = {}, cy = {};
  c.inputs.forEach((n, i) => { level[n] = 0; cy[n] = TOP + i * SP; });
  c.order.forEach(g => {
    g.level = 1 + Math.max(...g.ins.map(x => level[x]));
    level[g.out] = g.level;
    g.H = Math.max(44, 14 * (g.ins.length + 1));
    g.x0 = LEFT + 70 + (g.level - 1) * COLW;
  });
  const maxL = c.order.length ? Math.max(...c.order.map(g => g.level)) : 0;
  let bottom = TOP + Math.max(0, c.inputs.length - 1) * SP + 12;

  for (let L = 1; L <= maxL; L++) {
    const gs = c.order.filter(g => g.level === L);
    gs.forEach(g => { g.want = g.ins.reduce((a, x) => a + cy[x], 0) / g.ins.length; });
    gs.sort((a, b) => a.want - b.want);
    let prevBottom = -Infinity;
    gs.forEach(g => {
      const top = Math.max(g.want - g.H / 2, prevBottom + GAP);
      g.cy = top + g.H / 2;
      prevBottom = top + g.H;
      cy[g.out] = g.cy;
      bottom = Math.max(bottom, prevBottom);
    });
  }
  let right = LEFT + 40;
  c.order.forEach(g => { right = Math.max(right, g.x0 + GATE_W + 16); });
  c.outputs.forEach(n => { right = Math.max(right, c.driver[n].x0 + GATE_W + 52 + n.length * 8 + 12); });
  return { cy, maxL, width: right, height: bottom + TOP };
}

// Horizontal gap that makes the drawing about targetW px wide.
function solveGap(c, vgap, targetW) {
  const L0 = layout(c, { hgap: 90, vgap });
  if (L0.maxL < 2) return 90;
  return clamp(90 + (targetW - L0.width) / (L0.maxL - 1), 40, 1000);
}

/* ═══════════════════════════ Circuit diagram ═══════════════════════════ */

// ctx: { title, hspacing:{px}|{pct}, vgap, bubbles, getDelay, onToggle(name), onChange(sig,v) }
function createDiagram(c, parent, ctx) {
  const bp = ctx.bubbles ? bubblePush(c) : null;
  const netInv = bp ? bp.netInv : {};
  const repOf = g => (bp ? bp.reps.get(g) : { shape: GATES[g.type].shape, out: +GATES[g.type].inv, ins: g.ins.map(() => 0) });
  const fan = {};
  c.gates.forEach(g => g.ins.forEach(n => { fan[n] = (fan[n] || 0) + 1; }));

  const sim = createSim(c, ctx.getDelay, (sig, v) => { paint(); if (ctx.onChange) ctx.onChange(sig, v); });

  const box = h('div', 'lg-diagram', parent);
  if (ctx.title) h('div', 'lg-title', box, ctx.title);
  const scroll = h('div', 'lg-scroll', box);
  let hgap = ctx.hspacing.px || 90;
  let wires = [], dots = [], inBoxes = {}, outBoxes = {};

  function draw() {
    scroll.textContent = '';
    wires = []; dots = []; inBoxes = {}; outBoxes = {};
    const L = layout(c, { hgap, vgap: ctx.vgap });
    const svg = s('svg', { class: 'lg-svg', viewBox: `0 0 ${L.width} ${L.height}`, width: L.width, height: L.height }, scroll);
    if (ctx.hspacing.pct > 100) svg.style.maxWidth = 'none';
    const wireLayer = s('g', {}, svg);
    const gateLayer = s('g', {}, svg);
    const srcPoint = n => (c.driver[n]
      ? { x: c.driver[n].x0 + GATE_W, y: c.driver[n].cy }
      : { x: LEFT, y: L.cy[n] });
    const addWire = (sig, d) => wires.push({ sig, el: s('path', { class: 'lg-wire', d }, wireLayer) });

    // wires into gates (+ input bubbles)
    c.order.forEach(g => {
      const r = repOf(g), n = g.ins.length;
      const avail = Math.max(10, hgap - 6), first = Math.min(20, avail / 2);
      const step = n > 1 ? Math.min(7, (avail - first) / (n - 1)) : 0;
      g.ins.forEach((sig, i) => {
        const a = srcPoint(sig);
        const py = g.cy - g.H / 2 + g.H * (i + 1) / (n + 1);
        const mx = g.x0 - first - step * i;
        addWire(sig, `M${a.x},${a.y} H${mx} V${py} H${r.ins[i] ? g.x0 - 8 : g.x0}`);
        if (r.ins[i]) s('circle', { class: 'lg-bubble', cx: g.x0 - 4, cy: py, r: 4 }, gateLayer);
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
      s('path', { class: 'lg-gate', d: gatePath(r.shape, g.H) }, grp);
      if (r.shape === 'XOR') s('path', { class: 'lg-gate-extra', d: `M-7,0 Q7,${g.H / 2} -7,${g.H}` }, grp);
      if (r.out) s('circle', { class: 'lg-bubble', cx: 56, cy: g.H / 2, r: 4 }, grp);
      else addWire(g.out, `M${g.x0 + 52},${g.cy} H${g.x0 + GATE_W}`);
      s('text', { class: 'lg-muted', x: 26, y: g.H + 12, 'text-anchor': 'middle' }, grp, g.type);
      if (c.used.has(g.out)) s('text', { class: 'lg-muted', x: GATE_W + 4, y: g.H / 2 - 5 }, grp, g.out);
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
    const on = sig => !!(v[sig] ^ (netInv[sig] || 0));
    wires.forEach(w => w.el.classList.toggle('on', on(w.sig)));
    dots.forEach(d => d.el.classList.toggle('on', on(d.sig)));
    const setBox = (b, val) => {
      b.rect.classList.toggle('on', !!val);
      b.text.classList.toggle('on', !!val);
      b.text.textContent = String(val);
    };
    c.inputs.forEach(n => setBox(inBoxes[n], v[n]));
    c.outputs.forEach(n => setBox(outBoxes[n], v[n]));
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
  return { sim, paint };
}

/* ═══════════════════════════ Timing diagram ═══════════════════════════ */

function createTiming(parent, signals, kinds) {
  const box = h('div', 'lg-timing', parent);
  const head = h('div', 'lg-title', box, 'Timing diagram ');
  const host = h('div', 'lg-scroll', box);
  const clearBtn = h('button', 'lg-small', head, 'clear');
  let t0 = performance.now(), last = 0, hist = {}, queued = false;

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
  const schedule = () => { if (!queued) { queued = true; later(() => { queued = false; draw(); }); } };

  function draw() {
    host.textContent = '';
    const W = 640, LBL = 84, RH = 22, PAD = 10;
    const T = Math.max(1, last * 1.1 + 0.2);
    const H = signals.length * RH + 28;
    const x = t => LBL + (t / T) * (W - LBL - PAD);
    const svg = s('svg', { class: 'lg-svg', viewBox: `0 0 ${W} ${H}`, width: W, height: H }, host);
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
  clearBtn.addEventListener('click', () => { begin(lastVals()); });
  let lastVals = () => ({});
  return { begin, record, setLastVals(fn) { lastVals = fn; } };
}

/* ═══════════════════════════ Truth table ═══════════════════════════ */

function renderTable(parent, c, all, compact) {
  const n = c.inputs.length;
  const table = h('table', 'lg-table', parent);
  const head = h('tr', '', h('thead', '', table));
  let cols, rows;
  if (compact) {
    cols = [...c.inputs.map(x => ({ n: x, cls: '' })), ...c.outputs.map((x, i) => ({ n: x, cls: i === 0 ? 'lg-sep' : '' }))];
    rows = compactRows(c, all).map(t => {
      const pattern = {};
      c.inputs.forEach((x, k) => { const bit = 1 << (n - 1 - k); pattern[x] = (t.mask & bit) ? 'X' : ((t.v & bit) ? 1 : 0); });
      const r = all[t.v];
      return { v: t.v, mask: t.mask, pattern, cells: [...c.inputs.map(x => String(pattern[x])), ...c.outputs.map(o => String(r[o]))] };
    });
  } else {
    cols = [
      ...c.inputs.map(x => ({ n: x, cls: '' })),
      ...c.middles.map((x, i) => ({ n: x, cls: 'lg-mid' + (i === 0 ? ' lg-sep' : '') })),
      ...c.outputs.map((x, i) => ({ n: x, cls: i === 0 ? 'lg-sep' : '' })),
    ];
    rows = all.map((r, i) => {
      const pattern = {};
      c.inputs.forEach(x => { pattern[x] = r[x]; });
      return { v: i, mask: 0, pattern, cells: cols.map(col => String(r[col.n])) };
    });
  }
  cols.forEach(col => h('th', col.cls, head, col.n));
  const tbody = h('tbody', '', table);
  const trs = rows.map(row => {
    const tr = h('tr', '', tbody);
    row.cells.forEach((txt, k) => h('td', cols[k].cls, tr, txt));
    return tr;
  });
  return {
    table, rows, trs, colNames: cols.map(x => x.n),
    markActive(idx) { rows.forEach((r, i) => trs[i].classList.toggle('lg-active', (idx & ~r.mask) === r.v)); },
  };
}

function tableToMarkdown(colNames, cellRows) {
  const row = cells => '| ' + cells.join(' | ') + ' |';
  return [row(colNames), row(colNames.map(() => ':-:')), ...cellRows.map(row)].join('\n');
}

/* ═══════════════════════════ Karnaugh maps ═══════════════════════════ */

function renderKmaps(parent, c, all, exprs) {
  const n = c.inputs.length;
  if (n < 2 || n > 6) { h('div', 'lg-note', parent, 'Karnaugh maps are drawn for 2 to 6 inputs.'); return; }
  const gridVars = Math.min(n, 4), rowVars = Math.floor(gridVars / 2), colVars = gridVars - rowVars, extra = n - gridVars;
  const gray = k => (k === 0 ? [0] : k === 1 ? [0, 1] : [0, 1, 3, 2]);
  const bits = (v, k) => (k ? v.toString(2).padStart(k, '0') : '');

  exprs.forEach(e => {
    const blk = h('div', 'lg-kmap-block', parent);
    h('div', 'lg-title', blk, `Karnaugh map: ${e.name}`);
    if (e.cov.const !== undefined) { h('div', 'lg-note', blk, `${e.name} is constant ${e.cov.const}`); return; }
    const groupOf = new Array(1 << n).fill(-1);
    e.cov.cover.forEach((cb, gi) => {
      for (let m = 0; m < (1 << n); m++) if (((m & ~cb.mask) === cb.v) && groupOf[m] < 0) groupOf[m] = gi;
    });
    const maps = h('div', 'lg-kmaps', blk);
    for (let x = 0; x < (1 << extra); x++) {
      const holder = h('div', 'lg-kmap-holder', maps);
      if (extra) h('div', 'lg-muted-text', holder, c.inputs.slice(gridVars).join('') + ' = ' + bits(x, extra));
      const tbl = h('table', 'lg-kmap', holder);
      const hr = h('tr', '', tbl);
      h('th', 'lg-corner', hr, c.inputs.slice(0, rowVars).join('') + ' \\ ' + c.inputs.slice(rowVars, gridVars).join(''));
      gray(colVars).forEach(cv => h('th', '', hr, bits(cv, colVars)));
      gray(rowVars).forEach(rv => {
        const tr = h('tr', '', tbl);
        h('th', '', tr, bits(rv, rowVars));
        gray(colVars).forEach(cv => {
          let m = 0;
          const put = (val, startK, count) => {
            for (let j = 0; j < count; j++) m |= ((val >> (count - 1 - j)) & 1) << (n - 1 - (startK + j));
          };
          put(rv, 0, rowVars); put(cv, rowVars, colVars); put(x, gridVars, extra);
          const val = all[m][e.name];
          const g = groupOf[m];
          h('td', (val ? 'lg-k1 ' : '') + (g >= 0 ? 'lg-g' + (g % 6) : ''), tr, String(val));
        });
      });
    }
    const legend = h('div', 'lg-legend', blk);
    e.cov.cover.forEach((cb, gi) => {
      const item = h('span', 'lg-legend-item', legend);
      h('span', 'lg-swatch lg-g' + (gi % 6), item);
      math(cubeLatex(c, cb), item);
    });
  });
}

/* ═══════════════════════════ Exports ═══════════════════════════ */

function toLatexSource(exprs) {
  return exprs.map(e => {
    const lines = [];
    if (e.raw && e.raw !== e.min) lines.push(`$$${nm(e.name)} = ${e.raw}$$`);
    if (e.min !== null) lines.push(`$$${nm(e.name)} = ${e.min}$$`);
    return lines.join('\n');
  }).join('\n');
}

function toMermaid(c) {
  const id = {};
  c.inputs.forEach(n => { id[n] = 'in_' + n; });
  c.order.forEach((g, i) => { id[g.out] = 'g' + (i + 1); });
  const out = ['flowchart LR'];
  c.inputs.forEach(n => out.push(`  ${id[n]}([${n}])`));
  c.order.forEach(g => out.push(`  ${id[g.out]}[${g.type}]`));
  c.outputs.forEach(n => out.push(`  out_${n}([${n}])`));
  c.order.forEach(g => g.ins.forEach(n => out.push(c.driver[n] ? `  ${id[n]} -->|${n}| ${id[g.out]}` : `  ${id[n]} --> ${id[g.out]}`)));
  c.outputs.forEach(n => out.push(`  ${id[n]} --> out_${n}`));
  return '```mermaid\n' + out.join('\n') + '\n```';
}

function copy(text) {
  const done = () => new Notice('Copied to clipboard');
  if (typeof navigator !== 'undefined' && navigator.clipboard) navigator.clipboard.writeText(text).then(done);
  else done();
}

/* ═══════════════════════════ Block rendering ═══════════════════════════ */

function renderBlock(src, el, S) {
  const wrap = h('div', 'lg-wrap', el);
  let c;
  try { c = parse(src, { maxInputs: S.maxInputs, maxGates: S.maxGates }); }
  catch (e) { h('div', 'lg-error', wrap, e.message); return; }

  const O = c.opts;
  const part = (name, def) => (O.hide.has(name) ? false : O.show.has(name) ? true : def);
  const analyzable = c.inputs.length <= ANALYSIS_MAX_INPUTS;
  const all = analyzable ? truthTable(c) : null;
  const exprs = buildExpressions(c, all);

  const bubbles = O.bubbles !== null ? O.bubbles : S.bubblePushing;
  const method = O.simplify !== null ? (O.simplify === 'off' ? null : O.simplify) : (S.expSimplify ? S.simplifyMethod : null);
  const compact = O.compact !== null ? O.compact : S.collapseDontCare;
  const delaySec = O.delay !== null ? O.delay : (S.delayEnabled ? S.delaySeconds : 0);
  const getDelay = () => (delaySec < 0 ? Math.random() * 5 : delaySec);
  const hspacing = parseSpacing(S.hSpacing) || { px: 90 };

  const inputState = {};
  c.inputs.forEach(n => { inputState[n] = 0; });
  const diagrams = [];
  let mainDiagram = null, timing = null, table = null;

  function highlight() {
    if (table) table.markActive(c.inputs.reduce((a, n) => a * 2 + (inputState[n] ? 1 : 0), 0));
  }
  function setInputs(patch) {
    if (timing && mainDiagram && mainDiagram.sim.pending() === 0) timing.begin(mainDiagram.sim.vals);
    Object.assign(inputState, patch);
    diagrams.forEach(d => d.sim.setInputs(patch));
    highlight();
  }
  const toggle = n => setInputs({ [n]: inputState[n] ? 0 : 1 });
  const base = { hspacing, vgap: S.vSpacing, bubbles, getDelay, onToggle: toggle };

  // 1. main diagram (+ timing)
  if (part('diagram', true)) {
    const signals = [...c.inputs, ...c.middles, ...c.outputs];
    if (delaySec !== 0 && part('timing', true)) {
      const kinds = {};
      c.inputs.forEach(n => { kinds[n] = 'in'; });
      c.outputs.forEach(n => { kinds[n] = 'out'; });
      const holder = h('div', '', wrap);
      mainDiagram = createDiagram(c, holder, Object.assign({}, base, { onChange: (sig, v) => { if (timing) timing.record(sig, v); } }));
      timing = createTiming(holder, signals, kinds);
      timing.setLastVals(() => mainDiagram.sim.vals);
      timing.begin(mainDiagram.sim.vals);
    } else {
      mainDiagram = createDiagram(c, wrap, base);
    }
    diagrams.push(mainDiagram);
  }

  // 2. experimental: simplified circuit
  if (method && part('diagram', true)) {
    if (!analyzable) {
      h('div', 'lg-note', wrap, `Simplification needs at most ${ANALYSIS_MAX_INPUTS} inputs.`);
    } else {
      const syn = synthesize(c, all, method);
      Object.keys(syn.consts).forEach(o => h('div', 'lg-note', wrap, `${o} simplifies to the constant ${syn.consts[o]}`));
      if (syn.circuit) {
        diagrams.push(createDiagram(syn.circuit, wrap, Object.assign({}, base, {
          title: `Simplified: ${METHOD_LABEL[method]} (experimental)`,
        })));
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
        if (e.raw && !same) h('span', 'lg-expr-tag', r2, ' simplified');
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
    renderKmaps(kb, c, all, exprs);
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
    highlight();
  } else if (!analyzable && showTable) {
    h('div', 'lg-note', wrap, `Truth table hidden: more than ${ANALYSIS_MAX_INPUTS} inputs (2^${c.inputs.length} rows). The diagram is still interactive.`);
  }

  // 6. copy buttons
  const actions = h('div', 'lg-actions', wrap);
  const btn = (label, fn) => h('button', '', actions, label).addEventListener('click', () => copy(fn()));
  if (table) btn('Copy table (Markdown)', () => tableToMarkdown(table.colNames, table.rows.map(r => r.cells)));
  if (analyzable) btn('Copy expressions (LaTeX)', () => toLatexSource(exprs));
  btn('Copy diagram (Mermaid)', () => toMermaid(c));
}

/* ═══════════════════════════ Templates & commands ═══════════════════════════ */

const TEMPLATES = [
  { name: 'Blank (two-input AND)', code: '(a,b) AND (y)' },
  { name: 'Half adder', code: '(a,b) XOR (sum)\n(a,b) AND (carry)' },
  { name: 'Full adder', code: '(a,b) XOR (t)\n(t,cin) XOR (sum)\n(a,b) AND (x)\n(t,cin) AND (z)\n(x,z) OR (cout)' },
  { name: '2-to-1 multiplexer', code: '(s) NOT (ns)\n(a,ns) AND (x)\n(b,s) AND (z)\n(x,z) OR (y)' },
  { name: '2-to-4 decoder', code: '(a) NOT (na)\n(b) NOT (nb)\n(na,nb) AND (y0)\n(na,b) AND (y1)\n(a,nb) AND (y2)\n(a,b) AND (y3)' },
  { name: '3-input majority', code: '(a,b) AND (x)\n(b,c) AND (y)\n(a,c) AND (z)\n(x,y,z) OR (maj)' },
  { name: '4-bit parity (XOR tree)', code: '(a,b) XOR (p1)\n(c,d) XOR (p2)\n(p1,p2) XOR (parity)' },
  { name: 'XOR from NAND gates', code: '(a,b) NAND (n1)\n(a,n1) NAND (n2)\n(b,n1) NAND (n3)\n(n2,n3) NAND (y)' },
];
const fence = code => '```logic\n' + code + '\n```\n';

class TemplateModal extends FuzzySuggestModal {
  constructor(app, onPick) { super(app); this.onPick = onPick; this.setPlaceholder('Choose a circuit template…'); }
  getItems() { return TEMPLATES; }
  getItemText(t) { return t.name; }
  onChooseItem(t) { this.onPick(t); }
}

class ImageModal extends FuzzySuggestModal {
  constructor(app, onPick) { super(app); this.onPick = onPick; this.setPlaceholder('Choose an image of a logic circuit…'); }
  getItems() { return this.app.vault.getFiles().filter(f => /^(png|jpe?g|gif|webp)$/i.test(f.extension)); }
  getItemText(f) { return f.path; }
  onChooseItem(f) { this.onPick(f); }
}

const IMPORT_PROMPT = `You are reading a picture of a combinational logic circuit (gate diagram or schematic).
Transcribe it into this exact text format, one gate per line:

(input1,input2) GATE (output)

Rules:
- GATE is one of: AND, OR, NAND, NOR, XOR, XNOR, NOT, BUF.
- Use the signal names written in the picture. If a wire has no label, invent short names: a, b, c... for circuit inputs, and w1, w2, ... for internal wires.
- Every signal is driven by exactly one gate. Inputs are signals no gate drives.
- NOT and BUF have exactly one input; the other gates have 2 to 6 inputs.
- Signal names may only contain letters, digits and underscores.
- Reply with ONLY the gate lines. No explanation and no code fences.`;

async function importFromImage(plugin, file, editor) {
  const S = plugin.settings;
  if (!S.apiKey) { new Notice('Set your Anthropic API key in the Logic Graph settings first.'); return; }
  const media = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp' }[file.extension.toLowerCase()];
  const notice = new Notice('Reading the circuit from the image…', 0);
  try {
    const data = arrayBufferToBase64(await plugin.app.vault.readBinary(file));
    const res = await requestUrl({
      url: 'https://api.anthropic.com/v1/messages',
      method: 'POST',
      headers: { 'x-api-key': S.apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: S.model,
        max_tokens: 2000,
        messages: [{ role: 'user', content: [
          { type: 'image', source: { type: 'base64', media_type: media, data } },
          { type: 'text', text: IMPORT_PROMPT },
        ] }],
      }),
      throw: false,
    });
    if (res.status !== 200) throw new Error(`API error ${res.status}: ${(res.json && res.json.error && res.json.error.message) || res.text}`);
    let text = (res.json.content || []).filter(p => p.type === 'text').map(p => p.text).join('\n');
    text = text.replace(/```[a-z]*\n?/gi, '').replace(/```/g, '').trim();
    let problem = null;
    try { parse(text, { maxInputs: HARD_MAX_INPUTS, maxGates: HARD_MAX_GATES }); } catch (e) { problem = e.message; }
    editor.replaceSelection(fence(text));
    new Notice(problem ? `Inserted, but please check it: ${problem}` : 'Circuit imported. Check it against the picture.', 8000);
  } catch (e) {
    new Notice('Import failed: ' + e.message, 10000);
  } finally {
    notice.hide();
  }
}

/* ═══════════════════════════ Settings tab ═══════════════════════════ */

class LogicGraphSettingTab extends PluginSettingTab {
  constructor(app, plugin) { super(app, plugin); this.plugin = plugin; }

  display() {
    const { containerEl } = this;
    const P = this.plugin, S = P.settings;
    containerEl.empty();
    const save = async () => { await P.saveSettings(); };
    const heading = name => new Setting(containerEl).setName(name).setHeading();
    const num = (setting, key, lo, hi, isInt) => setting.addText(t => t
      .setValue(String(S[key]))
      .onChange(async v => {
        const x = Number(v);
        if (v.trim() === '' || !Number.isFinite(x) || x < lo || x > hi) return;
        S[key] = isInt ? Math.round(x) : x;
        await save();
      }));

    containerEl.createEl('p', { text: 'Changes apply to blocks rendered after you save (reopen the note or switch view to refresh).' });

    heading('Limits');
    num(new Setting(containerEl).setName('Max inputs at a time')
      .setDesc(`Circuits with more inputs show an error. 1 to ${HARD_MAX_INPUTS}. Truth tables, Karnaugh maps and simplification are only available up to ${ANALYSIS_MAX_INPUTS} inputs (2^n rows).`),
      'maxInputs', 1, HARD_MAX_INPUTS, true);
    num(new Setting(containerEl).setName('Max gates at a time')
      .setDesc(`1 to ${HARD_MAX_GATES}.`), 'maxGates', 1, HARD_MAX_GATES, true);

    heading('Display');
    new Setting(containerEl).setName('Show truth table automatically')
      .setDesc('Per block you can override with "@hide table" or "@show table".')
      .addToggle(t => t.setValue(S.showTable).onChange(async v => { S.showTable = v; await save(); }));
    new Setting(containerEl).setName('Show boolean expressions')
      .addToggle(t => t.setValue(S.showExpr).onChange(async v => { S.showExpr = v; await save(); }));
    new Setting(containerEl).setName('Show Karnaugh maps')
      .setDesc('2 to 6 inputs. Groups come from the Quine–McCluskey result.')
      .addToggle(t => t.setValue(S.showKmap).onChange(async v => { S.showKmap = v; await save(); }));
    new Setting(containerEl).setName('Collapse "don\'t care" rows in the truth table')
      .setDesc('Rows whose outputs do not depend on some inputs are merged and shown with X (the middle signals are hidden in this mode).')
      .addToggle(t => t.setValue(S.collapseDontCare).onChange(async v => { S.collapseDontCare = v; await save(); }));
    new Setting(containerEl).setName('Bubble pushing view')
      .setDesc('Draws gates with their De Morgan symbols (e.g. NAND as an OR with bubbled inputs) so inversion bubbles cancel where possible.')
      .addToggle(t => t.setValue(S.bubblePushing).onChange(async v => { S.bubblePushing = v; await save(); }));

    heading('Timing');
    new Setting(containerEl).setName('Simulate gate delays')
      .setDesc('Signals propagate through the gates one step at a time, and a timing diagram is drawn.')
      .addToggle(t => t.setValue(S.delayEnabled).onChange(async v => { S.delayEnabled = v; await save(); }));
    num(new Setting(containerEl).setName('Delay per gate (seconds)')
      .setDesc('0 to 30. Use -1 for a random delay between 0 and 5 seconds for every gate change.'),
      'delaySeconds', -1, 30, false);

    heading('Graphic values');
    new Setting(containerEl).setName('Horizontal spacing')
      .setDesc('Distance between gate columns. A whole number of pixels (e.g. 90), or a percentage (e.g. 100%) to spread the circuit across that share of the page width.')
      .addText(t => t.setValue(String(S.hSpacing)).onChange(async v => { if (parseSpacing(v)) { S.hSpacing = v.trim(); await save(); } }));
    num(new Setting(containerEl).setName('Vertical spacing (px)')
      .setDesc('Distance between gates in the same column. 0 to 200.'), 'vSpacing', 0, 200, true);

    heading('Experimental');
    new Setting(containerEl).setName('Simplify the circuit')
      .setDesc('Also draws a minimised version of the circuit (Quine–McCluskey). Off by default. Per block: "@simplify nand".')
      .addToggle(t => t.setValue(S.expSimplify).onChange(async v => { S.expSimplify = v; await save(); }));
    new Setting(containerEl).setName('Simplification style')
      .addDropdown(d => {
        Object.keys(METHOD_LABEL).forEach(k => d.addOption(k, METHOD_LABEL[k]));
        d.setValue(S.simplifyMethod).onChange(async v => { S.simplifyMethod = v; await save(); });
      });

    heading('Import from image (experimental)');
    containerEl.createEl('p', { text: 'Sends the chosen image to the Anthropic API using your own key and asks the model to transcribe the circuit. The key is stored unencrypted in this plugin\'s data file inside your vault, so do not sync that file anywhere public.' });
    new Setting(containerEl).setName('Anthropic API key')
      .addText(t => { t.inputEl.type = 'password'; t.setPlaceholder('sk-ant-…').setValue(S.apiKey).onChange(async v => { S.apiKey = v.trim(); await save(); }); });
    new Setting(containerEl).setName('Model')
      .addText(t => t.setValue(S.model).onChange(async v => { if (v.trim()) { S.model = v.trim(); await save(); } }));
  }
}

/* ═══════════════════════════ Plugin ═══════════════════════════ */

class LogicGraphPlugin extends Plugin {
  async onload() {
    await this.loadSettings();
    this.addSettingTab(new LogicGraphSettingTab(this.app, this));

    // ```logic   (language ids can't contain spaces)
    ['logic', 'Logic', 'logic-graph'].forEach(lang =>
      this.registerMarkdownCodeBlockProcessor(lang, (source, el) => renderBlock(source, el, this.settings)));

    this.addCommand({
      id: 'insert-block', name: 'Insert logic block',
      editorCallback: ed => ed.replaceSelection(fence('(a,b) AND (c)\n(c,b) XOR (d)\n(d) NOT (y)')),
    });
    this.addCommand({
      id: 'insert-template', name: 'Insert logic block from template…',
      editorCallback: ed => new TemplateModal(this.app, t => ed.replaceSelection(fence(t.code))).open(),
    });
    this.addCommand({
      id: 'wrap-selection', name: 'Wrap selection in logic block',
      editorCallback: ed => { const sel = ed.getSelection(); ed.replaceSelection(fence(sel || '(a,b) AND (y)')); },
    });
    Object.keys(GATES).forEach(type => {
      this.addCommand({
        id: 'gate-' + type.toLowerCase(), name: `Insert gate line: ${type}`,
        editorCallback: ed => ed.replaceSelection(GATES[type].min === 1 ? `(a) ${type} (y)\n` : `(a,b) ${type} (y)\n`),
      });
    });
    ['@simplify nand', '@bubbles', '@delay 1', '@hide table'].forEach(d => {
      this.addCommand({
        id: 'directive-' + d.slice(1).replace(/\s+/g, '-'), name: `Insert directive: ${d}`,
        editorCallback: ed => ed.replaceSelection(d + '\n'),
      });
    });
    this.addCommand({
      id: 'import-image', name: 'Import circuit from image (AI, experimental)',
      editorCallback: ed => new ImageModal(this.app, f => importFromImage(this, f, ed)).open(),
    });
  }

  async loadSettings() { this.settings = sanitizeSettings(await this.loadData()); }
  async saveSettings() { this.settings = Object.assign(this.settings, sanitizeSettings(this.settings)); await this.saveData(this.settings); }
}

module.exports = LogicGraphPlugin;
module.exports._core = { parse, evaluate, truthTable, layout, createSim, bubblePush, synthesize, renderBlock, sanitizeSettings, DEFAULTS };
