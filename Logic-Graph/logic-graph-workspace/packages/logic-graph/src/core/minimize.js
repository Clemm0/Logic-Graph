// Quine-McCluskey: prime implicants, exact minimum cover, minimal expressions.

import { nm, rawLatex } from './latex.js';

export const popcount = x => { let k = 0; while (x) { k += x & 1; x >>>= 1; } return k; };

// Prime implicants. v = fixed bits, mask = dash ("don't care") bits.
export function primeImplicants(ones) {
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

// Minimum cover of `ones` by prime implicants: essential primes, then branch & bound
// (fewest terms first, then fewest literals). Falls back to the best found if the search is too big.
export function chooseCover(primes, ones, nvars) {
  const NODE_LIMIT = 60000;
  const covers = (p, m) => (m & ~p.mask) === p.v;
  const lits = p => nvars - popcount(p.mask);
  const cost = list => [list.length, list.reduce((a, p) => a + lits(p), 0)];
  const better = (a, b) => (a[0] !== b[0] ? a[0] < b[0] : a[1] < b[1]);
  const byOrder = (a, b) => a.v - b.v || a.mask - b.mask;

  const chosen = [], left = new Set(ones);
  ones.forEach(m => {
    const ps = primes.filter(p => covers(p, m));
    if (ps.length === 1 && !chosen.includes(ps[0])) chosen.push(ps[0]);
  });
  chosen.forEach(p => ones.forEach(m => { if (covers(p, m)) left.delete(m); }));
  const rest = [...left];
  if (!rest.length) return { cover: chosen.sort(byOrder), exact: true };

  const cand = primes.filter(p => !chosen.includes(p) && rest.some(m => covers(p, m)));
  const coverers = new Map(rest.map(m => [m, cand.filter(p => covers(p, m))]));

  // greedy upper bound
  let bestSel = [];
  { const unc = new Set(rest);
    while (unc.size) {
      let bp = null, bc = -1;
      cand.forEach(p => { let k = 0; unc.forEach(m => { if (covers(p, m)) k++; }); if (k > bc) { bc = k; bp = p; } });
      bestSel.push(bp);
      [...unc].forEach(m => { if (covers(bp, m)) unc.delete(m); });
    } }
  let bestCost = cost(chosen.concat(bestSel));
  let nodes = 0, exact = true;

  const rec = (unc, sel) => {
    if (++nodes > NODE_LIMIT) { exact = false; return; }
    if (!unc.length) {
      const c2 = cost(chosen.concat(sel));
      if (better(c2, bestCost)) { bestCost = c2; bestSel = sel.slice(); }
      return;
    }
    if (chosen.length + sel.length + 1 > bestCost[0]) return;
    let pick = unc[0], pc = coverers.get(pick).length;
    for (const m of unc) { const k = coverers.get(m).length; if (k < pc) { pick = m; pc = k; } }
    const opts = coverers.get(pick).slice()
      .sort((a, b) => unc.filter(m => covers(b, m)).length - unc.filter(m => covers(a, m)).length);
    for (const p of opts) {
      sel.push(p);
      rec(unc.filter(m => !covers(p, m)), sel);
      sel.pop();
      if (nodes > NODE_LIMIT) return;
    }
  };
  rec(rest, []);
  return { cover: chosen.concat(bestSel).sort(byOrder), exact };
}

// target 1: cover the ones (SOP). target 0: cover the zeros (used for POS / NOR-NOR).
export function coverOf(all, out, target) {
  const idx = [];
  let count1 = 0;
  all.forEach((r, i) => {
    if (r[out]) count1++;
    if (r[out] === (target === 0 ? 0 : 1)) idx.push(i);
  });
  if (count1 === 0) return { const: 0 };
  if (count1 === all.length) return { const: 1 };
  const nvars = Math.round(Math.log2(all.length));
  const { cover, exact } = chooseCover(primeImplicants(idx), idx, nvars);
  return { ones: idx, cover, exact };
}

export function cubeLiterals(c, cube) {
  const n = c.inputs.length, out = [];
  c.inputs.forEach((name, k) => {
    const bit = 1 << (n - 1 - k);
    if (!(cube.mask & bit)) out.push({ name, neg: !(cube.v & bit) });
  });
  return out;
}

export const litLatex = l => (l.neg ? `\\overline{${nm(l.name)}}` : nm(l.name));

export const cubeLatex = (c, cube) => cubeLiterals(c, cube).map(litLatex).join(' \\cdot ');

export const sopLatex = (c, cov) => (cov.const !== undefined ? String(cov.const) : cov.cover.map(cb => cubeLatex(c, cb)).join(' + '));

export function buildExpressions(c, all) {
  return c.outputs.map(o => {
    let raw;
    try { raw = rawLatex(c, o); } catch (e) { raw = null; }
    if (raw && raw.length > 800) raw = null;
    let cov = null, min = null;
    if (all) { cov = coverOf(all, o, 1); min = sopLatex(c, cov); }
    return { name: o, raw, min, cov };
  });
}
