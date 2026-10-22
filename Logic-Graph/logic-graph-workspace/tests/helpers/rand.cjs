// Deterministic pseudo-random numbers and random-circuit generator for property tests.
function rng(seed) { let s = seed; return () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff; }
const TYPES = ['AND', 'OR', 'NAND', 'NOR', 'XOR', 'XNOR', 'NOT', 'BUF'];
function randomCircuit(rnd, nIn, nGates, types = TYPES) {
  const pick = a => a[Math.floor(rnd() * a.length)];
  const sigs = Array.from({ length: nIn }, (_, i) => 'i' + i), lines = [];
  for (let g = 0; g < nGates; g++) {
    const t = pick(types), unary = t === 'NOT' || t === 'BUF', k = unary ? 1 : 2 + Math.floor(rnd() * 2);
    const ins = new Set(); let guard = 0;
    while (ins.size < k && guard++ < 20) ins.add(pick(sigs));
    if (ins.size < k) { g--; continue; }
    lines.push(`(${[...ins].join(',')}) ${t} (g${g})`); sigs.push('g' + g);
  }
  return lines.join('\n');
}
module.exports = { rng, randomCircuit, TYPES };
