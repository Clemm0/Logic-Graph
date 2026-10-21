// Plugin entry point: the "Import circuit from image" command.

import { FuzzySuggestModal, Notice, Plugin } from 'obsidian';
import { importImage } from './import.js';
import { ImportError } from './providers.js';

export class ImageModal extends FuzzySuggestModal {
  constructor(app, onPick) { super(app); this.onPick = onPick; this.setPlaceholder('Choose an image of a logic circuit…'); }
  getItems() { return this.app.vault.getFiles().filter(f => /^(png|jpe?g|gif|webp)$/i.test(f.extension)); }
  getItemText(f) { return f.path; }
  onChooseItem(f) { this.onPick(f); }
}

export default class LogicGraphImport extends Plugin {
  onload() {
    this.addCommand({
      id: 'import-image', name: 'Import circuit from image',
      editorCallback: ed => new ImageModal(this.app, f => this.run(f, ed)).open(),
    });
  }

  mainPlugin() {
    const m = this.app.plugins && this.app.plugins.plugins && this.app.plugins.plugins['logic-graph'];
    return m && m.api ? m : null;
  }

  async run(file, ed) {
    const main = this.mainPlugin();
    if (!main) { new Notice('Logic Graph is not installed or not enabled. This extension needs it.'); return; }
    const working = new Notice('Reading the circuit…', 0);
    try {
      const buffer = await this.app.vault.readBinary(file);
      const r = await importImage(main, buffer, file.extension);
      const header = '# imported from ' + file.name + ' - signal names are generated, please check against the picture\n';
      ed.replaceSelection(main.api.fence(header + r.text));
      const warn = (r.problem ? [r.problem] : []).concat((r.notes || []).filter(n => !/^Signal names/.test(n)));
      new Notice(`Imported ${r.lines ? r.lines.length : r.text.split('\n').length} line(s).` + (warn.length ? ' Check: ' + warn.join(' ') : ''), warn.length ? 12000 : 5000);
    } catch (e) {
      new Notice(e instanceof ImportError ? e.message : 'Import failed: ' + e.message, 12000);
    } finally {
      working.hide();
    }
  }
}
