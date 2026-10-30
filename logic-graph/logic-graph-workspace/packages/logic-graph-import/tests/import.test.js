const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path');
const { PNG } = require('pngjs');
require('../../../tests/helpers/dom.cjs');
const X = require('../../../.test-build/logic-graph-import.cjs');

const settings = (over = {}) => Object.assign({ importProvider: 'local', keys: { claude: '', gemini: '', grok: '', deepseek: '', openrouter: '' }, models: {} }, over);
const fail = async (provider, key) => {
  const s = settings(); s.keys[provider] = key;
  try { await X.cloudImport(provider, s, new ArrayBuffer(1), 'png'); return 'no error'; } catch (e) { return e.message; }
};

test('cloud providers: missing token', async () => {
  assert.match(await fail('claude', ''), /API token not found for Claude/);
  assert.match(await fail('gemini', '   '), /API token not found for Gemini/);
});
test('cloud providers: token in the wrong format', async () => {
  assert.match(await fail('gemini', 'abc123'), /Gemini.*looks invalid/);
  assert.match(await fail('claude', 'sk-wrong'), /Claude.*looks invalid/);
});
test('cloud providers: a plausible token still stops at "under construction"', async () => {
  assert.match(await fail('claude', 'sk-ant-abcdefghijklmnop'), /under construction/);
  assert.match(await fail('openrouter', 'sk-or-abcdefghijklmnop'), /OpenRouter import is under construction/);
});
test('HTTP errors are explained in plain words', () => {
  assert.match(X.explainHttp('grok', 401), /Invalid or expired API token for Grok/);
  assert.match(X.explainHttp('claude', 429), /rate limit/);
  assert.match(X.explainHttp('deepseek', 500, 'oops'), /HTTP 500.*oops/);
});

const png = PNG.sync.read(fs.readFileSync(path.join(__dirname, 'fixtures', 'userex.light2.png')));
const decode = async () => ({ width: png.width, height: png.height, data: png.data });

async function mainPlugin(over) { const p = new X.LogicGraphPlugin(); await p.onload(); Object.assign(p.settings, over); return p; }

test('importImage: local provider returns a valid circuit', async () => {
  const r = await X.importImage(await mainPlugin(), new ArrayBuffer(1), 'png', decode);
  assert.equal(r.problem, null);
  assert.equal(r.text.split('\n').length, 3);
});

test('importImage: a cloud provider without a token fails with the token message', async () => {
  const main = await mainPlugin({ importProvider: 'gemini' });
  await assert.rejects(X.importImage(main, new ArrayBuffer(1), 'png', decode), /API token not found for Gemini/);
});

test('the command inserts a fenced block with a header comment, and tells the user what to check', async () => {
  const main = await mainPlugin();
  const ext = new X.LogicGraphImport();
  ext.app = { plugins: { plugins: { 'logic-graph': main } }, vault: { readBinary: async () => new ArrayBuffer(1) } };
  // decode path in the browser uses createImageBitmap + canvas: fake both
  global.createImageBitmap = async () => ({ width: png.width, height: png.height });
  const canvas = { getContext: () => ({ drawImage() {}, getImageData: () => ({ width: png.width, height: png.height, data: png.data }) }) };
  const realCreate = document.createElement.bind(document);
  document.createElement = t => (t === 'canvas' ? canvas : realCreate(t));
  try {
    let inserted = '';
    await ext.run({ name: 'circuit.png', extension: 'png' }, { replaceSelection(t) { inserted = t; } });
    assert.match(inserted, /^```logic\n# imported from circuit\.png/);
    assert.ok(inserted.includes('NOT'));
    assert.match(X.__log.notices.at(-1), /Imported 3 line/);
  } finally { document.createElement = realCreate; delete global.createImageBitmap; }
});

test('without the Logic Graph plugin the extension explains what is missing', async () => {
  const ext = new X.LogicGraphImport();
  ext.app = { plugins: { plugins: {} }, vault: {} };
  await ext.run({ name: 'x.png', extension: 'png' }, { replaceSelection() {} });
  assert.match(X.__log.notices.at(-1), /not installed or not enabled/);
});
