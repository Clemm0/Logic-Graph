var DEFAULTS = {
  maxInputs: DEFAULT_MAX_INPUTS,
  maxGates: DEFAULT_MAX_GATES,
  showTable: true,
  showExpr: true,
  showKmap: false,
  collapseDontCare: false,
  delayEnabled: false,
  delaySeconds: 1,
  // -1 = random 0..5 s per gate
  timingView: "graph",
  // graph | animation | both
  bubblePushing: false,
  expSimplify: false,
  // experimental
  simplifyMethod: "structural",
  // structural | best | sop | pos | nand | nor
  hSpacing: "90",
  // "90" (px) or "100%" (spread over the page width)
  vSpacing: 16,
  importProvider: "local",
  // used by the Image Import extension
  keys: { claude: "", gemini: "", grok: "", deepseek: "", openrouter: "" },
  models: { claude: "claude-sonnet-5-5", gemini: "", grok: "", deepseek: "", openrouter: "" }
};
function sanitizeSettings(raw) {
  const s2 = Object.assign({}, DEFAULTS, raw || {});
  s2.maxInputs = clamp(Math.round(Number(s2.maxInputs)) || DEFAULTS.maxInputs, 1, HARD_MAX_INPUTS);
  s2.maxGates = clamp(Math.round(Number(s2.maxGates)) || DEFAULTS.maxGates, 1, HARD_MAX_GATES);
  const d = Number(s2.delaySeconds);
  s2.delaySeconds = Number.isFinite(d) ? d < 0 ? -1 : clamp(d, 0, 30) : DEFAULTS.delaySeconds;
  const v = Number(s2.vSpacing);
  s2.vSpacing = Number.isFinite(v) ? clamp(Math.round(v), 0, 200) : DEFAULTS.vSpacing;
  if (!parseSpacing(s2.hSpacing)) s2.hSpacing = DEFAULTS.hSpacing;
  if (!REDUCE_METHODS.includes(s2.simplifyMethod)) s2.simplifyMethod = "structural";
  if (!TIMING_VIEWS.includes(s2.timingView)) s2.timingView = "graph";
  s2.keys = Object.assign({}, DEFAULTS.keys, raw && raw.keys || {});
  s2.models = Object.assign({}, DEFAULTS.models, raw && raw.models || {});
  if (raw && raw.apiKey && !s2.keys.claude) s2.keys.claude = raw.apiKey;
  if (raw && raw.model && !(raw.models && raw.models.claude)) s2.models.claude = raw.model;
  delete s2.apiKey;
  delete s2.model;
  if (!["local", "claude", "gemini", "grok", "deepseek", "openrouter"].includes(s2.importProvider)) s2.importProvider = "local";
  return s2;
}
function parseSpacing(str) {
  const m = String(str).trim().match(/^(\d+(?:\.\d+)?)\s*(%|px)?$/i);
  if (!m) return null;
  const v = parseFloat(m[1]);
  return m[2] === "%" ? { pct: clamp(v, 10, 400) } : { px: clamp(Math.round(v), 40, 1e3) };
}