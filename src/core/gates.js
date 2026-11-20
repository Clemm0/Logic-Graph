export const GATES = {
  AND: { min: 2, shape: "AND", inv: false, fn: (v) => v.every((x) => x) },
  NAND: { min: 2, shape: "AND", inv: true, fn: (v) => !v.every((x) => x) },
  OR: { min: 2, shape: "OR", inv: false, fn: (v) => v.some((x) => x) },
  NOR: { min: 2, shape: "OR", inv: true, fn: (v) => !v.some((x) => x) },
  XOR: { min: 2, shape: "XOR", inv: false, fn: (v) => v.filter((x) => x).length % 2 === 1 },
  XNOR: { min: 2, shape: "XOR", inv: true, fn: (v) => v.filter((x) => x).length % 2 === 0 },
  NOT: { min: 1, max: 1, shape: "BUF", inv: true, fn: (v) => !v[0] },
  BUF: { min: 1, max: 1, shape: "BUF", inv: false, fn: (v) => !!v[0] },
  MUX: { 
    min: 3, 
    shape: "MUX", 
    inv: false, 
    fn: (v) => {
      const n = v.length;
      let k = 1;
      while ((1 << k) + k < n) k++;
      const data = v.slice(0, n - k);
      let idx = 0;
      for (let i = 0; i < k; i++) idx = (idx << 1) | (v[n - k + i] ? 1 : 0);
      return !!data[idx];
    } 
  }
};
export const INVERSE = { AND: "NAND", NAND: "AND", OR: "NOR", NOR: "OR", XOR: "XNOR", XNOR: "XOR" };
export const BASE = { AND: "AND", NAND: "AND", OR: "OR", NOR: "OR", XOR: "XOR", XNOR: "XOR" };
export const INVERTING = { NAND: 1, NOR: 1, XNOR: 1, NOT: 1 };