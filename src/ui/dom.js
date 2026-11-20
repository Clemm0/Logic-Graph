// packages/logic-graph/src/ui/dom.js
import * as import_obsidian4 from "obsidian";
export const SVGNS = "http://www.w3.org/2000/svg";
export function h(tag, cls, parent, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== void 0) e.textContent = text;
  if (parent) parent.appendChild(e);
  return e;
}
export function s(tag, attrs, parent, text) {
  const e = document.createElementNS(SVGNS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (text !== void 0) e.textContent = text;
  if (parent) parent.appendChild(e);
  return e;
}
export function clickable(el, onActivate) {
  el.setAttribute("tabindex", "0");
  el.setAttribute("role", "button");
  el.addEventListener("click", onActivate);
  el.addEventListener("keydown", (evt) => {
    if (evt.key === "Enter" || evt.key === " ") {
      evt.preventDefault();
      onActivate(evt);
    }
  });
  return el;
}
export const later = (fn) => typeof requestAnimationFrame === "function" ? requestAnimationFrame(fn) : setTimeout(fn, 0);
export function math(latex, parent) {
  if (typeof import_obsidian4.renderMath === "function") parent.appendChild((0, import_obsidian4.renderMath)(latex, false));
  else parent.appendChild(document.createTextNode(latex));
}

