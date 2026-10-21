// The @help reference zone.

import { renderBlock } from './block.js';
import { copy } from './copy.js';
import { h } from './dom.js';

export const HALF_ADDER = '(a,b) XOR (sum)\n(a,b) AND (carry)';

export const HELP = [
  { title: 'Gates', note: 'One gate per line: (inputs) GATE (output). Up to 6 inputs per gate.', items: [
    ['AND', 'Output is 1 only when every input is 1.', '(a,b) AND (y)'],
    ['OR', 'Output is 1 when at least one input is 1.', '(a,b) OR (y)'],
    ['NAND', 'AND followed by NOT.', '(a,b) NAND (y)'],
    ['NOR', 'OR followed by NOT.', '(a,b) NOR (y)'],
    ['XOR', 'Output is 1 when an odd number of inputs are 1.', '(a,b) XOR (y)'],
    ['XNOR', 'Output is 1 when an even number of inputs are 1.', '(a,b) XNOR (y)'],
    ['NOT', 'Inverts its single input.', '(a) NOT (y)'],
    ['BUF', 'Copies its single input (a buffer).', '(a) BUF (y)'],
  ] },
  { title: 'Writing circuits', items: [
    ['Several gates', 'Signals no gate drives are the inputs. Signals nothing uses are the outputs. Names may contain letters, digits and _.', HALF_ADDER],
    ['Wide gates', 'Gates can take 2 to 6 inputs.', '(a,b,c,d) AND (y)'],
    ['Comments', 'Everything after # or // is ignored.', '(a,b) AND (y)  # a comment\n// another comment'],
  ] },
  { title: 'Directives (first lines of a block)', items: [
    ['@help', 'Shows this reference above the circuit.', '@help\n(a,b) AND (y)'],
    ['@hide / @show', 'Hide or show: table, expr, diagram, kmap, timing.', '@hide table\n@show kmap\n(a,b,c) OR (y)'],
    ['@simplify / @reduce', 'Draws a reduced circuit and checks it is equivalent. Methods: structural, best, sop, pos, nand, nor, off.', '@simplify structural\n(a) NOT (n1)\n(n1) NOT (n2)\n(n2,b) AND (y)'],
    ['@simplify nand', 'Rebuilds the function as NAND-NAND from the minimal cover (can be larger than the original).', '@simplify nand\n(a,b) AND (x)\n(b,c) AND (y1)\n(x,y1) OR (y)'],
    ['@bubbles', 'Bubble pushing: gates are drawn with their De Morgan symbol so bubbles match. Click a gate to flip it by hand.', '@bubbles\n(a,b) NAND (p)\n(c,d) NAND (q)\n(p,q) NAND (y)'],
    ['@compact', 'Merges truth-table rows that do not depend on some inputs (shown as X).', '@compact\n(a,b) AND (x)\n(x,c) OR (y)'],
    ['@delay', 'Seconds of delay per gate (0 to 30), "random" (0 to 5 s), or off.', '@delay 0.5\n(a,b) AND (c)\n(c) NOT (y)'],
    ['@timing-graph', 'Delays on, with the timing graph (waveforms).', '@timing-graph\n@delay 0.5\n(a,b) AND (c)\n(c,b) XOR (y)'],
    ['@timing-animation', 'Delays on, with bits travelling along the wires and gate lamps (green = 1, red/orange = 0).', '@timing-animation\n@delay 1\n(a,b) AND (c)\n(c,b) XOR (y)'],
    ['@timing-both', 'Graph and animation together.', '@timing-both\n@delay 1\n(a,b) AND (c)\n(c,b) XOR (y)'],
  ] },
  { title: 'Things you can click', items: [
    ['Input boxes', 'Click a box on the left of the diagram to flip that input between 0 and 1.', null],
    ['Truth-table rows', 'Click a row to set the inputs to that row. The active row is highlighted.', null],
    ['Karnaugh cells', 'Click a cell to set the inputs to that cell. Coloured outlines are the groups; outlines that stop at an edge wrap around.', null],
    ['Gates in @bubbles view', 'Click a gate to flip it between its two De Morgan symbols. "reset" restores the automatic layout.', null],
    ['export', 'On every figure: save as PNG or SVG in your vault, or copy the PNG.', null],
    ['Copy buttons', 'Copy the truth table (Markdown), the expressions (LaTeX) or the circuit (Mermaid).', null],
  ] },
  { title: 'Commands (Ctrl/Cmd + P)', items: [
    ['Logic Graph: Insert logic block', 'Inserts an example block.', null],
    ['Logic Graph: Insert logic block from template…', 'Half adder, full adder, multiplexer, decoder, majority, parity, XOR from NAND.', null],
    ['Logic Graph: Wrap selection in logic block', 'Turns the selected text into a block.', null],
    ['Logic Graph: Insert gate line / directive', 'One command for each gate type and the common directives.', null],
    ['Image Import extension', 'Optional extension: "Import circuit from image".', null],
  ] },
  { title: 'Settings', items: [
    ['Limits', 'Max inputs (up to 32) and max gates (up to 256). Truth tables, Karnaugh maps and simplification work up to 12 inputs.', null],
    ['Display', 'Show table / expressions / Karnaugh maps by default, compact table, bubble pushing.', null],
    ['Timing', 'Gate delay and the default timing view (graph, animation or both).', null],
    ['Graphic values', 'Horizontal spacing in px or % of the page width, vertical spacing in px.', null],
    ['Experimental', 'Always draw a reduced circuit, and choose the method.', null],
  ] },
];

export function renderHelp(parent, plugin) {
  const zone = h('div', 'lg-help', parent);
  h('div', 'lg-help-title', zone, 'Logic Graph reference');
  HELP.forEach(sec => {
    const box = h('div', 'lg-help-sec', zone);
    h('div', 'lg-title', box, sec.title);
    if (sec.note) h('div', 'lg-note', box, sec.note);
    sec.items.forEach(([name, desc, example]) => {
      if (!example) {
        const row = h('div', 'lg-help-row', box);
        h('b', '', row, name);
        h('span', '', row, ' - ' + desc);
        return;
      }
      const det = h('details', 'lg-help-item', box);
      const sum = h('summary', '', det);
      h('b', '', sum, name);
      h('span', '', sum, ' - ' + desc);
      let done = false;
      det.addEventListener('toggle', () => {
        if (!det.open || done) return;
        done = true;
        h('pre', 'lg-help-code', det, example);
        h('button', 'lg-small', det, 'copy example').addEventListener('click', () => copy('```logic\n' + example + '\n```'));
        renderBlock(example, h('div', 'lg-help-live', det), plugin);
      });
    });
  });
}
