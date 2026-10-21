// The plugin settings page.

import { PluginSettingTab, Setting } from 'obsidian';
import { ANALYSIS_MAX_INPUTS, HARD_MAX_GATES, HARD_MAX_INPUTS } from '../core/constants.js';
import { METHOD_LABEL } from '../core/synthesize.js';
import { IMPORT_EXTENSION_ID, PROVIDERS } from './providers.js';
import { parseSpacing } from './settings.js';

export class LogicGraphSettingTab extends PluginSettingTab {
  constructor(app, plugin) { super(app, plugin); this.plugin = plugin; }

  display() {
    const { containerEl } = this;
    const P = this.plugin, S = P.settings;
    containerEl.empty();
    const save = async () => { await P.saveSettings(); };
    const heading = name => new Setting(containerEl).setName(name).setHeading();
    const num = (setting, key, lo, hi, isInt) => setting.addText(t => t
      .setValue(String(S[key]))
      .onChange(async v => {
        const x = Number(v);
        if (v.trim() === '' || !Number.isFinite(x) || x < lo || x > hi) return;
        S[key] = isInt ? Math.round(x) : x;
        await save();
      }));

    containerEl.createEl('p', { text: 'Changes apply to blocks rendered after you save (reopen the note or switch view to refresh). Add @help to a logic block for a reference of everything.' });

    heading('Limits');
    num(new Setting(containerEl).setName('Max inputs at a time')
      .setDesc(`Circuits with more inputs show an error. 1 to ${HARD_MAX_INPUTS}. Truth tables, Karnaugh maps and simplification are only available up to ${ANALYSIS_MAX_INPUTS} inputs (2^n rows).`),
      'maxInputs', 1, HARD_MAX_INPUTS, true);
    num(new Setting(containerEl).setName('Max gates at a time')
      .setDesc(`1 to ${HARD_MAX_GATES}.`), 'maxGates', 1, HARD_MAX_GATES, true);

    heading('Display');
    new Setting(containerEl).setName('Show truth table automatically')
      .setDesc('Per block you can override with "@hide table" or "@show table".')
      .addToggle(t => t.setValue(S.showTable).onChange(async v => { S.showTable = v; await save(); }));
    new Setting(containerEl).setName('Show boolean expressions')
      .addToggle(t => t.setValue(S.showExpr).onChange(async v => { S.showExpr = v; await save(); }));
    new Setting(containerEl).setName('Show Karnaugh maps')
      .setDesc('2 to 6 inputs. Groups come from the Quine–McCluskey result (an exact minimum when the search is small enough).')
      .addToggle(t => t.setValue(S.showKmap).onChange(async v => { S.showKmap = v; await save(); }));
    new Setting(containerEl).setName('Collapse "don\'t care" rows in the truth table')
      .setDesc('Rows whose outputs do not depend on some inputs are merged and shown with X (the middle signals are hidden in this mode).')
      .addToggle(t => t.setValue(S.collapseDontCare).onChange(async v => { S.collapseDontCare = v; await save(); }));
    new Setting(containerEl).setName('Bubble pushing view')
      .setDesc('Draws each gate with the De Morgan symbol that makes its bubbles match the next gate (e.g. NAND-NAND shows as AND-OR with matching bubbles). No gate is added or removed; click a gate to flip it by hand.')
      .addToggle(t => t.setValue(S.bubblePushing).onChange(async v => { S.bubblePushing = v; await save(); }));

    heading('Timing');
    new Setting(containerEl).setName('Simulate gate delays')
      .setDesc('Signals propagate through the gates one step at a time.')
      .addToggle(t => t.setValue(S.delayEnabled).onChange(async v => { S.delayEnabled = v; await save(); }));
    num(new Setting(containerEl).setName('Delay per gate (seconds)')
      .setDesc('0 to 30. Use -1 for a random delay between 0 and 5 seconds for every gate change.'),
      'delaySeconds', -1, 30, false);
    new Setting(containerEl).setName('Timing view')
      .setDesc('Graph = waveforms. Animation = bits travelling along the wires, gates light up green (output 1) or red/orange (output 0). Per block: @timing-graph, @timing-animation, @timing-both.')
      .addDropdown(d => {
        d.addOption('graph', 'Graph'); d.addOption('animation', 'Animation'); d.addOption('both', 'Both');
        d.setValue(S.timingView).onChange(async v => { S.timingView = v; await save(); });
      });

    heading('Graphic values');
    new Setting(containerEl).setName('Horizontal spacing')
      .setDesc('Distance between gate columns. A whole number of pixels (e.g. 90), or a percentage (e.g. 100%) to spread the circuit across that share of the page width.')
      .addText(t => t.setValue(String(S.hSpacing)).onChange(async v => { if (parseSpacing(v)) { S.hSpacing = v.trim(); await save(); } }));
    num(new Setting(containerEl).setName('Vertical spacing (px)')
      .setDesc('Distance between gates in the same column. 0 to 200.'), 'vSpacing', 0, 200, true);

    heading('Experimental: circuit reduction');
    new Setting(containerEl).setName('Always draw a reduced circuit')
      .setDesc('Off by default. Every reduced circuit is checked against the original before it is shown. Per block: "@simplify structural" (or @reduce).')
      .addToggle(t => t.setValue(S.expSimplify).onChange(async v => { S.expSimplify = v; await save(); }));
    new Setting(containerEl).setName('Reduction method')
      .setDesc('Structural rewrites your actual circuit and never adds gates. The two-level methods rebuild the function from the Quine–McCluskey cover and can be larger than the original. Best picks the smallest.')
      .addDropdown(d => {
        Object.keys(METHOD_LABEL).forEach(k => d.addOption(k, METHOD_LABEL[k]));
        d.setValue(S.simplifyMethod).onChange(async v => { S.simplifyMethod = v; await save(); });
      });

    this.displayImport(containerEl, save);
  }

