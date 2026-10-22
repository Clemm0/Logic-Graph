// Copy-to-clipboard exports: Markdown table, LaTeX, Mermaid.

import { Notice } from 'obsidian';
import { nm } from '../core/latex.js';

export function toLatexSource(exprs) {
  return exprs.map(e => {
    const lines = [];
    if (e.raw && e.raw !== e.min) lines.push(`$$${nm(e.name)} = ${e.raw}$$`);
    if (e.min !== null) lines.push(`$$${nm(e.name)} = ${e.min}$$`);
    return lines.join('\n');
  }).join('\n');
}

export function toMermaid(c) {
  const id = {};
  c.inputs.forEach(n => { id[n] = 'in_' + n; });
  c.order.forEach((g, i) => { id[g.out] = 'g' + (i + 1); });
  const out = ['flowchart LR'];
  c.inputs.forEach(n => out.push(`  ${id[n]}([${n}])`));
  c.order.forEach(g => out.push(`  ${id[g.out]}[${g.type}]`));
  c.outputs.forEach(n => out.push(`  out_${n}([${n}])`));
  c.order.forEach(g => g.ins.forEach(n => out.push(c.driver[n] ? `  ${id[n]} -->|${n}| ${id[g.out]}` : `  ${id[n]} --> ${id[g.out]}`)));
  c.outputs.forEach(n => out.push(`  ${id[n]} --> out_${n}`));
  return '```mermaid\n' + out.join('\n') + '\n```';
}

export function copy(text) {
  const done = () => new Notice('Copied to clipboard');
  if (typeof navigator !== 'undefined' && navigator.clipboard) navigator.clipboard.writeText(text).then(done);
  else done();
}
