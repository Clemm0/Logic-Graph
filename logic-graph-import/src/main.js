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
  ImageModal: () => ImageModal,
  default: () => LogicGraphImport
});
module.exports = __toCommonJS(main_exports);
var import_obsidian = require("obsidian");

var ImageModal = class extends import_obsidian.FuzzySuggestModal {
  constructor(app, onPick) {
    super(app);
    this.onPick = onPick;
    this.setPlaceholder("Choose an image of a logic circuit\u2026");
  }
  getItems() {
    return this.app.vault.getFiles().filter((f) => /^(png|jpe?g|gif|webp)$/i.test(f.extension));
  }
  getItemText(f) {
    return f.path;
  }
  onChooseItem(f) {
    this.onPick(f);
  }
};
var LogicGraphImport = class extends import_obsidian.Plugin {
  onload() {
    this.addCommand({
      id: "import-image",
      name: "Import circuit from image",
      editorCallback: (ed) => new ImageModal(this.app, (f) => this.run(f, ed)).open()
    });
  }
  mainPlugin() {
    const m = this.app.plugins && this.app.plugins.plugins && this.app.plugins.plugins["logic-graph"];
    return m && m.api ? m : null;
  }
  async run(file, ed) {
    const main = this.mainPlugin();
    if (!main) {
      new import_obsidian.Notice("Logic Graph is not installed or not enabled. This extension needs it.");
      return;
    }
    const working = new import_obsidian.Notice("Reading the circuit\u2026", 0);
    try {
      const buffer = await this.app.vault.readBinary(file);
      const r = await importImage(main, buffer, file.extension);
      const header = "# imported from " + file.name + " - signal names are generated, please check against the picture\n";
      ed.replaceSelection(main.api.fence(header + r.text));
      const warn = (r.problem ? [r.problem] : []).concat((r.notes || []).filter((n) => !/^Signal names/.test(n)));
      new import_obsidian.Notice(`Imported ${r.lines ? r.lines.length : r.text.split("\n").length} line(s).` + (warn.length ? " Check: " + warn.join(" ") : ""), warn.length ? 12e3 : 5e3);
    } catch (e) {
      new import_obsidian.Notice(e instanceof ImportError ? e.message : "Import failed: " + e.message, 12e3);
    } finally {
      working.hide();
    }
  }
};
