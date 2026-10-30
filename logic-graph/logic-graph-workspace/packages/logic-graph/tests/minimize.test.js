const { test } = require('node:test');
const assert = require('node:assert/strict');
const L = require('../../../.test-build/logic-graph.cjs');
const { rng, randomCircuit } = require('../../../tests/helpers/rand.cjs');

const covers = (p, m) => (m & ~p.mask) === p.v;

test('Quine-McCluskey: the cover contains every one and no zero; minimal on small functions', () => {
  const rnd = rng(7);
  let checked = 0;
  for (let k = 0; k < 200; k++) {
    const n = 3 + Math.floor(rnd() * 3), rows = 1 << n, ones = [];
    for (let i = 0; i < rows; i++) if (rnd() < 0.5) ones.push(i);
    if (!ones.length || ones.length === rows) continue;
    const primes = L.primeImplicants(ones);
    const { cover, exact } = L.chooseCover(primes, ones, n);
    assert.ok(exact);
    assert.ok(ones.every(m => cover.some(p => covers(p, m))), 'every one is covered');
    for (const p of cover) for (let m = 0; m < rows; m++) if (covers(p, m)) assert.ok(ones.includes(m), 'a term covers a zero');
    if (primes.length <= 14) {                                   // brute-force the minimum number of terms
      let min = Infinity;
      for (let mask = 1; mask < (1 << primes.length); mask++) {
        const sel = primes.filter((_, b) => mask & (1 << b));
        if (sel.length < min && ones.every(m => sel.some(p => covers(p, m)))) min = sel.length;
      }
      assert.equal(cover.length, min);
      checked++;
    }
  }
  assert.ok(checked > 100);
});

test('minimal expression of the example is  \\overline{b} + a', () => {
  const c = L.parse('(a,b) AND (c)\n(c,b) XOR (d)\n(d) NOT (y)');
  const [e] = L.buildExpressions(c, L.truthTable(c));
  assert.equal(e.min, '\\overline{b} + a');
  assert.ok(e.raw.includes('\\oplus'));
});

test("don't-care rows partition the truth table and keep the outputs", () => {
  const rnd = rng(11);
  for (let it = 0; it < 80; it++) {
    const c = L.parse(randomCircuit(rnd, 2 + Math.floor(rnd() * 4), 3 + Math.floor(rnd() * 8)));
    const all = L.truthTable(c), rows = L.compactRows(c, all), seen = new Array(all.length).fill(0);
    for (const t of rows) all.forEach((r, i) => {
      if ((i & ~t.mask) === t.v) { seen[i]++; assert.equal(c.outputs.map(o => r[o]).join(''), t.key); }
    });
    assert.ok(seen.every(x => x === 1));
  }
});

test('structural expression stays bounded for huge shared circuits', () => {
  const lines = ['(a,b) XOR (s0)'];
  for (let i = 1; i < 30; i++) lines.push(`(s${i - 1},s${i - 1}x) XOR (s${i})`, `(s${i - 1},a) AND (s${i - 1}x)`);
  const c = L.parse(lines.join('\n'), { maxGates: 256 });
  const exprs = L.buildExpressions(c, null);      // no truth table: must not hang or throw
  assert.equal(exprs.length, c.outputs.length);
});