  // Image import: the zone below the dropdown changes with the provider
  displayImport(containerEl, save) {
    const P = this.plugin, S = P.settings;
    new Setting(containerEl).setName('Import from image').setHeading();
    containerEl.createEl('p', { cls: 'lg-wip-banner', text: 'Under construction. Cloud providers are not available yet. The offline recognizer lives in the separate "Logic Graph - Image Import" extension.' });
    const zone = containerEl.createDiv({ cls: 'lg-import-zone' });

    const renderZone = () => {
      zone.empty();
      const p = S.importProvider, info = PROVIDERS[p];
      if (p === 'local') {
        const installed = !!(this.app.plugins && this.app.plugins.plugins && this.app.plugins.plugins[IMPORT_EXTENSION_ID]);
        new Setting(zone).setName('Local recognizer')
          .setDesc(installed
            ? 'Extension installed and enabled. Use the command "Import circuit from image" (Ctrl/Cmd + P). Everything stays on your device.'
            : 'The "Logic Graph - Image Import" extension is not installed or not enabled. Copy its folder into .obsidian/plugins/ and enable it.');
        return;
      }
      zone.addClass('lg-wip');
      new Setting(zone).setName(`${info.name}: API token`)
        .setDesc('Unavailable for now.')
        .addText(t => { t.inputEl.type = 'password'; t.setPlaceholder(info.keyHint).setValue(S.keys[p] || '').setDisabled(true); });
      new Setting(zone).setName(`${info.name}: model`)
        .setDesc('Unavailable for now.')
        .addText(t => t.setPlaceholder(info.modelHint).setValue(S.models[p] || '').setDisabled(true));
    };

    new Setting(containerEl).setName('Provider')
      .setDesc('Choose where the picture is analysed.')
      .addDropdown(d => {
        Object.keys(PROVIDERS).forEach(k => d.addOption(k, PROVIDERS[k].name));
        d.setValue(S.importProvider).onChange(async v => { S.importProvider = v; await save(); renderZone(); });
      });
    containerEl.appendChild(zone);   // keep the zone below the dropdown
    renderZone();
  }
}
