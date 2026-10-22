// Cloud providers (under construction): token checks, error messages, Claude adapter (disabled).

import { arrayBufferToBase64, requestUrl } from 'obsidian';

export const CLOUD_ENABLED = false;           // flip when the provider adapters are finished

export const PROVIDERS = {
  claude:     { name: 'Claude (Anthropic)', tokenRe: /^sk-ant-[\w-]{10,}$/ },
  gemini:     { name: 'Gemini (Google)', tokenRe: /^AIza[\w-]{20,}$/ },
  grok:       { name: 'Grok (xAI)', tokenRe: /^xai-[\w-]{10,}$/ },
  deepseek:   { name: 'DeepSeek', tokenRe: /^sk-[\w-]{10,}$/ },
  openrouter: { name: 'OpenRouter', tokenRe: /^sk-or-[\w-]{10,}$/ },
};

export class ImportError extends Error {}

export function checkToken(provider, key) {
  const p = PROVIDERS[provider];
  if (!key || !String(key).trim()) {
    throw new ImportError(`API token not found for ${p.name}. Add it in Settings > Logic Graph > Import from image.`);
  }
  if (!p.tokenRe.test(String(key).trim())) {
    throw new ImportError(`The API token for ${p.name} looks invalid (wrong format). Check that you copied the whole key.`);
  }
}

export function explainHttp(provider, status, detail) {
  const name = PROVIDERS[provider].name;
  if (status === 401 || status === 403) return `Invalid or expired API token for ${name} (HTTP ${status}). Check the token in the settings.`;
  if (status === 429) return `${name} refused the request: rate limit or quota reached (HTTP 429). Try again later.`;
  if (status === 400) return `${name} could not use this request (HTTP 400): ${detail || 'bad request'}.`;
  return `${name} returned an error (HTTP ${status})${detail ? ': ' + detail : ''}.`;
}

export const IMPORT_PROMPT = `You are reading a picture of a combinational logic circuit (gate diagram or schematic).
Transcribe it into this exact text format, one gate per line:

(input1,input2) GATE (output)

Rules:
- GATE is one of: AND, OR, NAND, NOR, XOR, XNOR, NOT, BUF.
- Use the signal names written in the picture. If a wire has no label, invent short names: a, b, c... for circuit inputs, and w1, w2, ... for internal wires.
- Every signal is driven by exactly one gate. Inputs are signals no gate drives.
- NOT and BUF have exactly one input; the other gates have 2 to 6 inputs.
- Signal names may only contain letters, digits and underscores.
- Reply with ONLY the gate lines. No explanation and no code fences.`;

export async function claudeImport(settings, buffer, ext) {
  const media = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp' }[ext.toLowerCase()];
  const res = await requestUrl({
    url: 'https://api.anthropic.com/v1/messages',
    method: 'POST',
    headers: { 'x-api-key': settings.keys.claude.trim(), 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: settings.models.claude || 'claude-sonnet-5-5',
      max_tokens: 2000,
      messages: [{ role: 'user', content: [
        { type: 'image', source: { type: 'base64', media_type: media, data: arrayBufferToBase64(buffer) } },
        { type: 'text', text: IMPORT_PROMPT },
      ] }],
    }),
    throw: false,
  });
  if (res.status !== 200) throw new ImportError(explainHttp('claude', res.status, res.json && res.json.error && res.json.error.message));
  const text = (res.json.content || []).filter(p => p.type === 'text').map(p => p.text).join('\n');
  return { text: text.replace(/```[a-z]*\n?/gi, '').replace(/```/g, '').trim(), notes: ['Read by an online model: check it against the picture.'] };
}

// Order matters: token problems are reported first, then "under construction".
export async function cloudImport(provider, settings, buffer, ext) {
  checkToken(provider, settings.keys[provider]);
  if (!CLOUD_ENABLED) throw new ImportError(`${PROVIDERS[provider].name} import is under construction. Use the local recognizer for now.`);
  if (provider !== 'claude') throw new ImportError(`${PROVIDERS[provider].name} is not implemented yet.`);
  return claudeImport(settings, buffer, ext);
}
