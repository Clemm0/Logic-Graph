// packages/logic-graph/src/main.js
import { GATES } from "core/gates.js";
import { Plugin } from "obsidian";
const import_obsidian7 = { Plugin };
var LogicGraphPlugin = class extends import_obsidian7.Plugin {
  constructor() {
    super(...arguments);
    this.liveBlocks = /* @__PURE__ */ new Set();
  }
  async onload() {
    await this.loadSettings();
    this.addSettingTab(new LogicGraphSettingTab(this.app, this));
    this.api = {
      version: manifest_default.version,
      parse: (src, limits) => parse(src, limits),
      getSettings: () => this.settings,
      providers: PROVIDERS,
      fence
    };
    ["logic", "Logic", "logic-graph"].forEach((lang) => this.registerMarkdownCodeBlockProcessor(lang, (source, el) => {
      const handle = renderBlock(source, el, this);
      if (handle && handle.dispose) this.liveBlocks.add(handle);
      if (typeof MutationObserver !== "undefined") {
        const mo = new MutationObserver(() => {
          if (!el.isConnected) {
            mo.disconnect();
            if (handle && handle.dispose) {
              handle.dispose();
              this.liveBlocks.delete(handle);
            }
          }
        });
        mo.observe(document.body, { childList: true, subtree: true });
      }
    }));
    this.addCommand({
      id: "insert-block",
      name: "Insert logic block",
      editorCallback: (ed) => ed.replaceSelection(fence("(a,b) AND (c)\n(c,b) XOR (d)\n(d) NOT (y)"))
    });
    this.addCommand({
      id: "insert-help",
      name: "Insert help block (@help)",
      editorCallback: (ed) => ed.replaceSelection(fence("@help"))
    });
    this.addCommand({
      id: "insert-template",
      name: "Insert logic block from template\u2026",
      editorCallback: (ed) => new TemplateModal(this.app, (t) => ed.replaceSelection(fence(t.code))).open()
    });
    this.addCommand({
      id: "wrap-selection",
      name: "Wrap selection in logic block",
      editorCallback: (ed) => {
        const sel = ed.getSelection();
        ed.replaceSelection(fence(sel || "(a,b) AND (y)"));
      }
    });
    Object.keys(GATES).forEach((type) => {
      this.addCommand({
        id: "gate-" + type.toLowerCase(),
        name: `Insert gate line: ${type}`,
        editorCallback: (ed) => ed.replaceSelection(GATES[type].min === 1 ? `(a) ${type} (y)
` : `(a,b) ${type} (y)
`)
      });
    });
    ["@simplify structural", "@bubbles", "@timing-both", "@timing-graph", "@timing-animation", "@hide table", "@show kmap"].forEach((d) => {
      this.addCommand({
        id: "directive-" + d.slice(1).replace(/\s+/g, "-"),
        name: `Insert directive: ${d}`,
        editorCallback: (ed) => ed.replaceSelection(d + "\n")
      });
    });
  }
  onunload() {
    this.liveBlocks.forEach((b) => {
      if (b.dispose) b.dispose();
    });
    this.liveBlocks.clear();
  }
  refreshAll() {
    this.app.workspace.getLeavesOfType("markdown").forEach((leaf) => {
      const view = leaf.view;
      if (!view) return;
      if (view.previewMode && typeof view.previewMode.rerender === "function") {
        view.previewMode.rerender(true);
      }
    });
  }
  async loadSettings() {
    this.settings = sanitizeSettings(await this.loadData());
  }
  async saveSettings() {
    this.settings = Object.assign(this.settings, sanitizeSettings(this.settings));
    await this.saveData(this.settings);
  }
};
export default LogicGraphPlugin;