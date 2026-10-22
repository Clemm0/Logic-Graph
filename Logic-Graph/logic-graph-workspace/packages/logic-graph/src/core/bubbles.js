// Bubble pushing: De Morgan symbol choice so inversion bubbles match.

import { GATES, SHAPE_FN } from './gates.js';

export const DUAL_SHAPE = { AND: 'OR', OR: 'AND', BUF: 'BUF', XOR: 'XOR' };

export const baseRep = g => {
  const sp = GATES[g.type];
  return { shape: sp.shape, out: +sp.inv, ins: g.ins.map(() => 0), fixed: sp.shape === 'XOR' };
};

// De Morgan: draw the same physical gate with the dual symbol (AND<->OR, all bubbles toggled)
export const flipRep = r => { r.shape = DUAL_SHAPE[r.shape]; r.out ^= 1; r.ins = r.ins.map(b => b ^ 1); };

// Start at the outputs and work back: each gate is drawn so that its output bubble matches the
// input bubble of the gate it feeds (no bubble at the final outputs). No gate is added or removed.
// `flips` = gates the user flipped by hand (applied last).
export function bubbleForms(c, flips) {
  const reps = new Map();
  c.gates.forEach(g => reps.set(g, baseRep(g)));
  const cons = {};
  c.gates.forEach(g => g.ins.forEach((n, i) => { (cons[n] = cons[n] || []).push([g, i]); }));
  for (let k = c.order.length - 1; k >= 0; k--) {
    const g = c.order[k], r = reps.get(g);
    if (r.fixed) continue;
    const list = cons[g.out] || [];
    let ones = 0;
    list.forEach(([cg, i]) => { ones += reps.get(cg).ins[i]; });
    const want = list.length && ones * 2 > list.length ? 1 : 0;
    if (r.out !== want) flipRep(r);
  }
  if (flips) flips.forEach(g => { const r = reps.get(g); if (r && !r.fixed) flipRep(r); });
  return reps;
}

// nets whose driver output bubble and every consumer input bubble are both present: the pair cancels
export function matchedBubbleNets(c, reps) {
  const matched = new Set();
  c.gates.forEach(d => {
    if (!reps.get(d).out) return;
    let n = 0, ok = true;
    c.gates.forEach(g => g.ins.forEach((x, i) => {
      if (x !== d.out) return;
      n++; if (!reps.get(g).ins[i]) ok = false;
    }));
    if (n && ok) matched.add(d.out);
  });
  return matched;
}

// (tests) signal values computed from the drawn symbols: must equal the real circuit
export function evalReps(c, reps, inputVals) {
  const v = Object.assign({}, inputVals);
  c.order.forEach(g => {
    const r = reps.get(g);
    v[g.out] = +SHAPE_FN[r.shape](g.ins.map((n, i) => !!(v[n] ^ r.ins[i]))) ^ r.out;
  });
  return v;
}
