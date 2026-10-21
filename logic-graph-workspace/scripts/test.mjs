// Builds one test bundle per package (with the fake "obsidian" module) and runs node:test.
//   npm test                 all packages
//   npm test -- logic-graph  one package
import esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const wanted = process.argv.slice(2);
const names = fs.readdirSync(path.join(root, 'packages')).filter(n => !wanted.length || wanted.includes(n));
let failed = false;

for (const name of names) {
  const entry = path.join(root, 'packages', name, 'tests', 'entry.js');
  if (!fs.existsSync(entry)) continue;
  await esbuild.build({
    entryPoints: [entry], outfile: path.join(root, '.test-build', name + '.cjs'),
    bundle: true, format: 'cjs', platform: 'node', target: 'node20', logLevel: 'warning',
    alias: { obsidian: path.join(root, 'tests', 'helpers', 'obsidian-stub.js') },
  });
  const dir = path.join(root, 'packages', name, 'tests');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.test.js')).map(f => path.join(dir, f));
  const r = spawnSync(process.execPath, ['--test', ...files], { stdio: 'inherit', cwd: root });
  if (r.status !== 0) failed = true;
}
process.exit(failed ? 1 : 0);
