// Turns the text of a ```logic block into a circuit object; handles @directives.

import { DEFAULT_MAX_GATES, DEFAULT_MAX_INPUTS, HARD_MAX_GATES, HARD_MAX_INPUTS, ID_RE, MAX_GATE_FANIN, REDUCE_METHODS, TIMING_VIEWS } from './constants.js';
import { GATES } from './gates.js';

export const PARTS = ['table', 'expr', 'diagram', 'kmap', 'timing'];

export const DIRECTIVE_LIST = '@help, @hide, @show, @simplify (@reduce), @bubbles, @compact, @delay, @timing-graph, @timing-animation, @timing-both';

export function applyDirective(line, n, o) {
  const m = line.match(/^@([\w-]+)\s*(.*)$/);
  if (!m) throw new Error(`Line ${n}: malformed directive`);
  let name = m[1].toLowerCase();
  const args = m[2].toLowerCase().split(/[,\s]+/).filter(Boolean);
  if (name === 'reduce') name = 'simplify';
  if (name.startsWith('timing-')) { args.unshift(name.slice(7)); name = 'timing'; }
  switch (name) {
    case 'help': o.help = true; break;
    case 'timing': {
      const a = args[0] || 'graph';
      if (!TIMING_VIEWS.includes(a)) throw new Error(`Line ${n}: use @timing-graph, @timing-animation or @timing-both`);
      o.timing = a;
      break;
    }
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
      const a = args[0] || 'structural';
      if (a === 'off') o.simplify = 'off';
      else if (REDUCE_METHODS.includes(a)) o.simplify = a;
      else throw new Error(`Line ${n}: "@simplify" takes ${REDUCE_METHODS.join(', ')} or off`);
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
    default: throw new Error(`Line ${n}: unknown directive "@${name}". Available: ${DIRECTIVE_LIST}`);
  }
}

// Orders gates topologically, finds outputs/middles. `inputs` may be given (synthesised circuits).
export function assemble(gates, inputs) {
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
export function parse(src, limits) {
  limits = Object.assign({ maxInputs: DEFAULT_MAX_INPUTS, maxGates: DEFAULT_MAX_GATES }, limits);
  const gates = [];
  const driver = {};
  const opts = { hide: new Set(), show: new Set(), simplify: null, bubbles: null, delay: null, compact: null, timing: null, help: false };

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

  if (!gates.length) {
    if (opts.help) return { gates: [], order: [], inputs: [], outputs: [], middles: [], driver: {}, used: new Set(), opts, empty: true };
    throw new Error('Empty circuit. Example: (a,b) AND (y)   (or add @help for a reference)');
  }
  const c = assemble(gates);
  if (c.inputs.length > limits.maxInputs) {
    throw new Error(`Too many inputs (${c.inputs.length}, max ${limits.maxInputs}). Raise "Max inputs" in the plugin settings (up to ${HARD_MAX_INPUTS}).`);
  }
  c.opts = opts;
  return c;
}
