// Tiny DOM/SVG helpers.

import { renderMath } from 'obsidian';

export const SVGNS = 'http://www.w3.org/2000/svg';

export function h(tag, cls, parent, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  if (parent) parent.appendChild(e);
  return e;
}

export function s(tag, attrs, parent, text) {
  const e = document.createElementNS(SVGNS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (text !== undefined) e.textContent = text;
  if (parent) parent.appendChild(e);
  return e;
}

export const later = fn => (typeof requestAnimationFrame === 'function' ? requestAnimationFrame(fn) : setTimeout(fn, 0));

export function math(latex, parent) {
  if (typeof renderMath === 'function') parent.appendChild(renderMath(latex, false));
  else parent.appendChild(document.createTextNode(latex));
}
