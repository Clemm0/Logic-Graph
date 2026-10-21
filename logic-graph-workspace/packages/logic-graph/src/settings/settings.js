// Setting defaults, validation, spacing parser.

import { DEFAULT_MAX_GATES, DEFAULT_MAX_INPUTS, HARD_MAX_GATES, HARD_MAX_INPUTS, REDUCE_METHODS, TIMING_VIEWS, clamp } from '../core/constants.js';

export const DEFAULTS = {
  maxInputs: DEFAULT_MAX_INPUTS,
  maxGates: DEFAULT_MAX_GATES,
  showTable: true,
  showExpr: true,
  showKmap: false,
  collapseDontCare: false,
  delayEnabled: false,
  delaySeconds: 1,            // -1 = random 0..5 s per gate
  timingView: 'graph',        // graph | animation | both
  bubblePushing: false,
  expSimplify: false,         // experimental
  simplifyMethod: 'structural', // structural | best | sop | pos | nand | nor
  hSpacing: '90',             // "90" (px) or "100%" (spread over the page width)
  vSpacing: 16,
  importProvider: 'local',    // used by the Image Import extension
  keys: { claude: '', gemini: '', grok: '', deepseek: '', openrouter: '' },
  models: { claude: 'claude-sonnet-5-5', gemini: '', grok: '', deepseek: '', openrouter: '' },
};



export function sanitizeSettings(raw) {
  const s = Object.assign({}, DEFAULTS, raw || {});
  s.maxInputs = clamp(Math.round(Number(s.maxInputs)) || DEFAULTS.maxInputs, 1, HARD_MAX_INPUTS);
  s.maxGates = clamp(Math.round(Number(s.maxGates)) || DEFAULTS.maxGates, 1, HARD_MAX_GATES);
  const d = Number(s.delaySeconds);
  s.delaySeconds = Number.isFinite(d) ? (d < 0 ? -1 : clamp(d, 0, 30)) : DEFAULTS.delaySeconds;
  const v = Number(s.vSpacing);
  s.vSpacing = Number.isFinite(v) ? clamp(Math.round(v), 0, 200) : DEFAULTS.vSpacing;
  if (!parseSpacing(s.hSpacing)) s.hSpacing = DEFAULTS.hSpacing;
  if (!REDUCE_METHODS.includes(s.simplifyMethod)) s.simplifyMethod = 'structural';
  if (!TIMING_VIEWS.includes(s.timingView)) s.timingView = 'graph';
  s.keys = Object.assign({}, DEFAULTS.keys, (raw && raw.keys) || {});
  s.models = Object.assign({}, DEFAULTS.models, (raw && raw.models) || {});
  if (raw && raw.apiKey && !s.keys.claude) s.keys.claude = raw.apiKey;      // migrate v0.2
  if (raw && raw.model && !(raw.models && raw.models.claude)) s.models.claude = raw.model;
  delete s.apiKey; delete s.model;
  if (!['local', 'claude', 'gemini', 'grok', 'deepseek', 'openrouter'].includes(s.importProvider)) s.importProvider = 'local';
  return s;
}

// "90" / "90px" -> {px:90};  "100%" -> {pct:100}
export function parseSpacing(str) {
  const m = String(str).trim().match(/^(\d+(?:\.\d+)?)\s*(%|px)?$/i);
  if (!m) return null;
  const v = parseFloat(m[1]);
  return m[2] === '%' ? { pct: clamp(v, 10, 400) } : { px: clamp(Math.round(v), 40, 1000) };
}
