const { test } = require('node:test');
const assert = require('node:assert/strict');
const L = require('../../../.test-build/logic-graph.cjs');
const { rng, randomCircuit } = require('../../../tests/helpers/rand.cjs');

const reduce = (src, method) => { const c = L.parse(src), all = L.truthTable(c); return L.reduceCircuit(c, all, method); };

test('structural reduction is always equivalent and never adds gates (600 random circuits)', () => {
  const rnd = rng(987);
  let shrunk = 0;
  for (let it = 0; it < 600; it++) {
    const src = randomCircuit(rnd, 2 + Math.floor(rnd() * 4), 3 + Math.floor(rnd() * 12));
    const r = reduce(src, 'structural');
    assert.equal(r.verified, 'exact', src);
    assert.ok(r.after.gates <= r.before.gates, src);
    if (r.after.gates < r.before.gates) shrunk++;
  }
  assert.ok(shrunk > 100);
});

test('two-level methods are equivalent and respect the 6-input gate limit', () => {
  const rnd = rng(5);
  for (let it = 0; it < 150; it++) {
    const c = L.parse(randomCircuit(rnd, 2 + Math.floor(rnd() * 4), 3 + Math.floor(rnd() * 10))), all = L.truthTable(c);
    for (const m of ['sop', 'pos', 'nand', 'nor']) {
      const r = L.reduceCircuit(c, all, m);
      assert.equal(r.verified, 'exact', m);
      if (r.circuit) assert.ok(r.circuit.gates.every(g => g.ins.length <= L.MAX_GATE_FANIN));
    }
  }
});

test('"best" is never worse than structural', () => {
  const rnd = rng(31);
  for (let it = 0; it < 60; it++) {
    const src = randomCircuit(rnd, 3, 8);
    assert.ok(reduce(src, 'best').after.gates <= reduce(src, 'structural').after.gates);
  }
});

test('rewrite rules', () => {
  assert.equal(reduce('(a) NOT (n1)\n(n1) NOT (n2)\n(n2,b) AND (y)', 'structural').after.gates, 1, 'double NOT');
  const nand = reduce('(a,b) AND (t)\n(t) NOT (y)', 'structural');
  assert.equal(nand.after.gates, 1); assert.equal(nand.circuit.gates[0].type, 'NAND');
  assert.equal(reduce('(a,b) AND (t)\n(t,c) AND (u)\n(u,d) AND (y)', 'structural').after.gates, 1, 'cascade merge');
  assert.equal(reduce('(a,b) OR (t)\n(a,t) AND (y)', 'structural').after.gates, 1, 'absorption a.(a+b)=a');
  assert.equal(reduce('(a,b) AND (x)\n(a,b) AND (z)\n(x,c) OR (y1)\n(z,d) OR (y2)', 'structural').after.gates, 3, 'shared gate');
});

test('a parity tree shrinks to one XOR, while two-level logic explodes (the old bug)', () => {
  const par = '(a,b) XOR (p1)\n(c,d) XOR (p2)\n(e,f) XOR (p3)\n(p1,p2) XOR (q)\n(q,p3) XOR (y)';
  assert.equal(reduce(par, 'structural').after.gates, 1);
  assert.ok(reduce(par, 'sop').after.gates > 5);
  assert.equal(reduce(par, 'best').after.gates, 1);
});

test('large circuits are verified by sampling', () => {
  const rnd = rng(1);
  const c = L.parse(randomCircuit(rnd, 20, 80), { maxInputs: 32, maxGates: 256 });
  assert.equal(L.reduceCircuit(c, null, 'structural').verified, 'sampled');
});
