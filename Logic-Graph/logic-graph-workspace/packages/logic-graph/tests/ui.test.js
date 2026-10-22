const { test } = require('node:test');
const assert = require('node:assert/strict');
const dom = require('../../../tests/helpers/dom.cjs');
const L = require('../../../.test-build/logic-graph.cjs');
const { rng } = require('../../../tests/helpers/rand.cjs');

const plugin = (settings = {}) => ({ settings: Object.assign({}, L.DEFAULTS, settings), app: { vault: {}, fileManager: {} } });
const render = (src, settings) => { const el = document.createElement('div'); document.body.appendChild(el); L.renderBlock(src, el, plugin(settings)); return el; };
const click = el => el.dispatchEvent(new dom.window.Event('click'));

test('a block renders diagram, expressions, table and copy buttons', () => {
  const el = render('(a,b) AND (c)\n(c,b) XOR (d)\n(d) NOT (y)');
  assert.ok(el.querySelector('svg.lg-svg'));
  assert.equal(el.querySelectorAll('.lg-table tbody tr').length, 4);
  assert.equal(el.querySelectorAll('.lg-actions button').length, 3);
  assert.ok(el.querySelector('.lg-expr .math'));
});

test('errors are shown, not thrown', () => {
  assert.match(render('(a) AND (y)').querySelector('.lg-error').textContent, /Line 1/);
});

test('clicking inputs and truth-table rows drives the diagram and the highlight', () => {
  const el = render('(a,b) AND (y)');
  const boxes = () => [...el.querySelectorAll('.lg-boxtext')].map(t => t.textContent).join('');
  const inputs = el.querySelectorAll('rect.in');
  click(inputs[0]); click(inputs[1]);
  assert.equal(boxes(), '111');
  assert.equal(el.querySelector('tr.lg-active').textContent.replace(/\s/g, ''), '111');
  click(el.querySelectorAll('.lg-table tbody tr')[0]);
  assert.equal(boxes(), '000');
});

test('@hide / @show / limits for the table', () => {
  assert.equal(render('@hide table\n(a,b) AND (y)').querySelector('.lg-table'), null);
  assert.ok(render('(a,b) AND (y)', { showTable: false }).querySelector('.lg-table') === null);
  assert.ok(render('@show table\n(a,b) AND (y)', { showTable: false }).querySelector('.lg-table'));
  const wide = Array.from({ length: 13 }, (_, i) => `(x${i},x${i + 1}) XOR (s${i})`).join('\n');
  const el = render(wide, { maxInputs: 32, maxGates: 256 });
  assert.match(el.textContent, /Truth table hidden: more than 12 inputs/);
  assert.ok(el.querySelector('svg.lg-svg'), 'the diagram is still drawn');
});

test('@help renders the reference; every example opens and renders without error', () => {
  const el = render('@help');
  const items = [...el.querySelectorAll('details')];
  assert.ok(items.length >= 20);
  items.forEach(d => { d.open = true; d.dispatchEvent(new dom.window.Event('toggle')); });
  assert.equal(el.querySelectorAll('.lg-error').length, 0);
  assert.ok(el.querySelectorAll('.lg-help-live svg').length >= items.length);
  assert.ok(render('@help\n(a,b) AND (y)').querySelector('.lg-help + * svg.lg-svg, svg.lg-svg'), 'help and circuit together');
});

test('Karnaugh pieces: the outlines cover exactly the cells of each group (incl. wrap-around)', () => {
  const rnd = rng(3), gray = k => (k === 0 ? [0] : k === 1 ? [0, 1] : [0, 1, 3, 2]);
  for (let n = 2; n <= 6; n++) {
    const gridVars = Math.min(n, 4), rowVars = Math.floor(gridVars / 2), colVars = gridVars - rowVars, extra = n - gridVars;
    for (let t = 0; t < 150; t++) {
      let mask = 0, v = 0;
      for (let b = 0; b < n; b++) { if (rnd() < 0.45) mask |= 1 << b; else if (rnd() < 0.5) v |= 1 << b; }
      if (mask === (1 << n) - 1) continue;
      const cube = { v, mask };
      for (let slice = 0; slice < (1 << extra); slice++) {
        const want = new Set();
        gray(rowVars).forEach((rg, i) => gray(colVars).forEach((cg, j) => {
          let m = 0;
          const put = (val, s0, cnt) => { for (let q = 0; q < cnt; q++) m |= ((val >> (cnt - 1 - q)) & 1) << (n - 1 - (s0 + q)); };
          put(rg, 0, rowVars); put(cg, rowVars, colVars); put(slice, gridVars, extra);
          if ((m & ~cube.mask) === cube.v) want.add(i + ',' + j);
        }));
        const got = new Set();
        L.kmapPieces(cube, n, gridVars, rowVars, colVars, extra, slice).forEach(p => {
          for (let i = p.r0; i <= p.r1; i++) for (let j = p.c0; j <= p.c1; j++) { assert.ok(!got.has(i + ',' + j), 'pieces overlap'); got.add(i + ',' + j); }
        });
        assert.deepEqual([...got].sort(), [...want].sort());
      }
    }
  }
});

test('Karnaugh maps render one SVG per slice, and clicking a cell sets the inputs', () => {
  assert.equal(render('@hide diagram table expr\n@show kmap\n(a,b,c,d,e) AND (y)').querySelectorAll('svg.lg-kmap').length, 2);
  const el = render('@hide table expr\n@show kmap\n(a,b,c) AND (y)');
  click(el.querySelectorAll('rect.lg-kcell')[3]);
  assert.equal(el.querySelectorAll('.lg-kactive').length, 1);
  assert.equal([...el.querySelectorAll('svg.lg-svg:not(.lg-kmap) .lg-boxtext')].map(t => t.textContent).join(''), '0100');
});

