// Evaluating circuits, truth tables, and the event-driven delay simulation.

import { GATES } from './gates.js';

export function evaluate(c, inputVals) {
  const v = Object.assign({}, inputVals);
  c.order.forEach(g => { v[g.out] = +GATES[g.type].fn(g.ins.map(x => !!v[x])); });
  return v;
}

export function truthTable(c) {
  const n = c.inputs.length;
  const rows = [];
  for (let i = 0; i < (1 << n); i++) {
    const ins = {};
    c.inputs.forEach((x, k) => { ins[x] = (i >> (n - 1 - k)) & 1; });
    rows.push(evaluate(c, ins));
  }
  return rows;
}

// Event-driven simulation with an inertial delay per gate (getDelay() -> seconds).
// onChange(sig, v) fires when a signal flips; onWork(gate) fires when a gate starts/stops "working".
export function createSim(c, getDelay, onChange, onWork) {
  const zero = {};
  c.inputs.forEach(n => { zero[n] = 0; });
  const vals = evaluate(c, zero);
  const timers = new Map();
  const consumers = {};
  c.gates.forEach(g => g.ins.forEach(n => { (consumers[n] = consumers[n] || []).push(g); }));
  const work = g => { if (onWork) onWork(g); };

  function set(sig, v) {
    if (vals[sig] === v) return;
    vals[sig] = v;
    onChange(sig, v);
    (consumers[sig] || []).forEach(reeval);
  }
  function reeval(g) {
    const target = +GATES[g.type].fn(g.ins.map(x => !!vals[x]));
    const pend = timers.get(g);
    if (pend) { clearTimeout(pend.h); timers.delete(g); }
    if (target === vals[g.out]) { if (pend) work(g); return; }
    const d = getDelay();
    if (!(d > 0)) { set(g.out, target); if (pend) work(g); return; }
    const h = setTimeout(() => { timers.delete(g); set(g.out, target); work(g); }, d * 1000);
    timers.set(g, { h, target });
    work(g);
  }
  return {
    vals,
    setInputs(patch) { Object.keys(patch).forEach(n => set(n, patch[n])); },
    pending() { return timers.size; },
    working(g) { const p = timers.get(g); return p ? p.target : null; },
    dispose() { timers.forEach(p => clearTimeout(p.h)); timers.clear(); },
  };
}
