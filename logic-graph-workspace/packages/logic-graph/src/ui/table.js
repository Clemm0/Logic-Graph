// Truth table.

import { compactRows } from '../core/compact.js';
import { h } from './dom.js';

export function renderTable(parent, c, all, compact) {
  const n = c.inputs.length;
  const table = h('table', 'lg-table', parent);
  const head = h('tr', '', h('thead', '', table));
  let cols, rows;
  if (compact) {
    cols = [...c.inputs.map(x => ({ n: x, cls: '' })), ...c.outputs.map((x, i) => ({ n: x, cls: i === 0 ? 'lg-sep' : '' }))];
    rows = compactRows(c, all).map(t => {
      const pattern = {};
      c.inputs.forEach((x, k) => { const bit = 1 << (n - 1 - k); pattern[x] = (t.mask & bit) ? 'X' : ((t.v & bit) ? 1 : 0); });
      const r = all[t.v];
      return { v: t.v, mask: t.mask, pattern, cells: [...c.inputs.map(x => String(pattern[x])), ...c.outputs.map(o => String(r[o]))] };
    });
  } else {
    cols = [
      ...c.inputs.map(x => ({ n: x, cls: '' })),
      ...c.middles.map((x, i) => ({ n: x, cls: 'lg-mid' + (i === 0 ? ' lg-sep' : '') })),
      ...c.outputs.map((x, i) => ({ n: x, cls: i === 0 ? 'lg-sep' : '' })),
    ];
    rows = all.map((r, i) => {
      const pattern = {};
      c.inputs.forEach(x => { pattern[x] = r[x]; });
      return { v: i, mask: 0, pattern, cells: cols.map(col => String(r[col.n])) };
    });
  }
  cols.forEach(col => h('th', col.cls, head, col.n));
  const tbody = h('tbody', '', table);
  const trs = rows.map(row => {
    const tr = h('tr', '', tbody);
    row.cells.forEach((txt, k) => h('td', cols[k].cls, tr, txt));
    return tr;
  });
  return {
    table, rows, trs, colNames: cols.map(x => x.n),
    markActive(idx) { rows.forEach((r, i) => trs[i].classList.toggle('lg-active', (idx & ~r.mask) === r.v)); },
  };
}

export function tableToMarkdown(colNames, cellRows) {
  const row = cells => '| ' + cells.join(' | ') + ' |';
  return [row(colNames), row(colNames.map(() => ':-:')), ...cellRows.map(row)].join('\n');
}
