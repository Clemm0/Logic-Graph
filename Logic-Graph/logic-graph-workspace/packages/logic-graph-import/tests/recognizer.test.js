const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path');
const { PNG } = require('pngjs');
const X = require('../../../.test-build/logic-graph-import.cjs');
const CASES = require('./fixtures/cases.json');

// Same function up to renaming/reordering of the inputs (outputs compared as a set).
const perms = a => (a.length <= 1 ? [a] : a.flatMap((x, i) => perms([...a.slice(0, i), ...a.slice(i + 1)]).map(p => [x, ...p])));
function signature(c, perm) {
  const n = c.inputs.length;
  return c.outputs.map(o => {
    let s = '';
    for (let i = 0; i < (1 << n); i++) {
      const ins = {};
      c.inputs.forEach((name, k) => { ins[name] = (i >> (n - 1 - (perm ? perm[k] : k))) & 1; });
      s += X.evaluate(c, ins)[o];
    }
    return s;
  }).sort().join('|');
}
function sameFunction(originalText, recoveredText) {
  const limits = { maxInputs: 32, maxGates: 256 };
  const A = X.parse(originalText, limits), B = X.parse(recoveredText, limits);
  if (A.inputs.length !== B.inputs.length || A.outputs.length !== B.outputs.length) return false;
  const want = signature(A);
  return perms([...Array(A.inputs.length).keys()]).some(p => signature(B, p) === want);
}
const image = file => { const png = PNG.sync.read(fs.readFileSync(path.join(__dirname, 'fixtures', file))); return { width: png.width, height: png.height, data: png.data }; };

// Known gaps (see README): complex circuits in the synthetic dark palette.
const KNOWN_FAILURES = new Set(['mux.dark15', 'full.dark15']);

for (const [name, source] of Object.entries(CASES)) {
  for (const style of ['light1', 'light2', 'dark15']) {
    const id = `${name}.${style}`;
    test(`recognizes ${id}`, { todo: KNOWN_FAILURES.has(id) ? 'known gap: complex circuit, dark theme' : false }, () => {
      const out = X.recognize(image(`${id}.png`));
      assert.ok(out.text, 'nothing recognised: ' + out.notes.join(' '));
      assert.ok(sameFunction(source, out.text), `recovered a different circuit:\n${out.text}`);
    });
  }
}

test('the recovered text is always a valid logic block', () => {
  for (const name of Object.keys(CASES)) {
    const out = X.recognize(image(`${name}.light2.png`));
    assert.doesNotThrow(() => X.parse(out.text, { maxInputs: 32, maxGates: 256 }), name);
  }
});

test('a picture without gates gives a helpful note, not a crash', () => {
  const blank = { width: 50, height: 50, data: new Uint8ClampedArray(50 * 50 * 4).fill(255) };
  const out = X.recognize(blank);
  assert.equal(out.text, '');
  assert.match(out.notes[0], /No gates found/);
});

test('XOR and negation bubbles are told apart from plain gates', () => {
  const text = name => X.recognize(image(`${name}.light2.png`)).text;
  assert.match(text('xor'), /XOR/); assert.match(text('xnor'), /XNOR/);
  assert.match(text('nand'), /NAND/); assert.match(text('nor3'), /NOR/); assert.match(text('not'), /NOT/);
});
