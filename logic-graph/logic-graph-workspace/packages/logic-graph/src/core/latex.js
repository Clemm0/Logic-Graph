// Structural boolean expression of a signal, as LaTeX.

export const nm = n => /^[A-Za-z]$/.test(n) ? n : `\\mathrm{${n.replace(/_/g, '\\_')}}`;

// Unsimplified expression following the circuit. p = precedence (OR 1 < XOR 2 < AND 3 < atom 5)
export function rawLatex(c, sig) {
  const memo = new Map();
  const go = x => {
    if (memo.has(x)) return memo.get(x);
    const g = c.driver[x];
    let r;
    if (!g) r = { s: nm(x), p: 5 };
    else {
      const kids = g.ins.map(go);
      const join = (op, p) => kids.map(k => (k.p < p ? `\\left(${k.s}\\right)` : k.s)).join(op);
      const AND = () => join(' \\cdot ', 3), OR = () => join(' + ', 1), XOR = () => join(' \\oplus ', 2);
      switch (g.type) {
        case 'AND':  r = { s: AND(), p: 3 }; break;
        case 'OR':   r = { s: OR(), p: 1 }; break;
        case 'XOR':  r = { s: XOR(), p: 2 }; break;
        case 'NAND': r = { s: `\\overline{${AND()}}`, p: 5 }; break;
        case 'NOR':  r = { s: `\\overline{${OR()}}`, p: 5 }; break;
        case 'XNOR': r = { s: `\\overline{${XOR()}}`, p: 5 }; break;
        case 'NOT':  r = { s: `\\overline{${kids[0].s}}`, p: 5 }; break;
        default:     r = kids[0];
      }
    }
    if (r.s.length > 2000) throw new Error('too long');
    memo.set(x, r);
    return r;
  };
  return go(sig).s;
}
