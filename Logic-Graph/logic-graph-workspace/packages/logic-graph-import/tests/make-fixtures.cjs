// Regenerates tests/fixtures/*.png by rendering circuits with the plugin itself.
// Needs: python3 with cairosvg (pip install cairosvg). Run after `npm test` has built .test-build/:
//   node packages/logic-graph-import/tests/make-fixtures.cjs
const fs = require('fs'), path = require('path'), { execSync } = require('child_process');
require('../../../tests/helpers/dom.cjs');
const L = require('../../../.test-build/logic-graph.cjs');
const CASES = require('./fixtures/cases.json');
const LIGHT = `.lg-wire{fill:none;stroke:#999;stroke-width:2}.lg-wire.on{stroke:#3b82f6}.lg-dot{fill:#999}.lg-gate{fill:#eee;stroke:#222;stroke-width:2}.lg-gate-extra{fill:none;stroke:#222;stroke-width:2}.lg-bubble{fill:#fff;stroke:#222;stroke-width:2.2}.lg-label{font-size:13px;font-family:monospace}.lg-muted{fill:#777;font-size:10px;font-family:monospace}.lg-box{fill:#fff;stroke:#666;stroke-width:1.5}.lg-boxtext{font-size:12px;font-family:monospace}`;
const DARK = LIGHT.replace(/#eee/g, '#262626').replace(/#222/g, '#dadada').replace(/stroke:#999/g, 'stroke:#777').replace(/#fff/g, '#1e1e1e').replace(/fill:#777/g, 'fill:#aaa');
const STYLES = { light1: [LIGHT, 1, 'white'], light2: [LIGHT, 2, 'white'], dark15: [DARK, 1.5, '#1e1e1e'] };
const dir = path.join(__dirname, 'fixtures');
for (const [name, src] of Object.entries(CASES)) for (const [style, [css, scale, bg]] of Object.entries(STYLES)) {
  const el = document.createElement('div'); document.body.appendChild(el);
  L.renderBlock(src + '\n@hide table expr', el, { settings: L.DEFAULTS, app: {} });
  const svg = el.querySelector('svg.lg-svg').outerHTML.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"').replace('>', `><style>${css}</style><rect width="100%" height="100%" fill="${bg}"/>`);
  const file = path.join(dir, `${name}.${style}`);
  fs.writeFileSync(file + '.svg', svg);
  execSync(`python3 -c "import cairosvg;cairosvg.svg2png(url='${file}.svg',write_to='${file}.png',scale=${scale})"`);
  fs.unlinkSync(file + '.svg');
}
console.log('fixtures written to', dir);
