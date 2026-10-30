var import_obsidian = require("obsidian");

var SVGNS = "http://www.w3.org/2000/svg";
function h(tag, cls, parent, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== void 0) e.textContent = text;
  if (parent) parent.appendChild(e);
  return e;
}
function s(tag, attrs, parent, text) {
  const e = document.createElementNS(SVGNS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (text !== void 0) e.textContent = text;
  if (parent) parent.appendChild(e);
  return e;
}
var later = (fn) => typeof requestAnimationFrame === "function" ? requestAnimationFrame(fn) : setTimeout(fn, 0);
function math(latex, parent) {
  if (typeof import_obsidian.renderMath === "function") parent.appendChild((0, import_obsidian.renderMath)(latex, false));
  else parent.appendChild(document.createTextNode(latex));
}