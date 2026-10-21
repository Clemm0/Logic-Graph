const { test } = require('node:test');
const assert = require('node:assert/strict');
const L = require('../../../.test-build/logic-graph.cjs');

const USER_EXAMPLE = '(a,b) AND (c)\n(c,b) XOR (d)\n(d) NOT (y)';

test('parses the example: inputs, middles, outputs', () => {
  const c = L.parse(USER_EXAMPLE);
  assert.deepEqual(c.inputs, ['a', 'b']);
  assert.deepEqual(c.middles, ['c', 'd']);
  assert.deepEqual(c.outputs, ['y']);
});

test('truth table of the example is y = 1,0,1,1', () => {
  const rows = L.truthTable(L.parse(USER_EXAMPLE));
  assert.deepEqual(rows.map(r => r.y), [1, 0, 1, 1]);
});

test('error messages carry the line number', () => {
  assert.throws(() => L.parse('(a) AND (y)'), /Line 1: AND needs at least 2/);
  assert.throws(() => L.parse('(a,b) FOO (y)'), /unknown gate/);
  assert.throws(() => L.parse('(a,b) AND (c)\n(a,b) OR (c)'), /Line 2: signal "c" is already driven/);
  assert.throws(() => L.parse('(a,b) AND (c)\n(c,a) AND (c)'), /Line 2/);
  assert.throws(() => L.parse('(a,b) AND (a)'), /feeds back/);
  assert.throws(() => L.parse('(x,b) AND (c)\n(c,b) AND (x)'), /Loop detected/);
});

test('limits for inputs and gates', () => {
  assert.throws(() => L.parse('(a,b) AND (y)', { maxGates: 0 }), /more than 0 gates/);
  assert.throws(() => L.parse('(a,b,c) AND (y)', { maxInputs: 2 }), /Too many inputs \(3, max 2\)/);
  const chain = Array.from({ length: 31 }, (_, i) => `(${i === 0 ? 'x0' : 's' + (i - 1)},x${i + 1}) XOR (s${i})`).join('\n');
  const c = L.parse(chain, { maxInputs: 32, maxGates: 256 });
  assert.equal(c.inputs.length, 32);
});

test('directives', () => {
  const c = L.parse('@hide table expr\n@bubbles\n@delay random\n@timing-both\n@simplify nand\n@compact\n(a,b) AND (y)');
  assert.ok(c.opts.hide.has('table') && c.opts.hide.has('expr'));
  assert.equal(c.opts.bubbles, true);
  assert.equal(c.opts.delay, -1);
  assert.equal(c.opts.timing, 'both');
  assert.equal(c.opts.simplify, 'nand');
  assert.equal(c.opts.compact, true);
  assert.equal(L.parse('@reduce\n(a,b) AND (y)').opts.simplify, 'structural');
  assert.throws(() => L.parse('@timing-foo\n(a,b) AND (y)'), /@timing-graph/);
  assert.throws(() => L.parse('@nope\n(a,b) AND (y)'), /unknown directive/);
  assert.ok(L.parse('@help').empty, '@help alone is a valid (empty) block');
});

test('every example in the @help reference is a valid block', () => {
  let n = 0;
  for (const sec of L.HELP) for (const [, , example] of sec.items) if (example) { L.parse(example); n++; }
  assert.ok(n >= 20);
});

test('every template parses', () => {
  for (const t of L.TEMPLATES) L.parse(t.code);
});

test('settings are sanitised and old keys migrated', () => {
  const s = L.sanitizeSettings({ maxInputs: 999, maxGates: 0, delaySeconds: -5, hSpacing: 'abc', simplifyMethod: 'nope', apiKey: 'sk-ant-old' });
  assert.equal(s.maxInputs, 32);
  assert.equal(s.maxGates, 64);
  assert.equal(s.delaySeconds, -1);
  assert.equal(s.hSpacing, '90');
  assert.equal(s.simplifyMethod, 'structural');
  assert.equal(s.keys.claude, 'sk-ant-old');
  assert.equal(s.apiKey, undefined);
  assert.deepEqual(L.parseSpacing('100%'), { pct: 100 });
  assert.deepEqual(L.parseSpacing('90'), { px: 90 });
  assert.equal(L.parseSpacing('x'), null);
});