test('bubble view keeps every gate and adds matching bubbles; clicking a gate flips its symbol', () => {
  const el = render('@bubbles\n(a,b) NAND (p)\n(c,d) NAND (q)\n(p,q) NAND (y)');
  assert.equal(el.querySelectorAll('path.lg-gate').length, 3);
  assert.equal(el.querySelectorAll('circle.lg-bubble.match').length, 4);
  const before = el.querySelectorAll('circle.lg-bubble').length;
  click(el.querySelector('.lg-gate.flip'));
  assert.notEqual(el.querySelectorAll('circle.lg-bubble').length, before);
  [...el.querySelectorAll('.lg-title button')].find(b => b.textContent === 'reset') && click([...el.querySelectorAll('.lg-title button')].find(b => b.textContent === 'reset'));
  assert.equal(el.querySelectorAll('circle.lg-bubble').length, before);
});

test('reduced circuit is drawn with a verified title, or explained when nothing can be reduced', () => {
  const titles = el => [...el.querySelectorAll('.lg-title > span:first-child')].map(x => x.textContent);
  const a = render('@simplify structural\n@hide table expr\n(a) NOT (n1)\n(n1) NOT (n2)\n(n2,b) AND (y)');
  assert.match(titles(a)[1], /3 to 1 gates \(checked on all inputs\)/);
  assert.match(render('@simplify structural\n@hide table expr\n(a,b) AND (y)').textContent, /No structural reduction found/);
  assert.match(render('@simplify sop\n@hide table expr\n(a,b) XOR (p)\n(c,d) XOR (q)\n(p,q) XOR (y)').textContent, /more gates than your circuit/);
});

test('timing views: graph, animation, both; a @timing line implies a delay', () => {
  const view = src => { const e = render(src + '\n@hide table expr\n(a,b) AND (y)'); return { graph: !!e.querySelector('.lg-timing'), lamps: e.querySelectorAll('circle.lg-lamp').length }; };
  assert.deepEqual(view('@timing-graph'), { graph: true, lamps: 0 });
  assert.deepEqual(view('@timing-animation'), { graph: false, lamps: 1 });
  assert.deepEqual(view('@timing-both'), { graph: true, lamps: 1 });
  assert.deepEqual(view(''), { graph: false, lamps: 0 });
  assert.deepEqual(view('@delay 0.5'), { graph: true, lamps: 0 });
});

test('animation: working gates light up, bits travel along the wires, then everything settles', async () => {
  const frames = [];
  global.requestAnimationFrame = f => frames.push(f);
  dom.window.SVGElement.prototype.getTotalLength = () => 100;
  dom.window.SVGElement.prototype.getPointAtLength = l => ({ x: l, y: 5 });
  try {
    const el = render('@timing-animation\n@delay 0.05\n@hide table expr\n(a,b) AND (c)\n(c) NOT (y)');
    const lamps = () => [...el.querySelectorAll('circle.lg-lamp')].map(l => l.getAttribute('class').replace('lg-lamp ', ''));
    assert.deepEqual(lamps(), ['v0', 'v1']);
    const ins = el.querySelectorAll('rect.in'); click(ins[0]); click(ins[1]);
    assert.deepEqual(lamps(), ['v1 work', 'v1']);                         // AND is working towards 1
    assert.ok(el.querySelectorAll('.lg-sprite').length > 0, 'bits spawned');
    frames.splice(0).forEach(f => f(performance.now() + 100));
    assert.ok([...el.querySelectorAll('.lg-sprite')].every(s => /translate/.test(s.getAttribute('transform'))));
    await new Promise(r => setTimeout(r, 200));
    assert.deepEqual(lamps(), ['v1', 'v0']);
    frames.splice(0).forEach(f => f(performance.now() + 5000));
    assert.equal(el.querySelectorAll('.lg-sprite').length, 0, 'sprites are removed when they arrive');
  } finally { delete global.requestAnimationFrame; }
});

test('detour routing: a wire that would pass behind a gate goes through a lane above the circuit', () => {
  const c = L.parse('(s) NOT (ns)\n(a,ns) AND (x)\n(b,s) AND (z)\n(x,z) OR (y)');
  let lay = L.layout(c, { hgap: 90, vgap: 16 });
  const plan = L.planRoutes(c, lay, 90);
  assert.ok(plan.lanes >= 1);
  const simple = L.parse('(a,b) AND (y)'); lay = L.layout(simple, { hgap: 90, vgap: 16 });
  assert.equal(L.planRoutes(simple, lay, 90).lanes, 0);
});

test('export: the snapshot inlines styles and adds a background', () => {
  const el = render('(a,b) NAND (y)');
  const snap = L.svgSnapshot(el.querySelector('svg.lg-svg'));
  assert.match(snap.text, /^<svg[^>]*xmlns/);
  assert.ok(snap.text.includes('<rect') && !/class=/.test(snap.text));
  assert.ok(snap.width > 100 && snap.height > 50);
  const btn = [...el.querySelectorAll('.lg-title button')].find(b => b.textContent === 'export');
  click(btn);                                             // opens the menu (fake)
});

test('percentage spacing stretches the drawing to the container width', () => {
  const callbacks = [];
  global.ResizeObserver = class { constructor(cb) { callbacks.push(cb); } observe() {} };
  try {
    const el = render('(a,b) AND (c)\n(c,b) XOR (d)\n(d) NOT (y)', { hSpacing: '100%' });
    callbacks.forEach(f => f([{ contentRect: { width: 1000 } }]));
    return new Promise(r => setTimeout(r, 50)).then(() => assert.equal(el.querySelector('svg.lg-svg').getAttribute('width'), '1000'));
  } finally { delete global.ResizeObserver; }
});
