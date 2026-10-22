// Glue: decode an image, choose local/cloud, validate the result.

import { ImportError, cloudImport } from './providers.js';
import { recognize } from './vision/recognize.js';

export async function decodeImage(buffer, ext) {
  const type = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp' }[ext.toLowerCase()] || 'image/png';
  const bmp = await createImageBitmap(new Blob([buffer], { type }));
  const scale = Math.min(1, 1800 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bmp.width * scale));
  canvas.height = Math.max(1, Math.round(bmp.height * scale));
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

export async function localImport(buffer, ext, decode) {
  const img = await (decode || decodeImage)(buffer, ext);
  return recognize(img);
}

// returns {text, notes, problem}; throws ImportError for user-facing failures
export async function importImage(main, buffer, ext, decode) {
  const settings = main.api.getSettings();
  const provider = settings.importProvider || 'local';
  const result = provider === 'local' ? await localImport(buffer, ext, decode) : await cloudImport(provider, settings, buffer, ext);
  if (!result.text) throw new ImportError((result.notes && result.notes[0]) || 'No circuit could be read from this image.');
  let problem = null;
  try { main.api.parse(result.text, { maxInputs: 32, maxGates: 256 }); } catch (e) { problem = e.message; }
  return Object.assign(result, { problem });
}
