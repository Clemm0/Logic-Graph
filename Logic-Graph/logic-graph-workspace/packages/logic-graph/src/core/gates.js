// Gate table (truth functions, drawing shape) and gate-family lookups.


export const GATES = {
  AND:  { min: 2, shape: 'AND', inv: false, fn: v => v.every(x => x) },
  NAND: { min: 2, shape: 'AND', inv: true,  fn: v => !v.every(x => x) },
  OR:   { min: 2, shape: 'OR',  inv: false, fn: v => v.some(x => x) },
  NOR:  { min: 2, shape: 'OR',  inv: true,  fn: v => !v.some(x => x) },
  XOR:  { min: 2, shape: 'XOR', inv: false, fn: v => v.filter(x => x).length % 2 === 1 },
  XNOR: { min: 2, shape: 'XOR', inv: true,  fn: v => v.filter(x => x).length % 2 === 0 },
  NOT:  { min: 1, max: 1, shape: 'BUF', inv: true,  fn: v => !v[0] },
  BUF:  { min: 1, max: 1, shape: 'BUF', inv: false, fn: v => !!v[0] },
};

export const SHAPE_FN = {
  AND: v => v.every(x => x),
  OR:  v => v.some(x => x),
  XOR: v => v.filter(x => x).length % 2 === 1,
  BUF: v => !!v[0],
};

export const INVERSE = { AND: 'NAND', NAND: 'AND', OR: 'NOR', NOR: 'OR', XOR: 'XNOR', XNOR: 'XOR' };

export const BASE = { AND: 'AND', NAND: 'AND', OR: 'OR', NOR: 'OR', XOR: 'XOR', XNOR: 'XOR' };

export const INVERTING = { NAND: 1, NOR: 1, XNOR: 1, NOT: 1 };
