// Merges truth-table rows into rows with X (don't care).


// Merge truth-table rows that have identical outputs and differ in one input -> rows with X.
export function compactRows(c, all) {
  const n = c.inputs.length;
  let cur = all.map((r, i) => ({ v: i, mask: 0, key: c.outputs.map(o => r[o]).join('') }));
  let changed = true;
  while (changed) {
    changed = false;
    const groups = new Map();
    cur.forEach(t => {
      const k = t.mask + '|' + t.key;
      if (!groups.has(k)) groups.set(k, new Map());
      groups.get(k).set(t.v, t);
    });
    const next = [], used = new Set();
    for (const grp of groups.values()) {
      for (const t of grp.values()) {
        if (used.has(t)) continue;
        let merged = false;
        for (let b = 0; b < n && !merged; b++) {
          const bit = 1 << b;
          if (t.mask & bit) continue;
          const p = grp.get(t.v ^ bit);
          if (p && !used.has(p)) {
            used.add(t); used.add(p);
            next.push({ v: t.v & ~bit, mask: t.mask | bit, key: t.key });
            merged = changed = true;
          }
        }
        if (!merged) { used.add(t); next.push(t); }
      }
    }
    cur = next;
  }
  return cur.sort((a, b) => a.v - b.v || a.mask - b.mask);
}
