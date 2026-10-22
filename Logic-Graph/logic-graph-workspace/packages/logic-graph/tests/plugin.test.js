const { test } = require('node:test');
const assert = require('node:assert/strict');
require('../../../tests/helpers/dom.cjs');
const L = require('../../../.test-build/logic-graph.cjs');

async function loaded() { const p = new L.LogicGraphPlugin(); await p.onload(); return p; }

test('the plugin registers the code-block languages and exposes an api for extensions', async () => {
  const p = await loaded();
  assert.deepEqual(Object.keys(p.processors).sort(), ['Logic', 'logic', 'logic-graph']);
  assert.equal(p.api.version, require('../manifest.json').version);
  assert.deepEqual(p.api.parse('(a,b) AND (y)').inputs, ['a', 'b']);
  assert.ok(p.api.fence('x').startsWith('```logic'));
});

test('Ctrl+P commands insert text', async () => {
  const p = await loaded();
  const names = p.commands.map(c => c.name);
  for (const n of ['Insert logic block', 'Insert help block (@help)', 'Insert logic block from template…', 'Wrap selection in logic block', 'Insert gate line: NAND', 'Insert directive: @timing-both']) assert.ok(names.includes(n), n);
  const run = name => { const ed = { out: '', replaceSelection(t) { this.out += t; }, getSelection: () => '(x,y) OR (z)' }; p.commands.find(c => c.name === name).editorCallback(ed); return ed.out; };
  assert.equal(run('Insert gate line: NOT'), '(a) NOT (y)\n');
  assert.equal(run('Insert help block (@help)'), '```logic\n@help\n```\n');
  assert.equal(run('Wrap selection in logic block'), '```logic\n(x,y) OR (z)\n```\n');
  assert.doesNotThrow(() => L.parse(run('Insert logic block').replace(/```(logic)?\n?/g, '')));
});

test('settings page: values are validated and saved; the import zone follows the provider dropdown', async () => {
  const p = await loaded(), log = L.__log.settings;
  log.length = 0; p.settingTab.display();
  const row = name => log.find(s => s.name && s.name.startsWith(name));
  await row('Max inputs').text.fn('32'); await row('Max gates').text.fn('999'); await row('Max gates').text.fn('256');
  await row('Horizontal spacing').text.fn('abc'); await row('Horizontal spacing').text.fn('100%');
  await row('Delay per gate').text.fn('-1'); await row('Timing view').dropdown.fn('both');
  assert.deepEqual([p._data.maxInputs, p._data.maxGates, p._data.hSpacing, p._data.delaySeconds, p._data.timingView], [32, 256, '100%', -1, 'both']);
  const provider = row('Provider');
  assert.deepEqual(provider.dropdown.options, ['local', 'claude', 'gemini', 'grok', 'deepseek', 'openrouter']);
  log.length = 0; await provider.dropdown.fn('claude');
  assert.ok(log.filter(s => /Claude \(Anthropic\): (API token|model)/.test(s.name || '')).every(s => s.text.disabled === true), 'cloud fields are greyed out (disabled)');
  log.length = 0; await provider.dropdown.fn('openrouter');
  assert.ok(log.some(s => /OpenRouter: API token/.test(s.name || '')), 'the zone changes with the provider');
});
