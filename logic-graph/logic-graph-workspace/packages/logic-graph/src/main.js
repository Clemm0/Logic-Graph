// Plugin entry point: settings, code-block processor, commands, API.

import manifest from '../manifest.json';
import { Plugin } from 'obsidian';
import { GATES } from './core/gates.js';
import { parse } from './core/parser.js';
import { PROVIDERS } from './settings/providers.js';
import { sanitizeSettings } from './settings/settings.js';
import { LogicGraphSettingTab } from './settings/tab.js';
import { TemplateModal, fence } from './templates.js';
import { renderBlock } from './ui/block.js';

export default class LogicGraphPlugin extends Plugin {
  async onload() {
    await this.loadSettings();
    this.addSettingTab(new LogicGraphSettingTab(this.app, this));

    // small API for companion extensions (e.g. Logic Graph - Image Import)
    this.api = {
      version: manifest.version,
      parse: (src, limits) => parse(src, limits),
      getSettings: () => this.settings,
      providers: PROVIDERS,
      fence,
    };

    // ```logic   (language ids can't contain spaces)
    ['logic', 'Logic', 'logic-graph'].forEach(lang =>
      this.registerMarkdownCodeBlockProcessor(lang, (source, el) => renderBlock(source, el, this)));

    this.addCommand({
      id: 'insert-block', name: 'Insert logic block',
      editorCallback: ed => ed.replaceSelection(fence('(a,b) AND (c)\n(c,b) XOR (d)\n(d) NOT (y)')),
    });
    this.addCommand({
      id: 'insert-help', name: 'Insert help block (@help)',
      editorCallback: ed => ed.replaceSelection(fence('@help')),
    });
    this.addCommand({
      id: 'insert-template', name: 'Insert logic block from template…',
      editorCallback: ed => new TemplateModal(this.app, t => ed.replaceSelection(fence(t.code))).open(),
    });
    this.addCommand({
      id: 'wrap-selection', name: 'Wrap selection in logic block',
      editorCallback: ed => { const sel = ed.getSelection(); ed.replaceSelection(fence(sel || '(a,b) AND (y)')); },
    });
    Object.keys(GATES).forEach(type => {
      this.addCommand({
        id: 'gate-' + type.toLowerCase(), name: `Insert gate line: ${type}`,
        editorCallback: ed => ed.replaceSelection(GATES[type].min === 1 ? `(a) ${type} (y)\n` : `(a,b) ${type} (y)\n`),
      });
    });
    ['@simplify structural', '@bubbles', '@timing-both', '@timing-graph', '@timing-animation', '@hide table', '@show kmap'].forEach(d => {
      this.addCommand({
        id: 'directive-' + d.slice(1).replace(/\s+/g, '-'), name: `Insert directive: ${d}`,
        editorCallback: ed => ed.replaceSelection(d + '\n'),
      });
    });
  }

  async loadSettings() { this.settings = sanitizeSettings(await this.loadData()); }
  async saveSettings() { this.settings = Object.assign(this.settings, sanitizeSettings(this.settings)); await this.saveData(this.settings); }
}
