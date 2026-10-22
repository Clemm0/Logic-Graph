const { test } = require('node:test');
const assert = require('node:assert/strict');
const L = require('../../../.test-build/logic-graph.cjs');
const { rng, randomCircuit } = require('../../../tests/helpers/rand.cjs');

test('bubble pushing never changes what a gate computes, even with manual flips', () => {
  const rnd = rng(21);
  for (let it = 0; it < 200; it++) {
    const c = L.parse(randomCircuit(rnd, 2 + Math.floor(rnd() * 3), 3 + Math.floor(rnd() * 8))), all = L.truthTable(c);
    const flips = new Set(c.gates.filter(() => rnd() < 0.3));
    for (const fl of [null, flips]) {
      const reps = L.bubbleForms(c, fl);
      for (const row of all) {
        const ins = {}; c.inputs.forEach(x => { ins[x] = row[x]; });
        const v = L.evalReps(c, reps, ins);
        c.gates.forEach(g => assert.equal(v[g.out], row[g.out]));
      }
    }
  }
});

test('textbook property: single-consumer nets are bubble-matched, final outputs have no bubble', () => {
  const rnd = rng(22);
  for (let it = 0; it < 200; it++) {
    const c = L.parse(randomCircuit(rnd, 3, 8)), reps = L.bubbleForms(c, null), cons = {};
    c.gates.forEach(g => g.ins.forEach((n, i) => { (cons[n] = cons[n] || []).push([g, i]); }));
    c.gates.forEach(d => {
      const r = reps.get(d); if (r.fixed) return;
      const list = cons[d.out] || [];
      if (list.length === 1) assert.equal(reps.get(list[0][0]).ins[list[0][1]], r.out);
      if (!list.length) assert.equal(r.out, 0);
    });
  }
});

test('NAND-NAND is drawn AND, AND, OR with matching bubbles and no gate removed', () => {
  const c = L.parse('(a,b) NAND (p)\n(c,d) NAND (q)\n(p,q) NAND (y)'), reps = L.bubbleForms(c, null);
  assert.deepEqual(c.gates.map(g => reps.get(g).shape), ['AND', 'AND', 'OR']);
  assert.equal(L.matchedBubbleNets(c, reps).size, 2);
  assert.equal(c.gates.length, 3);
});

test('delay simulation: gates react after their delay', async () => {
  const log = [];
  const sim = L.createSim(L.parse('(a,b) AND (c)\n(c) NOT (y)'), () => 0.03, (s, v) => log.push([s, v]));
  sim.setInputs({ a: 1 }); sim.setInputs({ b: 1 });
  assert.equal(sim.vals.c, 0); assert.equal(sim.pending(), 1);
  await new Promise(r => setTimeout(r, 200));
  assert.deepEqual(log.filter(([s]) => s === 'c' || s === 'y'), [['c', 1], ['y', 0]]);
  assert.equal(sim.pending(), 0);
});

test('delay simulation is inertial: a pulse shorter than the delay is swallowed', async () => {
  const sim = L.createSim(L.parse('(a) NOT (y)'), () => 0.05, () => {});
  sim.setInputs({ a: 1 }); sim.setInputs({ a: 0 });
  await new Promise(r => setTimeout(r, 120));
  assert.equal(sim.vals.y, 1);
});

test('working() reports the value a gate is heading to', () => {
  const c = L.parse('(a,b) AND (y)');
  const sim = L.createSim(c, () => 5, () => {});
  sim.setInputs({ a: 1, b: 1 });
  assert.equal(sim.working(c.gates[0]), 1);
  sim.dispose();
  assert.equal(sim.working(c.gates[0]), null);
});
