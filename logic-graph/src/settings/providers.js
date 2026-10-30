var PROVIDERS = {
  local: { name: "Local recognizer (offline, Image Import extension)" },
  claude: { name: "Claude (Anthropic)", keyHint: "sk-ant-\u2026", modelHint: "claude-sonnet-5-5" },
  gemini: { name: "Gemini (Google)", keyHint: "AIza\u2026", modelHint: "model name" },
  grok: { name: "Grok (xAI)", keyHint: "xai-\u2026", modelHint: "model name" },
  deepseek: { name: "DeepSeek", keyHint: "sk-\u2026", modelHint: "model name" },
  openrouter: { name: "OpenRouter", keyHint: "sk-or-\u2026", modelHint: "provider/model" }
};
var IMPORT_EXTENSION_ID = "logic-graph-import";