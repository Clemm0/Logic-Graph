// Rebuilds a circuit from the minimal cover (AND-OR, OR-AND, NAND-NAND, NOR-NOR).

import { MAX_GATE_FANIN } from './constants.js';
import { BASE } from './gates.js';
import { coverOf, cubeLiterals } from './minimize.js';
import { assemble } from './parser.js';

export const METHOD_LABEL = {
  structural: 'Structural (rewrites your actual circuit)',
  best: 'Best of all methods',
  sop: 'AND-OR (sum of products)',
  pos: 'OR-AND (product of sums)',
  nand: 'NAND-NAND',
  nor: 'NOR-NOR',
};

// Rebuilds the circuit from the minimised cover. Returns { circuit|null, consts }
export function synthesize(c, all, method) {
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
  // gates are limited to MAX_GATE_FANIN inputs: wider ones become trees (AND/OR groups, inverting gate on top)
  const build = (type, ins, prefix, out) => {
    const base = BASE[type];
    let cur = ins;
    while (cur.length > MAX_GATE_FANIN) {
      const next = [];
      for (let i = 0; i < cur.length; i += MAX_GATE_FANIN) {
        const chunk = cur.slice(i, i + MAX_GATE_FANIN);
        next.push(chunk.length === 1 ? chunk[0] : shared(base, chunk, 't'));
      }
      cur = next;
    }
    return out ? addGate(type, cur, out) : shared(type, cur, prefix);
  };
  const single = (type, L, out) => {
    if (L.length === 1) addGate(L[0].neg ? 'NOT' : 'BUF', [L[0].name], out);
    else build(type, L.map(lit), '', out);
  };
  const dual = method === 'pos' || method === 'nor';

  c.outputs.forEach(o => {
    const cov = coverOf(all, o, dual ? 0 : 1);
    if (cov.const !== undefined) { consts[o] = cov.const; return; }
    const cubes = cov.cover;
    const lits = cb => (dual ? cubeLiterals(c, cb).map(comp) : cubeLiterals(c, cb));
    if (cubes.length === 1) { single(dual ? 'OR' : 'AND', lits(cubes[0]), o); return; }
    if (method === 'sop') {
      build('OR', cubes.map(cb => { const L = lits(cb); return L.length === 1 ? lit(L[0]) : build('AND', L.map(lit), 'p'); }), '', o);
    } else if (method === 'nand') {
      build('NAND', cubes.map(cb => {
        const L = lits(cb);
        return L.length === 1 ? (L[0].neg ? L[0].name : notOf(L[0].name)) : build('NAND', L.map(lit), 'p');
      }), '', o);
    } else if (method === 'pos') {
      build('AND', cubes.map(cb => { const L = lits(cb); return L.length === 1 ? lit(L[0]) : build('OR', L.map(lit), 's'); }), '', o);
    } else {
      build('NOR', cubes.map(cb => {
        const L = lits(cb);
        return L.length === 1 ? (L[0].neg ? L[0].name : notOf(L[0].name)) : build('NOR', L.map(lit), 's');
      }), '', o);
    }
  });
  return { circuit: gates.length ? assemble(gates, c.inputs) : null, consts };
}
