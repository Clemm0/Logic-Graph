// Circuit reduction: structural rewriting, equivalence check, method selection.

import { MAX_GATE_FANIN } from './constants.js';
import { BASE, INVERSE, INVERTING } from './gates.js';
import { assemble } from './parser.js';
import { evaluate } from './sim.js';
import { synthesize } from './synthesize.js';

export const circuitCost = c => ({ gates: c.gates.length, pins: c.gates.reduce((a, g) => a + g.ins.length, 0) });

// Rewrites the real circuit with equivalence-preserving rules; it never adds gates.
// Rules: duplicate inputs, buffer removal, double NOT, NOT absorbed into the gate before it
// (NOT(AND)=NAND ...), merging cascades (AND(AND(a,b),c)=AND(a,b,c)), absorption (a.(a+b)=a),
// identical-gate sharing, dead-gate removal. Output signal names are kept.
export function reduceStructural(c) {
  let gates = c.gates.map(g => ({ type: g.type, ins: g.ins.slice(), out: g.out, line: 0 }));
  const isOut = new Set(c.outputs);
  const drv = () => { const d = {}; gates.forEach(g => { d[g.out] = g; }); return d; };
  const fanout = () => { const f = {}; gates.forEach(g => g.ins.forEach(x => { f[x] = (f[x] || 0) + 1; })); return f; };
  const rename = (from, to) => gates.forEach(g => { g.ins = g.ins.map(x => (x === from ? to : x)); });
  const live = g => gates.includes(g);

  for (let iter = 0; iter < 300; iter++) {
    let changed = false;

    // 1. duplicate inputs / one-input gates
    gates.forEach(g => {
      const base = BASE[g.type];
      if (base === 'AND' || base === 'OR') {
        const u = [...new Set(g.ins)];
        if (u.length !== g.ins.length) { g.ins = u; changed = true; }
        if (g.ins.length === 1) { g.type = INVERTING[g.type] ? 'NOT' : 'BUF'; changed = true; }
      } else if (base === 'XOR') {
        const cnt = {};
        g.ins.forEach(x => { cnt[x] = (cnt[x] || 0) + 1; });
        const odd = Object.keys(cnt).filter(x => cnt[x] % 2 === 1);
        if (odd.length > 0 && odd.length !== g.ins.length) { g.ins = odd; changed = true; }
        if (g.ins.length === 1) { g.type = g.type === 'XNOR' ? 'NOT' : 'BUF'; changed = true; }
      }
    });

    // 2. buffers that are not outputs disappear
    for (const g of gates.slice()) {
      if (g.type === 'BUF' && !isOut.has(g.out)) { rename(g.out, g.ins[0]); gates = gates.filter(x => x !== g); changed = true; }
    }

    // 3. double NOT, and NOT absorbed into the gate that feeds it
    { const d = drv(), f = fanout();
      for (const g of gates.slice()) {
        if (g.type !== 'NOT' || !live(g)) continue;
        const inner = d[g.ins[0]];
        if (!inner || !live(inner)) continue;
        if (inner.type === 'NOT') { g.type = 'BUF'; g.ins = [inner.ins[0]]; changed = true; continue; }
        if (INVERSE[inner.type] && !isOut.has(inner.out) && f[inner.out] === 1) {
          g.type = INVERSE[inner.type]; g.ins = inner.ins.slice();
          gates = gates.filter(x => x !== inner); changed = true;
        }
      } }

    // 4. merge cascades of the same (non-inverted) gate
    { const d = drv(), f = fanout();
      for (const g of gates.slice()) {
        const base = BASE[g.type];
        if (!base || !live(g)) continue;
        let again = true;
        while (again) {
          again = false;
          for (let i = 0; i < g.ins.length; i++) {
            const x = g.ins[i], inner = d[x];
            if (!inner || !live(inner) || inner === g || inner.type !== base) continue;
            if (isOut.has(x) || f[x] !== 1) continue;
            const merged = g.ins.slice(0, i).concat(inner.ins, g.ins.slice(i + 1));
            if (merged.length > MAX_GATE_FANIN) continue;
            g.ins = merged; gates = gates.filter(y => y !== inner); f[x] = 0; changed = true; again = true;
            break;
          }
        }
      } }

    // 5. absorption: a.(a+b) = a  and  a+(a.b) = a
    { const d = drv(), f = fanout();
      for (const g of gates.slice()) {
        const base = BASE[g.type];
        if ((base !== 'AND' && base !== 'OR') || !live(g)) continue;
        const dual = base === 'AND' ? 'OR' : 'AND';
        for (let i = 0; i < g.ins.length; i++) {
          const x = g.ins[i], inner = d[x];
          if (!inner || !live(inner) || inner.type !== dual || isOut.has(x) || f[x] !== 1) continue;
          const others = g.ins.filter((_, k) => k !== i);
          if (inner.ins.some(y => others.includes(y))) {
            g.ins = others; gates = gates.filter(y => y !== inner); changed = true;
            break;
          }
        }
      } }

    // 6. identical gates (same type, same inputs) are shared
    { const seen = new Map();
      for (const g of gates.slice()) {
        if (!live(g)) continue;
        const key = g.type + '|' + [...g.ins].sort().join(',');
        const prev = seen.get(key);
        if (!prev) { seen.set(key, g); continue; }
        let keep = prev, drop = g;
        if (isOut.has(drop.out)) { if (isOut.has(keep.out)) continue; keep = g; drop = prev; seen.set(key, keep); }
        rename(drop.out, keep.out); gates = gates.filter(y => y !== drop); changed = true;
      } }

    // 7. dead gates
    { const f = fanout(), n0 = gates.length;
      gates = gates.filter(g => isOut.has(g.out) || f[g.out]);
      if (gates.length !== n0) changed = true; }

    if (!changed) break;
  }
  return assemble(gates, c.inputs);
}

// 'exact' = checked on every input combination, 'sampled' = 4096 random vectors, 'FAILED' = mismatch
export function verifyEquivalent(c, circuit, consts, all) {
  consts = consts || {};
  const check = (ins, ref) => {
    const v = circuit ? evaluate(circuit, ins) : {};
    return c.outputs.every(o => ((o in consts) ? consts[o] : v[o]) === ref[o]);
  };
  if (all) {
    return all.every(row => { const ins = {}; c.inputs.forEach(x => { ins[x] = row[x]; }); return check(ins, row); }) ? 'exact' : 'FAILED';
  }
  let seed = 1234567;
  const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  for (let k = 0; k < 4096; k++) {
    const ins = {};
    c.inputs.forEach(x => { ins[x] = rnd() < 0.5 ? 0 : 1; });
    if (!check(ins, evaluate(c, ins))) return 'FAILED';
  }
  return 'sampled';
}

// method: structural | best | sop | pos | nand | nor.  Returns {circuit, consts, method, before, after, verified}
export function reduceCircuit(c, all, method) {
  const cands = [];
  const add = m => {
    const r = m === 'structural' ? { circuit: reduceStructural(c), consts: {} } : synthesize(c, all, m);
    r.method = m;
    r.after = r.circuit ? circuitCost(r.circuit) : { gates: 0, pins: 0 };
    cands.push(r);
  };
  if (method === 'best') { add('structural'); if (all) ['sop', 'pos', 'nand', 'nor'].forEach(add); }
  else add(method);
  cands.sort((a, b) => a.after.gates - b.after.gates || a.after.pins - b.after.pins);   // stable: ties keep the earlier one
  const best = cands[0];
  best.before = circuitCost(c);
  best.verified = verifyEquivalent(c, best.circuit, best.consts, all);
  return best;
}
