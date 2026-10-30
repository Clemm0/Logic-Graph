// Image-import provider list (settings UI only).


// The import itself lives in the separate "Logic Graph - Image Import" extension.
export const PROVIDERS = {
  local:      { name: 'Local recognizer (offline, Image Import extension)' },
  claude:     { name: 'Claude (Anthropic)', keyHint: 'sk-ant-…', modelHint: 'claude-sonnet-5-5' },
  gemini:     { name: 'Gemini (Google)', keyHint: 'AIza…', modelHint: 'model name' },
  grok:       { name: 'Grok (xAI)', keyHint: 'xai-…', modelHint: 'model name' },
  deepseek:   { name: 'DeepSeek', keyHint: 'sk-…', modelHint: 'model name' },
  openrouter: { name: 'OpenRouter', keyHint: 'sk-or-…', modelHint: 'provider/model' },
};

export const IMPORT_EXTENSION_ID = 'logic-graph-import';
