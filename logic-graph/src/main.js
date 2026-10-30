var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

var main_exports = {};
__export(main_exports, {
  default: () => LogicGraphPlugin
});
module.exports = __toCommonJS(main_exports);

var import_obsidian = require("obsidian");

var LogicGraphPlugin = class extends import_obsidian.Plugin {
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
    ["logic", "Logic", "logic-graph"].forEach((lang) => this.registerMarkdownCodeBlockProcessor(lang, (source, el) => renderBlock(source, el, this)));
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
  async loadSettings() {
    this.settings = sanitizeSettings(await this.loadData());
  }
  async saveSettings() {
    this.settings = Object.assign(this.settings, sanitizeSettings(this.settings));
    await this.saveData(this.settings);
  }
};
