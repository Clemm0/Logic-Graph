// Export a figure as PNG/SVG (inlines the theme CSS).

import { Menu, Notice } from 'obsidian';
import { SVGNS, h } from './dom.js';

export const STYLE_PROPS = ['fill', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-opacity', 'stroke-linejoin',
  'stroke-linecap', 'stroke-dasharray', 'opacity', 'font-size', 'font-family', 'font-weight', 'text-anchor'];

// Copies the SVG and bakes the theme's CSS into it, so it looks the same outside Obsidian.
export function svgSnapshot(svg) {
  const clone = svg.cloneNode(true);
  const src = [svg, ...svg.querySelectorAll('*')], dst = [clone, ...clone.querySelectorAll('*')];
  src.forEach((el, i) => {
    const cs = getComputedStyle(el);
    STYLE_PROPS.forEach(p => { const v = cs.getPropertyValue(p); if (v) dst[i].style.setProperty(p, v); });
    dst[i].removeAttribute('class');
  });
  clone.style.removeProperty('max-width');
  const vb = clone.getAttribute('viewBox').split(/\s+/).map(Number);
  const bg = (getComputedStyle(document.body).getPropertyValue('--background-primary') || '').trim() || '#ffffff';
  const rect = document.createElementNS(SVGNS, 'rect');
  rect.setAttribute('x', 0); rect.setAttribute('y', 0);
  rect.setAttribute('width', vb[2]); rect.setAttribute('height', vb[3]);
  rect.setAttribute('fill', bg);
  clone.insertBefore(rect, clone.firstChild);
  clone.setAttribute('xmlns', SVGNS);
  clone.setAttribute('width', vb[2]); clone.setAttribute('height', vb[3]);
  return { text: new XMLSerializer().serializeToString(clone), width: vb[2], height: vb[3] };
}

export async function svgToPng(snap, scale) {
  const url = URL.createObjectURL(new Blob([snap.text], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error('could not render the image')); img.src = url; });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(snap.width * scale); canvas.height = Math.round(snap.height * scale);
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise(res => canvas.toBlob(res, 'image/png'));
  } finally { URL.revokeObjectURL(url); }
}

export async function saveToVault(app, baseName, ext, buffer) {
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const filename = `${baseName}-${stamp}.${ext}`;
  let path = filename;
  try { if (app.fileManager && app.fileManager.getAvailablePathForAttachment) path = await app.fileManager.getAvailablePathForAttachment(filename); } catch (e) { path = filename; }
  await app.vault.createBinary(path, buffer);
  new Notice(`Saved ${path}`);
}

export function addExportButton(head, app, getSvg, baseName) {
  if (!app || typeof Menu === 'undefined') return;
  const btn = h('button', 'lg-small', head, 'export');
  btn.addEventListener('click', evt => {
    const svg = getSvg();
    if (!svg) return;
    const run = fn => async () => { try { await fn(svgSnapshot(svg)); } catch (e) { new Notice('Export failed: ' + e.message); } };
    const menu = new Menu();
    menu.addItem(i => i.setTitle('Save as PNG').setIcon('image').onClick(run(async snap => {
      const blob = await svgToPng(snap, 2);
      await saveToVault(app, baseName, 'png', await blob.arrayBuffer());
    })));
    menu.addItem(i => i.setTitle('Save as SVG').setIcon('file-code').onClick(run(async snap => {
      await saveToVault(app, baseName, 'svg', new TextEncoder().encode(snap.text).buffer);
    })));
    menu.addItem(i => i.setTitle('Copy PNG to clipboard').setIcon('copy').onClick(run(async snap => {
      const blob = await svgToPng(snap, 2);
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      new Notice('Image copied');
    })));
    menu.showAtMouseEvent(evt);
  });
}
