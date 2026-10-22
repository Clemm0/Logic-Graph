// Circuit templates and the template picker.

import { FuzzySuggestModal } from 'obsidian';

export const TEMPLATES = [
  { name: 'Blank (two-input AND)', code: '(a,b) AND (y)' },
  { name: 'Half adder', code: '(a,b) XOR (sum)\n(a,b) AND (carry)' },
  { name: 'Full adder', code: '(a,b) XOR (t)\n(t,cin) XOR (sum)\n(a,b) AND (x)\n(t,cin) AND (z)\n(x,z) OR (cout)' },
  { name: '2-to-1 multiplexer', code: '(s) NOT (ns)\n(a,ns) AND (x)\n(b,s) AND (z)\n(x,z) OR (y)' },
  { name: '2-to-4 decoder', code: '(a) NOT (na)\n(b) NOT (nb)\n(na,nb) AND (y0)\n(na,b) AND (y1)\n(a,nb) AND (y2)\n(a,b) AND (y3)' },
  { name: '3-input majority', code: '(a,b) AND (x)\n(b,c) AND (y)\n(a,c) AND (z)\n(x,y,z) OR (maj)' },
  { name: '4-bit parity (XOR tree)', code: '(a,b) XOR (p1)\n(c,d) XOR (p2)\n(p1,p2) XOR (parity)' },
  { name: 'XOR from NAND gates', code: '(a,b) NAND (n1)\n(a,n1) NAND (n2)\n(b,n1) NAND (n3)\n(n2,n3) NAND (y)' },
];

export const fence = code => '```logic\n' + code + '\n```\n';

export class TemplateModal extends FuzzySuggestModal {
  constructor(app, onPick) { super(app); this.onPick = onPick; this.setPlaceholder('Choose a circuit template…'); }
  getItems() { return TEMPLATES; }
  getItemText(t) { return t.name; }
  onChooseItem(t) { this.onPick(t); }
}
