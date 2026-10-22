// A minimal fake of the "obsidian" module, aliased in by scripts/test.mjs.
// Everything the tests may want to inspect is collected in `__log`.
export const __log = { notices: [], settings: [], commands: [], clipboard: [] };

export class Notice { constructor(msg) { __log.notices.push(msg); } hide() {} }

export class Menu {
  constructor() { this.items = []; Menu.last = this; }
  addItem(fn) {
    const it = { setTitle(t) { this.title = t; return this; }, setIcon() { return this; }, onClick(f) { this.fn = f; return this; } };
    fn(it); this.items.push(it); return this;
  }
  showAtMouseEvent() {}
}

export class Setting {
  constructor() { this.rec = {}; __log.settings.push(this.rec); }
  setName(n) { this.rec.name = n; return this; }
  setDesc(d) { this.rec.desc = d; return this; }
  setHeading() { this.rec.heading = true; return this; }
  addText(f) {
    const t = { inputEl: {}, setValue(v) { this.v = v; return this; }, setPlaceholder(p) { this.ph = p; return this; }, setDisabled(d) { this.disabled = d; return this; }, onChange(fn) { this.fn = fn; return this; } };
    f(t); this.rec.text = t; return this;
  }
  addToggle(f) {
    const t = { setValue(v) { this.v = v; return this; }, onChange(fn) { this.fn = fn; return this; } };
    f(t); this.rec.toggle = t; return this;
  }
  addDropdown(f) {
    const d = { options: [], addOption(k) { this.options.push(k); }, setValue(v) { this.v = v; return this; }, onChange(fn) { this.fn = fn; return this; } };
    f(d); this.rec.dropdown = d; return this;
  }
}

class FakeEl {
  constructor() { this.classes = new Set(); }
  empty() {} createEl() { return new FakeEl(); } createDiv(o) { const e = new FakeEl(); if (o && o.cls) e.classes.add(o.cls); return e; }
  addClass(c) { this.classes.add(c); } appendChild() {}
}
export class PluginSettingTab { constructor(app, plugin) { this.app = app; this.plugin = plugin; this.containerEl = new FakeEl(); } }
export class FuzzySuggestModal { constructor(app) { this.app = app; } setPlaceholder() {} open() {} }

export class Plugin {
  constructor() { this.app = { plugins: { plugins: {} }, vault: {}, fileManager: {} }; this._data = null; this.processors = {}; this.commands = []; }
  async loadData() { return this._data; }
  async saveData(d) { this._data = JSON.parse(JSON.stringify(d)); }
  addSettingTab(t) { this.settingTab = t; }
  registerMarkdownCodeBlockProcessor(lang, fn) { this.processors[lang] = fn; }
  addCommand(c) { this.commands.push(c); }
}

export const renderMath = latex => { const e = document.createElement('span'); e.className = 'math'; e.textContent = latex; return e; };
export const finishRenderMath = () => {};
export const requestUrl = async () => { throw new Error('network is not available in tests'); };
export const arrayBufferToBase64 = () => '';
