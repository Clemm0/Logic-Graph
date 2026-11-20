var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
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
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.js
var main_exports = {};
__export(main_exports, {
  default: () => LogicGraphPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian7 = require("obsidian");

// src/core/gates.js
var GATES = {
  AND: { min: 2, shape: "AND", inv: false, fn: (v) => v.every((x) => x) },
  NAND: { min: 2, shape: "AND", inv: true, fn: (v) => !v.every((x) => x) },
  OR: { min: 2, shape: "OR", inv: false, fn: (v) => v.some((x) => x) },
  NOR: { min: 2, shape: "OR", inv: true, fn: (v) => !v.some((x) => x) },
  XOR: { min: 2, shape: "XOR", inv: false, fn: (v) => v.filter((x) => x).length % 2 === 1 },
  XNOR: { min: 2, shape: "XOR", inv: true, fn: (v) => v.filter((x) => x).length % 2 === 0 },
  NOT: { min: 1, max: 1, shape: "BUF", inv: true, fn: (v) => !v[0] },
  BUF: { min: 1, max: 1, shape: "BUF", inv: false, fn: (v) => !!v[0] }
};
var INVERSE = { AND: "NAND", NAND: "AND", OR: "NOR", NOR: "OR", XOR: "XNOR", XNOR: "XOR" };
var BASE = { AND: "AND", NAND: "AND", OR: "OR", NOR: "OR", XOR: "XOR", XNOR: "XOR" };
var INVERTING = { NAND: 1, NOR: 1, XNOR: 1, NOT: 1 };

// src/core/constants.js
var HARD_MAX_INPUTS2 = 32;
var HARD_MAX_GATES2 = 256;
var ANALYSIS_MAX_INPUTS2 = 12;
var MAX_GATE_FANIN = 6;
var ID_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;
var clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
var DEFAULT_MAX_INPUTS = 12;
var DEFAULT_MAX_GATES = 64;
var REDUCE_METHODS = ["structural", "best", "sop", "pos", "nand", "nor"];
var TIMING_VIEWS = ["graph", "animation", "both"];

// src/core/parser.js
var PARTS = ["table", "expr", "diagram", "kmap", "timing"];
var DIRECTIVE_LIST = "@help, @hide, @show, @simplify (@reduce), @bubbles, @compact, @delay, @timing-graph, @timing-animation, @timing-both";
function applyDirective(line, n, o) {
  const m = line.match(/^@([\w-]+)\s*(.*)$/);
  if (!m)
    throw new Error(`Line ${n}: malformed directive`);
  let name = m[1].toLowerCase();
  const args = m[2].toLowerCase().split(/[,\s]+/).filter(Boolean);
  if (name === "reduce")
    name = "simplify";
  if (name.startsWith("timing-")) {
    args.unshift(name.slice(7));
    name = "timing";
  }
  switch (name) {
    case "help":
      o.help = true;
      break;
    case "timing": {
      const a = args[0] || "graph";
      if (!TIMING_VIEWS.includes(a))
        throw new Error(`Line ${n}: use @timing-graph, @timing-animation or @timing-both`);
      o.timing = a;
      break;
    }
    case "hide":
    case "show":
      if (!args.length)
        throw new Error(`Line ${n}: "@${name}" needs: ${PARTS.join(", ")}`);
      args.forEach((a) => {
        if (!PARTS.includes(a))
          throw new Error(`Line ${n}: cannot ${name} "${a}" (${PARTS.join(", ")})`);
        (name === "hide" ? o.hide : o.show).add(a);
        (name === "hide" ? o.show : o.hide).delete(a);
      });
      break;
    case "simplify": {
      const a = args[0] || "structural";
      if (a === "off")
        o.simplify = "off";
      else if (REDUCE_METHODS.includes(a))
        o.simplify = a;
      else
        throw new Error(`Line ${n}: "@simplify" takes ${REDUCE_METHODS.join(", ")} or off`);
      break;
    }
    case "bubbles":
      o.bubbles = args[0] !== "off";
      break;
    case "compact":
      o.compact = args[0] !== "off";
      break;
    case "delay": {
      const a = args[0];
      if (a === "off")
        o.delay = 0;
      else if (a === "random")
        o.delay = -1;
      else {
        const x = Number(a);
        if (!a || !Number.isFinite(x) || x < -1 || x > 30)
          throw new Error(`Line ${n}: "@delay" takes seconds (0-30), random or off`);
        o.delay = x < 0 ? -1 : x;
      }
      break;
    }
    default:
      throw new Error(`Line ${n}: unknown directive "@${name}". Available: ${DIRECTIVE_LIST}`);
  }
}
function assemble(gates, inputs) {
  const driver = {};
  gates.forEach((g) => {
    driver[g.out] = g;
  });
  const used = /* @__PURE__ */ new Set();
  gates.forEach((g) => g.ins.forEach((x) => used.add(x)));
  if (!inputs) {
    inputs = [];
    gates.forEach((g) => g.ins.forEach((x) => {
      if (!driver[x] && !inputs.includes(x))
        inputs.push(x);
    }));
  }
  const known = new Set(inputs);
  const order = [];
  let pending = gates.slice();
  while (pending.length) {
    const ready = pending.filter((g) => g.ins.every((x) => known.has(x)));
    if (!ready.length) {
      throw new Error("Loop detected (combinational feedback) involving: " + pending.map((g) => g.out).join(", "));
    }
    ready.forEach((g) => {
      known.add(g.out);
      order.push(g);
    });
    pending = pending.filter((g) => !ready.includes(g));
  }
  const outputs = gates.map((g) => g.out).filter((x) => !used.has(x));
  const middles = gates.map((g) => g.out).filter((x) => used.has(x));
  return { gates, order, inputs, outputs, middles, driver, used };
}
function parse(src, limits) {
  limits = Object.assign({ maxInputs: DEFAULT_MAX_INPUTS, maxGates: DEFAULT_MAX_GATES }, limits);
  const gates = [];
  const driver = {};
  const opts = { hide: /* @__PURE__ */ new Set(), show: /* @__PURE__ */ new Set(), simplify: null, bubbles: null, delay: null, compact: null, timing: null, help: false };
  src.split("\n").forEach((raw, i) => {
    const line = raw.replace(/(#|\/\/).*$/, "").trim();
    if (!line)
      return;
    const n = i + 1;
    if (line[0] === "@") {
      applyDirective(line, n, opts);
      return;
    }
    const m = line.match(/^\(([^)]*)\)\s*([A-Za-z]+)\s*\(([^)]*)\)$/);
    if (!m)
      throw new Error(`Line ${n}: expected "(inputs) GATE (output)"`);
    const ins = m[1].split(/[,\s]+/).map((x) => x.trim()).filter(Boolean);
    const outs = m[3].split(/[,\s]+/).map((x) => x.trim()).filter(Boolean);
    const type = m[2].toUpperCase().trim();
    const spec = GATES[type];
    if (!spec)
      throw new Error(`Line ${n}: unknown gate "${m[2]}". Available: ${Object.keys(GATES).join(", ")}`);
    if (outs.length !== 1)
      throw new Error(`Line ${n}: a gate needs exactly one output signal`);
    if (ins.length < spec.min)
      throw new Error(`Line ${n}: ${type} needs at least ${spec.min} input(s)`);
    if (spec.max && ins.length > spec.max)
      throw new Error(`Line ${n}: ${type} takes exactly ${spec.max} input`);
    if (ins.length > MAX_GATE_FANIN)
      throw new Error(`Line ${n}: at most ${MAX_GATE_FANIN} inputs per gate`);
    for (const x of [...ins, ...outs]) {
      if (!ID_RE.test(x))
        throw new Error(`Line ${n}: invalid signal name "${x}"`);
    }
    const out = outs[0];
    if (ins.includes(out))
      throw new Error(`Line ${n}: "${out}" feeds back into its own gate`);
    if (driver[out])
      throw new Error(`Line ${n}: signal "${out}" is already driven by another gate`);
    if (gates.length >= limits.maxGates) {
      throw new Error(`Line ${n}: more than ${limits.maxGates} gates (raise "Max gates" in the plugin settings, up to ${HARD_MAX_GATES2})`);
    }
    const gate = { type, ins, out, line: n };
    driver[out] = gate;
    gates.push(gate);
  });
  if (!gates.length) {
    if (opts.help)
      return { gates: [], order: [], inputs: [], outputs: [], middles: [], driver: {}, used: /* @__PURE__ */ new Set(), opts, empty: true };
    throw new Error("Empty circuit. Example: (a,b) AND (y)   (or add @help for a reference)");
  }
  const c = assemble(gates);
  if (c.inputs.length > limits.maxInputs) {
    throw new Error(`Too many inputs (${c.inputs.length}, max ${limits.maxInputs}). Raise "Max inputs" in the plugin settings (up to ${HARD_MAX_INPUTS2}).`);
  }
  c.opts = opts;
  return c;
}

// src/settings/tab.js
var import_obsidian = require("obsidian");
var import_obsidian2 = { Setting: import_obsidian.Setting, PluginSettingTab: import_obsidian.PluginSettingTab };
var LogicGraphSettingTab = class extends import_obsidian2.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    const P = this.plugin, S = P.settings;
    containerEl.empty();
    const save = async () => {
      await P.saveSettings();
      P.refreshAll();
    };
    const heading = (name) => new import_obsidian2.Setting(containerEl).setName(name).setHeading();
    const num = (setting, key, lo, hi, isInt) => setting.addText((t) => t.setValue(String(S[key])).onChange(async (v) => {
      const x = Number(v);
      if (v.trim() === "" || !Number.isFinite(x) || x < lo || x > hi)
        return;
      S[key] = isInt ? Math.round(x) : x;
      await save();
    }));
    containerEl.createEl("p", { text: `Logic Graph v${P.manifest.version}. Changes apply immediately to open notes. Add @help to a logic block for a full reference.` });
    heading("Limits");
    num(
      new import_obsidian2.Setting(containerEl).setName("Max inputs at a time").setDesc(`Circuits with more inputs show an error. 1 to ${HARD_MAX_INPUTS}. Truth tables, Karnaugh maps and simplification are only available up to ${ANALYSIS_MAX_INPUTS} inputs (2^n rows).`),
      "maxInputs",
      1,
      HARD_MAX_INPUTS,
      true
    );
    num(new import_obsidian2.Setting(containerEl).setName("Max gates at a time").setDesc(`1 to ${HARD_MAX_GATES}.`), "maxGates", 1, HARD_MAX_GATES, true);
    heading("Display");
    new import_obsidian2.Setting(containerEl).setName("Show truth table automatically").setDesc('Per block you can override with "@hide table" or "@show table".').addToggle((t) => t.setValue(S.showTable).onChange(async (v) => {
      S.showTable = v;
      await save();
    }));
    new import_obsidian2.Setting(containerEl).setName("Show boolean expressions").addToggle((t) => t.setValue(S.showExpr).onChange(async (v) => {
      S.showExpr = v;
      await save();
    }));
    new import_obsidian2.Setting(containerEl).setName("Show Karnaugh maps").setDesc("2 to 6 inputs. Groups come from the Quine\u2013McCluskey result (an exact minimum when the search is small enough).").addToggle((t) => t.setValue(S.showKmap).onChange(async (v) => {
      S.showKmap = v;
      await save();
    }));
    new import_obsidian2.Setting(containerEl).setName(`Collapse "don't care" rows in the truth table`).setDesc("Rows whose outputs do not depend on some inputs are merged and shown with X (the middle signals are hidden in this mode).").addToggle((t) => t.setValue(S.collapseDontCare).onChange(async (v) => {
      S.collapseDontCare = v;
      await save();
    }));
    new import_obsidian2.Setting(containerEl).setName("Bubble pushing view").setDesc("Draws each gate with the De Morgan symbol that makes its bubbles match the next gate (e.g. NAND-NAND shows as AND-OR with matching bubbles). No gate is added or removed; click a gate to flip it by hand.").addToggle((t) => t.setValue(S.bubblePushing).onChange(async (v) => {
      S.bubblePushing = v;
      await save();
    }));
    heading("Timing");
    new import_obsidian2.Setting(containerEl).setName("Simulate gate delays").setDesc("Signals propagate through the gates one step at a time.").addToggle((t) => t.setValue(S.delayEnabled).onChange(async (v) => {
      S.delayEnabled = v;
      await save();
    }));
    num(
      new import_obsidian2.Setting(containerEl).setName("Delay per gate (seconds)").setDesc("0 to 30. Use -1 for a random delay between 0 and 5 seconds for every gate change."),
      "delaySeconds",
      -1,
      30,
      false
    );
    new import_obsidian2.Setting(containerEl).setName("Timing view").setDesc("Graph = waveforms. Animation = bits travelling along the wires, gates light up green (output 1) or red/orange (output 0). Per block: @timing-graph, @timing-animation, @timing-both.").addDropdown((d) => {
      d.addOption("graph", "Graph");
      d.addOption("animation", "Animation");
      d.addOption("both", "Both");
      d.setValue(S.timingView).onChange(async (v) => {
        S.timingView = v;
        await save();
      });
    });
    heading("Graphic values");
    new import_obsidian2.Setting(containerEl).setName("Horizontal spacing").setDesc("Distance between gate columns. A whole number of pixels (e.g. 90), or a percentage (e.g. 100%) to spread the circuit across that share of the page width.").addText((t) => t.setValue(String(S.hSpacing)).onChange(async (v) => {
      if (parseSpacing(v)) {
        S.hSpacing = v.trim();
        await save();
      }
    }));
    num(new import_obsidian2.Setting(containerEl).setName("Vertical spacing (px)").setDesc("Distance between gates in the same column. 0 to 200."), "vSpacing", 0, 200, true);
    heading("Experimental: circuit reduction");
    new import_obsidian2.Setting(containerEl).setName("Always draw a reduced circuit").setDesc('Off by default. Every reduced circuit is checked against the original before it is shown. Per block: "@simplify structural" (or @reduce).').addToggle((t) => t.setValue(S.expSimplify).onChange(async (v) => {
      S.expSimplify = v;
      await save();
    }));
    new import_obsidian2.Setting(containerEl).setName("Reduction method").setDesc("Structural rewrites your actual circuit and never adds gates. The two-level methods rebuild the function from the Quine\u2013McCluskey cover and can be larger than the original. Best picks the smallest.").addDropdown((d) => {
      Object.keys(METHOD_LABEL).forEach((k) => d.addOption(k, METHOD_LABEL[k]));
      d.setValue(S.simplifyMethod).onChange(async (v) => {
        S.simplifyMethod = v;
        await save();
      });
    });
    this.displayImport(containerEl, save);
  }
  displayImport(containerEl, save) {
    const P = this.plugin, S = P.settings;
    new import_obsidian2.Setting(containerEl).setName("Import from image").setHeading();
    const installed = !!(this.app.plugins && this.app.plugins.plugins && this.app.plugins.plugins[IMPORT_EXTENSION_ID]);
    containerEl.createEl("p", {
      cls: "lg-note",
      text: installed ? 'The "Logic Graph - Image Import" extension is installed. Use the command "Import circuit from image" (Ctrl/Cmd + P) \u2014 everything stays on your device.' : 'Image import is provided by the separate "Logic Graph - Image Import" extension. Copy its folder into .obsidian/plugins/ and enable it, then use the command "Import circuit from image".'
    });
  }
};

// src/settings/settings.js
var DEFAULTS = {
  maxInputs: DEFAULT_MAX_INPUTS,
  maxGates: DEFAULT_MAX_GATES,
  showTable: true,
  showExpr: true,
  showKmap: false,
  collapseDontCare: false,
  delayEnabled: false,
  delaySeconds: 1,
  timingView: "graph",
  bubblePushing: false,
  expSimplify: false,
  simplifyMethod: "structural",
  hSpacing: "90",
  vSpacing: 16,
  importProvider: "local",
  keys: { claude: "", gemini: "", grok: "", deepseek: "", openrouter: "" },
  models: { claude: "claude-sonnet-4-5", gemini: "", grok: "", deepseek: "", openrouter: "" }
};
function sanitizeSettings(raw) {
  const s2 = Object.assign({}, DEFAULTS, raw || {});
  s2.maxInputs = clamp(Math.round(Number(s2.maxInputs)) || DEFAULTS.maxInputs, 1, HARD_MAX_INPUTS2);
  s2.maxGates = clamp(Math.round(Number(s2.maxGates)) || DEFAULTS.maxGates, 1, HARD_MAX_GATES2);
  const d = Number(s2.delaySeconds);
  s2.delaySeconds = Number.isFinite(d) ? d < 0 ? -1 : clamp(d, 0, 30) : DEFAULTS.delaySeconds;
  const v = Number(s2.vSpacing);
  s2.vSpacing = Number.isFinite(v) ? clamp(Math.round(v), 0, 200) : DEFAULTS.vSpacing;
  if (!parseSpacing2(s2.hSpacing))
    s2.hSpacing = DEFAULTS.hSpacing;
  if (!REDUCE_METHODS.includes(s2.simplifyMethod))
    s2.simplifyMethod = "structural";
  if (!TIMING_VIEWS.includes(s2.timingView))
    s2.timingView = "graph";
  s2.keys = Object.assign({}, DEFAULTS.keys, raw && raw.keys || {});
  s2.models = Object.assign({}, DEFAULTS.models, raw && raw.models || {});
  if (raw && raw.apiKey && !s2.keys.claude)
    s2.keys.claude = raw.apiKey;
  if (raw && raw.model && !(raw.models && raw.models.claude))
    s2.models.claude = raw.model;
  delete s2.apiKey;
  delete s2.model;
  if (!["local", "claude", "gemini", "grok", "deepseek", "openrouter"].includes(s2.importProvider))
    s2.importProvider = "local";
  return s2;
}
function parseSpacing2(str) {
  const m = String(str).trim().match(/^(\d+(?:\.\d+)?)\s*(%|px)?$/i);
  if (!m)
    return null;
  const v = parseFloat(m[1]);
  return m[2] === "%" ? { pct: clamp(v, 10, 400) } : { px: clamp(Math.round(v), 40, 1e3) };
}

// src/settings/providers.js
var PROVIDERS = {
  local: { name: "Local recognizer (offline, Image Import extension)" },
  claude: { name: "Claude (Anthropic)", keyHint: "sk-ant-\u2026", modelHint: "model name" },
  gemini: { name: "Gemini (Google)", keyHint: "AIza\u2026", modelHint: "model name" },
  grok: { name: "Grok (xAI)", keyHint: "xai-\u2026", modelHint: "model name" },
  deepseek: { name: "DeepSeek", keyHint: "sk-\u2026", modelHint: "model name" },
  openrouter: { name: "OpenRouter", keyHint: "sk-or-\u2026", modelHint: "provider/model" }
};

// src/templates.js
var import_obsidian22 = __toESM(require("obsidian"));
var TEMPLATES = [
  { name: "Blank (two-input AND)", code: "(a,b) AND (y)" },
  { name: "Half adder", code: "(a,b) XOR (sum)\n(a,b) AND (carry)" },
  { name: "Full adder", code: "(a,b) XOR (t)\n(t,cin) XOR (sum)\n(a,b) AND (x)\n(t,cin) AND (z)\n(x,z) OR (cout)" },
  { name: "2-to-1 multiplexer", code: "(s) NOT (ns)\n(a,ns) AND (x)\n(b,s) AND (z)\n(x,z) OR (y)" },
  { name: "2-to-4 decoder", code: "(a) NOT (na)\n(b) NOT (nb)\n(na,nb) AND (y0)\n(na,b) AND (y1)\n(a,nb) AND (y2)\n(a,b) AND (y3)" },
  { name: "3-input majority", code: "(a,b) AND (x)\n(b,c) AND (y)\n(a,c) AND (z)\n(x,y,z) OR (maj)" },
  { name: "4-bit parity (XOR tree)", code: "(a,b) XOR (p1)\n(c,d) XOR (p2)\n(p1,p2) XOR (parity)" },
  { name: "XOR from NAND gates", code: "(a,b) NAND (n1)\n(a,n1) NAND (n2)\n(b,n1) NAND (n3)\n(n2,n3) NAND (y)" }
];
var fence = (code) => "```logic\n" + code + "\n```\n";
var TemplateModal = class extends import_obsidian22.FuzzySuggestModal {
  constructor(app, onPick) {
    super(app);
    this.onPick = onPick;
    this.setPlaceholder("Choose a circuit template\u2026");
  }
  getItems() {
    return TEMPLATES;
  }
  getItemText(t) {
    return t.name;
  }
  onChooseItem(t) {
    this.onPick(t);
  }
};

// src/ui/block.js
var import_obsidian6 = require("obsidian");

// src/core/sim.js
function evaluate(c, inputVals) {
  const v = Object.assign({}, inputVals);
  c.order.forEach((g) => {
    v[g.out] = +GATES[g.type].fn(g.ins.map((x) => !!v[x]));
  });
  return v;
}
function truthTable(c, exerciseMode = false) {
  const n = c.inputs.length;
  const rows = [];
  for (let i = 0; i < 1 << n; i++) {
    const ins = {};
    c.inputs.forEach((x, k) => {
      ins[x] = i >> n - 1 - k & 1;
    });
    const row = evaluate(c, ins);
    if (exerciseMode) {
      c.outputs.forEach((o) => {
        if (Math.random() < 0.15)
          row[o] = -1;
      });
    }
    rows.push(row);
  }
  return rows;
}
function createSim(c, getDelay, onChange, onWork) {
  const zero = {};
  c.inputs.forEach((n) => {
    zero[n] = 0;
  });
  const vals = evaluate(c, zero);
  const timers = /* @__PURE__ */ new Map();
  const consumers = {};
  let disposed = false;
  c.gates.forEach((g) => g.ins.forEach((n) => {
    (consumers[n] = consumers[n] || []).push(g);
  }));
  const work = (g) => {
    if (!disposed && onWork)
      onWork(g);
  };
  function set(sig, v) {
    if (disposed || vals[sig] === v)
      return;
    vals[sig] = v;
    onChange(sig, v);
    (consumers[sig] || []).forEach(reeval);
  }
  function reeval(g) {
    if (disposed)
      return;
    const target = +GATES[g.type].fn(g.ins.map((x) => !!vals[x]));
    const pend = timers.get(g);
    if (pend) {
      clearTimeout(pend.h);
      timers.delete(g);
    }
    if (target === vals[g.out]) {
      if (pend)
        work(g);
      return;
    }
    const d = getDelay();
    if (!(d > 0)) {
      set(g.out, target);
      if (pend)
        work(g);
      return;
    }
    const h2 = setTimeout(() => {
      timers.delete(g);
      if (disposed)
        return;
      set(g.out, target);
      work(g);
    }, d * 1e3);
    timers.set(g, { h: h2, target });
    work(g);
  }
  return {
    vals,
    setInputs(patch) {
      Object.keys(patch).forEach((n) => set(n, patch[n]));
    },
    pending() {
      return timers.size;
    },
    working(g) {
      const p = timers.get(g);
      return p ? p.target : null;
    },
    dispose() {
      disposed = true;
      timers.forEach((p) => clearTimeout(p.h));
      timers.clear();
    }
  };
}

// src/core/latex.js
var nm = (n) => /^[A-Za-z]$/.test(n) ? n : `\\mathrm{${n.replace(/_/g, "\\_")}}`;
function rawLatex(c, sig) {
  const memo = /* @__PURE__ */ new Map();
  const go = (x) => {
    if (memo.has(x))
      return memo.get(x);
    const g = c.driver[x];
    let r;
    if (!g)
      r = { s: nm(x), p: 5 };
    else {
      const kids = g.ins.map(go);
      const join = (op, p) => kids.map((k) => k.p < p ? `\\left(${k.s}\\right)` : k.s).join(op);
      const AND = () => join(" \\cdot ", 3), OR = () => join(" + ", 1), XOR = () => join(" \\oplus ", 2);
      switch (g.type) {
        case "AND":
          r = { s: AND(), p: 3 };
          break;
        case "OR":
          r = { s: OR(), p: 1 };
          break;
        case "XOR":
          r = { s: XOR(), p: 2 };
          break;
        case "NAND":
          r = { s: `\\overline{${AND()}}`, p: 5 };
          break;
        case "NOR":
          r = { s: `\\overline{${OR()}}`, p: 5 };
          break;
        case "XNOR":
          r = { s: `\\overline{${XOR()}}`, p: 5 };
          break;
        case "NOT":
          r = { s: `\\overline{${kids[0].s}}`, p: 5 };
          break;
        default:
          r = kids[0];
      }
    }
    if (r.s.length > 2e3)
      throw new Error("too long");
    memo.set(x, r);
    return r;
  };
  return go(sig).s;
}

// src/core/minimize.js
var popcount = (x) => {
  let k = 0;
  while (x) {
    k += x & 1;
    x >>>= 1;
  }
  return k;
};
function primeImplicants(ones) {
  let cur = new Map(ones.map((m) => [m + ":0", { v: m, mask: 0 }]));
  const primes = [];
  while (cur.size) {
    const groups = /* @__PURE__ */ new Map();
    for (const t of cur.values()) {
      const k = t.mask + "|" + popcount(t.v);
      if (!groups.has(k))
        groups.set(k, []);
      groups.get(k).push(t);
    }
    const used = /* @__PURE__ */ new Set(), next = /* @__PURE__ */ new Map();
    for (const [k, list] of groups) {
      const [mask, p] = k.split("|").map(Number);
      const other = groups.get(mask + "|" + (p + 1));
      if (!other)
        continue;
      for (const a of list)
        for (const b of other) {
          const d = a.v ^ b.v;
          if (d && !(d & d - 1)) {
            const t = { v: a.v & b.v, mask: a.mask | d };
            next.set(t.v + ":" + t.mask, t);
            used.add(a);
            used.add(b);
          }
        }
    }
    for (const t of cur.values())
      if (!used.has(t))
        primes.push(t);
    cur = next;
  }
  return primes;
}
function chooseCover(primes, ones, nvars) {
  const NODE_LIMIT = 6e4;
  const covers = (p, m) => (m & ~p.mask) === p.v;
  const lits = (p) => nvars - popcount(p.mask);
  const cost = (list) => [list.length, list.reduce((a, p) => a + lits(p), 0)];
  const better = (a, b) => a[0] !== b[0] ? a[0] < b[0] : a[1] < b[1];
  const byOrder = (a, b) => a.v - b.v || a.mask - b.mask;
  const chosen = [], left = new Set(ones);
  ones.forEach((m) => {
    const ps = primes.filter((p) => covers(p, m));
    if (ps.length === 1 && !chosen.includes(ps[0]))
      chosen.push(ps[0]);
  });
  chosen.forEach((p) => ones.forEach((m) => {
    if (covers(p, m))
      left.delete(m);
  }));
  const rest = [...left];
  if (!rest.length)
    return { cover: chosen.sort(byOrder), exact: true };
  const cand = primes.filter((p) => !chosen.includes(p) && rest.some((m) => covers(p, m)));
  const coverers = new Map(rest.map((m) => [m, cand.filter((p) => covers(p, m))]));
  let bestSel = [];
  {
    const unc = new Set(rest);
    while (unc.size) {
      let bp = null, bc = -1;
      cand.forEach((p) => {
        let k = 0;
        unc.forEach((m) => {
          if (covers(p, m))
            k++;
        });
        if (k > bc) {
          bc = k;
          bp = p;
        }
      });
      bestSel.push(bp);
      [...unc].forEach((m) => {
        if (covers(bp, m))
          unc.delete(m);
      });
    }
  }
  let bestCost = cost(chosen.concat(bestSel));
  let nodes = 0, exact = true;
  const rec = (unc, sel) => {
    if (++nodes > NODE_LIMIT) {
      exact = false;
      return;
    }
    if (!unc.length) {
      const c2 = cost(chosen.concat(sel));
      if (better(c2, bestCost)) {
        bestCost = c2;
        bestSel = sel.slice();
      }
      return;
    }
    if (chosen.length + sel.length + 1 > bestCost[0])
      return;
    let pick = unc[0], pc = coverers.get(pick).length;
    for (const m of unc) {
      const k = coverers.get(m).length;
      if (k < pc) {
        pick = m;
        pc = k;
      }
    }
    const opts = coverers.get(pick).slice().sort((a, b) => unc.filter((m) => covers(b, m)).length - unc.filter((m) => covers(a, m)).length);
    for (const p of opts) {
      sel.push(p);
      rec(unc.filter((m) => !covers(p, m)), sel);
      sel.pop();
      if (nodes > NODE_LIMIT)
        return;
    }
  };
  rec(rest, []);
  return { cover: chosen.concat(bestSel).sort(byOrder), exact };
}
function coverOf(all, out, target, dc = /* @__PURE__ */ new Set()) {
  const idx = [];
  let count1 = 0;
  all.forEach((r, i) => {
    if (r[out])
      count1++;
    if (r[out] === (target === 0 ? 0 : 1))
      idx.push(i);
  });
  if (count1 === 0)
    return { const: 0, exact: true };
  if (count1 === all.length)
    return { const: 1, exact: true };
  const nvars = Math.round(Math.log2(all.length));
  const allOnes = [...idx, ...dc];
  const { cover, exact } = chooseCover(primeImplicants(allOnes), idx, nvars);
  return { ones: idx, cover, exact };
}
function cubeLiterals(c, cube) {
  const n = c.inputs.length, out = [];
  c.inputs.forEach((name, k) => {
    const bit = 1 << n - 1 - k;
    if (!(cube.mask & bit))
      out.push({ name, neg: !(cube.v & bit) });
  });
  return out;
}
var litLatex = (l) => l.neg ? `\\overline{${nm(l.name)}}` : nm(l.name);
var cubeLatex = (c, cube) => cubeLiterals(c, cube).map(litLatex).join(" \\cdot ");
var sopLatex = (c, cov) => cov.const !== void 0 ? String(cov.const) : cov.cover.map((cb) => cubeLatex(c, cb)).join(" + ");
function buildExpressions(c, all) {
  return c.outputs.map((o) => {
    let raw;
    try {
      raw = rawLatex(c, o);
    } catch (e) {
      raw = null;
    }
    if (raw && raw.length > 800)
      raw = null;
    let cov = null, min = null;
    if (all) {
      const dc = /* @__PURE__ */ new Set();
      all.forEach((r, i) => {
        if (r[o] === -1)
          dc.add(i);
      });
      cov = coverOf(all, o, 1, dc);
      min = sopLatex(c, cov);
    }
    return { name: o, raw, min, cov };
  });
}

// src/core/synthesize.js
var METHOD_LABEL2 = {
  structural: "Structural (rewrites your actual circuit)",
  best: "Best of all methods",
  sop: "AND-OR (sum of products)",
  pos: "OR-AND (product of sums)",
  nand: "NAND-NAND",
  nor: "NOR-NOR"
};
function synthesize(c, all, method) {
  const names = /* @__PURE__ */ new Set([...c.inputs, ...c.gates.map((g) => g.out)]);
  const gensym = (base, numbered) => {
    if (!numbered && !names.has(base)) {
      names.add(base);
      return base;
    }
    let k = numbered ? 1 : 2, nme;
    do {
      nme = base + k++;
    } while (names.has(nme));
    names.add(nme);
    return nme;
  };
  const gates = [], cache = /* @__PURE__ */ new Map(), nots = /* @__PURE__ */ new Map(), consts = {};
  const addGate = (type, ins, out) => {
    gates.push({ type, ins, out, line: 0 });
    return out;
  };
  const shared = (type, ins, prefix) => {
    const key = type + "|" + ins.join(",");
    if (!cache.has(key))
      cache.set(key, addGate(type, ins, gensym(prefix, true)));
    return cache.get(key);
  };
  const notOf = (name) => {
    if (!nots.has(name))
      nots.set(name, addGate("NOT", [name], gensym(name + "_n")));
    return nots.get(name);
  };
  const lit = (l) => l.neg ? notOf(l.name) : l.name;
  const comp = (l) => ({ name: l.name, neg: !l.neg });
  const build = (type, ins, prefix, out) => {
    const base = BASE[type];
    let cur = ins;
    while (cur.length > MAX_GATE_FANIN) {
      const next = [];
      for (let i = 0; i < cur.length; i += MAX_GATE_FANIN) {
        const chunk = cur.slice(i, i + MAX_GATE_FANIN);
        next.push(chunk.length === 1 ? chunk[0] : shared(base, chunk, "t"));
      }
      cur = next;
    }
    return out ? addGate(type, cur, out) : shared(type, cur, prefix);
  };
  const single = (type, L, out) => {
    if (L.length === 1)
      addGate(L[0].neg ? "NOT" : "BUF", [L[0].name], out);
    else
      build(type, L.map(lit), "", out);
  };
  const dual = method === "pos" || method === "nor";
  c.outputs.forEach((o) => {
    const cov = coverOf(all, o, dual ? 0 : 1);
    if (cov.const !== void 0) {
      consts[o] = cov.const;
      return;
    }
    const cubes = cov.cover;
    const lits = (cb) => dual ? cubeLiterals(c, cb).map(comp) : cubeLiterals(c, cb);
    if (cubes.length === 1) {
      single(dual ? "OR" : "AND", lits(cubes[0]), o);
      return;
    }
    if (method === "sop") {
      build("OR", cubes.map((cb) => {
        const L = lits(cb);
        return L.length === 1 ? lit(L[0]) : build("AND", L.map(lit), "p");
      }), "", o);
    } else if (method === "nand") {
      build("NAND", cubes.map((cb) => {
        const L = lits(cb);
        return L.length === 1 ? L[0].neg ? L[0].name : notOf(L[0].name) : build("NAND", L.map(lit), "p");
      }), "", o);
    } else if (method === "pos") {
      build("AND", cubes.map((cb) => {
        const L = lits(cb);
        return L.length === 1 ? lit(L[0]) : build("OR", L.map(lit), "s");
      }), "", o);
    } else {
      build("NOR", cubes.map((cb) => {
        const L = lits(cb);
        return L.length === 1 ? L[0].neg ? L[0].name : notOf(L[0].name) : build("NOR", L.map(lit), "s");
      }), "", o);
    }
  });
  return { circuit: gates.length ? assemble(gates, c.inputs) : null, consts };
}

// src/core/reduce.js
var circuitCost = (c) => ({ gates: c.gates.length, pins: c.gates.reduce((a, g) => a + g.ins.length, 0) });
function reduceStructural(c) {
  let gates = c.gates.map((g) => ({ type: g.type, ins: g.ins.slice(), out: g.out, line: 0 }));
  const isOut = new Set(c.outputs);
  const drv = () => {
    const d = {};
    gates.forEach((g) => {
      d[g.out] = g;
    });
    return d;
  };
  const fanout = () => {
    const f = {};
    gates.forEach((g) => g.ins.forEach((x) => {
      f[x] = (f[x] || 0) + 1;
    }));
    return f;
  };
  const rename = (from, to) => gates.forEach((g) => {
    g.ins = g.ins.map((x) => x === from ? to : x);
  });
  const live = (g) => gates.includes(g);
  for (let iter = 0; iter < 300; iter++) {
    let changed = false;
    gates.forEach((g) => {
      const base = BASE[g.type];
      if (base === "AND" || base === "OR") {
        const u = [...new Set(g.ins)];
        if (u.length !== g.ins.length) {
          g.ins = u;
          changed = true;
        }
        if (g.ins.length === 1) {
          g.type = INVERTING[g.type] ? "NOT" : "BUF";
          changed = true;
        }
      } else if (base === "XOR") {
        const cnt = {};
        g.ins.forEach((x) => {
          cnt[x] = (cnt[x] || 0) + 1;
        });
        const odd = Object.keys(cnt).filter((x) => cnt[x] % 2 === 1);
        if (odd.length > 0 && odd.length !== g.ins.length) {
          g.ins = odd;
          changed = true;
        }
        if (g.ins.length === 1) {
          g.type = g.type === "XNOR" ? "NOT" : "BUF";
          changed = true;
        }
      }
    });
    for (const g of gates.slice()) {
      if (g.type === "BUF" && !isOut.has(g.out)) {
        rename(g.out, g.ins[0]);
        gates = gates.filter((x) => x !== g);
        changed = true;
      }
    }
    {
      const d = drv(), f = fanout();
      for (const g of gates.slice()) {
        if (g.type !== "NOT" || !live(g))
          continue;
        const inner = d[g.ins[0]];
        if (!inner || !live(inner))
          continue;
        if (inner.type === "NOT") {
          g.type = "BUF";
          g.ins = [inner.ins[0]];
          changed = true;
          continue;
        }
        if (INVERSE[inner.type] && !isOut.has(inner.out) && f[inner.out] === 1) {
          g.type = INVERSE[inner.type];
          g.ins = inner.ins.slice();
          gates = gates.filter((x) => x !== inner);
          changed = true;
        }
      }
    }
    {
      const d = drv(), f = fanout();
      for (const g of gates.slice()) {
        const base = BASE[g.type];
        if (!base || !live(g))
          continue;
        let again = true;
        while (again) {
          again = false;
          for (let i = 0; i < g.ins.length; i++) {
            const x = g.ins[i], inner = d[x];
            if (!inner || !live(inner) || inner === g || inner.type !== base)
              continue;
            if (isOut.has(x) || f[x] !== 1)
              continue;
            const merged = g.ins.slice(0, i).concat(inner.ins, g.ins.slice(i + 1));
            if (merged.length > MAX_GATE_FANIN)
              continue;
            g.ins = merged;
            gates = gates.filter((y) => y !== inner);
            f[x] = 0;
            changed = true;
            again = true;
            break;
          }
        }
      }
    }
    {
      const d = drv(), f = fanout();
      for (const g of gates.slice()) {
        const base = BASE[g.type];
        if (base !== "AND" && base !== "OR" || !live(g))
          continue;
        const dual = base === "AND" ? "OR" : "AND";
        for (let i = 0; i < g.ins.length; i++) {
          const x = g.ins[i], inner = d[x];
          if (!inner || !live(inner) || inner.type !== dual || isOut.has(x) || f[x] !== 1)
            continue;
          const others = g.ins.filter((_, k) => k !== i);
          if (inner.ins.some((y) => others.includes(y))) {
            g.ins = others;
            gates = gates.filter((y) => y !== inner);
            changed = true;
            break;
          }
        }
      }
    }
    {
      const seen = /* @__PURE__ */ new Map();
      for (const g of gates.slice()) {
        if (!live(g))
          continue;
        const key = g.type + "|" + [...g.ins].sort().join(",");
        const prev = seen.get(key);
        if (!prev) {
          seen.set(key, g);
          continue;
        }
        let keep = prev, drop = g;
        if (isOut.has(drop.out)) {
          if (isOut.has(keep.out))
            continue;
          keep = g;
          drop = prev;
          seen.set(key, keep);
        }
        rename(drop.out, keep.out);
        gates = gates.filter((y) => y !== drop);
        changed = true;
      }
    }
    {
      const f = fanout(), n0 = gates.length;
      gates = gates.filter((g) => isOut.has(g.out) || f[g.out]);
      if (gates.length !== n0)
        changed = true;
    }
    if (!changed)
      break;
  }
  return assemble(gates, c.inputs);
}
function verifyEquivalent(c, circuit, consts, all) {
  consts = consts || {};
  const check = (ins, ref) => {
    const v = circuit ? evaluate(circuit, ins) : {};
    return c.outputs.every((o) => (o in consts ? consts[o] : v[o]) === ref[o]);
  };
  if (all) {
    return all.every((row) => {
      const ins = {};
      c.inputs.forEach((x) => {
        ins[x] = row[x];
      });
      return check(ins, row);
    }) ? "exact" : "FAILED";
  }
  let seed = 1234567;
  const rnd = () => (seed = Math.imul(seed, 1664525) + 1013904223 >>> 0) / 4294967296;
  for (let k = 0; k < 4096; k++) {
    const ins = {};
    c.inputs.forEach((x) => {
      ins[x] = rnd() < 0.5 ? 0 : 1;
    });
    if (!check(ins, evaluate(c, ins)))
      return "FAILED";
  }
  return "sampled";
}
function reduceCircuit(c, all, method) {
  const cands = [];
  const add = (m) => {
    const r = m === "structural" ? { circuit: reduceStructural(c), consts: {} } : synthesize(c, all, m);
    r.method = m;
    r.after = r.circuit ? circuitCost(r.circuit) : { gates: 0, pins: 0 };
    cands.push(r);
  };
  if (method === "best") {
    add("structural");
    if (all)
      ["sop", "pos", "nand", "nor"].forEach(add);
  } else
    add(method);
  cands.sort((a, b) => a.after.gates - b.after.gates || a.after.pins - b.after.pins);
  const best = cands[0];
  best.before = circuitCost(c);
  best.verified = verifyEquivalent(c, best.circuit, best.consts, all);
  return best;
}

// src/ui/dom.js
var import_obsidian4 = __toESM(require("obsidian"));
var SVGNS = "http://www.w3.org/2000/svg";
function h(tag, cls, parent, text) {
  const e = document.createElement(tag);
  if (cls)
    e.className = cls;
  if (text !== void 0)
    e.textContent = text;
  if (parent)
    parent.appendChild(e);
  return e;
}
function s(tag, attrs, parent, text) {
  const e = document.createElementNS(SVGNS, tag);
  for (const k in attrs)
    e.setAttribute(k, attrs[k]);
  if (text !== void 0)
    e.textContent = text;
  if (parent)
    parent.appendChild(e);
  return e;
}
function clickable(el, onActivate) {
  el.setAttribute("tabindex", "0");
  el.setAttribute("role", "button");
  el.addEventListener("click", onActivate);
  el.addEventListener("keydown", (evt) => {
    if (evt.key === "Enter" || evt.key === " ") {
      evt.preventDefault();
      onActivate(evt);
    }
  });
  return el;
}
var later = (fn) => typeof requestAnimationFrame === "function" ? requestAnimationFrame(fn) : setTimeout(fn, 0);
function math(latex, parent) {
  if (typeof import_obsidian4.renderMath === "function")
    parent.appendChild((0, import_obsidian4.renderMath)(latex, false));
  else
    parent.appendChild(document.createTextNode(latex));
}

// src/ui/copy.js
var import_obsidian3 = require("obsidian");
var import_obsidian32 = __toESM(require("obsidian"));
function toLatexSource(exprs) {
  return exprs.map((e) => {
    const lines = [];
    if (e.raw && e.raw !== e.min)
      lines.push(`$$${nm(e.name)} = ${e.raw}$$`);
    if (e.min !== null)
      lines.push(`$$${nm(e.name)} = ${e.min}$$`);
    return lines.join("\n");
  }).join("\n");
}
function toMermaid(c) {
  const id = {};
  c.inputs.forEach((n) => {
    id[n] = "in_" + n;
  });
  c.order.forEach((g, i) => {
    id[g.out] = "g" + (i + 1);
  });
  const out = ["flowchart LR"];
  c.inputs.forEach((n) => out.push(`  ${id[n]}([${n}])`));
  c.order.forEach((g) => out.push(`  ${id[g.out]}[${g.type}]`));
  c.outputs.forEach((n) => out.push(`  out_${n}([${n}])`));
  c.order.forEach((g) => g.ins.forEach((n) => out.push(c.driver[n] ? `  ${id[n]} -->|${n}| ${id[g.out]}` : `  ${id[n]} --> ${id[g.out]}`)));
  c.outputs.forEach((n) => out.push(`  ${id[n]} --> out_${n}`));
  return "```mermaid\n" + out.join("\n") + "\n```";
}
function copy(text) {
  const done = () => new import_obsidian32.Notice("Copied to clipboard");
  if (typeof navigator !== "undefined" && navigator.clipboard)
    navigator.clipboard.writeText(text).then(done);
  else
    done();
}

// src/ui/help.js
var HALF_ADDER = "(a,b) XOR (sum)\n(a,b) AND (carry)";
var HELP = [
  { title: "Gates", note: "One gate per line: (inputs) GATE (output). Up to 6 inputs per gate.", items: [
    ["AND", "Output is 1 only when every input is 1.", "(a,b) AND (y)"],
    ["OR", "Output is 1 when at least one input is 1.", "(a,b) OR (y)"],
    ["NAND", "AND followed by NOT.", "(a,b) NAND (y)"],
    ["NOR", "OR followed by NOT.", "(a,b) NOR (y)"],
    ["XOR", "Output is 1 when an odd number of inputs are 1.", "(a,b) XOR (y)"],
    ["XNOR", "Output is 1 when an even number of inputs are 1.", "(a,b) XNOR (y)"],
    ["NOT", "Inverts its single input.", "(a) NOT (y)"],
    ["BUF", "Copies its single input (a buffer).", "(a) BUF (y)"]
  ] },
  { title: "Writing circuits", items: [
    ["Several gates", "Signals no gate drives are the inputs. Signals nothing uses are the outputs. Names may contain letters, digits and _.", HALF_ADDER],
    ["Wide gates", "Gates can take 2 to 6 inputs.", "(a,b,c,d) AND (y)"],
    ["Comments", "Everything after # or // is ignored.", "(a,b) AND (y)  # a comment\n// another comment"]
  ] },
  { title: "Directives (first lines of a block)", items: [
    ["@help", "Shows this reference above the circuit.", "@help\n(a,b) AND (y)"],
    ["@hide / @show", "Hide or show: table, expr, diagram, kmap, timing.", "@hide table\n@show kmap\n(a,b,c) OR (y)"],
    ["@simplify / @reduce", "Draws a reduced circuit and checks it is equivalent. Methods: structural, best, sop, pos, nand, nor, off.", "@simplify structural\n(a) NOT (n1)\n(n1) NOT (n2)\n(n2,b) AND (y)"],
    ["@simplify nand", "Rebuilds the function as NAND-NAND from the minimal cover (can be larger than the original).", "@simplify nand\n(a,b) AND (x)\n(b,c) AND (y1)\n(x,y1) OR (y)"],
    ["@bubbles", "Bubble pushing: gates are drawn with their De Morgan symbol so bubbles match. Click a gate to flip it by hand.", "@bubbles\n(a,b) NAND (p)\n(c,d) NAND (q)\n(p,q) NAND (y)"],
    ["@compact", "Merges truth-table rows that do not depend on some inputs (shown as X).", "@compact\n(a,b) AND (x)\n(x,c) OR (y)"],
    ["@delay", 'Seconds of delay per gate (0 to 30), "random" (0 to 5 s), or off.', "@delay 0.5\n(a,b) AND (c)\n(c) NOT (y)"],
    ["@timing-graph", "Delays on, with the timing graph (waveforms).", "@timing-graph\n@delay 0.5\n(a,b) AND (c)\n(c,b) XOR (y)"],
    ["@timing-animation", "Delays on, with bits travelling along the wires and gate lamps (green = 1, red/orange = 0).", "@timing-animation\n@delay 1\n(a,b) AND (c)\n(c,b) XOR (y)"],
    ["@timing-both", "Graph and animation together.", "@timing-both\n@delay 1\n(a,b) AND (c)\n(c,b) XOR (y)"]
  ] },
  { title: "Things you can click", items: [
    ["Input boxes", "Click a box on the left of the diagram to flip that input between 0 and 1.", null],
    ["Truth-table rows", "Click a row to set the inputs to that row. The active row is highlighted.", null],
    ["Karnaugh cells", "Click a cell to set the inputs to that cell. Coloured outlines are the groups; outlines that stop at an edge wrap around.", null],
    ["Gates in @bubbles view", 'Click a gate to flip it between its two De Morgan symbols. "reset" restores the automatic layout.', null],
    ["export", "On every figure: save as PNG or SVG in your vault, or copy the PNG.", null],
    ["Copy buttons", "Copy the truth table (Markdown), the expressions (LaTeX) or the circuit (Mermaid).", null]
  ] },
  { title: "Commands (Ctrl/Cmd + P)", items: [
    ["Logic Graph: Insert logic block", "Inserts an example block.", null],
    ["Logic Graph: Insert logic block from template\u2026", "Half adder, full adder, multiplexer, decoder, majority, parity, XOR from NAND.", null],
    ["Logic Graph: Wrap selection in logic block", "Turns the selected text into a block.", null],
    ["Logic Graph: Insert gate line / directive", "One command for each gate type and the common directives.", null],
    ["Image Import extension", 'Optional extension: "Import circuit from image".', null]
  ] },
  { title: "Settings", items: [
    ["Limits", "Max inputs (up to 32) and max gates (up to 256). Truth tables, Karnaugh maps and simplification work up to 12 inputs.", null],
    ["Display", "Show table / expressions / Karnaugh maps by default, compact table, bubble pushing.", null],
    ["Timing", "Gate delay and the default timing view (graph, animation or both).", null],
    ["Graphic values", "Horizontal spacing in px or % of the page width, vertical spacing in px.", null],
    ["Experimental", "Always draw a reduced circuit, and choose the method.", null]
  ] }
];
function renderHelp(parent, plugin) {
  const zone = h("div", "lg-help", parent);
  h("div", "lg-help-title", zone, "Logic Graph reference");
  HELP.forEach((sec) => {
    const box = h("div", "lg-help-sec", zone);
    h("div", "lg-title", box, sec.title);
    if (sec.note)
      h("div", "lg-note", box, sec.note);
    sec.items.forEach(([name, desc, example]) => {
      if (!example) {
        const row = h("div", "lg-help-row", box);
        h("b", "", row, name);
        h("span", "", row, " - " + desc);
        return;
      }
      const det = h("details", "lg-help-item", box);
      const sum = h("summary", "", det);
      h("b", "", sum, name);
      h("span", "", sum, " - " + desc);
      let done = false;
      det.addEventListener("toggle", () => {
        if (!det.open || done)
          return;
        done = true;
        h("pre", "lg-help-code", det, example);
        h("button", "lg-small", det, "copy example").addEventListener("click", () => copy("```logic\n" + example + "\n```"));
        renderBlock(example, h("div", "lg-help-live", det), plugin);
      });
    });
  });
}

// src/core/bubbles.js
var DUAL_SHAPE = { AND: "OR", OR: "AND", BUF: "BUF", XOR: "XOR" };
var baseRep = (g) => {
  const sp = GATES[g.type];
  return { shape: sp.shape, out: +sp.inv, ins: g.ins.map(() => 0), fixed: sp.shape === "XOR" };
};
var flipRep = (r) => {
  r.shape = DUAL_SHAPE[r.shape];
  r.out ^= 1;
  r.ins = r.ins.map((b) => b ^ 1);
};
function bubbleForms(c, flips) {
  const reps = /* @__PURE__ */ new Map();
  c.gates.forEach((g) => reps.set(g, baseRep(g)));
  const cons = {};
  c.gates.forEach((g) => g.ins.forEach((n, i) => {
    (cons[n] = cons[n] || []).push([g, i]);
  }));
  for (let k = c.order.length - 1; k >= 0; k--) {
    const g = c.order[k], r = reps.get(g);
    if (r.fixed)
      continue;
    const list = cons[g.out] || [];
    let ones = 0;
    list.forEach(([cg, i]) => {
      ones += reps.get(cg).ins[i];
    });
    const want = list.length && ones * 2 > list.length ? 1 : 0;
    if (r.out !== want)
      flipRep(r);
  }
  if (flips)
    flips.forEach((g) => {
      const r = reps.get(g);
      if (r && !r.fixed)
        flipRep(r);
    });
  return reps;
}
function matchedBubbleNets(c, reps) {
  const matched = /* @__PURE__ */ new Set();
  c.gates.forEach((d) => {
    if (!reps.get(d).out)
      return;
    let n = 0, ok = true;
    c.gates.forEach((g) => g.ins.forEach((x, i) => {
      if (x !== d.out)
        return;
      n++;
      if (!reps.get(g).ins[i])
        ok = false;
    }));
    if (n && ok)
      matched.add(d.out);
  });
  return matched;
}

// src/ui/layout.js
var LEFT = 90;
var GATE_W = 64;
var TOP = 34;
var BUBBLE_R = 5.5;
var ANIM_MS = 450;
function gatePath(shape, H) {
  const r = H / 2;
  switch (shape) {
    case "AND":
      return `M0,0 H${52 - r} A${r},${r} 0 0 1 ${52 - r},${H} H0 Z`;
    case "OR":
    case "XOR":
      return `M0,0 Q32,0 52,${r} Q32,${H} 0,${H} Q14,${r} 0,0 Z`;
    default:
      return `M0,0 L52,${r} L0,${H} Z`;
  }
}
var CH_FIRST = 18;
var CH_STEP = 6;
var CH_MARGIN = 14;
var laneY = (lane) => 6 + 6 * lane;
var channelNeed = (tracks) => CH_FIRST + CH_STEP * Math.max(0, tracks - 1) + CH_MARGIN;
function layout(c, geo) {
  const SP = 40 + geo.vgap, GAP = geo.vgap, T0 = TOP + (geo.topPad || 0);
  const level = {}, cy = {};
  c.inputs.forEach((n, i) => {
    level[n] = 0;
    cy[n] = T0 + i * SP;
  });
  c.order.forEach((g) => {
    g.level = 1 + Math.max(...g.ins.map((x) => level[x]));
    level[g.out] = g.level;
    g.H = Math.max(44, 14 * (g.ins.length + 1));
  });
  const maxL = c.order.length ? Math.max(...c.order.map((g) => g.level)) : 0;
  const colX = {};
  for (let L = 1; L <= maxL; L++) {
    const need = geo.gapBefore && geo.gapBefore[L] || 0;
    colX[L] = L === 1 ? LEFT + Math.max(70, need) : colX[L - 1] + GATE_W + Math.max(geo.hgap, need);
  }
  c.order.forEach((g) => {
    g.x0 = colX[g.level];
  });
  let bottom = T0 + Math.max(0, c.inputs.length - 1) * SP + 12;
  for (let L = 1; L <= maxL; L++) {
    const gs = c.order.filter((g) => g.level === L);
    gs.forEach((g) => {
      g.want = g.ins.reduce((a, x) => a + cy[x], 0) / g.ins.length;
    });
    gs.sort((a, b) => a.want - b.want);
    let prevBottom = -Infinity;
    gs.forEach((g) => {
      const top = Math.max(g.want - g.H / 2, prevBottom + GAP + 14);
      g.cy = top + g.H / 2;
      prevBottom = top + g.H;
      cy[g.out] = g.cy;
      bottom = Math.max(bottom, prevBottom);
    });
  }
  let right = LEFT + 40;
  c.order.forEach((g) => {
    right = Math.max(right, g.x0 + GATE_W + 16);
  });
  c.outputs.forEach((n) => {
    right = Math.max(right, c.driver[n].x0 + GATE_W + 52 + n.length * 8 + 12);
  });
  return { cy, maxL, width: right, height: bottom + TOP };
}
function wireChannel(g, i, hgap) {
  const n = g.ins.length, avail = Math.max(10, hgap - 6), first = Math.min(20, avail / 2);
  const step = n > 1 ? Math.min(7, (avail - first) / (n - 1)) : 0;
  return g.x0 - first - step * i;
}
function planRoutes(c, L, hgap) {
  const boxes = c.order.map((g) => ({ g, x0: g.x0 - 2, x1: g.x0 + GATE_W + 2, y0: g.cy - g.H / 2 - 14, y1: g.cy + g.H / 2 + 16 }));
  const routes = /* @__PURE__ */ new Map();
  let lanes = 0;
  c.order.forEach((g) => g.ins.forEach((sig, i) => {
    const d = c.driver[sig];
    const ax = d ? d.x0 + GATE_W : LEFT, ay = d ? d.cy : L.cy[sig], mx = wireChannel(g, i, hgap);
    if (boxes.some((b) => b.g !== g && b.g !== d && b.x1 > ax + 2 && b.x0 < mx && ay > b.y0 && ay < b.y1)) {
      routes.set(g.out + ":" + i, { lane: lanes % 5 });
      lanes++;
    }
  }));
  return { routes, lanes: Math.min(lanes, 5) };
}
function planChannels(c, L, plan) {
  const byLevel = /* @__PURE__ */ new Map();
  c.order.forEach((g) => {
    if (!byLevel.has(g.level))
      byLevel.set(g.level, []);
    byLevel.get(g.level).push(g);
  });
  const trackOf = /* @__PURE__ */ new Map(), tracks = {}, nets = {};
  for (const [lvl, gates] of byLevel) {
    const perNet = /* @__PURE__ */ new Map();
    gates.forEach((g) => g.ins.forEach((sig, i) => {
      const key = g.out + ":" + i, d = c.driver[sig], route = plan.routes.get(key);
      const ay = route ? laneY(route.lane) : d ? d.cy : L.cy[sig];
      const py = g.cy - g.H / 2 + g.H * (i + 1) / (g.ins.length + 1);
      if (!perNet.has(sig))
        perNet.set(sig, { sig, lo: Infinity, hi: -Infinity, keys: [], track: 0 });
      const n = perNet.get(sig);
      n.lo = Math.min(n.lo, ay, py);
      n.hi = Math.max(n.hi, ay, py);
      n.keys.push(key);
    }));
    const list = [...perNet.values()].sort((a, b) => a.lo - b.lo || a.hi - b.hi);
    const ends = [];
    list.forEach((n) => {
      if (n.hi - n.lo >= 1) {
        let t = ends.findIndex((end) => end < n.lo - 5);
        if (t < 0) {
          t = ends.length;
          ends.push(-Infinity);
        }
        ends[t] = n.hi;
        n.track = t;
      }
      n.keys.forEach((k) => trackOf.set(k, n.track));
    });
    tracks[lvl] = Math.max(1, ends.length);
    nets[lvl] = list;
  }
  return { trackOf, tracks, nets };
}
function solveGap(c, vgap, targetW) {
  const L0 = layout(c, { hgap: 90, vgap });
  if (L0.maxL < 2)
    return 90;
  return clamp(90 + (targetW - L0.width) / (L0.maxL - 1), 40, 1e3);
}

// src/ui/export-image.js
var import_obsidian5 = require("obsidian");
var import_obsidian52 = __toESM(require("obsidian"));
var STYLE_PROPS = [
  "fill",
  "fill-opacity",
  "stroke",
  "stroke-width",
  "stroke-opacity",
  "stroke-linejoin",
  "stroke-linecap",
  "stroke-dasharray",
  "opacity",
  "font-size",
  "font-family",
  "font-weight",
  "text-anchor"
];
function svgSnapshot(svg) {
  const clone = svg.cloneNode(true);
  const src = [svg, ...svg.querySelectorAll("*")], dst = [clone, ...clone.querySelectorAll("*")];
  src.forEach((el, i) => {
    const cs = getComputedStyle(el);
    STYLE_PROPS.forEach((p) => {
      const v = cs.getPropertyValue(p);
      if (v)
        dst[i].style.setProperty(p, v);
    });
    dst[i].removeAttribute("class");
  });
  clone.style.removeProperty("max-width");
  const vb = clone.getAttribute("viewBox").split(/\s+/).map(Number);
  const bg = (getComputedStyle(document.body).getPropertyValue("--background-primary") || "").trim() || "#ffffff";
  const rect = document.createElementNS(SVGNS, "rect");
  rect.setAttribute("x", 0);
  rect.setAttribute("y", 0);
  rect.setAttribute("width", vb[2]);
  rect.setAttribute("height", vb[3]);
  rect.setAttribute("fill", bg);
  clone.insertBefore(rect, clone.firstChild);
  clone.setAttribute("xmlns", SVGNS);
  clone.setAttribute("width", vb[2]);
  clone.setAttribute("height", vb[3]);
  return { text: new XMLSerializer().serializeToString(clone), width: vb[2], height: vb[3] };
}
async function svgToPng(snap, scale) {
  const url = URL.createObjectURL(new Blob([snap.text], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const img = new Image();
    await new Promise((res, rej) => {
      img.onload = res;
      img.onerror = () => rej(new Error("could not render the image"));
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(snap.width * scale);
    canvas.height = Math.round(snap.height * scale);
    canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise((res) => canvas.toBlob(res, "image/png"));
  } finally {
    URL.revokeObjectURL(url);
  }
}
async function saveToVault(app, baseName, ext, buffer) {
  const stamp = (/* @__PURE__ */ new Date()).toISOString().slice(0, 19).replace(/[:T]/g, "-");
  const filename = `${baseName}-${stamp}.${ext}`;
  let path = filename;
  try {
    if (app.fileManager && app.fileManager.getAvailablePathForAttachment)
      path = await app.fileManager.getAvailablePathForAttachment(filename);
  } catch (e) {
    path = filename;
  }
  await app.vault.createBinary(path, buffer);
  new import_obsidian52.Notice(`Saved ${path}`);
}
function addExportButton(head, app, getSvg, baseName) {
  if (!app || typeof import_obsidian52.Menu === "undefined")
    return;
  const btn = h("button", "lg-small", head, "export");
  btn.addEventListener("click", (evt) => {
    const svg = getSvg();
    if (!svg)
      return;
    const run = (fn) => async () => {
      try {
        await fn(svgSnapshot(svg));
      } catch (e) {
        new import_obsidian52.Notice("Export failed: " + e.message);
      }
    };
    const menu = new import_obsidian52.Menu();
    menu.addItem((i) => i.setTitle("Save as PNG").setIcon("image").onClick(run(async (snap) => {
      const blob = await svgToPng(snap, 2);
      await saveToVault(app, baseName, "png", await blob.arrayBuffer());
    })));
    menu.addItem((i) => i.setTitle("Save as SVG").setIcon("file-code").onClick(run(async (snap) => {
      await saveToVault(app, baseName, "svg", new TextEncoder().encode(snap.text).buffer);
    })));
    menu.addItem((i) => i.setTitle("Copy PNG to clipboard").setIcon("copy").onClick(run(async (snap) => {
      const blob = await svgToPng(snap, 2);
      if (typeof ClipboardItem === "undefined" || !navigator.clipboard || !navigator.clipboard.write) {
        new import_obsidian52.Notice("Copying images to the clipboard is not supported on this device.");
        return;
      }
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      new import_obsidian52.Notice("Image copied");
    })));
    menu.showAtMouseEvent(evt);
  });
}

// src/ui/diagram.js
function createDiagram(c, parent, ctx) {
  const flips = /* @__PURE__ */ new Set();
  let reps = null, matched = /* @__PURE__ */ new Set();
  const computeReps = () => {
    if (ctx.bubbles) {
      reps = bubbleForms(c, flips);
      matched = matchedBubbleNets(c, reps);
    }
  };
  computeReps();
  const repOf = (g) => reps ? reps.get(g) : baseRep(g);
  const fan = {};
  c.gates.forEach((g) => g.ins.forEach((n) => {
    fan[n] = (fan[n] || 0) + 1;
  }));
  const sim = createSim(
    c,
    ctx.getDelay,
    (sig, v) => {
      paint();
      spawn(sig, v);
      if (ctx.onChange)
        ctx.onChange(sig, v);
    },
    () => paint()
  );
  const box = h("div", "lg-diagram", parent);
  const head = h("div", "lg-title", box);
  h("span", "", head, ctx.title || "Circuit");
  let svgEl = null;
  if (ctx.bubbles) {
    h("span", "lg-muted-text", head, "  click a gate to flip its symbol ");
    h("button", "lg-small", head, "reset").addEventListener("click", () => {
      flips.clear();
      computeReps();
      draw();
      paint();
    });
  }
  addExportButton(head, ctx.app, () => svgEl, ctx.exportName || "circuit");
  const scroll = h("div", "lg-scroll", box);
  let hgap = ctx.hspacing.px || 90;
  let wires = [], dots = [], inBoxes = {}, outBoxes = {}, lamps = [], sprites = [], spriteLayer = null, raf = 0;
  let disposed = false;
  function draw() {
    scroll.textContent = "";
    wires = [];
    dots = [];
    inBoxes = {};
    outBoxes = {};
    lamps = [];
    sprites = [];
    let L = layout(c, { hgap, vgap: ctx.vgap });
    const plan = planRoutes(c, L, hgap);
    const topPad = plan.lanes ? 8 + 6 * plan.lanes : 0;
    L = layout(c, { hgap, vgap: ctx.vgap, topPad });
    const chan = planChannels(c, L, plan);
    const gapBefore = {};
    Object.keys(chan.tracks).forEach((l) => {
      gapBefore[l] = channelNeed(chan.tracks[l]);
    });
    L = layout(c, { hgap, vgap: ctx.vgap, topPad, gapBefore });
    const svg = s("svg", { class: "lg-svg", viewBox: `0 0 ${L.width} ${L.height}`, width: L.width, height: L.height }, scroll);
    svgEl = svg;
    if (ctx.hspacing.pct > 100)
      svg.style.maxWidth = "none";
    const wireLayer = s("g", {}, svg);
    const gateLayer = s("g", {}, svg);
    spriteLayer = s("g", {}, svg);
    const srcPoint = (n) => c.driver[n] ? { x: c.driver[n].x0 + GATE_W, y: c.driver[n].cy } : { x: LEFT, y: L.cy[n] };
    const addWire = (sig, d) => wires.push({ sig, el: s("path", { class: "lg-wire", d }, wireLayer) });
    c.order.forEach((g) => {
      const r = repOf(g), n = g.ins.length;
      g.ins.forEach((sig, i) => {
        const a = srcPoint(sig);
        const py = g.cy - g.H / 2 + g.H * (i + 1) / (n + 1);
        const mx = g.x0 - CH_FIRST - CH_STEP * (chan.trackOf.get(g.out + ":" + i) || 0);
        const endx = r.ins[i] ? g.x0 - 2 * BUBBLE_R : g.x0;
        const route = plan.routes.get(g.out + ":" + i);
        if (route) {
          const ly = Math.min(a.y, py) - 10 - route.lane * 6;
          const c1 = a.x + 20 + 4 * (route.lane % 3);
          addWire(sig, `M${a.x},${a.y} H${c1} V${ly} H${mx} V${py} H${endx}`);
        } else {
          addWire(sig, `M${a.x},${a.y} H${mx} V${py} H${endx}`);
        }
        if (r.ins[i]) {
          s("circle", { class: "lg-bubble" + (matched.has(sig) ? " match" : ""), cx: g.x0 - BUBBLE_R, cy: py, r: BUBBLE_R }, gateLayer);
        }
      });
    });
    Object.keys(fan).forEach((n) => {
      if (fan[n] > 1) {
        const a = srcPoint(n);
        dots.push({ sig: n, el: s("circle", { class: "lg-dot", cx: a.x + 10, cy: a.y, r: 3.5 }, wireLayer) });
      }
    });
    c.inputs.forEach((n) => {
      const y = L.cy[n];
      s("text", { class: "lg-label", x: LEFT - 30, y: y + 4, "text-anchor": "end" }, gateLayer, n);
      const rect = s("rect", { class: "lg-box in", x: LEFT - 24, y: y - 10, width: 24, height: 20, rx: 4 }, gateLayer);
      const text = s("text", { class: "lg-boxtext", x: LEFT - 12, y: y + 4, "text-anchor": "middle" }, gateLayer, "0");
      clickable(rect, () => ctx.onToggle(n));
      inBoxes[n] = { rect, text };
    });
    c.order.forEach((g) => {
      const r = repOf(g);
      const grp = s("g", { transform: `translate(${g.x0},${g.cy - g.H / 2})` }, gateLayer);
      const flippable = ctx.bubbles && !r.fixed;
      const body = s("path", { class: "lg-gate" + (flippable ? " flip" : ""), d: gatePath(r.shape, g.H) }, grp);
      if (flippable)
        clickable(body, () => {
          if (flips.has(g))
            flips.delete(g);
          else
            flips.add(g);
          computeReps();
          draw();
          paint();
        });
      if (r.shape === "XOR")
        s("path", { class: "lg-gate-extra", d: `M-7,0 Q7,${g.H / 2} -7,${g.H}` }, grp);
      if (r.out) {
        s("circle", { class: "lg-bubble" + (matched.has(g.out) ? " match" : ""), cx: 52 + BUBBLE_R, cy: g.H / 2, r: BUBBLE_R }, grp);
        addWire(g.out, `M${g.x0 + 52 + 2 * BUBBLE_R},${g.cy} H${g.x0 + GATE_W}`);
      } else {
        addWire(g.out, `M${g.x0 + 52},${g.cy} H${g.x0 + GATE_W}`);
      }
      s("text", { class: "lg-muted", x: 26, y: g.H + 12, "text-anchor": "middle" }, grp, g.type);
      if (c.used.has(g.out))
        s("text", { class: "lg-muted", x: GATE_W + 4, y: g.H / 2 - 7 }, grp, g.out);
      if (ctx.anim)
        lamps.push({ g, body, el: s("circle", { class: "lg-lamp v0", cx: 26, cy: -9, r: 4.5 }, grp) });
    });
    c.outputs.forEach((n) => {
      const g = c.driver[n], x = g.x0 + GATE_W;
      addWire(n, `M${x},${g.cy} H${x + 20}`);
      const rect = s("rect", { class: "lg-box", x: x + 20, y: g.cy - 10, width: 24, height: 20, rx: 4 }, gateLayer);
      const text = s("text", { class: "lg-boxtext", x: x + 32, y: g.cy + 4, "text-anchor": "middle" }, gateLayer, "0");
      s("text", { class: "lg-label", x: x + 52, y: g.cy + 4 }, gateLayer, n);
      outBoxes[n] = { rect, text };
    });
  }
  function paint() {
    if (disposed)
      return;
    const v = sim.vals;
    wires.forEach((w) => w.el.classList.toggle("on", !!v[w.sig]));
    dots.forEach((d) => d.el.classList.toggle("on", !!v[d.sig]));
    const setBox = (b, val) => {
      b.rect.classList.toggle("on", !!val);
      b.text.classList.toggle("on", !!val);
      b.text.textContent = String(val);
    };
    c.inputs.forEach((n) => {
      if (inBoxes[n])
        setBox(inBoxes[n], v[n]);
    });
    c.outputs.forEach((n) => {
      if (outBoxes[n])
        setBox(outBoxes[n], v[n]);
    });
    lamps.forEach((l) => {
      const w = sim.working(l.g);
      const val = w !== null ? w : v[l.g.out];
      l.el.setAttribute("class", `lg-lamp ${val ? "v1" : "v0"}${w !== null ? " work" : ""}`);
      const flippable = ctx.bubbles && !repOf(l.g).fixed;
      l.body.setAttribute("class", "lg-gate" + (flippable ? " flip" : "") + (w !== null ? w ? " w1" : " w0" : ""));
    });
  }
  function spawn(sig, v) {
    if (!ctx.anim || !spriteLayer || typeof requestAnimationFrame !== "function" || disposed)
      return;
    if (sprites.some((sp) => sp.sig === sig))
      return;
    wires.forEach((w) => {
      if (w.sig !== sig || sprites.length > 240)
        return;
      let len;
      try {
        len = w.el.getTotalLength();
      } catch (e) {
        return;
      }
      if (!(len > 0))
        return;
      const g = s("g", { class: "lg-sprite v" + v }, spriteLayer);
      s("circle", { r: 6.5 }, g);
      s("text", { y: 3.5, "text-anchor": "middle" }, g, String(v));
      sprites.push({ sig, el: g, path: w.el, len, t0: performance.now() });
    });
    if (!raf && sprites.length)
      raf = requestAnimationFrame(step);
  }
  function step(now) {
    raf = 0;
    if (disposed)
      return;
    for (let i = sprites.length - 1; i >= 0; i--) {
      const sp = sprites[i];
      const k = Math.min(1, Math.max(0, (now - sp.t0) / ANIM_MS));
      const pt = sp.path.getPointAtLength(k * sp.len);
      sp.el.setAttribute("transform", `translate(${pt.x},${pt.y})`);
      if (k >= 1) {
        sp.el.remove();
        sprites.splice(i, 1);
      }
    }
    if (sprites.length)
      raf = requestAnimationFrame(step);
  }
  draw();
  paint();
  if (ctx.hspacing.pct) {
    const target = scroll.clientWidth * ctx.hspacing.pct / 100;
    if (target > 0) {
      hgap = solveGap(c, ctx.vgap, target);
      draw();
      paint();
    }
  }
  let ro = null;
  if (ctx.hspacing.pct && typeof ResizeObserver !== "undefined") {
    let lastW = 0, pending = false;
    ro = new ResizeObserver((entries) => {
      if (disposed)
        return;
      const w = entries[0].contentRect.width;
      if (!w || Math.abs(w - lastW) < 2 || pending)
        return;
      lastW = w;
      pending = true;
      later(() => {
        pending = false;
        if (disposed)
          return;
        hgap = solveGap(c, ctx.vgap, w * ctx.hspacing.pct / 100);
        draw();
        paint();
      });
    });
    ro.observe(scroll);
  }
  return {
    sim,
    paint,
    getSvg: () => svgEl,
    dispose() {
      disposed = true;
      sim.dispose();
      if (raf)
        cancelAnimationFrame(raf);
      if (ro)
        ro.disconnect();
    }
  };
}

// src/ui/timing.js
function createTiming(parent, signals, kinds, app) {
  const box = h("div", "lg-timing", parent);
  const head = h("div", "lg-title", box);
  h("span", "", head, "Timing graph");
  const clearBtn = h("button", "lg-small", head, "clear");
  const host = h("div", "lg-scroll", box);
  let t0 = performance.now(), last = 0, hist = {}, queued = false, svgEl = null, disposed = false;
  let lastVals = () => ({});
  addExportButton(head, app, () => svgEl, "timing-graph");
  const schedule = () => {
    if (!queued) {
      queued = true;
      later(() => {
        queued = false;
        if (!disposed)
          draw();
      });
    }
  };
  function begin(vals) {
    if (disposed)
      return;
    t0 = performance.now();
    last = 0;
    hist = {};
    signals.forEach((n) => {
      hist[n] = [[0, vals[n]]];
    });
    schedule();
  }
  function record(sig, v) {
    if (disposed || !hist[sig])
      return;
    const h2 = hist[sig];
    if (h2.length && h2[h2.length - 1][1] === v)
      return;
    const t = (performance.now() - t0) / 1e3;
    h2.push([t, v]);
    last = Math.max(last, t);
    schedule();
  }
  function draw() {
    if (disposed)
      return;
    host.textContent = "";
    const W = 640, LBL = 84, RH = 22, PAD = 10;
    const T = Math.max(1, last * 1.1 + 0.2);
    const H = signals.length * RH + 28;
    const x = (t) => LBL + t / T * (W - LBL - PAD);
    const svg = s("svg", { class: "lg-svg", viewBox: `0 0 ${W} ${H}`, width: W, height: H }, host);
    svgEl = svg;
    const step = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20].find((st) => T / st <= 10) || 20;
    for (let t = 0; t <= T + 1e-9; t += step) {
      s("line", { class: "lg-grid", x1: x(t), x2: x(t), y1: 4, y2: H - 18 }, svg);
      s("text", { class: "lg-muted", x: x(t), y: H - 6, "text-anchor": "middle" }, svg, Math.round(t * 100) / 100 + "s");
    }
    signals.forEach((n, i) => {
      const top = 6 + i * RH + 3, bot = 6 + i * RH + RH - 5;
      const y = (v) => v ? top : bot;
      s("text", { class: "lg-label", x: LBL - 8, y: bot, "text-anchor": "end" }, svg, n);
      const pts = [];
      for (const [t, v] of hist[n] || []) {
        const prev = pts[pts.length - 1];
        if (prev && prev[0] === t && prev[1] === v)
          continue;
        if (prev && prev[0] === t)
          prev[1] = v;
        else
          pts.push([t, v]);
      }
      if (!pts.length)
        return;
      let d = `M${x(pts[0][0])},${y(pts[0][1])}`;
      for (let k = 1; k < pts.length; k++)
        d += ` H${x(pts[k][0])} V${y(pts[k][1])}`;
      d += ` H${x(T)}`;
      s("path", { class: "lg-wave " + (kinds[n] || ""), d }, svg);
    });
  }
  clearBtn.addEventListener("click", () => begin(lastVals()));
  return {
    begin,
    record,
    setLastVals(fn) {
      lastVals = fn;
    },
    dispose() {
      disposed = true;
    }
  };
}

// src/core/compact.js
function compactRows(c, all) {
  const n = c.inputs.length;
  let cur = all.map((r, i) => ({ v: i, mask: 0, key: c.outputs.map((o) => r[o]).join("") }));
  let changed = true;
  while (changed) {
    changed = false;
    const groups = /* @__PURE__ */ new Map();
    cur.forEach((t) => {
      const k = t.mask + "|" + t.key;
      if (!groups.has(k))
        groups.set(k, /* @__PURE__ */ new Map());
      groups.get(k).set(t.v, t);
    });
    const next = [], used = /* @__PURE__ */ new Set();
    for (const grp of groups.values()) {
      for (const t of grp.values()) {
        if (used.has(t))
          continue;
        let merged = false;
        for (let b = 0; b < n && !merged; b++) {
          const bit = 1 << b;
          if (t.mask & bit)
            continue;
          const p = grp.get(t.v ^ bit);
          if (p && !used.has(p)) {
            used.add(t);
            used.add(p);
            next.push({ v: t.v & ~bit, mask: t.mask | bit, key: t.key });
            merged = changed = true;
          }
        }
        if (!merged) {
          used.add(t);
          next.push(t);
        }
      }
    }
    cur = next;
  }
  return cur.sort((a, b) => a.v - b.v || a.mask - b.mask);
}

// src/ui/table.js
function renderTable(parent, c, all, compact) {
  const n = c.inputs.length;
  const table = h("table", "lg-table", parent);
  const head = h("tr", "", h("thead", "", table));
  let cols, rows;
  if (compact) {
    cols = [...c.inputs.map((x) => ({ n: x, cls: "" })), ...c.outputs.map((x, i) => ({ n: x, cls: i === 0 ? "lg-sep" : "" }))];
    rows = compactRows(c, all).map((t) => {
      const pattern = {};
      c.inputs.forEach((x, k) => {
        const bit = 1 << n - 1 - k;
        pattern[x] = t.mask & bit ? "X" : t.v & bit ? 1 : 0;
      });
      const r = all[t.v];
      return { v: t.v, mask: t.mask, pattern, cells: [...c.inputs.map((x) => String(pattern[x])), ...c.outputs.map((o) => String(r[o]))] };
    });
  } else {
    cols = [
      ...c.inputs.map((x) => ({ n: x, cls: "" })),
      ...c.middles.map((x, i) => ({ n: x, cls: "lg-mid" + (i === 0 ? " lg-sep" : "") })),
      ...c.outputs.map((x, i) => ({ n: x, cls: i === 0 ? "lg-sep" : "" }))
    ];
    rows = all.map((r, i) => {
      const pattern = {};
      c.inputs.forEach((x) => {
        pattern[x] = r[x];
      });
      return { v: i, mask: 0, pattern, cells: cols.map((col) => String(r[col.n])) };
    });
  }
  cols.forEach((col) => h("th", col.cls, head, col.n));
  const tbody = h("tbody", "", table);
  const trs = rows.map((row) => {
    const tr = h("tr", "", tbody);
    row.cells.forEach((txt, k) => h("td", cols[k].cls, tr, txt));
    return tr;
  });
  return {
    table,
    rows,
    trs,
    colNames: cols.map((x) => x.n),
    markActive(idx) {
      rows.forEach((r, i) => trs[i].classList.toggle("lg-active", (idx & ~r.mask) === r.v));
    }
  };
}
function tableToMarkdown(colNames, cellRows) {
  const esc = (s2) => String(s2).replace(/\|/g, "\\|");
  const row = (cells) => "| " + cells.map(esc).join(" | ") + " |";
  const sep = "| " + colNames.map(() => ":-:").join(" | ") + " |";
  return [row(colNames), sep, ...cellRows.map(row)].join("\n");
}

// src/ui/kmap.js
var KGRAY = (k) => k === 0 ? [0] : k === 1 ? [0, 1] : [0, 1, 3, 2];
var KCOLORS = ["#e5484d", "#3b82f6", "#30a46c", "#f5a524", "#8e4ec6", "#12a594"];
function kmapArcs(cube, n, startVar, count) {
  const size = 1 << count, g = KGRAY(count), pos = [];
  for (let p = 0; p < size; p++) {
    let ok = true;
    for (let j = 0; j < count && ok; j++) {
      const bit = 1 << n - 1 - (startVar + j);
      if (cube.mask & bit)
        continue;
      if ((cube.v & bit ? 1 : 0) !== (g[p] >> count - 1 - j & 1))
        ok = false;
    }
    if (ok)
      pos.push(p);
  }
  if (!pos.length)
    return [];
  if (pos.length === size)
    return [{ a: 0, b: size - 1, openA: false, openB: false }];
  const runs = [];
  let st = pos[0], prev = pos[0];
  for (let i = 1; i < pos.length; i++) {
    if (pos[i] === prev + 1)
      prev = pos[i];
    else {
      runs.push([st, prev]);
      st = pos[i];
      prev = pos[i];
    }
  }
  runs.push([st, prev]);
  if (runs.length > 1 && runs[0][0] === 0 && runs[runs.length - 1][1] === size - 1) {
    return runs.map((r, i) => ({ a: r[0], b: r[1], openA: i === 0, openB: i === runs.length - 1 }));
  }
  return runs.map((r) => ({ a: r[0], b: r[1], openA: false, openB: false }));
}
function outlinePath(x, y, w, hh, r, oL, oR, oT, oB) {
  const rTL = !oT && !oL ? r : 0, rTR = !oT && !oR ? r : 0, rBR = !oB && !oR ? r : 0, rBL = !oB && !oL ? r : 0;
  const d = [];
  if (!oT)
    d.push(`M${x + rTL},${y} L${x + w - rTR},${y}`);
  if (rTR)
    d.push(`M${x + w - rTR},${y} A${rTR},${rTR} 0 0 1 ${x + w},${y + rTR}`);
  if (!oR)
    d.push(`M${x + w},${y + rTR} L${x + w},${y + hh - rBR}`);
  if (rBR)
    d.push(`M${x + w},${y + hh - rBR} A${rBR},${rBR} 0 0 1 ${x + w - rBR},${y + hh}`);
  if (!oB)
    d.push(`M${x + w - rBR},${y + hh} L${x + rBL},${y + hh}`);
  if (rBL)
    d.push(`M${x + rBL},${y + hh} A${rBL},${rBL} 0 0 1 ${x},${y + hh - rBL}`);
  if (!oL)
    d.push(`M${x},${y + hh - rBL} L${x},${y + rTL}`);
  if (rTL)
    d.push(`M${x},${y + rTL} A${rTL},${rTL} 0 0 1 ${x + rTL},${y}`);
  return d.join(" ");
}
function kmapPieces(cube, n, gridVars, rowVars, colVars, extra, slice) {
  for (let j = 0; j < extra; j++) {
    const bit = 1 << n - 1 - (gridVars + j);
    if (cube.mask & bit)
      continue;
    if ((cube.v & bit ? 1 : 0) !== (slice >> extra - 1 - j & 1))
      return [];
  }
  const rows = kmapArcs(cube, n, 0, rowVars), cols = kmapArcs(cube, n, rowVars, colVars);
  const out = [];
  rows.forEach((ra) => cols.forEach((ca) => out.push({
    r0: ra.a,
    r1: ra.b,
    c0: ca.a,
    c1: ca.b,
    oT: ra.openA,
    oB: ra.openB,
    oL: ca.openA,
    oR: ca.openB
  })));
  return out;
}
function renderKmaps(parent, c, all, exprs, ctx) {
  const n = c.inputs.length;
  if (n < 2 || n > 6) {
    h("div", "lg-note", parent, "Karnaugh maps are drawn for 2 to 6 inputs.");
    return null;
  }
  const gridVars = Math.min(n, 4), rowVars = Math.floor(gridVars / 2), colVars = gridVars - rowVars, extra = n - gridVars;
  const nR = 1 << rowVars, nC = 1 << colVars;
  const CW = 46, CH = 38, LBLW = 64, HDRH = 44;
  const bits = (v, k) => k ? v.toString(2).padStart(k, "0") : "";
  const cellIndex = (rg, cg, slice) => {
    let m = 0;
    const put = (val, startK, count) => {
      for (let j = 0; j < count; j++)
        m |= (val >> count - 1 - j & 1) << n - 1 - (startK + j);
    };
    put(rg, 0, rowVars);
    put(cg, rowVars, colVars);
    put(slice, gridVars, extra);
    return m;
  };
  const actives = [];
  exprs.forEach((e) => {
    const blk = h("div", "lg-kmap-block", parent);
    const head = h("div", "lg-title", blk);
    h("span", "", head, `Karnaugh map: ${e.name}`);
    if (e.cov.const !== void 0) {
      h("div", "lg-note", blk, `${e.name} is constant ${e.cov.const}`);
      return;
    }
    h("span", "lg-muted-text", head, e.cov.exact ? "  minimal cover " : "  near-minimal cover ");
    const svgs = [];
    addExportButton(head, ctx.app, () => svgs[0], "karnaugh-" + e.name);
    const maps = h("div", "lg-kmaps", blk);
    for (let slice = 0; slice < 1 << extra; slice++) {
      const holder = h("div", "lg-kmap-holder", maps);
      const W = LBLW + nC * CW + 8, H = HDRH + nR * CH + 8;
      const svg = s("svg", { class: "lg-svg lg-kmap", viewBox: `0 0 ${W} ${H}`, width: W, height: H }, holder);
      svgs.push(svg);
      s("line", { class: "lg-kline", x1: 0, y1: 0, x2: LBLW, y2: HDRH }, svg);
      s("text", { class: "lg-klabel", x: LBLW - 6, y: 15, "text-anchor": "end" }, svg, c.inputs.slice(rowVars, gridVars).join(""));
      s("text", { class: "lg-klabel", x: 6, y: HDRH - 7 }, svg, c.inputs.slice(0, rowVars).join(""));
      KGRAY(colVars).forEach((cg, j) => s("text", { class: "lg-kcode", x: LBLW + (j + 0.5) * CW, y: HDRH - 8, "text-anchor": "middle" }, svg, bits(cg, colVars)));
      KGRAY(rowVars).forEach((rg, i) => s("text", { class: "lg-kcode", x: LBLW - 8, y: HDRH + (i + 0.5) * CH + 4, "text-anchor": "end" }, svg, bits(rg, rowVars)));
      KGRAY(rowVars).forEach((rg, i) => KGRAY(colVars).forEach((cg, j) => {
        const m = cellIndex(rg, cg, slice), val = all[m][e.name];
        const rect = s("rect", { class: "lg-kcell", x: LBLW + j * CW, y: HDRH + i * CH, width: CW, height: CH }, svg);
        const isDontCare = val === -1;
        const textClass = "lg-kval" + (val === 1 ? " one" : "") + (isDontCare ? " lg-kval-x" : "");
        s("text", { class: textClass, x: LBLW + (j + 0.5) * CW, y: HDRH + (i + 0.5) * CH + 5, "text-anchor": "middle" }, svg, isDontCare ? "X" : String(val));
        s("text", { class: "lg-knum", x: LBLW + (j + 1) * CW - 4, y: HDRH + (i + 1) * CH - 4, "text-anchor": "end" }, svg, String(m));
        clickable(rect, () => ctx.onPick(m));
        actives.push({ rect, m });
      }));
      e.cov.cover.forEach((cb, gi) => {
        const color = KCOLORS[gi % KCOLORS.length], inset = 3 + gi % 3 * 3;
        kmapPieces(cb, n, gridVars, rowVars, colVars, extra, slice).forEach((p) => {
          const x0 = LBLW + p.c0 * CW + (p.oL ? 0 : inset), x1 = LBLW + (p.c1 + 1) * CW - (p.oR ? 0 : inset);
          const y0 = HDRH + p.r0 * CH + (p.oT ? 0 : inset), y1 = HDRH + (p.r1 + 1) * CH - (p.oB ? 0 : inset);
          s("rect", { class: "lg-kfill", x: x0, y: y0, width: x1 - x0, height: y1 - y0, rx: 8, fill: color }, svg);
          s("path", { class: "lg-kgroup", d: outlinePath(x0, y0, x1 - x0, y1 - y0, 8, p.oL, p.oR, p.oT, p.oB), stroke: color }, svg);
        });
      });
      if (extra)
        s("text", { class: "lg-kcode", x: W - 6, y: 14, "text-anchor": "end" }, svg, c.inputs.slice(gridVars).join("") + "=" + bits(slice, extra));
    }
    const legend = h("div", "lg-legend", blk);
    e.cov.cover.forEach((cb, gi) => {
      const item = h("span", "lg-legend-item", legend);
      h("span", "lg-swatch", item).style.background = KCOLORS[gi % KCOLORS.length];
      math(cubeLatex(c, cb), item);
    });
  });
  return { markActive(idx) {
    actives.forEach((a) => a.rect.classList.toggle("lg-kactive", a.m === idx));
  } };
}

// src/ui/block.js
function renderBlock(src, el, plugin) {
  const S = plugin.settings, app = plugin.app;
  const wrap = h("div", "lg-wrap", el);
  let c;
  try {
    c = parse(src, { maxInputs: S.maxInputs, maxGates: S.maxGates });
  } catch (e) {
    h("div", "lg-error", wrap, e.message);
    return { dispose() {
    } };
  }
  const O = c.opts;
  if (O.help)
    renderHelp(wrap, plugin);
  if (c.empty)
    return { dispose() {
    } };
  const part = (name, def) => O.hide.has(name) ? false : O.show.has(name) ? true : def;
  const analyzable = c.inputs.length <= ANALYSIS_MAX_INPUTS2;
  const all = analyzable ? truthTable(c) : null;
  const exprs = buildExpressions(c, all);
  const bubbles = O.bubbles !== null ? O.bubbles : S.bubblePushing;
  const method = O.simplify !== null ? O.simplify === "off" ? null : O.simplify : S.expSimplify ? S.simplifyMethod : null;
  const compact = O.compact !== null ? O.compact : S.collapseDontCare;
  const view = O.timing || S.timingView;
  let delaySec = O.delay !== null ? O.delay : S.delayEnabled ? S.delaySeconds : 0;
  if (O.timing && delaySec === 0)
    delaySec = 1;
  const getDelay = () => delaySec < 0 ? Math.random() * 5 : delaySec;
  const showGraph = delaySec !== 0 && (view === "graph" || view === "both") && part("timing", true);
  const anim = delaySec !== 0 && (view === "animation" || view === "both");
  const hspacing = parseSpacing2(S.hSpacing) || { px: 90 };
  const inputState = {};
  c.inputs.forEach((n) => {
    inputState[n] = 0;
  });
  const diagrams = [];
  let mainDiagram = null, timing = null, table = null, kmaps = null;
  function highlight() {
    const idx = c.inputs.reduce((a, n) => a * 2 + (inputState[n] ? 1 : 0), 0);
    if (table)
      table.markActive(idx);
    if (kmaps)
      kmaps.markActive(idx);
  }
  function setInputs(patch) {
    if (timing && mainDiagram && mainDiagram.sim.pending() === 0)
      timing.begin(mainDiagram.sim.vals);
    Object.assign(inputState, patch);
    diagrams.forEach((d) => d.sim.setInputs(patch));
    highlight();
  }
  const toggle = (n) => setInputs({ [n]: inputState[n] ? 0 : 1 });
  const pickIndex = (m) => {
    const patch = {};
    c.inputs.forEach((n, k) => {
      patch[n] = m >> c.inputs.length - 1 - k & 1;
    });
    setInputs(patch);
  };
  const base = { app, hspacing, vgap: S.vSpacing, bubbles, anim, getDelay, onToggle: toggle };
  if (part("diagram", true)) {
    const holder = h("div", "", wrap);
    mainDiagram = createDiagram(c, holder, Object.assign({}, base, {
      title: "Circuit",
      exportName: "circuit",
      onChange: (sig, v) => {
        if (timing)
          timing.record(sig, v);
      }
    }));
    if (showGraph) {
      const kinds = {};
      c.inputs.forEach((n) => {
        kinds[n] = "in";
      });
      c.outputs.forEach((n) => {
        kinds[n] = "out";
      });
      timing = createTiming(holder, [...c.inputs, ...c.middles, ...c.outputs], kinds, app);
      timing.setLastVals(() => mainDiagram.sim.vals);
      timing.begin(mainDiagram.sim.vals);
    }
    diagrams.push(mainDiagram);
  }
  if (method && part("diagram", true)) {
    if (!analyzable && method !== "structural") {
      h("div", "lg-note", wrap, `"${method}" needs at most ${ANALYSIS_MAX_INPUTS2} inputs. "structural" works at any size.`);
    } else {
      let r = null;
      try {
        r = reduceCircuit(c, all, method);
      } catch (e) {
        h("div", "lg-note", wrap, "Reduction failed: " + e.message);
      }
      if (r) {
        const chosen = method === "best" ? ` (${r.method})` : "";
        Object.keys(r.consts).forEach((o) => h("div", "lg-note", wrap, `${o} reduces to the constant ${r.consts[o]}`));
        if (r.verified === "FAILED") {
          h("div", "lg-error", wrap, "The reduced circuit did not match the original, so it is not shown. Please report this circuit.");
        } else if (r.circuit && !(r.method === "structural" && r.after.gates >= r.before.gates)) {
          const check = r.verified === "exact" ? "checked on all inputs" : "checked on 4096 random inputs";
          diagrams.push(createDiagram(r.circuit, wrap, Object.assign({}, base, {
            title: `Reduced, ${METHOD_LABEL2[r.method]}${chosen}: ${r.before.gates} to ${r.after.gates} gates (${check})`,
            exportName: "circuit-reduced"
          })));
          if (r.after.gates > r.before.gates)
            h("div", "lg-note", wrap, 'This form has more gates than your circuit: two-level logic can be larger (parity/XOR circuits are the classic case). Try "structural" or "best".');
        } else if (r.method === "structural") {
          h("div", "lg-note", wrap, `No structural reduction found: ${r.before.gates} gates is already minimal for these rewrite rules.`);
        }
      }
    }
  }
  if (part("expr", S.showExpr)) {
    const box = h("div", "lg-expr", wrap);
    exprs.forEach((e) => {
      const same = e.raw === e.min;
      if (e.raw && !same)
        math(`${nm(e.name)} = ${e.raw}`, h("div", "lg-expr-row", box));
      if (e.min !== null) {
        const r2 = h("div", "lg-expr-row", box);
        math(`${nm(e.name)} = ${e.min}`, r2);
        if (e.raw && !same)
          h("span", "lg-expr-tag", r2, e.cov.exact === false ? " simplified (near-minimal)" : " simplified");
      } else if (!e.raw) {
        h("div", "lg-note", box, `${e.name}: expression too long to display`);
      }
    });
    if (!analyzable)
      h("div", "lg-note", box, `More than ${ANALYSIS_MAX_INPUTS2} inputs: only the structural expression is shown.`);
    if (typeof import_obsidian6.finishRenderMath === "function")
      (0, import_obsidian6.finishRenderMath)();
  }
  if (analyzable && part("kmap", S.showKmap)) {
    const kb = h("div", "lg-kmap-wrap", wrap);
    kmaps = renderKmaps(kb, c, all, exprs, { app, onPick: pickIndex });
    if (typeof import_obsidian6.finishRenderMath === "function")
      (0, import_obsidian6.finishRenderMath)();
  }
  const showTable = part("table", S.showTable);
  if (analyzable && showTable) {
    table = renderTable(wrap, c, all, compact);
    table.trs.forEach((tr, i) => tr.addEventListener("click", () => {
      const patch = {};
      c.inputs.forEach((n) => {
        const p = table.rows[i].pattern[n];
        patch[n] = p === "X" ? inputState[n] : p;
      });
      setInputs(patch);
    }));
  } else if (!analyzable && showTable) {
    h("div", "lg-note", wrap, `Truth table hidden: more than ${ANALYSIS_MAX_INPUTS2} inputs (2^${c.inputs.length} rows). The diagram is still interactive.`);
  }
  highlight();
  const actions = h("div", "lg-actions", wrap);
  const btn = (label, fn) => h("button", "", actions, label).addEventListener("click", () => copy(fn()));
  if (table)
    btn("Copy table (Markdown)", () => tableToMarkdown(table.colNames, table.rows.map((r) => r.cells)));
  if (analyzable)
    btn("Copy expressions (LaTeX)", () => toLatexSource(exprs));
  btn("Copy diagram (Mermaid)", () => toMermaid(c));
  return {
    dispose() {
      diagrams.forEach((d) => d.dispose());
      if (timing)
        timing.dispose();
    }
  };
}

// src/main.js
var LogicGraphPlugin = class extends import_obsidian7.Plugin {
  constructor() {
    super(...arguments);
    this.liveBlocks = /* @__PURE__ */ new Set();
  }
  async onload() {
    await this.loadSettings();
    this.addSettingTab(new LogicGraphSettingTab(this.app, this));
    this.api = {
      version: this.manifest.version,
      // Fixed: use Obsidian's native manifest
      parse: (src, limits) => parse(src, limits),
      getSettings: () => this.settings,
      providers: PROVIDERS,
      fence
    };
    ["logic", "Logic", "logic-graph"].forEach((lang) => {
      this.registerMarkdownCodeBlockProcessor(lang, (source, el) => {
        const handle = renderBlock(source, el, this);
        if (handle && handle.dispose)
          this.liveBlocks.add(handle);
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
      });
    });
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
      if (b.dispose)
        b.dispose();
    });
    this.liveBlocks.clear();
  }
  refreshAll() {
    this.app.workspace.getLeavesOfType("markdown").forEach((leaf) => {
      const view = leaf.view;
      if (!view)
        return;
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsic3JjL21haW4uanMiLCAic3JjL2NvcmUvZ2F0ZXMuanMiLCAic3JjL2NvcmUvY29uc3RhbnRzLmpzIiwgInNyYy9jb3JlL3BhcnNlci5qcyIsICJzcmMvc2V0dGluZ3MvdGFiLmpzIiwgInNyYy9zZXR0aW5ncy9zZXR0aW5ncy5qcyIsICJzcmMvc2V0dGluZ3MvcHJvdmlkZXJzLmpzIiwgInNyYy90ZW1wbGF0ZXMuanMiLCAic3JjL3VpL2Jsb2NrLmpzIiwgInNyYy9jb3JlL3NpbS5qcyIsICJzcmMvY29yZS9sYXRleC5qcyIsICJzcmMvY29yZS9taW5pbWl6ZS5qcyIsICJzcmMvY29yZS9zeW50aGVzaXplLmpzIiwgInNyYy9jb3JlL3JlZHVjZS5qcyIsICJzcmMvdWkvZG9tLmpzIiwgInNyYy91aS9jb3B5LmpzIiwgInNyYy91aS9oZWxwLmpzIiwgInNyYy9jb3JlL2J1YmJsZXMuanMiLCAic3JjL3VpL2xheW91dC5qcyIsICJzcmMvdWkvZXhwb3J0LWltYWdlLmpzIiwgInNyYy91aS9kaWFncmFtLmpzIiwgInNyYy91aS90aW1pbmcuanMiLCAic3JjL2NvcmUvY29tcGFjdC5qcyIsICJzcmMvdWkvdGFibGUuanMiLCAic3JjL3VpL2ttYXAuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8vIHBhY2thZ2VzL2xvZ2ljLWdyYXBoL3NyYy9tYWluLmpzXG5pbXBvcnQgeyBQbHVnaW4gfSBmcm9tIFwib2JzaWRpYW5cIjtcbmltcG9ydCB7IEdBVEVTIH0gZnJvbSBcIi4vY29yZS9nYXRlcy5qc1wiO1xuaW1wb3J0IHsgcGFyc2UgfSBmcm9tIFwiLi9jb3JlL3BhcnNlci5qc1wiO1xuaW1wb3J0IHsgTG9naWNHcmFwaFNldHRpbmdUYWIgfSBmcm9tIFwiLi9zZXR0aW5ncy90YWIuanNcIjtcbmltcG9ydCB7IHNhbml0aXplU2V0dGluZ3MgfSBmcm9tIFwiLi9zZXR0aW5ncy9zZXR0aW5ncy5qc1wiO1xuaW1wb3J0IHsgUFJPVklERVJTIH0gZnJvbSBcIi4vc2V0dGluZ3MvcHJvdmlkZXJzLmpzXCI7XG5pbXBvcnQgeyBmZW5jZSwgVGVtcGxhdGVNb2RhbCB9IGZyb20gXCIuL3RlbXBsYXRlcy5qc1wiO1xuaW1wb3J0IHsgcmVuZGVyQmxvY2sgfSBmcm9tIFwiLi91aS9ibG9jay5qc1wiO1xuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBMb2dpY0dyYXBoUGx1Z2luIGV4dGVuZHMgUGx1Z2luIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoLi4uYXJndW1lbnRzKTtcbiAgICB0aGlzLmxpdmVCbG9ja3MgPSBuZXcgU2V0KCk7XG4gIH1cblxuICBhc3luYyBvbmxvYWQoKSB7XG4gICAgYXdhaXQgdGhpcy5sb2FkU2V0dGluZ3MoKTtcbiAgICB0aGlzLmFkZFNldHRpbmdUYWIobmV3IExvZ2ljR3JhcGhTZXR0aW5nVGFiKHRoaXMuYXBwLCB0aGlzKSk7XG4gICAgXG4gICAgdGhpcy5hcGkgPSB7XG4gICAgICB2ZXJzaW9uOiB0aGlzLm1hbmlmZXN0LnZlcnNpb24sIC8vIEZpeGVkOiB1c2UgT2JzaWRpYW4ncyBuYXRpdmUgbWFuaWZlc3RcbiAgICAgIHBhcnNlOiAoc3JjLCBsaW1pdHMpID0+IHBhcnNlKHNyYywgbGltaXRzKSxcbiAgICAgIGdldFNldHRpbmdzOiAoKSA9PiB0aGlzLnNldHRpbmdzLFxuICAgICAgcHJvdmlkZXJzOiBQUk9WSURFUlMsXG4gICAgICBmZW5jZVxuICAgIH07XG5cbiAgICBbXCJsb2dpY1wiLCBcIkxvZ2ljXCIsIFwibG9naWMtZ3JhcGhcIl0uZm9yRWFjaCgobGFuZykgPT4ge1xuICAgICAgdGhpcy5yZWdpc3Rlck1hcmtkb3duQ29kZUJsb2NrUHJvY2Vzc29yKGxhbmcsIChzb3VyY2UsIGVsKSA9PiB7XG4gICAgICAgIGNvbnN0IGhhbmRsZSA9IHJlbmRlckJsb2NrKHNvdXJjZSwgZWwsIHRoaXMpO1xuICAgICAgICBpZiAoaGFuZGxlICYmIGhhbmRsZS5kaXNwb3NlKSB0aGlzLmxpdmVCbG9ja3MuYWRkKGhhbmRsZSk7XG4gICAgICAgIFxuICAgICAgICBpZiAodHlwZW9mIE11dGF0aW9uT2JzZXJ2ZXIgIT09IFwidW5kZWZpbmVkXCIpIHtcbiAgICAgICAgICBjb25zdCBtbyA9IG5ldyBNdXRhdGlvbk9ic2VydmVyKCgpID0+IHtcbiAgICAgICAgICAgIGlmICghZWwuaXNDb25uZWN0ZWQpIHtcbiAgICAgICAgICAgICAgbW8uZGlzY29ubmVjdCgpO1xuICAgICAgICAgICAgICBpZiAoaGFuZGxlICYmIGhhbmRsZS5kaXNwb3NlKSB7XG4gICAgICAgICAgICAgICAgaGFuZGxlLmRpc3Bvc2UoKTtcbiAgICAgICAgICAgICAgICB0aGlzLmxpdmVCbG9ja3MuZGVsZXRlKGhhbmRsZSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9KTtcbiAgICAgICAgICBtby5vYnNlcnZlKGRvY3VtZW50LmJvZHksIHsgY2hpbGRMaXN0OiB0cnVlLCBzdWJ0cmVlOiB0cnVlIH0pO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9KTtcblxuICAgIHRoaXMuYWRkQ29tbWFuZCh7XG4gICAgICBpZDogXCJpbnNlcnQtYmxvY2tcIixcbiAgICAgIG5hbWU6IFwiSW5zZXJ0IGxvZ2ljIGJsb2NrXCIsXG4gICAgICBlZGl0b3JDYWxsYmFjazogKGVkKSA9PiBlZC5yZXBsYWNlU2VsZWN0aW9uKGZlbmNlKFwiKGEsYikgQU5EIChjKVxcbihjLGIpIFhPUiAoZClcXG4oZCkgTk9UICh5KVwiKSlcbiAgICB9KTtcbiAgICBcbiAgICB0aGlzLmFkZENvbW1hbmQoe1xuICAgICAgaWQ6IFwiaW5zZXJ0LWhlbHBcIixcbiAgICAgIG5hbWU6IFwiSW5zZXJ0IGhlbHAgYmxvY2sgKEBoZWxwKVwiLFxuICAgICAgZWRpdG9yQ2FsbGJhY2s6IChlZCkgPT4gZWQucmVwbGFjZVNlbGVjdGlvbihmZW5jZShcIkBoZWxwXCIpKVxuICAgIH0pO1xuICAgIFxuICAgIHRoaXMuYWRkQ29tbWFuZCh7XG4gICAgICBpZDogXCJpbnNlcnQtdGVtcGxhdGVcIixcbiAgICAgIG5hbWU6IFwiSW5zZXJ0IGxvZ2ljIGJsb2NrIGZyb20gdGVtcGxhdGVcdTIwMjZcIixcbiAgICAgIGVkaXRvckNhbGxiYWNrOiAoZWQpID0+IG5ldyBUZW1wbGF0ZU1vZGFsKHRoaXMuYXBwLCAodCkgPT4gZWQucmVwbGFjZVNlbGVjdGlvbihmZW5jZSh0LmNvZGUpKSkub3BlbigpXG4gICAgfSk7XG4gICAgXG4gICAgdGhpcy5hZGRDb21tYW5kKHtcbiAgICAgIGlkOiBcIndyYXAtc2VsZWN0aW9uXCIsXG4gICAgICBuYW1lOiBcIldyYXAgc2VsZWN0aW9uIGluIGxvZ2ljIGJsb2NrXCIsXG4gICAgICBlZGl0b3JDYWxsYmFjazogKGVkKSA9PiB7XG4gICAgICAgIGNvbnN0IHNlbCA9IGVkLmdldFNlbGVjdGlvbigpO1xuICAgICAgICBlZC5yZXBsYWNlU2VsZWN0aW9uKGZlbmNlKHNlbCB8fCBcIihhLGIpIEFORCAoeSlcIikpO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgT2JqZWN0LmtleXMoR0FURVMpLmZvckVhY2goKHR5cGUpID0+IHtcbiAgICAgIHRoaXMuYWRkQ29tbWFuZCh7XG4gICAgICAgIGlkOiBcImdhdGUtXCIgKyB0eXBlLnRvTG93ZXJDYXNlKCksXG4gICAgICAgIG5hbWU6IGBJbnNlcnQgZ2F0ZSBsaW5lOiAke3R5cGV9YCxcbiAgICAgICAgZWRpdG9yQ2FsbGJhY2s6IChlZCkgPT4gZWQucmVwbGFjZVNlbGVjdGlvbihHQVRFU1t0eXBlXS5taW4gPT09IDEgPyBgKGEpICR7dHlwZX0gKHkpXFxuYCA6IGAoYSxiKSAke3R5cGV9ICh5KVxcbmApXG4gICAgICB9KTtcbiAgICB9KTtcblxuICAgIFtcIkBzaW1wbGlmeSBzdHJ1Y3R1cmFsXCIsIFwiQGJ1YmJsZXNcIiwgXCJAdGltaW5nLWJvdGhcIiwgXCJAdGltaW5nLWdyYXBoXCIsIFwiQHRpbWluZy1hbmltYXRpb25cIiwgXCJAaGlkZSB0YWJsZVwiLCBcIkBzaG93IGttYXBcIl0uZm9yRWFjaCgoZCkgPT4ge1xuICAgICAgdGhpcy5hZGRDb21tYW5kKHtcbiAgICAgICAgaWQ6IFwiZGlyZWN0aXZlLVwiICsgZC5zbGljZSgxKS5yZXBsYWNlKC9cXHMrL2csIFwiLVwiKSxcbiAgICAgICAgbmFtZTogYEluc2VydCBkaXJlY3RpdmU6ICR7ZH1gLFxuICAgICAgICBlZGl0b3JDYWxsYmFjazogKGVkKSA9PiBlZC5yZXBsYWNlU2VsZWN0aW9uKGQgKyBcIlxcblwiKVxuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cblxuICBvbnVubG9hZCgpIHtcbiAgICB0aGlzLmxpdmVCbG9ja3MuZm9yRWFjaCgoYikgPT4ge1xuICAgICAgaWYgKGIuZGlzcG9zZSkgYi5kaXNwb3NlKCk7XG4gICAgfSk7XG4gICAgdGhpcy5saXZlQmxvY2tzLmNsZWFyKCk7XG4gIH1cblxuICByZWZyZXNoQWxsKCkge1xuICAgIHRoaXMuYXBwLndvcmtzcGFjZS5nZXRMZWF2ZXNPZlR5cGUoXCJtYXJrZG93blwiKS5mb3JFYWNoKChsZWFmKSA9PiB7XG4gICAgICBjb25zdCB2aWV3ID0gbGVhZi52aWV3O1xuICAgICAgaWYgKCF2aWV3KSByZXR1cm47XG4gICAgICBpZiAodmlldy5wcmV2aWV3TW9kZSAmJiB0eXBlb2Ygdmlldy5wcmV2aWV3TW9kZS5yZXJlbmRlciA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgIHZpZXcucHJldmlld01vZGUucmVyZW5kZXIodHJ1ZSk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICBhc3luYyBsb2FkU2V0dGluZ3MoKSB7XG4gICAgdGhpcy5zZXR0aW5ncyA9IHNhbml0aXplU2V0dGluZ3MoYXdhaXQgdGhpcy5sb2FkRGF0YSgpKTtcbiAgfVxuXG4gIGFzeW5jIHNhdmVTZXR0aW5ncygpIHtcbiAgICB0aGlzLnNldHRpbmdzID0gT2JqZWN0LmFzc2lnbih0aGlzLnNldHRpbmdzLCBzYW5pdGl6ZVNldHRpbmdzKHRoaXMuc2V0dGluZ3MpKTtcbiAgICBhd2FpdCB0aGlzLnNhdmVEYXRhKHRoaXMuc2V0dGluZ3MpO1xuICB9XG59IiwgIi8vIHBhY2thZ2VzL2xvZ2ljLWdyYXBoL3NyYy9jb3JlL2dhdGVzLmpzXG5leHBvcnQgY29uc3QgR0FURVMgPSB7XG4gIEFORDogeyBtaW46IDIsIHNoYXBlOiBcIkFORFwiLCBpbnY6IGZhbHNlLCBmbjogKHYpID0+IHYuZXZlcnkoKHgpID0+IHgpIH0sXG4gIE5BTkQ6IHsgbWluOiAyLCBzaGFwZTogXCJBTkRcIiwgaW52OiB0cnVlLCBmbjogKHYpID0+ICF2LmV2ZXJ5KCh4KSA9PiB4KSB9LFxuICBPUjogeyBtaW46IDIsIHNoYXBlOiBcIk9SXCIsIGludjogZmFsc2UsIGZuOiAodikgPT4gdi5zb21lKCh4KSA9PiB4KSB9LFxuICBOT1I6IHsgbWluOiAyLCBzaGFwZTogXCJPUlwiLCBpbnY6IHRydWUsIGZuOiAodikgPT4gIXYuc29tZSgoeCkgPT4geCkgfSxcbiAgWE9SOiB7IG1pbjogMiwgc2hhcGU6IFwiWE9SXCIsIGludjogZmFsc2UsIGZuOiAodikgPT4gdi5maWx0ZXIoKHgpID0+IHgpLmxlbmd0aCAlIDIgPT09IDEgfSxcbiAgWE5PUjogeyBtaW46IDIsIHNoYXBlOiBcIlhPUlwiLCBpbnY6IHRydWUsIGZuOiAodikgPT4gdi5maWx0ZXIoKHgpID0+IHgpLmxlbmd0aCAlIDIgPT09IDAgfSxcbiAgTk9UOiB7IG1pbjogMSwgbWF4OiAxLCBzaGFwZTogXCJCVUZcIiwgaW52OiB0cnVlLCBmbjogKHYpID0+ICF2WzBdIH0sXG4gIEJVRjogeyBtaW46IDEsIG1heDogMSwgc2hhcGU6IFwiQlVGXCIsIGludjogZmFsc2UsIGZuOiAodikgPT4gISF2WzBdIH1cbn07XG5leHBvcnQgY29uc3QgSU5WRVJTRSA9IHsgQU5EOiBcIk5BTkRcIiwgTkFORDogXCJBTkRcIiwgT1I6IFwiTk9SXCIsIE5PUjogXCJPUlwiLCBYT1I6IFwiWE5PUlwiLCBYTk9SOiBcIlhPUlwiIH07XG5leHBvcnQgY29uc3QgQkFTRSA9IHsgQU5EOiBcIkFORFwiLCBOQU5EOiBcIkFORFwiLCBPUjogXCJPUlwiLCBOT1I6IFwiT1JcIiwgWE9SOiBcIlhPUlwiLCBYTk9SOiBcIlhPUlwiIH07XG5leHBvcnQgY29uc3QgSU5WRVJUSU5HID0geyBOQU5EOiAxLCBOT1I6IDEsIFhOT1I6IDEsIE5PVDogMSB9O1xuXG4iLCAiLy8gcGFja2FnZXMvbG9naWMtZ3JhcGgvc3JjL2NvcmUvY29uc3RhbnRzLmpzXG5leHBvcnQgY29uc3QgSEFSRF9NQVhfSU5QVVRTID0gMzI7XG5leHBvcnQgY29uc3QgSEFSRF9NQVhfR0FURVMgPSAyNTY7XG5leHBvcnQgY29uc3QgQU5BTFlTSVNfTUFYX0lOUFVUUyA9IDEyO1xuZXhwb3J0IGNvbnN0IE1BWF9HQVRFX0ZBTklOID0gNjtcbmV4cG9ydCBjb25zdCBJRF9SRSA9IC9eW0EtWmEtel9dW0EtWmEtejAtOV9dKiQvO1xuZXhwb3J0IGNvbnN0IGNsYW1wID0gKHgsIGxvLCBoaSkgPT4gTWF0aC5taW4oaGksIE1hdGgubWF4KGxvLCB4KSk7XG5leHBvcnQgY29uc3QgREVGQVVMVF9NQVhfSU5QVVRTID0gMTI7XG5leHBvcnQgY29uc3QgREVGQVVMVF9NQVhfR0FURVMgPSA2NDtcbmV4cG9ydCBjb25zdCBSRURVQ0VfTUVUSE9EUyA9IFtcInN0cnVjdHVyYWxcIiwgXCJiZXN0XCIsIFwic29wXCIsIFwicG9zXCIsIFwibmFuZFwiLCBcIm5vclwiXTtcbmV4cG9ydCBjb25zdCBUSU1JTkdfVklFV1MgPSBbXCJncmFwaFwiLCBcImFuaW1hdGlvblwiLCBcImJvdGhcIl07XG5cbiIsICIvLyBwYWNrYWdlcy9sb2dpYy1ncmFwaC9zcmMvY29yZS9wYXJzZXIuanNcbmltcG9ydCB7IFxuICBUSU1JTkdfVklFV1MsIFxuICBSRURVQ0VfTUVUSE9EUywgXG4gIERFRkFVTFRfTUFYX0dBVEVTLCBcbiAgREVGQVVMVF9NQVhfSU5QVVRTLCBcbiAgSURfUkUsIFxuICBNQVhfR0FURV9GQU5JTiwgXG4gIEhBUkRfTUFYX0dBVEVTLCBcbiAgSEFSRF9NQVhfSU5QVVRTIFxufSBmcm9tIFwiLi9jb25zdGFudHMuanNcIjtcbmltcG9ydCB7IEdBVEVTIH0gZnJvbSBcIi4vZ2F0ZXMuanNcIjtcblxudmFyIFBBUlRTID0gW1widGFibGVcIiwgXCJleHByXCIsIFwiZGlhZ3JhbVwiLCBcImttYXBcIiwgXCJ0aW1pbmdcIl07XG52YXIgRElSRUNUSVZFX0xJU1QgPSBcIkBoZWxwLCBAaGlkZSwgQHNob3csIEBzaW1wbGlmeSAoQHJlZHVjZSksIEBidWJibGVzLCBAY29tcGFjdCwgQGRlbGF5LCBAdGltaW5nLWdyYXBoLCBAdGltaW5nLWFuaW1hdGlvbiwgQHRpbWluZy1ib3RoXCI7XG5cbmZ1bmN0aW9uIGFwcGx5RGlyZWN0aXZlKGxpbmUsIG4sIG8pIHtcbiAgY29uc3QgbSA9IGxpbmUubWF0Y2goL15AKFtcXHctXSspXFxzKiguKikkLyk7XG4gIGlmICghbSkgdGhyb3cgbmV3IEVycm9yKGBMaW5lICR7bn06IG1hbGZvcm1lZCBkaXJlY3RpdmVgKTtcbiAgbGV0IG5hbWUgPSBtWzFdLnRvTG93ZXJDYXNlKCk7XG4gIGNvbnN0IGFyZ3MgPSBtWzJdLnRvTG93ZXJDYXNlKCkuc3BsaXQoL1ssXFxzXSsvKS5maWx0ZXIoQm9vbGVhbik7XG4gIGlmIChuYW1lID09PSBcInJlZHVjZVwiKSBuYW1lID0gXCJzaW1wbGlmeVwiO1xuICBpZiAobmFtZS5zdGFydHNXaXRoKFwidGltaW5nLVwiKSkge1xuICAgIGFyZ3MudW5zaGlmdChuYW1lLnNsaWNlKDcpKTtcbiAgICBuYW1lID0gXCJ0aW1pbmdcIjtcbiAgfVxuICBzd2l0Y2ggKG5hbWUpIHtcbiAgICBjYXNlIFwiaGVscFwiOiBvLmhlbHAgPSB0cnVlOyBicmVhaztcbiAgICBjYXNlIFwidGltaW5nXCI6IHtcbiAgICAgIGNvbnN0IGEgPSBhcmdzWzBdIHx8IFwiZ3JhcGhcIjtcbiAgICAgIGlmICghVElNSU5HX1ZJRVdTLmluY2x1ZGVzKGEpKSB0aHJvdyBuZXcgRXJyb3IoYExpbmUgJHtufTogdXNlIEB0aW1pbmctZ3JhcGgsIEB0aW1pbmctYW5pbWF0aW9uIG9yIEB0aW1pbmctYm90aGApO1xuICAgICAgby50aW1pbmcgPSBhO1xuICAgICAgYnJlYWs7XG4gICAgfVxuICAgIGNhc2UgXCJoaWRlXCI6XG4gICAgY2FzZSBcInNob3dcIjpcbiAgICAgIGlmICghYXJncy5sZW5ndGgpIHRocm93IG5ldyBFcnJvcihgTGluZSAke259OiBcIkAke25hbWV9XCIgbmVlZHM6ICR7UEFSVFMuam9pbihcIiwgXCIpfWApO1xuICAgICAgYXJncy5mb3JFYWNoKChhKSA9PiB7XG4gICAgICAgIGlmICghUEFSVFMuaW5jbHVkZXMoYSkpIHRocm93IG5ldyBFcnJvcihgTGluZSAke259OiBjYW5ub3QgJHtuYW1lfSBcIiR7YX1cIiAoJHtQQVJUUy5qb2luKFwiLCBcIil9KWApO1xuICAgICAgICAobmFtZSA9PT0gXCJoaWRlXCIgPyBvLmhpZGUgOiBvLnNob3cpLmFkZChhKTtcbiAgICAgICAgKG5hbWUgPT09IFwiaGlkZVwiID8gby5zaG93IDogby5oaWRlKS5kZWxldGUoYSk7XG4gICAgICB9KTtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgXCJzaW1wbGlmeVwiOiB7XG4gICAgICBjb25zdCBhID0gYXJnc1swXSB8fCBcInN0cnVjdHVyYWxcIjtcbiAgICAgIGlmIChhID09PSBcIm9mZlwiKSBvLnNpbXBsaWZ5ID0gXCJvZmZcIjtcbiAgICAgIGVsc2UgaWYgKFJFRFVDRV9NRVRIT0RTLmluY2x1ZGVzKGEpKSBvLnNpbXBsaWZ5ID0gYTtcbiAgICAgIGVsc2UgdGhyb3cgbmV3IEVycm9yKGBMaW5lICR7bn06IFwiQHNpbXBsaWZ5XCIgdGFrZXMgJHtSRURVQ0VfTUVUSE9EUy5qb2luKFwiLCBcIil9IG9yIG9mZmApO1xuICAgICAgYnJlYWs7XG4gICAgfVxuICAgIGNhc2UgXCJidWJibGVzXCI6IG8uYnViYmxlcyA9IGFyZ3NbMF0gIT09IFwib2ZmXCI7IGJyZWFrO1xuICAgIGNhc2UgXCJjb21wYWN0XCI6IG8uY29tcGFjdCA9IGFyZ3NbMF0gIT09IFwib2ZmXCI7IGJyZWFrO1xuICAgIGNhc2UgXCJkZWxheVwiOiB7XG4gICAgICBjb25zdCBhID0gYXJnc1swXTtcbiAgICAgIGlmIChhID09PSBcIm9mZlwiKSBvLmRlbGF5ID0gMDtcbiAgICAgIGVsc2UgaWYgKGEgPT09IFwicmFuZG9tXCIpIG8uZGVsYXkgPSAtMTtcbiAgICAgIGVsc2Uge1xuICAgICAgICBjb25zdCB4ID0gTnVtYmVyKGEpO1xuICAgICAgICBpZiAoIWEgfHwgIU51bWJlci5pc0Zpbml0ZSh4KSB8fCB4IDwgLTEgfHwgeCA+IDMwKSB0aHJvdyBuZXcgRXJyb3IoYExpbmUgJHtufTogXCJAZGVsYXlcIiB0YWtlcyBzZWNvbmRzICgwLTMwKSwgcmFuZG9tIG9yIG9mZmApO1xuICAgICAgICBvLmRlbGF5ID0geCA8IDAgPyAtMSA6IHg7XG4gICAgICB9XG4gICAgICBicmVhaztcbiAgICB9XG4gICAgZGVmYXVsdDpcbiAgICAgIHRocm93IG5ldyBFcnJvcihgTGluZSAke259OiB1bmtub3duIGRpcmVjdGl2ZSBcIkAke25hbWV9XCIuIEF2YWlsYWJsZTogJHtESVJFQ1RJVkVfTElTVH1gKTtcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gYXNzZW1ibGUoZ2F0ZXMsIGlucHV0cykge1xuICBjb25zdCBkcml2ZXIgPSB7fTtcbiAgZ2F0ZXMuZm9yRWFjaCgoZykgPT4geyBkcml2ZXJbZy5vdXRdID0gZzsgfSk7XG4gIGNvbnN0IHVzZWQgPSBuZXcgU2V0KCk7XG4gIGdhdGVzLmZvckVhY2goKGcpID0+IGcuaW5zLmZvckVhY2goKHgpID0+IHVzZWQuYWRkKHgpKSk7XG4gIGlmICghaW5wdXRzKSB7XG4gICAgaW5wdXRzID0gW107XG4gICAgZ2F0ZXMuZm9yRWFjaCgoZykgPT4gZy5pbnMuZm9yRWFjaCgoeCkgPT4ge1xuICAgICAgaWYgKCFkcml2ZXJbeF0gJiYgIWlucHV0cy5pbmNsdWRlcyh4KSkgaW5wdXRzLnB1c2goeCk7XG4gICAgfSkpO1xuICB9XG4gIGNvbnN0IGtub3duID0gbmV3IFNldChpbnB1dHMpO1xuICBjb25zdCBvcmRlciA9IFtdO1xuICBsZXQgcGVuZGluZyA9IGdhdGVzLnNsaWNlKCk7XG4gIHdoaWxlIChwZW5kaW5nLmxlbmd0aCkge1xuICAgIGNvbnN0IHJlYWR5ID0gcGVuZGluZy5maWx0ZXIoKGcpID0+IGcuaW5zLmV2ZXJ5KCh4KSA9PiBrbm93bi5oYXMoeCkpKTtcbiAgICBpZiAoIXJlYWR5Lmxlbmd0aCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiTG9vcCBkZXRlY3RlZCAoY29tYmluYXRpb25hbCBmZWVkYmFjaykgaW52b2x2aW5nOiBcIiArIHBlbmRpbmcubWFwKChnKSA9PiBnLm91dCkuam9pbihcIiwgXCIpKTtcbiAgICB9XG4gICAgcmVhZHkuZm9yRWFjaCgoZykgPT4ge1xuICAgICAga25vd24uYWRkKGcub3V0KTtcbiAgICAgIG9yZGVyLnB1c2goZyk7XG4gICAgfSk7XG4gICAgcGVuZGluZyA9IHBlbmRpbmcuZmlsdGVyKChnKSA9PiAhcmVhZHkuaW5jbHVkZXMoZykpO1xuICB9XG4gIGNvbnN0IG91dHB1dHMgPSBnYXRlcy5tYXAoKGcpID0+IGcub3V0KS5maWx0ZXIoKHgpID0+ICF1c2VkLmhhcyh4KSk7XG4gIGNvbnN0IG1pZGRsZXMgPSBnYXRlcy5tYXAoKGcpID0+IGcub3V0KS5maWx0ZXIoKHgpID0+IHVzZWQuaGFzKHgpKTtcbiAgcmV0dXJuIHsgZ2F0ZXMsIG9yZGVyLCBpbnB1dHMsIG91dHB1dHMsIG1pZGRsZXMsIGRyaXZlciwgdXNlZCB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcGFyc2Uoc3JjLCBsaW1pdHMpIHtcbiAgbGltaXRzID0gT2JqZWN0LmFzc2lnbih7IG1heElucHV0czogREVGQVVMVF9NQVhfSU5QVVRTLCBtYXhHYXRlczogREVGQVVMVF9NQVhfR0FURVMgfSwgbGltaXRzKTtcbiAgY29uc3QgZ2F0ZXMgPSBbXTtcbiAgY29uc3QgZHJpdmVyID0ge307XG4gIGNvbnN0IG9wdHMgPSB7IGhpZGU6IG5ldyBTZXQoKSwgc2hvdzogbmV3IFNldCgpLCBzaW1wbGlmeTogbnVsbCwgYnViYmxlczogbnVsbCwgZGVsYXk6IG51bGwsIGNvbXBhY3Q6IG51bGwsIHRpbWluZzogbnVsbCwgaGVscDogZmFsc2UgfTtcbiAgXG4gIHNyYy5zcGxpdChcIlxcblwiKS5mb3JFYWNoKChyYXcsIGkpID0+IHtcbiAgICBjb25zdCBsaW5lID0gcmF3LnJlcGxhY2UoLygjfFxcL1xcLykuKiQvLCBcIlwiKS50cmltKCk7XG4gICAgaWYgKCFsaW5lKSByZXR1cm47XG4gICAgY29uc3QgbiA9IGkgKyAxO1xuICAgIGlmIChsaW5lWzBdID09PSBcIkBcIikge1xuICAgICAgYXBwbHlEaXJlY3RpdmUobGluZSwgbiwgb3B0cyk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIFxuICAgIC8vIFJlZ2V4IHVwZGF0ZWQgdG8gYmUgbW9yZSBmb3JnaXZpbmcgb2Ygc3BhY2VzXG4gICAgY29uc3QgbSA9IGxpbmUubWF0Y2goL15cXCgoW14pXSopXFwpXFxzKihbQS1aYS16XSspXFxzKlxcKChbXildKilcXCkkLyk7XG4gICAgaWYgKCFtKSB0aHJvdyBuZXcgRXJyb3IoYExpbmUgJHtufTogZXhwZWN0ZWQgXCIoaW5wdXRzKSBHQVRFIChvdXRwdXQpXCJgKTtcbiAgICBcbiAgICAvLyBSb2J1c3QgcGFyc2luZyBmb3IgaW5wdXRzIGFuZCBvdXRwdXRzXG4gICAgY29uc3QgaW5zID0gbVsxXS5zcGxpdCgvWyxcXHNdKy8pLm1hcCh4ID0+IHgudHJpbSgpKS5maWx0ZXIoQm9vbGVhbik7XG4gICAgY29uc3Qgb3V0cyA9IG1bM10uc3BsaXQoL1ssXFxzXSsvKS5tYXAoeCA9PiB4LnRyaW0oKSkuZmlsdGVyKEJvb2xlYW4pO1xuICAgIFxuICAgIC8vIFJvYnVzdCBwYXJzaW5nIGZvciBnYXRlIHR5cGUgKGhhbmRsZXMgXCJhbmRcIiwgXCJBTkRcIiwgXCIgYU5kIFwiKVxuICAgIGNvbnN0IHR5cGUgPSBtWzJdLnRvVXBwZXJDYXNlKCkudHJpbSgpO1xuICAgIGNvbnN0IHNwZWMgPSBHQVRFU1t0eXBlXTtcbiAgICBcbiAgICBpZiAoIXNwZWMpIHRocm93IG5ldyBFcnJvcihgTGluZSAke259OiB1bmtub3duIGdhdGUgXCIke21bMl19XCIuIEF2YWlsYWJsZTogJHtPYmplY3Qua2V5cyhHQVRFUykuam9pbihcIiwgXCIpfWApO1xuICAgIGlmIChvdXRzLmxlbmd0aCAhPT0gMSkgdGhyb3cgbmV3IEVycm9yKGBMaW5lICR7bn06IGEgZ2F0ZSBuZWVkcyBleGFjdGx5IG9uZSBvdXRwdXQgc2lnbmFsYCk7XG4gICAgaWYgKGlucy5sZW5ndGggPCBzcGVjLm1pbikgdGhyb3cgbmV3IEVycm9yKGBMaW5lICR7bn06ICR7dHlwZX0gbmVlZHMgYXQgbGVhc3QgJHtzcGVjLm1pbn0gaW5wdXQocylgKTtcbiAgICBpZiAoc3BlYy5tYXggJiYgaW5zLmxlbmd0aCA+IHNwZWMubWF4KSB0aHJvdyBuZXcgRXJyb3IoYExpbmUgJHtufTogJHt0eXBlfSB0YWtlcyBleGFjdGx5ICR7c3BlYy5tYXh9IGlucHV0YCk7XG4gICAgaWYgKGlucy5sZW5ndGggPiBNQVhfR0FURV9GQU5JTikgdGhyb3cgbmV3IEVycm9yKGBMaW5lICR7bn06IGF0IG1vc3QgJHtNQVhfR0FURV9GQU5JTn0gaW5wdXRzIHBlciBnYXRlYCk7XG4gICAgXG4gICAgZm9yIChjb25zdCB4IG9mIFsuLi5pbnMsIC4uLm91dHNdKSB7XG4gICAgICBpZiAoIUlEX1JFLnRlc3QoeCkpIHRocm93IG5ldyBFcnJvcihgTGluZSAke259OiBpbnZhbGlkIHNpZ25hbCBuYW1lIFwiJHt4fVwiYCk7XG4gICAgfVxuICAgIFxuICAgIGNvbnN0IG91dCA9IG91dHNbMF07XG4gICAgaWYgKGlucy5pbmNsdWRlcyhvdXQpKSB0aHJvdyBuZXcgRXJyb3IoYExpbmUgJHtufTogXCIke291dH1cIiBmZWVkcyBiYWNrIGludG8gaXRzIG93biBnYXRlYCk7XG4gICAgaWYgKGRyaXZlcltvdXRdKSB0aHJvdyBuZXcgRXJyb3IoYExpbmUgJHtufTogc2lnbmFsIFwiJHtvdXR9XCIgaXMgYWxyZWFkeSBkcml2ZW4gYnkgYW5vdGhlciBnYXRlYCk7XG4gICAgaWYgKGdhdGVzLmxlbmd0aCA+PSBsaW1pdHMubWF4R2F0ZXMpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgTGluZSAke259OiBtb3JlIHRoYW4gJHtsaW1pdHMubWF4R2F0ZXN9IGdhdGVzIChyYWlzZSBcIk1heCBnYXRlc1wiIGluIHRoZSBwbHVnaW4gc2V0dGluZ3MsIHVwIHRvICR7SEFSRF9NQVhfR0FURVN9KWApO1xuICAgIH1cbiAgICBcbiAgICBjb25zdCBnYXRlID0geyB0eXBlLCBpbnMsIG91dCwgbGluZTogbiB9O1xuICAgIGRyaXZlcltvdXRdID0gZ2F0ZTtcbiAgICBnYXRlcy5wdXNoKGdhdGUpO1xuICB9KTtcbiAgXG4gIGlmICghZ2F0ZXMubGVuZ3RoKSB7XG4gICAgaWYgKG9wdHMuaGVscCkgcmV0dXJuIHsgZ2F0ZXM6IFtdLCBvcmRlcjogW10sIGlucHV0czogW10sIG91dHB1dHM6IFtdLCBtaWRkbGVzOiBbXSwgZHJpdmVyOiB7fSwgdXNlZDogbmV3IFNldCgpLCBvcHRzLCBlbXB0eTogdHJ1ZSB9O1xuICAgIHRocm93IG5ldyBFcnJvcihcIkVtcHR5IGNpcmN1aXQuIEV4YW1wbGU6IChhLGIpIEFORCAoeSkgICAob3IgYWRkIEBoZWxwIGZvciBhIHJlZmVyZW5jZSlcIik7XG4gIH1cbiAgXG4gIGNvbnN0IGMgPSBhc3NlbWJsZShnYXRlcyk7XG4gIGlmIChjLmlucHV0cy5sZW5ndGggPiBsaW1pdHMubWF4SW5wdXRzKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBUb28gbWFueSBpbnB1dHMgKCR7Yy5pbnB1dHMubGVuZ3RofSwgbWF4ICR7bGltaXRzLm1heElucHV0c30pLiBSYWlzZSBcIk1heCBpbnB1dHNcIiBpbiB0aGUgcGx1Z2luIHNldHRpbmdzICh1cCB0byAke0hBUkRfTUFYX0lOUFVUU30pLmApO1xuICB9XG4gIGMub3B0cyA9IG9wdHM7XG4gIHJldHVybiBjO1xufSIsICIvLyBwYWNrYWdlcy9sb2dpYy1ncmFwaC9zcmMvc2V0dGluZ3MvdGFiLmpzXG5pbXBvcnQgeyBTZXR0aW5nIGFzIF9TZXR0aW5nLCBQbHVnaW5TZXR0aW5nVGFiIGFzIF9QbHVnaW5TZXR0aW5nVGFiIH0gZnJvbSBcIm9ic2lkaWFuXCI7XG5jb25zdCBpbXBvcnRfb2JzaWRpYW4gPSB7IFNldHRpbmc6IF9TZXR0aW5nLCBQbHVnaW5TZXR0aW5nVGFiOiBfUGx1Z2luU2V0dGluZ1RhYiB9O1xuZXhwb3J0IGNvbnN0IExvZ2ljR3JhcGhTZXR0aW5nVGFiID0gY2xhc3MgZXh0ZW5kcyBpbXBvcnRfb2JzaWRpYW4uUGx1Z2luU2V0dGluZ1RhYiB7XG4gIGNvbnN0cnVjdG9yKGFwcCwgcGx1Z2luKSB7XG4gICAgc3VwZXIoYXBwLCBwbHVnaW4pO1xuICAgIHRoaXMucGx1Z2luID0gcGx1Z2luO1xuICB9XG4gIGRpc3BsYXkoKSB7XG4gICAgY29uc3QgeyBjb250YWluZXJFbCB9ID0gdGhpcztcbiAgICBjb25zdCBQID0gdGhpcy5wbHVnaW4sIFMgPSBQLnNldHRpbmdzO1xuICAgIGNvbnRhaW5lckVsLmVtcHR5KCk7XG4gICAgY29uc3Qgc2F2ZSA9IGFzeW5jICgpID0+IHtcbiAgICAgIGF3YWl0IFAuc2F2ZVNldHRpbmdzKCk7XG4gICAgICBQLnJlZnJlc2hBbGwoKTtcbiAgICB9O1xuICAgIGNvbnN0IGhlYWRpbmcgPSAobmFtZSkgPT4gbmV3IGltcG9ydF9vYnNpZGlhbi5TZXR0aW5nKGNvbnRhaW5lckVsKS5zZXROYW1lKG5hbWUpLnNldEhlYWRpbmcoKTtcbiAgICBjb25zdCBudW0gPSAoc2V0dGluZywga2V5LCBsbywgaGksIGlzSW50KSA9PiBzZXR0aW5nLmFkZFRleHQoKHQpID0+IHQuc2V0VmFsdWUoU3RyaW5nKFNba2V5XSkpLm9uQ2hhbmdlKGFzeW5jICh2KSA9PiB7XG4gICAgICBjb25zdCB4ID0gTnVtYmVyKHYpO1xuICAgICAgaWYgKHYudHJpbSgpID09PSBcIlwiIHx8ICFOdW1iZXIuaXNGaW5pdGUoeCkgfHwgeCA8IGxvIHx8IHggPiBoaSkgcmV0dXJuO1xuICAgICAgU1trZXldID0gaXNJbnQgPyBNYXRoLnJvdW5kKHgpIDogeDtcbiAgICAgIGF3YWl0IHNhdmUoKTtcbiAgICB9KSk7XG4gICAgY29udGFpbmVyRWwuY3JlYXRlRWwoXCJwXCIsIHsgdGV4dDogYExvZ2ljIEdyYXBoIHYke1AubWFuaWZlc3QudmVyc2lvbn0uIENoYW5nZXMgYXBwbHkgaW1tZWRpYXRlbHkgdG8gb3BlbiBub3Rlcy4gQWRkIEBoZWxwIHRvIGEgbG9naWMgYmxvY2sgZm9yIGEgZnVsbCByZWZlcmVuY2UuYCB9KTtcbiAgICBoZWFkaW5nKFwiTGltaXRzXCIpO1xuICAgIG51bShcbiAgICAgIG5ldyBpbXBvcnRfb2JzaWRpYW4uU2V0dGluZyhjb250YWluZXJFbCkuc2V0TmFtZShcIk1heCBpbnB1dHMgYXQgYSB0aW1lXCIpLnNldERlc2MoYENpcmN1aXRzIHdpdGggbW9yZSBpbnB1dHMgc2hvdyBhbiBlcnJvci4gMSB0byAke0hBUkRfTUFYX0lOUFVUU30uIFRydXRoIHRhYmxlcywgS2FybmF1Z2ggbWFwcyBhbmQgc2ltcGxpZmljYXRpb24gYXJlIG9ubHkgYXZhaWxhYmxlIHVwIHRvICR7QU5BTFlTSVNfTUFYX0lOUFVUU30gaW5wdXRzICgyXm4gcm93cykuYCksXG4gICAgICBcIm1heElucHV0c1wiLFxuICAgICAgMSxcbiAgICAgIEhBUkRfTUFYX0lOUFVUUyxcbiAgICAgIHRydWVcbiAgICApO1xuICAgIG51bShuZXcgaW1wb3J0X29ic2lkaWFuLlNldHRpbmcoY29udGFpbmVyRWwpLnNldE5hbWUoXCJNYXggZ2F0ZXMgYXQgYSB0aW1lXCIpLnNldERlc2MoYDEgdG8gJHtIQVJEX01BWF9HQVRFU30uYCksIFwibWF4R2F0ZXNcIiwgMSwgSEFSRF9NQVhfR0FURVMsIHRydWUpO1xuICAgIGhlYWRpbmcoXCJEaXNwbGF5XCIpO1xuICAgIG5ldyBpbXBvcnRfb2JzaWRpYW4uU2V0dGluZyhjb250YWluZXJFbCkuc2V0TmFtZShcIlNob3cgdHJ1dGggdGFibGUgYXV0b21hdGljYWxseVwiKS5zZXREZXNjKCdQZXIgYmxvY2sgeW91IGNhbiBvdmVycmlkZSB3aXRoIFwiQGhpZGUgdGFibGVcIiBvciBcIkBzaG93IHRhYmxlXCIuJykuYWRkVG9nZ2xlKCh0KSA9PiB0LnNldFZhbHVlKFMuc2hvd1RhYmxlKS5vbkNoYW5nZShhc3luYyAodikgPT4ge1xuICAgICAgUy5zaG93VGFibGUgPSB2O1xuICAgICAgYXdhaXQgc2F2ZSgpO1xuICAgIH0pKTtcbiAgICBuZXcgaW1wb3J0X29ic2lkaWFuLlNldHRpbmcoY29udGFpbmVyRWwpLnNldE5hbWUoXCJTaG93IGJvb2xlYW4gZXhwcmVzc2lvbnNcIikuYWRkVG9nZ2xlKCh0KSA9PiB0LnNldFZhbHVlKFMuc2hvd0V4cHIpLm9uQ2hhbmdlKGFzeW5jICh2KSA9PiB7XG4gICAgICBTLnNob3dFeHByID0gdjtcbiAgICAgIGF3YWl0IHNhdmUoKTtcbiAgICB9KSk7XG4gICAgbmV3IGltcG9ydF9vYnNpZGlhbi5TZXR0aW5nKGNvbnRhaW5lckVsKS5zZXROYW1lKFwiU2hvdyBLYXJuYXVnaCBtYXBzXCIpLnNldERlc2MoXCIyIHRvIDYgaW5wdXRzLiBHcm91cHMgY29tZSBmcm9tIHRoZSBRdWluZVxcdTIwMTNNY0NsdXNrZXkgcmVzdWx0IChhbiBleGFjdCBtaW5pbXVtIHdoZW4gdGhlIHNlYXJjaCBpcyBzbWFsbCBlbm91Z2gpLlwiKS5hZGRUb2dnbGUoKHQpID0+IHQuc2V0VmFsdWUoUy5zaG93S21hcCkub25DaGFuZ2UoYXN5bmMgKHYpID0+IHtcbiAgICAgIFMuc2hvd0ttYXAgPSB2O1xuICAgICAgYXdhaXQgc2F2ZSgpO1xuICAgIH0pKTtcbiAgICBuZXcgaW1wb3J0X29ic2lkaWFuLlNldHRpbmcoY29udGFpbmVyRWwpLnNldE5hbWUoYENvbGxhcHNlIFwiZG9uJ3QgY2FyZVwiIHJvd3MgaW4gdGhlIHRydXRoIHRhYmxlYCkuc2V0RGVzYyhcIlJvd3Mgd2hvc2Ugb3V0cHV0cyBkbyBub3QgZGVwZW5kIG9uIHNvbWUgaW5wdXRzIGFyZSBtZXJnZWQgYW5kIHNob3duIHdpdGggWCAodGhlIG1pZGRsZSBzaWduYWxzIGFyZSBoaWRkZW4gaW4gdGhpcyBtb2RlKS5cIikuYWRkVG9nZ2xlKCh0KSA9PiB0LnNldFZhbHVlKFMuY29sbGFwc2VEb250Q2FyZSkub25DaGFuZ2UoYXN5bmMgKHYpID0+IHtcbiAgICAgIFMuY29sbGFwc2VEb250Q2FyZSA9IHY7XG4gICAgICBhd2FpdCBzYXZlKCk7XG4gICAgfSkpO1xuICAgIG5ldyBpbXBvcnRfb2JzaWRpYW4uU2V0dGluZyhjb250YWluZXJFbCkuc2V0TmFtZShcIkJ1YmJsZSBwdXNoaW5nIHZpZXdcIikuc2V0RGVzYyhcIkRyYXdzIGVhY2ggZ2F0ZSB3aXRoIHRoZSBEZSBNb3JnYW4gc3ltYm9sIHRoYXQgbWFrZXMgaXRzIGJ1YmJsZXMgbWF0Y2ggdGhlIG5leHQgZ2F0ZSAoZS5nLiBOQU5ELU5BTkQgc2hvd3MgYXMgQU5ELU9SIHdpdGggbWF0Y2hpbmcgYnViYmxlcykuIE5vIGdhdGUgaXMgYWRkZWQgb3IgcmVtb3ZlZDsgY2xpY2sgYSBnYXRlIHRvIGZsaXAgaXQgYnkgaGFuZC5cIikuYWRkVG9nZ2xlKCh0KSA9PiB0LnNldFZhbHVlKFMuYnViYmxlUHVzaGluZykub25DaGFuZ2UoYXN5bmMgKHYpID0+IHtcbiAgICAgIFMuYnViYmxlUHVzaGluZyA9IHY7XG4gICAgICBhd2FpdCBzYXZlKCk7XG4gICAgfSkpO1xuICAgIGhlYWRpbmcoXCJUaW1pbmdcIik7XG4gICAgbmV3IGltcG9ydF9vYnNpZGlhbi5TZXR0aW5nKGNvbnRhaW5lckVsKS5zZXROYW1lKFwiU2ltdWxhdGUgZ2F0ZSBkZWxheXNcIikuc2V0RGVzYyhcIlNpZ25hbHMgcHJvcGFnYXRlIHRocm91Z2ggdGhlIGdhdGVzIG9uZSBzdGVwIGF0IGEgdGltZS5cIikuYWRkVG9nZ2xlKCh0KSA9PiB0LnNldFZhbHVlKFMuZGVsYXlFbmFibGVkKS5vbkNoYW5nZShhc3luYyAodikgPT4ge1xuICAgICAgUy5kZWxheUVuYWJsZWQgPSB2O1xuICAgICAgYXdhaXQgc2F2ZSgpO1xuICAgIH0pKTtcbiAgICBudW0oXG4gICAgICBuZXcgaW1wb3J0X29ic2lkaWFuLlNldHRpbmcoY29udGFpbmVyRWwpLnNldE5hbWUoXCJEZWxheSBwZXIgZ2F0ZSAoc2Vjb25kcylcIikuc2V0RGVzYyhcIjAgdG8gMzAuIFVzZSAtMSBmb3IgYSByYW5kb20gZGVsYXkgYmV0d2VlbiAwIGFuZCA1IHNlY29uZHMgZm9yIGV2ZXJ5IGdhdGUgY2hhbmdlLlwiKSxcbiAgICAgIFwiZGVsYXlTZWNvbmRzXCIsXG4gICAgICAtMSxcbiAgICAgIDMwLFxuICAgICAgZmFsc2VcbiAgICApO1xuICAgIG5ldyBpbXBvcnRfb2JzaWRpYW4uU2V0dGluZyhjb250YWluZXJFbCkuc2V0TmFtZShcIlRpbWluZyB2aWV3XCIpLnNldERlc2MoXCJHcmFwaCA9IHdhdmVmb3Jtcy4gQW5pbWF0aW9uID0gYml0cyB0cmF2ZWxsaW5nIGFsb25nIHRoZSB3aXJlcywgZ2F0ZXMgbGlnaHQgdXAgZ3JlZW4gKG91dHB1dCAxKSBvciByZWQvb3JhbmdlIChvdXRwdXQgMCkuIFBlciBibG9jazogQHRpbWluZy1ncmFwaCwgQHRpbWluZy1hbmltYXRpb24sIEB0aW1pbmctYm90aC5cIikuYWRkRHJvcGRvd24oKGQpID0+IHtcbiAgICAgIGQuYWRkT3B0aW9uKFwiZ3JhcGhcIiwgXCJHcmFwaFwiKTtcbiAgICAgIGQuYWRkT3B0aW9uKFwiYW5pbWF0aW9uXCIsIFwiQW5pbWF0aW9uXCIpO1xuICAgICAgZC5hZGRPcHRpb24oXCJib3RoXCIsIFwiQm90aFwiKTtcbiAgICAgIGQuc2V0VmFsdWUoUy50aW1pbmdWaWV3KS5vbkNoYW5nZShhc3luYyAodikgPT4ge1xuICAgICAgICBTLnRpbWluZ1ZpZXcgPSB2O1xuICAgICAgICBhd2FpdCBzYXZlKCk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgICBoZWFkaW5nKFwiR3JhcGhpYyB2YWx1ZXNcIik7XG4gICAgbmV3IGltcG9ydF9vYnNpZGlhbi5TZXR0aW5nKGNvbnRhaW5lckVsKS5zZXROYW1lKFwiSG9yaXpvbnRhbCBzcGFjaW5nXCIpLnNldERlc2MoXCJEaXN0YW5jZSBiZXR3ZWVuIGdhdGUgY29sdW1ucy4gQSB3aG9sZSBudW1iZXIgb2YgcGl4ZWxzIChlLmcuIDkwKSwgb3IgYSBwZXJjZW50YWdlIChlLmcuIDEwMCUpIHRvIHNwcmVhZCB0aGUgY2lyY3VpdCBhY3Jvc3MgdGhhdCBzaGFyZSBvZiB0aGUgcGFnZSB3aWR0aC5cIikuYWRkVGV4dCgodCkgPT4gdC5zZXRWYWx1ZShTdHJpbmcoUy5oU3BhY2luZykpLm9uQ2hhbmdlKGFzeW5jICh2KSA9PiB7XG4gICAgICBpZiAocGFyc2VTcGFjaW5nKHYpKSB7XG4gICAgICAgIFMuaFNwYWNpbmcgPSB2LnRyaW0oKTtcbiAgICAgICAgYXdhaXQgc2F2ZSgpO1xuICAgICAgfVxuICAgIH0pKTtcbiAgICBudW0obmV3IGltcG9ydF9vYnNpZGlhbi5TZXR0aW5nKGNvbnRhaW5lckVsKS5zZXROYW1lKFwiVmVydGljYWwgc3BhY2luZyAocHgpXCIpLnNldERlc2MoXCJEaXN0YW5jZSBiZXR3ZWVuIGdhdGVzIGluIHRoZSBzYW1lIGNvbHVtbi4gMCB0byAyMDAuXCIpLCBcInZTcGFjaW5nXCIsIDAsIDIwMCwgdHJ1ZSk7XG4gICAgaGVhZGluZyhcIkV4cGVyaW1lbnRhbDogY2lyY3VpdCByZWR1Y3Rpb25cIik7XG4gICAgbmV3IGltcG9ydF9vYnNpZGlhbi5TZXR0aW5nKGNvbnRhaW5lckVsKS5zZXROYW1lKFwiQWx3YXlzIGRyYXcgYSByZWR1Y2VkIGNpcmN1aXRcIikuc2V0RGVzYygnT2ZmIGJ5IGRlZmF1bHQuIEV2ZXJ5IHJlZHVjZWQgY2lyY3VpdCBpcyBjaGVja2VkIGFnYWluc3QgdGhlIG9yaWdpbmFsIGJlZm9yZSBpdCBpcyBzaG93bi4gUGVyIGJsb2NrOiBcIkBzaW1wbGlmeSBzdHJ1Y3R1cmFsXCIgKG9yIEByZWR1Y2UpLicpLmFkZFRvZ2dsZSgodCkgPT4gdC5zZXRWYWx1ZShTLmV4cFNpbXBsaWZ5KS5vbkNoYW5nZShhc3luYyAodikgPT4ge1xuICAgICAgUy5leHBTaW1wbGlmeSA9IHY7XG4gICAgICBhd2FpdCBzYXZlKCk7XG4gICAgfSkpO1xuICAgIG5ldyBpbXBvcnRfb2JzaWRpYW4uU2V0dGluZyhjb250YWluZXJFbCkuc2V0TmFtZShcIlJlZHVjdGlvbiBtZXRob2RcIikuc2V0RGVzYyhcIlN0cnVjdHVyYWwgcmV3cml0ZXMgeW91ciBhY3R1YWwgY2lyY3VpdCBhbmQgbmV2ZXIgYWRkcyBnYXRlcy4gVGhlIHR3by1sZXZlbCBtZXRob2RzIHJlYnVpbGQgdGhlIGZ1bmN0aW9uIGZyb20gdGhlIFF1aW5lXFx1MjAxM01jQ2x1c2tleSBjb3ZlciBhbmQgY2FuIGJlIGxhcmdlciB0aGFuIHRoZSBvcmlnaW5hbC4gQmVzdCBwaWNrcyB0aGUgc21hbGxlc3QuXCIpLmFkZERyb3Bkb3duKChkKSA9PiB7XG4gICAgICBPYmplY3Qua2V5cyhNRVRIT0RfTEFCRUwpLmZvckVhY2goKGspID0+IGQuYWRkT3B0aW9uKGssIE1FVEhPRF9MQUJFTFtrXSkpO1xuICAgICAgZC5zZXRWYWx1ZShTLnNpbXBsaWZ5TWV0aG9kKS5vbkNoYW5nZShhc3luYyAodikgPT4ge1xuICAgICAgICBTLnNpbXBsaWZ5TWV0aG9kID0gdjtcbiAgICAgICAgYXdhaXQgc2F2ZSgpO1xuICAgICAgfSk7XG4gICAgfSk7XG4gICAgdGhpcy5kaXNwbGF5SW1wb3J0KGNvbnRhaW5lckVsLCBzYXZlKTtcbiAgfVxuICBkaXNwbGF5SW1wb3J0KGNvbnRhaW5lckVsLCBzYXZlKSB7XG4gICAgY29uc3QgUCA9IHRoaXMucGx1Z2luLCBTID0gUC5zZXR0aW5ncztcbiAgICBuZXcgaW1wb3J0X29ic2lkaWFuLlNldHRpbmcoY29udGFpbmVyRWwpLnNldE5hbWUoXCJJbXBvcnQgZnJvbSBpbWFnZVwiKS5zZXRIZWFkaW5nKCk7XG4gICAgY29uc3QgaW5zdGFsbGVkID0gISEodGhpcy5hcHAucGx1Z2lucyAmJiB0aGlzLmFwcC5wbHVnaW5zLnBsdWdpbnMgJiYgdGhpcy5hcHAucGx1Z2lucy5wbHVnaW5zW0lNUE9SVF9FWFRFTlNJT05fSURdKTtcbiAgICBjb250YWluZXJFbC5jcmVhdGVFbChcInBcIiwge1xuICAgICAgY2xzOiBcImxnLW5vdGVcIixcbiAgICAgIHRleHQ6IGluc3RhbGxlZFxuICAgICAgICA/ICdUaGUgXCJMb2dpYyBHcmFwaCAtIEltYWdlIEltcG9ydFwiIGV4dGVuc2lvbiBpcyBpbnN0YWxsZWQuIFVzZSB0aGUgY29tbWFuZCBcIkltcG9ydCBjaXJjdWl0IGZyb20gaW1hZ2VcIiAoQ3RybC9DbWQgKyBQKSBcdTIwMTQgZXZlcnl0aGluZyBzdGF5cyBvbiB5b3VyIGRldmljZS4nXG4gICAgICAgIDogJ0ltYWdlIGltcG9ydCBpcyBwcm92aWRlZCBieSB0aGUgc2VwYXJhdGUgXCJMb2dpYyBHcmFwaCAtIEltYWdlIEltcG9ydFwiIGV4dGVuc2lvbi4gQ29weSBpdHMgZm9sZGVyIGludG8gLm9ic2lkaWFuL3BsdWdpbnMvIGFuZCBlbmFibGUgaXQsIHRoZW4gdXNlIHRoZSBjb21tYW5kIFwiSW1wb3J0IGNpcmN1aXQgZnJvbSBpbWFnZVwiLidcbiAgICB9KTtcbiAgfVxufTtcblxuIiwgIi8vIHBhY2thZ2VzL2xvZ2ljLWdyYXBoL3NyYy9zZXR0aW5ncy9zZXR0aW5ncy5qc1xuaW1wb3J0IHsgVElNSU5HX1ZJRVdTIH0gZnJvbSBcIi4uL2NvcmUvY29uc3RhbnRzLmpzXCI7XG5pbXBvcnQgeyBSRURVQ0VfTUVUSE9EUyB9IGZyb20gXCIuLi9jb3JlL2NvbnN0YW50cy5qc1wiO1xuaW1wb3J0IHsgREVGQVVMVF9NQVhfR0FURVMgfSBmcm9tIFwiLi4vY29yZS9jb25zdGFudHMuanNcIjtcbmltcG9ydCB7IERFRkFVTFRfTUFYX0lOUFVUUyB9IGZyb20gXCIuLi9jb3JlL2NvbnN0YW50cy5qc1wiO1xuaW1wb3J0IHsgY2xhbXAgfSBmcm9tIFwiLi4vY29yZS9jb25zdGFudHMuanNcIjtcbmltcG9ydCB7IEhBUkRfTUFYX0dBVEVTIH0gZnJvbSBcIi4uL2NvcmUvY29uc3RhbnRzLmpzXCI7XG5pbXBvcnQgeyBIQVJEX01BWF9JTlBVVFMgfSBmcm9tIFwiLi4vY29yZS9jb25zdGFudHMuanNcIjtcbmV4cG9ydCBjb25zdCBERUZBVUxUUyA9IHtcbiAgbWF4SW5wdXRzOiBERUZBVUxUX01BWF9JTlBVVFMsXG4gIG1heEdhdGVzOiBERUZBVUxUX01BWF9HQVRFUyxcbiAgc2hvd1RhYmxlOiB0cnVlLFxuICBzaG93RXhwcjogdHJ1ZSxcbiAgc2hvd0ttYXA6IGZhbHNlLFxuICBjb2xsYXBzZURvbnRDYXJlOiBmYWxzZSxcbiAgZGVsYXlFbmFibGVkOiBmYWxzZSxcbiAgZGVsYXlTZWNvbmRzOiAxLFxuICB0aW1pbmdWaWV3OiBcImdyYXBoXCIsXG4gIGJ1YmJsZVB1c2hpbmc6IGZhbHNlLFxuICBleHBTaW1wbGlmeTogZmFsc2UsXG4gIHNpbXBsaWZ5TWV0aG9kOiBcInN0cnVjdHVyYWxcIixcbiAgaFNwYWNpbmc6IFwiOTBcIixcbiAgdlNwYWNpbmc6IDE2LFxuICBpbXBvcnRQcm92aWRlcjogXCJsb2NhbFwiLFxuICBrZXlzOiB7IGNsYXVkZTogXCJcIiwgZ2VtaW5pOiBcIlwiLCBncm9rOiBcIlwiLCBkZWVwc2VlazogXCJcIiwgb3BlbnJvdXRlcjogXCJcIiB9LFxuICBtb2RlbHM6IHsgY2xhdWRlOiBcImNsYXVkZS1zb25uZXQtNC01XCIsIGdlbWluaTogXCJcIiwgZ3JvazogXCJcIiwgZGVlcHNlZWs6IFwiXCIsIG9wZW5yb3V0ZXI6IFwiXCIgfVxufTtcbmV4cG9ydCBmdW5jdGlvbiBzYW5pdGl6ZVNldHRpbmdzKHJhdykge1xuICBjb25zdCBzMiA9IE9iamVjdC5hc3NpZ24oe30sIERFRkFVTFRTLCByYXcgfHwge30pO1xuICBzMi5tYXhJbnB1dHMgPSBjbGFtcChNYXRoLnJvdW5kKE51bWJlcihzMi5tYXhJbnB1dHMpKSB8fCBERUZBVUxUUy5tYXhJbnB1dHMsIDEsIEhBUkRfTUFYX0lOUFVUUyk7XG4gIHMyLm1heEdhdGVzID0gY2xhbXAoTWF0aC5yb3VuZChOdW1iZXIoczIubWF4R2F0ZXMpKSB8fCBERUZBVUxUUy5tYXhHYXRlcywgMSwgSEFSRF9NQVhfR0FURVMpO1xuICBjb25zdCBkID0gTnVtYmVyKHMyLmRlbGF5U2Vjb25kcyk7XG4gIHMyLmRlbGF5U2Vjb25kcyA9IE51bWJlci5pc0Zpbml0ZShkKSA/IGQgPCAwID8gLTEgOiBjbGFtcChkLCAwLCAzMCkgOiBERUZBVUxUUy5kZWxheVNlY29uZHM7XG4gIGNvbnN0IHYgPSBOdW1iZXIoczIudlNwYWNpbmcpO1xuICBzMi52U3BhY2luZyA9IE51bWJlci5pc0Zpbml0ZSh2KSA/IGNsYW1wKE1hdGgucm91bmQodiksIDAsIDIwMCkgOiBERUZBVUxUUy52U3BhY2luZztcbiAgaWYgKCFwYXJzZVNwYWNpbmcoczIuaFNwYWNpbmcpKSBzMi5oU3BhY2luZyA9IERFRkFVTFRTLmhTcGFjaW5nO1xuICBpZiAoIVJFRFVDRV9NRVRIT0RTLmluY2x1ZGVzKHMyLnNpbXBsaWZ5TWV0aG9kKSkgczIuc2ltcGxpZnlNZXRob2QgPSBcInN0cnVjdHVyYWxcIjtcbiAgaWYgKCFUSU1JTkdfVklFV1MuaW5jbHVkZXMoczIudGltaW5nVmlldykpIHMyLnRpbWluZ1ZpZXcgPSBcImdyYXBoXCI7XG4gIHMyLmtleXMgPSBPYmplY3QuYXNzaWduKHt9LCBERUZBVUxUUy5rZXlzLCByYXcgJiYgcmF3LmtleXMgfHwge30pO1xuICBzMi5tb2RlbHMgPSBPYmplY3QuYXNzaWduKHt9LCBERUZBVUxUUy5tb2RlbHMsIHJhdyAmJiByYXcubW9kZWxzIHx8IHt9KTtcbiAgaWYgKHJhdyAmJiByYXcuYXBpS2V5ICYmICFzMi5rZXlzLmNsYXVkZSkgczIua2V5cy5jbGF1ZGUgPSByYXcuYXBpS2V5O1xuICBpZiAocmF3ICYmIHJhdy5tb2RlbCAmJiAhKHJhdy5tb2RlbHMgJiYgcmF3Lm1vZGVscy5jbGF1ZGUpKSBzMi5tb2RlbHMuY2xhdWRlID0gcmF3Lm1vZGVsO1xuICBkZWxldGUgczIuYXBpS2V5O1xuICBkZWxldGUgczIubW9kZWw7XG4gIGlmICghW1wibG9jYWxcIiwgXCJjbGF1ZGVcIiwgXCJnZW1pbmlcIiwgXCJncm9rXCIsIFwiZGVlcHNlZWtcIiwgXCJvcGVucm91dGVyXCJdLmluY2x1ZGVzKHMyLmltcG9ydFByb3ZpZGVyKSkgczIuaW1wb3J0UHJvdmlkZXIgPSBcImxvY2FsXCI7XG4gIHJldHVybiBzMjtcbn1cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZVNwYWNpbmcoc3RyKSB7XG4gIGNvbnN0IG0gPSBTdHJpbmcoc3RyKS50cmltKCkubWF0Y2goL14oXFxkKyg/OlxcLlxcZCspPylcXHMqKCV8cHgpPyQvaSk7XG4gIGlmICghbSkgcmV0dXJuIG51bGw7XG4gIGNvbnN0IHYgPSBwYXJzZUZsb2F0KG1bMV0pO1xuICByZXR1cm4gbVsyXSA9PT0gXCIlXCIgPyB7IHBjdDogY2xhbXAodiwgMTAsIDQwMCkgfSA6IHsgcHg6IGNsYW1wKE1hdGgucm91bmQodiksIDQwLCAxZTMpIH07XG59XG5cbiIsICIvLyBwYWNrYWdlcy9sb2dpYy1ncmFwaC9zcmMvc2V0dGluZ3MvcHJvdmlkZXJzLmpzXG5leHBvcnQgY29uc3QgUFJPVklERVJTID0ge1xuICBsb2NhbDogeyBuYW1lOiBcIkxvY2FsIHJlY29nbml6ZXIgKG9mZmxpbmUsIEltYWdlIEltcG9ydCBleHRlbnNpb24pXCIgfSxcbiAgY2xhdWRlOiB7IG5hbWU6IFwiQ2xhdWRlIChBbnRocm9waWMpXCIsIGtleUhpbnQ6IFwic2stYW50LVxcdTIwMjZcIiwgbW9kZWxIaW50OiBcIm1vZGVsIG5hbWVcIiB9LFxuICBnZW1pbmk6IHsgbmFtZTogXCJHZW1pbmkgKEdvb2dsZSlcIiwga2V5SGludDogXCJBSXphXFx1MjAyNlwiLCBtb2RlbEhpbnQ6IFwibW9kZWwgbmFtZVwiIH0sXG4gIGdyb2s6IHsgbmFtZTogXCJHcm9rICh4QUkpXCIsIGtleUhpbnQ6IFwieGFpLVxcdTIwMjZcIiwgbW9kZWxIaW50OiBcIm1vZGVsIG5hbWVcIiB9LFxuICBkZWVwc2VlazogeyBuYW1lOiBcIkRlZXBTZWVrXCIsIGtleUhpbnQ6IFwic2stXFx1MjAyNlwiLCBtb2RlbEhpbnQ6IFwibW9kZWwgbmFtZVwiIH0sXG4gIG9wZW5yb3V0ZXI6IHsgbmFtZTogXCJPcGVuUm91dGVyXCIsIGtleUhpbnQ6IFwic2stb3ItXFx1MjAyNlwiLCBtb2RlbEhpbnQ6IFwicHJvdmlkZXIvbW9kZWxcIiB9XG59O1xuZXhwb3J0IGNvbnN0IElNUE9SVF9FWFRFTlNJT05fSUQgPSBcImxvZ2ljLWdyYXBoLWltcG9ydFwiO1xuXG4iLCAiLy8gcGFja2FnZXMvbG9naWMtZ3JhcGgvc3JjL3RlbXBsYXRlcy5qc1xuaW1wb3J0ICogYXMgaW1wb3J0X29ic2lkaWFuMiBmcm9tIFwib2JzaWRpYW5cIjtcbmV4cG9ydCBjb25zdCBURU1QTEFURVMgPSBbXG4gIHsgbmFtZTogXCJCbGFuayAodHdvLWlucHV0IEFORClcIiwgY29kZTogXCIoYSxiKSBBTkQgKHkpXCIgfSxcbiAgeyBuYW1lOiBcIkhhbGYgYWRkZXJcIiwgY29kZTogXCIoYSxiKSBYT1IgKHN1bSlcXG4oYSxiKSBBTkQgKGNhcnJ5KVwiIH0sXG4gIHsgbmFtZTogXCJGdWxsIGFkZGVyXCIsIGNvZGU6IFwiKGEsYikgWE9SICh0KVxcbih0LGNpbikgWE9SIChzdW0pXFxuKGEsYikgQU5EICh4KVxcbih0LGNpbikgQU5EICh6KVxcbih4LHopIE9SIChjb3V0KVwiIH0sXG4gIHsgbmFtZTogXCIyLXRvLTEgbXVsdGlwbGV4ZXJcIiwgY29kZTogXCIocykgTk9UIChucylcXG4oYSxucykgQU5EICh4KVxcbihiLHMpIEFORCAoeilcXG4oeCx6KSBPUiAoeSlcIiB9LFxuICB7IG5hbWU6IFwiMi10by00IGRlY29kZXJcIiwgY29kZTogXCIoYSkgTk9UIChuYSlcXG4oYikgTk9UIChuYilcXG4obmEsbmIpIEFORCAoeTApXFxuKG5hLGIpIEFORCAoeTEpXFxuKGEsbmIpIEFORCAoeTIpXFxuKGEsYikgQU5EICh5MylcIiB9LFxuICB7IG5hbWU6IFwiMy1pbnB1dCBtYWpvcml0eVwiLCBjb2RlOiBcIihhLGIpIEFORCAoeClcXG4oYixjKSBBTkQgKHkpXFxuKGEsYykgQU5EICh6KVxcbih4LHkseikgT1IgKG1hailcIiB9LFxuICB7IG5hbWU6IFwiNC1iaXQgcGFyaXR5IChYT1IgdHJlZSlcIiwgY29kZTogXCIoYSxiKSBYT1IgKHAxKVxcbihjLGQpIFhPUiAocDIpXFxuKHAxLHAyKSBYT1IgKHBhcml0eSlcIiB9LFxuICB7IG5hbWU6IFwiWE9SIGZyb20gTkFORCBnYXRlc1wiLCBjb2RlOiBcIihhLGIpIE5BTkQgKG4xKVxcbihhLG4xKSBOQU5EIChuMilcXG4oYixuMSkgTkFORCAobjMpXFxuKG4yLG4zKSBOQU5EICh5KVwiIH1cbl07XG5leHBvcnQgY29uc3QgZmVuY2UgPSAoY29kZSkgPT4gXCJgYGBsb2dpY1xcblwiICsgY29kZSArIFwiXFxuYGBgXFxuXCI7XG5leHBvcnQgY29uc3QgVGVtcGxhdGVNb2RhbCA9IGNsYXNzIGV4dGVuZHMgaW1wb3J0X29ic2lkaWFuMi5GdXp6eVN1Z2dlc3RNb2RhbCB7XG4gIGNvbnN0cnVjdG9yKGFwcCwgb25QaWNrKSB7XG4gICAgc3VwZXIoYXBwKTtcbiAgICB0aGlzLm9uUGljayA9IG9uUGljaztcbiAgICB0aGlzLnNldFBsYWNlaG9sZGVyKFwiQ2hvb3NlIGEgY2lyY3VpdCB0ZW1wbGF0ZVxcdTIwMjZcIik7XG4gIH1cbiAgZ2V0SXRlbXMoKSB7XG4gICAgcmV0dXJuIFRFTVBMQVRFUztcbiAgfVxuICBnZXRJdGVtVGV4dCh0KSB7XG4gICAgcmV0dXJuIHQubmFtZTtcbiAgfVxuICBvbkNob29zZUl0ZW0odCkge1xuICAgIHRoaXMub25QaWNrKHQpO1xuICB9XG59O1xuXG4iLCAiLy8gcGFja2FnZXMvbG9naWMtZ3JhcGgvc3JjL3VpL2Jsb2NrLmpzXG5pbXBvcnQgeyBmaW5pc2hSZW5kZXJNYXRoIH0gZnJvbSBcIm9ic2lkaWFuXCI7XG5pbXBvcnQgeyBBTkFMWVNJU19NQVhfSU5QVVRTIH0gZnJvbSBcIi4uL2NvcmUvY29uc3RhbnRzLmpzXCI7XG5pbXBvcnQgeyBwYXJzZSB9IGZyb20gXCIuLi9jb3JlL3BhcnNlci5qc1wiO1xuaW1wb3J0IHsgdHJ1dGhUYWJsZSB9IGZyb20gXCIuLi9jb3JlL3NpbS5qc1wiO1xuaW1wb3J0IHsgYnVpbGRFeHByZXNzaW9ucyB9IGZyb20gXCIuLi9jb3JlL21pbmltaXplLmpzXCI7XG5pbXBvcnQgeyBubSB9IGZyb20gXCIuLi9jb3JlL2xhdGV4LmpzXCI7XG5pbXBvcnQgeyBwYXJzZVNwYWNpbmcgfSBmcm9tIFwiLi4vc2V0dGluZ3Mvc2V0dGluZ3MuanNcIjtcbmltcG9ydCB7IHJlZHVjZUNpcmN1aXQgfSBmcm9tIFwiLi4vY29yZS9yZWR1Y2UuanNcIjtcbmltcG9ydCB7IE1FVEhPRF9MQUJFTCB9IGZyb20gXCIuLi9jb3JlL3N5bnRoZXNpemUuanNcIjtcbmltcG9ydCB7IGgsIG1hdGggfSBmcm9tIFwiLi9kb20uanNcIjtcbmltcG9ydCB7IHJlbmRlckhlbHAgfSBmcm9tIFwiLi9oZWxwLmpzXCI7XG5pbXBvcnQgeyBjcmVhdGVEaWFncmFtIH0gZnJvbSBcIi4vZGlhZ3JhbS5qc1wiO1xuaW1wb3J0IHsgY3JlYXRlVGltaW5nIH0gZnJvbSBcIi4vdGltaW5nLmpzXCI7XG5pbXBvcnQgeyByZW5kZXJUYWJsZSwgdGFibGVUb01hcmtkb3duIH0gZnJvbSBcIi4vdGFibGUuanNcIjtcbmltcG9ydCB7IHJlbmRlckttYXBzIH0gZnJvbSBcIi4va21hcC5qc1wiO1xuaW1wb3J0IHsgY29weSwgdG9MYXRleFNvdXJjZSwgdG9NZXJtYWlkIH0gZnJvbSBcIi4vY29weS5qc1wiO1xuXG5leHBvcnQgZnVuY3Rpb24gcmVuZGVyQmxvY2soc3JjLCBlbCwgcGx1Z2luKSB7XG4gIGNvbnN0IFMgPSBwbHVnaW4uc2V0dGluZ3MsIGFwcCA9IHBsdWdpbi5hcHA7XG4gIGNvbnN0IHdyYXAgPSBoKFwiZGl2XCIsIFwibGctd3JhcFwiLCBlbCk7XG4gIGxldCBjO1xuICB0cnkge1xuICAgIGMgPSBwYXJzZShzcmMsIHsgbWF4SW5wdXRzOiBTLm1heElucHV0cywgbWF4R2F0ZXM6IFMubWF4R2F0ZXMgfSk7XG4gIH0gY2F0Y2ggKGUpIHtcbiAgICBoKFwiZGl2XCIsIFwibGctZXJyb3JcIiwgd3JhcCwgZS5tZXNzYWdlKTtcbiAgICByZXR1cm4geyBkaXNwb3NlKCkge30gfTtcbiAgfVxuICBcbiAgY29uc3QgTyA9IGMub3B0cztcbiAgaWYgKE8uaGVscCkgcmVuZGVySGVscCh3cmFwLCBwbHVnaW4pO1xuICBpZiAoYy5lbXB0eSkgcmV0dXJuIHsgZGlzcG9zZSgpIHt9IH07XG4gIFxuICBjb25zdCBwYXJ0ID0gKG5hbWUsIGRlZikgPT4gTy5oaWRlLmhhcyhuYW1lKSA/IGZhbHNlIDogTy5zaG93LmhhcyhuYW1lKSA/IHRydWUgOiBkZWY7XG4gIGNvbnN0IGFuYWx5emFibGUgPSBjLmlucHV0cy5sZW5ndGggPD0gQU5BTFlTSVNfTUFYX0lOUFVUUztcbiAgY29uc3QgYWxsID0gYW5hbHl6YWJsZSA/IHRydXRoVGFibGUoYykgOiBudWxsO1xuICBjb25zdCBleHBycyA9IGJ1aWxkRXhwcmVzc2lvbnMoYywgYWxsKTtcbiAgY29uc3QgYnViYmxlcyA9IE8uYnViYmxlcyAhPT0gbnVsbCA/IE8uYnViYmxlcyA6IFMuYnViYmxlUHVzaGluZztcbiAgY29uc3QgbWV0aG9kID0gTy5zaW1wbGlmeSAhPT0gbnVsbCA/IE8uc2ltcGxpZnkgPT09IFwib2ZmXCIgPyBudWxsIDogTy5zaW1wbGlmeSA6IFMuZXhwU2ltcGxpZnkgPyBTLnNpbXBsaWZ5TWV0aG9kIDogbnVsbDtcbiAgY29uc3QgY29tcGFjdCA9IE8uY29tcGFjdCAhPT0gbnVsbCA/IE8uY29tcGFjdCA6IFMuY29sbGFwc2VEb250Q2FyZTtcbiAgY29uc3QgdmlldyA9IE8udGltaW5nIHx8IFMudGltaW5nVmlldztcbiAgbGV0IGRlbGF5U2VjID0gTy5kZWxheSAhPT0gbnVsbCA/IE8uZGVsYXkgOiBTLmRlbGF5RW5hYmxlZCA/IFMuZGVsYXlTZWNvbmRzIDogMDtcbiAgaWYgKE8udGltaW5nICYmIGRlbGF5U2VjID09PSAwKSBkZWxheVNlYyA9IDE7XG4gIGNvbnN0IGdldERlbGF5ID0gKCkgPT4gZGVsYXlTZWMgPCAwID8gTWF0aC5yYW5kb20oKSAqIDUgOiBkZWxheVNlYztcbiAgY29uc3Qgc2hvd0dyYXBoID0gZGVsYXlTZWMgIT09IDAgJiYgKHZpZXcgPT09IFwiZ3JhcGhcIiB8fCB2aWV3ID09PSBcImJvdGhcIikgJiYgcGFydChcInRpbWluZ1wiLCB0cnVlKTtcbiAgY29uc3QgYW5pbSA9IGRlbGF5U2VjICE9PSAwICYmICh2aWV3ID09PSBcImFuaW1hdGlvblwiIHx8IHZpZXcgPT09IFwiYm90aFwiKTtcbiAgY29uc3QgaHNwYWNpbmcgPSBwYXJzZVNwYWNpbmcoUy5oU3BhY2luZykgfHwgeyBweDogOTAgfTtcbiAgXG4gIGNvbnN0IGlucHV0U3RhdGUgPSB7fTtcbiAgYy5pbnB1dHMuZm9yRWFjaCgobikgPT4geyBpbnB1dFN0YXRlW25dID0gMDsgfSk7XG4gIFxuICBjb25zdCBkaWFncmFtcyA9IFtdO1xuICBsZXQgbWFpbkRpYWdyYW0gPSBudWxsLCB0aW1pbmcgPSBudWxsLCB0YWJsZSA9IG51bGwsIGttYXBzID0gbnVsbDtcbiAgXG4gIGZ1bmN0aW9uIGhpZ2hsaWdodCgpIHtcbiAgICBjb25zdCBpZHggPSBjLmlucHV0cy5yZWR1Y2UoKGEsIG4pID0+IGEgKiAyICsgKGlucHV0U3RhdGVbbl0gPyAxIDogMCksIDApO1xuICAgIGlmICh0YWJsZSkgdGFibGUubWFya0FjdGl2ZShpZHgpO1xuICAgIGlmIChrbWFwcykga21hcHMubWFya0FjdGl2ZShpZHgpO1xuICB9XG4gIFxuICBmdW5jdGlvbiBzZXRJbnB1dHMocGF0Y2gpIHtcbiAgICBpZiAodGltaW5nICYmIG1haW5EaWFncmFtICYmIG1haW5EaWFncmFtLnNpbS5wZW5kaW5nKCkgPT09IDApIHRpbWluZy5iZWdpbihtYWluRGlhZ3JhbS5zaW0udmFscyk7XG4gICAgT2JqZWN0LmFzc2lnbihpbnB1dFN0YXRlLCBwYXRjaCk7XG4gICAgZGlhZ3JhbXMuZm9yRWFjaCgoZCkgPT4gZC5zaW0uc2V0SW5wdXRzKHBhdGNoKSk7XG4gICAgaGlnaGxpZ2h0KCk7XG4gIH1cbiAgXG4gIGNvbnN0IHRvZ2dsZSA9IChuKSA9PiBzZXRJbnB1dHMoeyBbbl06IGlucHV0U3RhdGVbbl0gPyAwIDogMSB9KTtcbiAgY29uc3QgcGlja0luZGV4ID0gKG0pID0+IHtcbiAgICBjb25zdCBwYXRjaCA9IHt9O1xuICAgIGMuaW5wdXRzLmZvckVhY2goKG4sIGspID0+IHsgcGF0Y2hbbl0gPSBtID4+IGMuaW5wdXRzLmxlbmd0aCAtIDEgLSBrICYgMTsgfSk7XG4gICAgc2V0SW5wdXRzKHBhdGNoKTtcbiAgfTtcbiAgXG4gIGNvbnN0IGJhc2UgPSB7IGFwcCwgaHNwYWNpbmcsIHZnYXA6IFMudlNwYWNpbmcsIGJ1YmJsZXMsIGFuaW0sIGdldERlbGF5LCBvblRvZ2dsZTogdG9nZ2xlIH07XG4gIFxuICBpZiAocGFydChcImRpYWdyYW1cIiwgdHJ1ZSkpIHtcbiAgICBjb25zdCBob2xkZXIgPSBoKFwiZGl2XCIsIFwiXCIsIHdyYXApO1xuICAgIG1haW5EaWFncmFtID0gY3JlYXRlRGlhZ3JhbShjLCBob2xkZXIsIE9iamVjdC5hc3NpZ24oe30sIGJhc2UsIHtcbiAgICAgIHRpdGxlOiBcIkNpcmN1aXRcIixcbiAgICAgIGV4cG9ydE5hbWU6IFwiY2lyY3VpdFwiLFxuICAgICAgb25DaGFuZ2U6IChzaWcsIHYpID0+IHsgaWYgKHRpbWluZykgdGltaW5nLnJlY29yZChzaWcsIHYpOyB9XG4gICAgfSkpO1xuICAgIGlmIChzaG93R3JhcGgpIHtcbiAgICAgIGNvbnN0IGtpbmRzID0ge307XG4gICAgICBjLmlucHV0cy5mb3JFYWNoKChuKSA9PiB7IGtpbmRzW25dID0gXCJpblwiOyB9KTtcbiAgICAgIGMub3V0cHV0cy5mb3JFYWNoKChuKSA9PiB7IGtpbmRzW25dID0gXCJvdXRcIjsgfSk7XG4gICAgICB0aW1pbmcgPSBjcmVhdGVUaW1pbmcoaG9sZGVyLCBbLi4uYy5pbnB1dHMsIC4uLmMubWlkZGxlcywgLi4uYy5vdXRwdXRzXSwga2luZHMsIGFwcCk7XG4gICAgICB0aW1pbmcuc2V0TGFzdFZhbHMoKCkgPT4gbWFpbkRpYWdyYW0uc2ltLnZhbHMpO1xuICAgICAgdGltaW5nLmJlZ2luKG1haW5EaWFncmFtLnNpbS52YWxzKTtcbiAgICB9XG4gICAgZGlhZ3JhbXMucHVzaChtYWluRGlhZ3JhbSk7XG4gIH1cbiAgXG4gIGlmIChtZXRob2QgJiYgcGFydChcImRpYWdyYW1cIiwgdHJ1ZSkpIHtcbiAgICBpZiAoIWFuYWx5emFibGUgJiYgbWV0aG9kICE9PSBcInN0cnVjdHVyYWxcIikge1xuICAgICAgaChcImRpdlwiLCBcImxnLW5vdGVcIiwgd3JhcCwgYFwiJHttZXRob2R9XCIgbmVlZHMgYXQgbW9zdCAke0FOQUxZU0lTX01BWF9JTlBVVFN9IGlucHV0cy4gXCJzdHJ1Y3R1cmFsXCIgd29ya3MgYXQgYW55IHNpemUuYCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGxldCByID0gbnVsbDtcbiAgICAgIHRyeSB7XG4gICAgICAgIHIgPSByZWR1Y2VDaXJjdWl0KGMsIGFsbCwgbWV0aG9kKTtcbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgaChcImRpdlwiLCBcImxnLW5vdGVcIiwgd3JhcCwgXCJSZWR1Y3Rpb24gZmFpbGVkOiBcIiArIGUubWVzc2FnZSk7XG4gICAgICB9XG4gICAgICBpZiAocikge1xuICAgICAgICBjb25zdCBjaG9zZW4gPSBtZXRob2QgPT09IFwiYmVzdFwiID8gYCAoJHtyLm1ldGhvZH0pYCA6IFwiXCI7XG4gICAgICAgIE9iamVjdC5rZXlzKHIuY29uc3RzKS5mb3JFYWNoKChvKSA9PiBoKFwiZGl2XCIsIFwibGctbm90ZVwiLCB3cmFwLCBgJHtvfSByZWR1Y2VzIHRvIHRoZSBjb25zdGFudCAke3IuY29uc3RzW29dfWApKTtcbiAgICAgICAgaWYgKHIudmVyaWZpZWQgPT09IFwiRkFJTEVEXCIpIHtcbiAgICAgICAgICBoKFwiZGl2XCIsIFwibGctZXJyb3JcIiwgd3JhcCwgXCJUaGUgcmVkdWNlZCBjaXJjdWl0IGRpZCBub3QgbWF0Y2ggdGhlIG9yaWdpbmFsLCBzbyBpdCBpcyBub3Qgc2hvd24uIFBsZWFzZSByZXBvcnQgdGhpcyBjaXJjdWl0LlwiKTtcbiAgICAgICAgfSBlbHNlIGlmIChyLmNpcmN1aXQgJiYgIShyLm1ldGhvZCA9PT0gXCJzdHJ1Y3R1cmFsXCIgJiYgci5hZnRlci5nYXRlcyA+PSByLmJlZm9yZS5nYXRlcykpIHtcbiAgICAgICAgICBjb25zdCBjaGVjayA9IHIudmVyaWZpZWQgPT09IFwiZXhhY3RcIiA/IFwiY2hlY2tlZCBvbiBhbGwgaW5wdXRzXCIgOiBcImNoZWNrZWQgb24gNDA5NiByYW5kb20gaW5wdXRzXCI7XG4gICAgICAgICAgZGlhZ3JhbXMucHVzaChjcmVhdGVEaWFncmFtKHIuY2lyY3VpdCwgd3JhcCwgT2JqZWN0LmFzc2lnbih7fSwgYmFzZSwge1xuICAgICAgICAgICAgdGl0bGU6IGBSZWR1Y2VkLCAke01FVEhPRF9MQUJFTFtyLm1ldGhvZF19JHtjaG9zZW59OiAke3IuYmVmb3JlLmdhdGVzfSB0byAke3IuYWZ0ZXIuZ2F0ZXN9IGdhdGVzICgke2NoZWNrfSlgLFxuICAgICAgICAgICAgZXhwb3J0TmFtZTogXCJjaXJjdWl0LXJlZHVjZWRcIlxuICAgICAgICAgIH0pKSk7XG4gICAgICAgICAgaWYgKHIuYWZ0ZXIuZ2F0ZXMgPiByLmJlZm9yZS5nYXRlcykgaChcImRpdlwiLCBcImxnLW5vdGVcIiwgd3JhcCwgJ1RoaXMgZm9ybSBoYXMgbW9yZSBnYXRlcyB0aGFuIHlvdXIgY2lyY3VpdDogdHdvLWxldmVsIGxvZ2ljIGNhbiBiZSBsYXJnZXIgKHBhcml0eS9YT1IgY2lyY3VpdHMgYXJlIHRoZSBjbGFzc2ljIGNhc2UpLiBUcnkgXCJzdHJ1Y3R1cmFsXCIgb3IgXCJiZXN0XCIuJyk7XG4gICAgICAgIH0gZWxzZSBpZiAoci5tZXRob2QgPT09IFwic3RydWN0dXJhbFwiKSB7XG4gICAgICAgICAgaChcImRpdlwiLCBcImxnLW5vdGVcIiwgd3JhcCwgYE5vIHN0cnVjdHVyYWwgcmVkdWN0aW9uIGZvdW5kOiAke3IuYmVmb3JlLmdhdGVzfSBnYXRlcyBpcyBhbHJlYWR5IG1pbmltYWwgZm9yIHRoZXNlIHJld3JpdGUgcnVsZXMuYCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgXG4gIGlmIChwYXJ0KFwiZXhwclwiLCBTLnNob3dFeHByKSkge1xuICAgIGNvbnN0IGJveCA9IGgoXCJkaXZcIiwgXCJsZy1leHByXCIsIHdyYXApO1xuICAgIGV4cHJzLmZvckVhY2goKGUpID0+IHtcbiAgICAgIGNvbnN0IHNhbWUgPSBlLnJhdyA9PT0gZS5taW47XG4gICAgICBpZiAoZS5yYXcgJiYgIXNhbWUpIG1hdGgoYCR7bm0oZS5uYW1lKX0gPSAke2UucmF3fWAsIGgoXCJkaXZcIiwgXCJsZy1leHByLXJvd1wiLCBib3gpKTtcbiAgICAgIGlmIChlLm1pbiAhPT0gbnVsbCkge1xuICAgICAgICBjb25zdCByMiA9IGgoXCJkaXZcIiwgXCJsZy1leHByLXJvd1wiLCBib3gpO1xuICAgICAgICBtYXRoKGAke25tKGUubmFtZSl9ID0gJHtlLm1pbn1gLCByMik7XG4gICAgICAgIGlmIChlLnJhdyAmJiAhc2FtZSkgaChcInNwYW5cIiwgXCJsZy1leHByLXRhZ1wiLCByMiwgZS5jb3YuZXhhY3QgPT09IGZhbHNlID8gXCIgc2ltcGxpZmllZCAobmVhci1taW5pbWFsKVwiIDogXCIgc2ltcGxpZmllZFwiKTtcbiAgICAgIH0gZWxzZSBpZiAoIWUucmF3KSB7XG4gICAgICAgIGgoXCJkaXZcIiwgXCJsZy1ub3RlXCIsIGJveCwgYCR7ZS5uYW1lfTogZXhwcmVzc2lvbiB0b28gbG9uZyB0byBkaXNwbGF5YCk7XG4gICAgICB9XG4gICAgfSk7XG4gICAgaWYgKCFhbmFseXphYmxlKSBoKFwiZGl2XCIsIFwibGctbm90ZVwiLCBib3gsIGBNb3JlIHRoYW4gJHtBTkFMWVNJU19NQVhfSU5QVVRTfSBpbnB1dHM6IG9ubHkgdGhlIHN0cnVjdHVyYWwgZXhwcmVzc2lvbiBpcyBzaG93bi5gKTtcbiAgICBpZiAodHlwZW9mIGZpbmlzaFJlbmRlck1hdGggPT09IFwiZnVuY3Rpb25cIikgZmluaXNoUmVuZGVyTWF0aCgpO1xuICB9XG4gIFxuICBpZiAoYW5hbHl6YWJsZSAmJiBwYXJ0KFwia21hcFwiLCBTLnNob3dLbWFwKSkge1xuICAgIGNvbnN0IGtiID0gaChcImRpdlwiLCBcImxnLWttYXAtd3JhcFwiLCB3cmFwKTtcbiAgICBrbWFwcyA9IHJlbmRlckttYXBzKGtiLCBjLCBhbGwsIGV4cHJzLCB7IGFwcCwgb25QaWNrOiBwaWNrSW5kZXggfSk7XG4gICAgaWYgKHR5cGVvZiBmaW5pc2hSZW5kZXJNYXRoID09PSBcImZ1bmN0aW9uXCIpIGZpbmlzaFJlbmRlck1hdGgoKTtcbiAgfVxuICBcbiAgY29uc3Qgc2hvd1RhYmxlID0gcGFydChcInRhYmxlXCIsIFMuc2hvd1RhYmxlKTtcbiAgaWYgKGFuYWx5emFibGUgJiYgc2hvd1RhYmxlKSB7XG4gICAgdGFibGUgPSByZW5kZXJUYWJsZSh3cmFwLCBjLCBhbGwsIGNvbXBhY3QpO1xuICAgIHRhYmxlLnRycy5mb3JFYWNoKCh0ciwgaSkgPT4gdHIuYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHtcbiAgICAgIGNvbnN0IHBhdGNoID0ge307XG4gICAgICBjLmlucHV0cy5mb3JFYWNoKChuKSA9PiB7XG4gICAgICAgIGNvbnN0IHAgPSB0YWJsZS5yb3dzW2ldLnBhdHRlcm5bbl07XG4gICAgICAgIHBhdGNoW25dID0gcCA9PT0gXCJYXCIgPyBpbnB1dFN0YXRlW25dIDogcDtcbiAgICAgIH0pO1xuICAgICAgc2V0SW5wdXRzKHBhdGNoKTtcbiAgICB9KSk7XG4gIH0gZWxzZSBpZiAoIWFuYWx5emFibGUgJiYgc2hvd1RhYmxlKSB7XG4gICAgaChcImRpdlwiLCBcImxnLW5vdGVcIiwgd3JhcCwgYFRydXRoIHRhYmxlIGhpZGRlbjogbW9yZSB0aGFuICR7QU5BTFlTSVNfTUFYX0lOUFVUU30gaW5wdXRzICgyXiR7Yy5pbnB1dHMubGVuZ3RofSByb3dzKS4gVGhlIGRpYWdyYW0gaXMgc3RpbGwgaW50ZXJhY3RpdmUuYCk7XG4gIH1cbiAgXG4gIGhpZ2hsaWdodCgpO1xuICBjb25zdCBhY3Rpb25zID0gaChcImRpdlwiLCBcImxnLWFjdGlvbnNcIiwgd3JhcCk7XG4gIGNvbnN0IGJ0biA9IChsYWJlbCwgZm4pID0+IGgoXCJidXR0b25cIiwgXCJcIiwgYWN0aW9ucywgbGFiZWwpLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKSA9PiBjb3B5KGZuKCkpKTtcbiAgaWYgKHRhYmxlKSBidG4oXCJDb3B5IHRhYmxlIChNYXJrZG93bilcIiwgKCkgPT4gdGFibGVUb01hcmtkb3duKHRhYmxlLmNvbE5hbWVzLCB0YWJsZS5yb3dzLm1hcCgocikgPT4gci5jZWxscykpKTtcbiAgaWYgKGFuYWx5emFibGUpIGJ0bihcIkNvcHkgZXhwcmVzc2lvbnMgKExhVGVYKVwiLCAoKSA9PiB0b0xhdGV4U291cmNlKGV4cHJzKSk7XG4gIGJ0bihcIkNvcHkgZGlhZ3JhbSAoTWVybWFpZClcIiwgKCkgPT4gdG9NZXJtYWlkKGMpKTtcbiAgXG4gIHJldHVybiB7XG4gICAgZGlzcG9zZSgpIHtcbiAgICAgIGRpYWdyYW1zLmZvckVhY2goKGQpID0+IGQuZGlzcG9zZSgpKTtcbiAgICAgIGlmICh0aW1pbmcpIHRpbWluZy5kaXNwb3NlKCk7XG4gICAgfVxuICB9O1xufSIsICIvLyBwYWNrYWdlcy9sb2dpYy1ncmFwaC9zcmMvY29yZS9zaW0uanNcbmltcG9ydCB7IEdBVEVTIH0gZnJvbSBcIi4vZ2F0ZXMuanNcIjtcblxuZXhwb3J0IGZ1bmN0aW9uIGV2YWx1YXRlKGMsIGlucHV0VmFscykge1xuICBjb25zdCB2ID0gT2JqZWN0LmFzc2lnbih7fSwgaW5wdXRWYWxzKTtcbiAgYy5vcmRlci5mb3JFYWNoKChnKSA9PiB7XG4gICAgdltnLm91dF0gPSArR0FURVNbZy50eXBlXS5mbihnLmlucy5tYXAoKHgpID0+ICEhdlt4XSkpO1xuICB9KTtcbiAgcmV0dXJuIHY7XG59XG5cbi8vIGV4ZXJjaXNlTW9kZTogaWYgdHJ1ZSwgaXQgd2lsbCByYW5kb21seSBzZXQgc29tZSBvdXRwdXRzIHRvIC0xIChEb24ndCBDYXJlKVxuLy8gc28gdGhlIHVzZXIgY2FuIHByYWN0aWNlIGZpbGxpbmcgdGhlbSBpbi5cbmV4cG9ydCBmdW5jdGlvbiB0cnV0aFRhYmxlKGMsIGV4ZXJjaXNlTW9kZSA9IGZhbHNlKSB7XG4gIGNvbnN0IG4gPSBjLmlucHV0cy5sZW5ndGg7XG4gIGNvbnN0IHJvd3MgPSBbXTtcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCAxIDw8IG47IGkrKykge1xuICAgIGNvbnN0IGlucyA9IHt9O1xuICAgIGMuaW5wdXRzLmZvckVhY2goKHgsIGspID0+IHtcbiAgICAgIGluc1t4XSA9IGkgPj4gbiAtIDEgLSBrICYgMTtcbiAgICB9KTtcbiAgICBjb25zdCByb3cgPSBldmFsdWF0ZShjLCBpbnMpO1xuICAgIFxuICAgIGlmIChleGVyY2lzZU1vZGUpIHtcbiAgICAgIGMub3V0cHV0cy5mb3JFYWNoKG8gPT4ge1xuICAgICAgICBpZiAoTWF0aC5yYW5kb20oKSA8IDAuMTUpIHJvd1tvXSA9IC0xOyAvLyAxNSUgY2hhbmNlIHRvIGhpZGUgYSBjZWxsXG4gICAgICB9KTtcbiAgICB9XG4gICAgXG4gICAgcm93cy5wdXNoKHJvdyk7XG4gIH1cbiAgcmV0dXJuIHJvd3M7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVTaW0oYywgZ2V0RGVsYXksIG9uQ2hhbmdlLCBvbldvcmspIHtcbiAgY29uc3QgemVybyA9IHt9O1xuICBjLmlucHV0cy5mb3JFYWNoKChuKSA9PiB7XG4gICAgemVyb1tuXSA9IDA7XG4gIH0pO1xuICBjb25zdCB2YWxzID0gZXZhbHVhdGUoYywgemVybyk7XG4gIGNvbnN0IHRpbWVycyA9IC8qIEBfX1BVUkVfXyAqLyBuZXcgTWFwKCk7XG4gIGNvbnN0IGNvbnN1bWVycyA9IHt9O1xuICBsZXQgZGlzcG9zZWQgPSBmYWxzZTtcbiAgYy5nYXRlcy5mb3JFYWNoKChnKSA9PiBnLmlucy5mb3JFYWNoKChuKSA9PiB7XG4gICAgKGNvbnN1bWVyc1tuXSA9IGNvbnN1bWVyc1tuXSB8fCBbXSkucHVzaChnKTtcbiAgfSkpO1xuICBjb25zdCB3b3JrID0gKGcpID0+IHtcbiAgICBpZiAoIWRpc3Bvc2VkICYmIG9uV29yaykgb25Xb3JrKGcpO1xuICB9O1xuICBmdW5jdGlvbiBzZXQoc2lnLCB2KSB7XG4gICAgaWYgKGRpc3Bvc2VkIHx8IHZhbHNbc2lnXSA9PT0gdikgcmV0dXJuO1xuICAgIHZhbHNbc2lnXSA9IHY7XG4gICAgb25DaGFuZ2Uoc2lnLCB2KTtcbiAgICAoY29uc3VtZXJzW3NpZ10gfHwgW10pLmZvckVhY2gocmVldmFsKTtcbiAgfVxuICBmdW5jdGlvbiByZWV2YWwoZykge1xuICAgIGlmIChkaXNwb3NlZCkgcmV0dXJuO1xuICAgIGNvbnN0IHRhcmdldCA9ICtHQVRFU1tnLnR5cGVdLmZuKGcuaW5zLm1hcCgoeCkgPT4gISF2YWxzW3hdKSk7XG4gICAgY29uc3QgcGVuZCA9IHRpbWVycy5nZXQoZyk7XG4gICAgaWYgKHBlbmQpIHtcbiAgICAgIGNsZWFyVGltZW91dChwZW5kLmgpO1xuICAgICAgdGltZXJzLmRlbGV0ZShnKTtcbiAgICB9XG4gICAgaWYgKHRhcmdldCA9PT0gdmFsc1tnLm91dF0pIHtcbiAgICAgIGlmIChwZW5kKSB3b3JrKGcpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBjb25zdCBkID0gZ2V0RGVsYXkoKTtcbiAgICBpZiAoIShkID4gMCkpIHtcbiAgICAgIHNldChnLm91dCwgdGFyZ2V0KTtcbiAgICAgIGlmIChwZW5kKSB3b3JrKGcpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBjb25zdCBoMiA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgdGltZXJzLmRlbGV0ZShnKTtcbiAgICAgIGlmIChkaXNwb3NlZCkgcmV0dXJuO1xuICAgICAgc2V0KGcub3V0LCB0YXJnZXQpO1xuICAgICAgd29yayhnKTtcbiAgICB9LCBkICogMWUzKTtcbiAgICB0aW1lcnMuc2V0KGcsIHsgaDogaDIsIHRhcmdldCB9KTtcbiAgICB3b3JrKGcpO1xuICB9XG4gIHJldHVybiB7XG4gICAgdmFscyxcbiAgICBzZXRJbnB1dHMocGF0Y2gpIHtcbiAgICAgIE9iamVjdC5rZXlzKHBhdGNoKS5mb3JFYWNoKChuKSA9PiBzZXQobiwgcGF0Y2hbbl0pKTtcbiAgICB9LFxuICAgIHBlbmRpbmcoKSB7XG4gICAgICByZXR1cm4gdGltZXJzLnNpemU7XG4gICAgfSxcbiAgICB3b3JraW5nKGcpIHtcbiAgICAgIGNvbnN0IHAgPSB0aW1lcnMuZ2V0KGcpO1xuICAgICAgcmV0dXJuIHAgPyBwLnRhcmdldCA6IG51bGw7XG4gICAgfSxcbiAgICBkaXNwb3NlKCkge1xuICAgICAgZGlzcG9zZWQgPSB0cnVlO1xuICAgICAgdGltZXJzLmZvckVhY2goKHApID0+IGNsZWFyVGltZW91dChwLmgpKTtcbiAgICAgIHRpbWVycy5jbGVhcigpO1xuICAgIH1cbiAgfTtcbn0iLCAiLy8gcGFja2FnZXMvbG9naWMtZ3JhcGgvc3JjL2NvcmUvbGF0ZXguanNcbmV4cG9ydCBjb25zdCBubSA9IChuKSA9PiAvXltBLVphLXpdJC8udGVzdChuKSA/IG4gOiBgXFxcXG1hdGhybXske24ucmVwbGFjZSgvXy9nLCBcIlxcXFxfXCIpfX1gO1xuZXhwb3J0IGZ1bmN0aW9uIHJhd0xhdGV4KGMsIHNpZykge1xuICBjb25zdCBtZW1vID0gLyogQF9fUFVSRV9fICovIG5ldyBNYXAoKTtcbiAgY29uc3QgZ28gPSAoeCkgPT4ge1xuICAgIGlmIChtZW1vLmhhcyh4KSkgcmV0dXJuIG1lbW8uZ2V0KHgpO1xuICAgIGNvbnN0IGcgPSBjLmRyaXZlclt4XTtcbiAgICBsZXQgcjtcbiAgICBpZiAoIWcpIHIgPSB7IHM6IG5tKHgpLCBwOiA1IH07XG4gICAgZWxzZSB7XG4gICAgICBjb25zdCBraWRzID0gZy5pbnMubWFwKGdvKTtcbiAgICAgIGNvbnN0IGpvaW4gPSAob3AsIHApID0+IGtpZHMubWFwKChrKSA9PiBrLnAgPCBwID8gYFxcXFxsZWZ0KCR7ay5zfVxcXFxyaWdodClgIDogay5zKS5qb2luKG9wKTtcbiAgICAgIGNvbnN0IEFORCA9ICgpID0+IGpvaW4oXCIgXFxcXGNkb3QgXCIsIDMpLCBPUiA9ICgpID0+IGpvaW4oXCIgKyBcIiwgMSksIFhPUiA9ICgpID0+IGpvaW4oXCIgXFxcXG9wbHVzIFwiLCAyKTtcbiAgICAgIHN3aXRjaCAoZy50eXBlKSB7XG4gICAgICAgIGNhc2UgXCJBTkRcIjpcbiAgICAgICAgICByID0geyBzOiBBTkQoKSwgcDogMyB9O1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIFwiT1JcIjpcbiAgICAgICAgICByID0geyBzOiBPUigpLCBwOiAxIH07XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgXCJYT1JcIjpcbiAgICAgICAgICByID0geyBzOiBYT1IoKSwgcDogMiB9O1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIFwiTkFORFwiOlxuICAgICAgICAgIHIgPSB7IHM6IGBcXFxcb3ZlcmxpbmV7JHtBTkQoKX19YCwgcDogNSB9O1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIFwiTk9SXCI6XG4gICAgICAgICAgciA9IHsgczogYFxcXFxvdmVybGluZXske09SKCl9fWAsIHA6IDUgfTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBcIlhOT1JcIjpcbiAgICAgICAgICByID0geyBzOiBgXFxcXG92ZXJsaW5leyR7WE9SKCl9fWAsIHA6IDUgfTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBcIk5PVFwiOlxuICAgICAgICAgIHIgPSB7IHM6IGBcXFxcb3ZlcmxpbmV7JHtraWRzWzBdLnN9fWAsIHA6IDUgfTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICByID0ga2lkc1swXTtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKHIucy5sZW5ndGggPiAyZTMpIHRocm93IG5ldyBFcnJvcihcInRvbyBsb25nXCIpO1xuICAgIG1lbW8uc2V0KHgsIHIpO1xuICAgIHJldHVybiByO1xuICB9O1xuICByZXR1cm4gZ28oc2lnKS5zO1xufVxuXG4iLCAiLy8gcGFja2FnZXMvbG9naWMtZ3JhcGgvc3JjL2NvcmUvbWluaW1pemUuanNcbmltcG9ydCB7IG5tLCByYXdMYXRleCB9IGZyb20gXCIuL2xhdGV4LmpzXCI7XG5cbmV4cG9ydCBjb25zdCBwb3Bjb3VudCA9ICh4KSA9PiB7XG4gIGxldCBrID0gMDtcbiAgd2hpbGUgKHgpIHtcbiAgICBrICs9IHggJiAxO1xuICAgIHggPj4+PSAxO1xuICB9XG4gIHJldHVybiBrO1xufTtcblxuZXhwb3J0IGZ1bmN0aW9uIHByaW1lSW1wbGljYW50cyhvbmVzKSB7XG4gIGxldCBjdXIgPSBuZXcgTWFwKG9uZXMubWFwKChtKSA9PiBbbSArIFwiOjBcIiwgeyB2OiBtLCBtYXNrOiAwIH1dKSk7XG4gIGNvbnN0IHByaW1lcyA9IFtdO1xuICB3aGlsZSAoY3VyLnNpemUpIHtcbiAgICBjb25zdCBncm91cHMgPSBuZXcgTWFwKCk7XG4gICAgZm9yIChjb25zdCB0IG9mIGN1ci52YWx1ZXMoKSkge1xuICAgICAgY29uc3QgayA9IHQubWFzayArIFwifFwiICsgcG9wY291bnQodC52KTtcbiAgICAgIGlmICghZ3JvdXBzLmhhcyhrKSkgZ3JvdXBzLnNldChrLCBbXSk7XG4gICAgICBncm91cHMuZ2V0KGspLnB1c2godCk7XG4gICAgfVxuICAgIGNvbnN0IHVzZWQgPSBuZXcgU2V0KCksIG5leHQgPSBuZXcgTWFwKCk7XG4gICAgZm9yIChjb25zdCBbaywgbGlzdF0gb2YgZ3JvdXBzKSB7XG4gICAgICBjb25zdCBbbWFzaywgcF0gPSBrLnNwbGl0KFwifFwiKS5tYXAoTnVtYmVyKTtcbiAgICAgIGNvbnN0IG90aGVyID0gZ3JvdXBzLmdldChtYXNrICsgXCJ8XCIgKyAocCArIDEpKTtcbiAgICAgIGlmICghb3RoZXIpIGNvbnRpbnVlO1xuICAgICAgZm9yIChjb25zdCBhIG9mIGxpc3QpIGZvciAoY29uc3QgYiBvZiBvdGhlcikge1xuICAgICAgICBjb25zdCBkID0gYS52IF4gYi52O1xuICAgICAgICBpZiAoZCAmJiAhKGQgJiBkIC0gMSkpIHtcbiAgICAgICAgICBjb25zdCB0ID0geyB2OiBhLnYgJiBiLnYsIG1hc2s6IGEubWFzayB8IGQgfTtcbiAgICAgICAgICBuZXh0LnNldCh0LnYgKyBcIjpcIiArIHQubWFzaywgdCk7XG4gICAgICAgICAgdXNlZC5hZGQoYSk7XG4gICAgICAgICAgdXNlZC5hZGQoYik7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgZm9yIChjb25zdCB0IG9mIGN1ci52YWx1ZXMoKSkgaWYgKCF1c2VkLmhhcyh0KSkgcHJpbWVzLnB1c2godCk7XG4gICAgY3VyID0gbmV4dDtcbiAgfVxuICByZXR1cm4gcHJpbWVzO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY2hvb3NlQ292ZXIocHJpbWVzLCBvbmVzLCBudmFycykge1xuICBjb25zdCBOT0RFX0xJTUlUID0gNmU0O1xuICBjb25zdCBjb3ZlcnMgPSAocCwgbSkgPT4gKG0gJiB+cC5tYXNrKSA9PT0gcC52O1xuICBjb25zdCBsaXRzID0gKHApID0+IG52YXJzIC0gcG9wY291bnQocC5tYXNrKTtcbiAgY29uc3QgY29zdCA9IChsaXN0KSA9PiBbbGlzdC5sZW5ndGgsIGxpc3QucmVkdWNlKChhLCBwKSA9PiBhICsgbGl0cyhwKSwgMCldO1xuICBjb25zdCBiZXR0ZXIgPSAoYSwgYikgPT4gYVswXSAhPT0gYlswXSA/IGFbMF0gPCBiWzBdIDogYVsxXSA8IGJbMV07XG4gIGNvbnN0IGJ5T3JkZXIgPSAoYSwgYikgPT4gYS52IC0gYi52IHx8IGEubWFzayAtIGIubWFzaztcbiAgY29uc3QgY2hvc2VuID0gW10sIGxlZnQgPSBuZXcgU2V0KG9uZXMpO1xuICBvbmVzLmZvckVhY2goKG0pID0+IHtcbiAgICBjb25zdCBwcyA9IHByaW1lcy5maWx0ZXIoKHApID0+IGNvdmVycyhwLCBtKSk7XG4gICAgaWYgKHBzLmxlbmd0aCA9PT0gMSAmJiAhY2hvc2VuLmluY2x1ZGVzKHBzWzBdKSkgY2hvc2VuLnB1c2gocHNbMF0pO1xuICB9KTtcbiAgY2hvc2VuLmZvckVhY2goKHApID0+IG9uZXMuZm9yRWFjaCgobSkgPT4ge1xuICAgIGlmIChjb3ZlcnMocCwgbSkpIGxlZnQuZGVsZXRlKG0pO1xuICB9KSk7XG4gIGNvbnN0IHJlc3QgPSBbLi4ubGVmdF07XG4gIGlmICghcmVzdC5sZW5ndGgpIHJldHVybiB7IGNvdmVyOiBjaG9zZW4uc29ydChieU9yZGVyKSwgZXhhY3Q6IHRydWUgfTtcbiAgY29uc3QgY2FuZCA9IHByaW1lcy5maWx0ZXIoKHApID0+ICFjaG9zZW4uaW5jbHVkZXMocCkgJiYgcmVzdC5zb21lKChtKSA9PiBjb3ZlcnMocCwgbSkpKTtcbiAgY29uc3QgY292ZXJlcnMgPSBuZXcgTWFwKHJlc3QubWFwKChtKSA9PiBbbSwgY2FuZC5maWx0ZXIoKHApID0+IGNvdmVycyhwLCBtKSldKSk7XG4gIGxldCBiZXN0U2VsID0gW107XG4gIHtcbiAgICBjb25zdCB1bmMgPSBuZXcgU2V0KHJlc3QpO1xuICAgIHdoaWxlICh1bmMuc2l6ZSkge1xuICAgICAgbGV0IGJwID0gbnVsbCwgYmMgPSAtMTtcbiAgICAgIGNhbmQuZm9yRWFjaCgocCkgPT4ge1xuICAgICAgICBsZXQgayA9IDA7XG4gICAgICAgIHVuYy5mb3JFYWNoKChtKSA9PiB7XG4gICAgICAgICAgaWYgKGNvdmVycyhwLCBtKSkgaysrO1xuICAgICAgICB9KTtcbiAgICAgICAgaWYgKGsgPiBiYykge1xuICAgICAgICAgIGJjID0gaztcbiAgICAgICAgICBicCA9IHA7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgICAgYmVzdFNlbC5wdXNoKGJwKTtcbiAgICAgIFsuLi51bmNdLmZvckVhY2goKG0pID0+IHtcbiAgICAgICAgaWYgKGNvdmVycyhicCwgbSkpIHVuYy5kZWxldGUobSk7XG4gICAgICB9KTtcbiAgICB9XG4gIH1cbiAgbGV0IGJlc3RDb3N0ID0gY29zdChjaG9zZW4uY29uY2F0KGJlc3RTZWwpKTtcbiAgbGV0IG5vZGVzID0gMCwgZXhhY3QgPSB0cnVlO1xuICBjb25zdCByZWMgPSAodW5jLCBzZWwpID0+IHtcbiAgICBpZiAoKytub2RlcyA+IE5PREVfTElNSVQpIHtcbiAgICAgIGV4YWN0ID0gZmFsc2U7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGlmICghdW5jLmxlbmd0aCkge1xuICAgICAgY29uc3QgYzIgPSBjb3N0KGNob3Nlbi5jb25jYXQoc2VsKSk7XG4gICAgICBpZiAoYmV0dGVyKGMyLCBiZXN0Q29zdCkpIHtcbiAgICAgICAgYmVzdENvc3QgPSBjMjtcbiAgICAgICAgYmVzdFNlbCA9IHNlbC5zbGljZSgpO1xuICAgICAgfVxuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBpZiAoY2hvc2VuLmxlbmd0aCArIHNlbC5sZW5ndGggKyAxID4gYmVzdENvc3RbMF0pIHJldHVybjtcbiAgICBsZXQgcGljayA9IHVuY1swXSwgcGMgPSBjb3ZlcmVycy5nZXQocGljaykubGVuZ3RoO1xuICAgIGZvciAoY29uc3QgbSBvZiB1bmMpIHtcbiAgICAgIGNvbnN0IGsgPSBjb3ZlcmVycy5nZXQobSkubGVuZ3RoO1xuICAgICAgaWYgKGsgPCBwYykge1xuICAgICAgICBwaWNrID0gbTtcbiAgICAgICAgcGMgPSBrO1xuICAgICAgfVxuICAgIH1cbiAgICBjb25zdCBvcHRzID0gY292ZXJlcnMuZ2V0KHBpY2spLnNsaWNlKCkuc29ydCgoYSwgYikgPT4gdW5jLmZpbHRlcigobSkgPT4gY292ZXJzKGIsIG0pKS5sZW5ndGggLSB1bmMuZmlsdGVyKChtKSA9PiBjb3ZlcnMoYSwgbSkpLmxlbmd0aCk7XG4gICAgZm9yIChjb25zdCBwIG9mIG9wdHMpIHtcbiAgICAgIHNlbC5wdXNoKHApO1xuICAgICAgcmVjKHVuYy5maWx0ZXIoKG0pID0+ICFjb3ZlcnMocCwgbSkpLCBzZWwpO1xuICAgICAgc2VsLnBvcCgpO1xuICAgICAgaWYgKG5vZGVzID4gTk9ERV9MSU1JVCkgcmV0dXJuO1xuICAgIH1cbiAgfTtcbiAgcmVjKHJlc3QsIFtdKTtcbiAgcmV0dXJuIHsgY292ZXI6IGNob3Nlbi5jb25jYXQoYmVzdFNlbCkuc29ydChieU9yZGVyKSwgZXhhY3QgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNvdmVyT2YoYWxsLCBvdXQsIHRhcmdldCwgZGMgPSBuZXcgU2V0KCkpIHtcbiAgY29uc3QgaWR4ID0gW107XG4gIGxldCBjb3VudDEgPSAwO1xuICBhbGwuZm9yRWFjaCgociwgaSkgPT4ge1xuICAgIGlmIChyW291dF0pIGNvdW50MSsrO1xuICAgIGlmIChyW291dF0gPT09ICh0YXJnZXQgPT09IDAgPyAwIDogMSkpIGlkeC5wdXNoKGkpO1xuICB9KTtcbiAgaWYgKGNvdW50MSA9PT0gMCkgcmV0dXJuIHsgY29uc3Q6IDAsIGV4YWN0OiB0cnVlIH07XG4gIGlmIChjb3VudDEgPT09IGFsbC5sZW5ndGgpIHJldHVybiB7IGNvbnN0OiAxLCBleGFjdDogdHJ1ZSB9O1xuICBcbiAgY29uc3QgbnZhcnMgPSBNYXRoLnJvdW5kKE1hdGgubG9nMihhbGwubGVuZ3RoKSk7XG4gIC8vIEFkZCBkb24ndCBjYXJlcyB0byB0aGUgbGlzdCBvZiBvbmVzIHVzZWQgZm9yIHByaW1lIGltcGxpY2FudHNcbiAgY29uc3QgYWxsT25lcyA9IFsuLi5pZHgsIC4uLmRjXTsgXG4gIGNvbnN0IHsgY292ZXIsIGV4YWN0IH0gPSBjaG9vc2VDb3ZlcihwcmltZUltcGxpY2FudHMoYWxsT25lcyksIGlkeCwgbnZhcnMpO1xuICByZXR1cm4geyBvbmVzOiBpZHgsIGNvdmVyLCBleGFjdCB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY3ViZUxpdGVyYWxzKGMsIGN1YmUpIHtcbiAgY29uc3QgbiA9IGMuaW5wdXRzLmxlbmd0aCwgb3V0ID0gW107XG4gIGMuaW5wdXRzLmZvckVhY2goKG5hbWUsIGspID0+IHtcbiAgICBjb25zdCBiaXQgPSAxIDw8IG4gLSAxIC0gaztcbiAgICBpZiAoIShjdWJlLm1hc2sgJiBiaXQpKSBvdXQucHVzaCh7IG5hbWUsIG5lZzogIShjdWJlLnYgJiBiaXQpIH0pO1xuICB9KTtcbiAgcmV0dXJuIG91dDtcbn1cblxuZXhwb3J0IGNvbnN0IGxpdExhdGV4ID0gKGwpID0+IGwubmVnID8gYFxcXFxvdmVybGluZXske25tKGwubmFtZSl9fWAgOiBubShsLm5hbWUpO1xuZXhwb3J0IGNvbnN0IGN1YmVMYXRleCA9IChjLCBjdWJlKSA9PiBjdWJlTGl0ZXJhbHMoYywgY3ViZSkubWFwKGxpdExhdGV4KS5qb2luKFwiIFxcXFxjZG90IFwiKTtcbmV4cG9ydCBjb25zdCBzb3BMYXRleCA9IChjLCBjb3YpID0+IGNvdi5jb25zdCAhPT0gdm9pZCAwID8gU3RyaW5nKGNvdi5jb25zdCkgOiBjb3YuY292ZXIubWFwKChjYikgPT4gY3ViZUxhdGV4KGMsIGNiKSkuam9pbihcIiArIFwiKTtcblxuZXhwb3J0IGZ1bmN0aW9uIGJ1aWxkRXhwcmVzc2lvbnMoYywgYWxsKSB7XG4gIHJldHVybiBjLm91dHB1dHMubWFwKChvKSA9PiB7XG4gICAgbGV0IHJhdztcbiAgICB0cnkge1xuICAgICAgcmF3ID0gcmF3TGF0ZXgoYywgbyk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgcmF3ID0gbnVsbDtcbiAgICB9XG4gICAgaWYgKHJhdyAmJiByYXcubGVuZ3RoID4gODAwKSByYXcgPSBudWxsO1xuICAgIFxuICAgIGxldCBjb3YgPSBudWxsLCBtaW4gPSBudWxsO1xuICAgIGlmIChhbGwpIHtcbiAgICAgIGNvbnN0IGRjID0gbmV3IFNldCgpO1xuICAgICAgYWxsLmZvckVhY2goKHIsIGkpID0+IHsgaWYgKHJbb10gPT09IC0xKSBkYy5hZGQoaSk7IH0pO1xuICAgICAgXG4gICAgICBjb3YgPSBjb3Zlck9mKGFsbCwgbywgMSwgZGMpO1xuICAgICAgbWluID0gc29wTGF0ZXgoYywgY292KTtcbiAgICB9XG4gICAgcmV0dXJuIHsgbmFtZTogbywgcmF3LCBtaW4sIGNvdiB9O1xuICB9KTtcbn0iLCAiLy8gcGFja2FnZXMvbG9naWMtZ3JhcGgvc3JjL2NvcmUvc3ludGhlc2l6ZS5qc1xuaW1wb3J0IHsgTUFYX0dBVEVfRkFOSU4gfSBmcm9tIFwiLi9jb25zdGFudHMuanNcIjtcbmltcG9ydCB7IEJBU0UgfSBmcm9tIFwiLi9nYXRlcy5qc1wiO1xuaW1wb3J0IHsgY292ZXJPZiwgY3ViZUxpdGVyYWxzIH0gZnJvbSBcIi4vbWluaW1pemUuanNcIjtcbmltcG9ydCB7IGFzc2VtYmxlIH0gZnJvbSBcIi4vcGFyc2VyLmpzXCI7XG5leHBvcnQgY29uc3QgTUVUSE9EX0xBQkVMID0ge1xuICBzdHJ1Y3R1cmFsOiBcIlN0cnVjdHVyYWwgKHJld3JpdGVzIHlvdXIgYWN0dWFsIGNpcmN1aXQpXCIsXG4gIGJlc3Q6IFwiQmVzdCBvZiBhbGwgbWV0aG9kc1wiLFxuICBzb3A6IFwiQU5ELU9SIChzdW0gb2YgcHJvZHVjdHMpXCIsXG4gIHBvczogXCJPUi1BTkQgKHByb2R1Y3Qgb2Ygc3VtcylcIixcbiAgbmFuZDogXCJOQU5ELU5BTkRcIixcbiAgbm9yOiBcIk5PUi1OT1JcIlxufTtcbmV4cG9ydCBmdW5jdGlvbiBzeW50aGVzaXplKGMsIGFsbCwgbWV0aG9kKSB7XG4gIGNvbnN0IG5hbWVzID0gLyogQF9fUFVSRV9fICovIG5ldyBTZXQoWy4uLmMuaW5wdXRzLCAuLi5jLmdhdGVzLm1hcCgoZykgPT4gZy5vdXQpXSk7XG4gIGNvbnN0IGdlbnN5bSA9IChiYXNlLCBudW1iZXJlZCkgPT4ge1xuICAgIGlmICghbnVtYmVyZWQgJiYgIW5hbWVzLmhhcyhiYXNlKSkge1xuICAgICAgbmFtZXMuYWRkKGJhc2UpO1xuICAgICAgcmV0dXJuIGJhc2U7XG4gICAgfVxuICAgIGxldCBrID0gbnVtYmVyZWQgPyAxIDogMiwgbm1lO1xuICAgIGRvIHtcbiAgICAgIG5tZSA9IGJhc2UgKyBrKys7XG4gICAgfSB3aGlsZSAobmFtZXMuaGFzKG5tZSkpO1xuICAgIG5hbWVzLmFkZChubWUpO1xuICAgIHJldHVybiBubWU7XG4gIH07XG4gIGNvbnN0IGdhdGVzID0gW10sIGNhY2hlID0gLyogQF9fUFVSRV9fICovIG5ldyBNYXAoKSwgbm90cyA9IC8qIEBfX1BVUkVfXyAqLyBuZXcgTWFwKCksIGNvbnN0cyA9IHt9O1xuICBjb25zdCBhZGRHYXRlID0gKHR5cGUsIGlucywgb3V0KSA9PiB7XG4gICAgZ2F0ZXMucHVzaCh7IHR5cGUsIGlucywgb3V0LCBsaW5lOiAwIH0pO1xuICAgIHJldHVybiBvdXQ7XG4gIH07XG4gIGNvbnN0IHNoYXJlZCA9ICh0eXBlLCBpbnMsIHByZWZpeCkgPT4ge1xuICAgIGNvbnN0IGtleSA9IHR5cGUgKyBcInxcIiArIGlucy5qb2luKFwiLFwiKTtcbiAgICBpZiAoIWNhY2hlLmhhcyhrZXkpKSBjYWNoZS5zZXQoa2V5LCBhZGRHYXRlKHR5cGUsIGlucywgZ2Vuc3ltKHByZWZpeCwgdHJ1ZSkpKTtcbiAgICByZXR1cm4gY2FjaGUuZ2V0KGtleSk7XG4gIH07XG4gIGNvbnN0IG5vdE9mID0gKG5hbWUpID0+IHtcbiAgICBpZiAoIW5vdHMuaGFzKG5hbWUpKSBub3RzLnNldChuYW1lLCBhZGRHYXRlKFwiTk9UXCIsIFtuYW1lXSwgZ2Vuc3ltKG5hbWUgKyBcIl9uXCIpKSk7XG4gICAgcmV0dXJuIG5vdHMuZ2V0KG5hbWUpO1xuICB9O1xuICBjb25zdCBsaXQgPSAobCkgPT4gbC5uZWcgPyBub3RPZihsLm5hbWUpIDogbC5uYW1lO1xuICBjb25zdCBjb21wID0gKGwpID0+ICh7IG5hbWU6IGwubmFtZSwgbmVnOiAhbC5uZWcgfSk7XG4gIGNvbnN0IGJ1aWxkID0gKHR5cGUsIGlucywgcHJlZml4LCBvdXQpID0+IHtcbiAgICBjb25zdCBiYXNlID0gQkFTRVt0eXBlXTtcbiAgICBsZXQgY3VyID0gaW5zO1xuICAgIHdoaWxlIChjdXIubGVuZ3RoID4gTUFYX0dBVEVfRkFOSU4pIHtcbiAgICAgIGNvbnN0IG5leHQgPSBbXTtcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgY3VyLmxlbmd0aDsgaSArPSBNQVhfR0FURV9GQU5JTikge1xuICAgICAgICBjb25zdCBjaHVuayA9IGN1ci5zbGljZShpLCBpICsgTUFYX0dBVEVfRkFOSU4pO1xuICAgICAgICBuZXh0LnB1c2goY2h1bmsubGVuZ3RoID09PSAxID8gY2h1bmtbMF0gOiBzaGFyZWQoYmFzZSwgY2h1bmssIFwidFwiKSk7XG4gICAgICB9XG4gICAgICBjdXIgPSBuZXh0O1xuICAgIH1cbiAgICByZXR1cm4gb3V0ID8gYWRkR2F0ZSh0eXBlLCBjdXIsIG91dCkgOiBzaGFyZWQodHlwZSwgY3VyLCBwcmVmaXgpO1xuICB9O1xuICBjb25zdCBzaW5nbGUgPSAodHlwZSwgTCwgb3V0KSA9PiB7XG4gICAgaWYgKEwubGVuZ3RoID09PSAxKSBhZGRHYXRlKExbMF0ubmVnID8gXCJOT1RcIiA6IFwiQlVGXCIsIFtMWzBdLm5hbWVdLCBvdXQpO1xuICAgIGVsc2UgYnVpbGQodHlwZSwgTC5tYXAobGl0KSwgXCJcIiwgb3V0KTtcbiAgfTtcbiAgY29uc3QgZHVhbCA9IG1ldGhvZCA9PT0gXCJwb3NcIiB8fCBtZXRob2QgPT09IFwibm9yXCI7XG4gIGMub3V0cHV0cy5mb3JFYWNoKChvKSA9PiB7XG4gICAgY29uc3QgY292ID0gY292ZXJPZihhbGwsIG8sIGR1YWwgPyAwIDogMSk7XG4gICAgaWYgKGNvdi5jb25zdCAhPT0gdm9pZCAwKSB7XG4gICAgICBjb25zdHNbb10gPSBjb3YuY29uc3Q7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGNvbnN0IGN1YmVzID0gY292LmNvdmVyO1xuICAgIGNvbnN0IGxpdHMgPSAoY2IpID0+IGR1YWwgPyBjdWJlTGl0ZXJhbHMoYywgY2IpLm1hcChjb21wKSA6IGN1YmVMaXRlcmFscyhjLCBjYik7XG4gICAgaWYgKGN1YmVzLmxlbmd0aCA9PT0gMSkge1xuICAgICAgc2luZ2xlKGR1YWwgPyBcIk9SXCIgOiBcIkFORFwiLCBsaXRzKGN1YmVzWzBdKSwgbyk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGlmIChtZXRob2QgPT09IFwic29wXCIpIHtcbiAgICAgIGJ1aWxkKFwiT1JcIiwgY3ViZXMubWFwKChjYikgPT4ge1xuICAgICAgICBjb25zdCBMID0gbGl0cyhjYik7XG4gICAgICAgIHJldHVybiBMLmxlbmd0aCA9PT0gMSA/IGxpdChMWzBdKSA6IGJ1aWxkKFwiQU5EXCIsIEwubWFwKGxpdCksIFwicFwiKTtcbiAgICAgIH0pLCBcIlwiLCBvKTtcbiAgICB9IGVsc2UgaWYgKG1ldGhvZCA9PT0gXCJuYW5kXCIpIHtcbiAgICAgIGJ1aWxkKFwiTkFORFwiLCBjdWJlcy5tYXAoKGNiKSA9PiB7XG4gICAgICAgIGNvbnN0IEwgPSBsaXRzKGNiKTtcbiAgICAgICAgcmV0dXJuIEwubGVuZ3RoID09PSAxID8gTFswXS5uZWcgPyBMWzBdLm5hbWUgOiBub3RPZihMWzBdLm5hbWUpIDogYnVpbGQoXCJOQU5EXCIsIEwubWFwKGxpdCksIFwicFwiKTtcbiAgICAgIH0pLCBcIlwiLCBvKTtcbiAgICB9IGVsc2UgaWYgKG1ldGhvZCA9PT0gXCJwb3NcIikge1xuICAgICAgYnVpbGQoXCJBTkRcIiwgY3ViZXMubWFwKChjYikgPT4ge1xuICAgICAgICBjb25zdCBMID0gbGl0cyhjYik7XG4gICAgICAgIHJldHVybiBMLmxlbmd0aCA9PT0gMSA/IGxpdChMWzBdKSA6IGJ1aWxkKFwiT1JcIiwgTC5tYXAobGl0KSwgXCJzXCIpO1xuICAgICAgfSksIFwiXCIsIG8pO1xuICAgIH0gZWxzZSB7XG4gICAgICBidWlsZChcIk5PUlwiLCBjdWJlcy5tYXAoKGNiKSA9PiB7XG4gICAgICAgIGNvbnN0IEwgPSBsaXRzKGNiKTtcbiAgICAgICAgcmV0dXJuIEwubGVuZ3RoID09PSAxID8gTFswXS5uZWcgPyBMWzBdLm5hbWUgOiBub3RPZihMWzBdLm5hbWUpIDogYnVpbGQoXCJOT1JcIiwgTC5tYXAobGl0KSwgXCJzXCIpO1xuICAgICAgfSksIFwiXCIsIG8pO1xuICAgIH1cbiAgfSk7XG4gIHJldHVybiB7IGNpcmN1aXQ6IGdhdGVzLmxlbmd0aCA/IGFzc2VtYmxlKGdhdGVzLCBjLmlucHV0cykgOiBudWxsLCBjb25zdHMgfTtcbn1cblxuIiwgIi8vIHBhY2thZ2VzL2xvZ2ljLWdyYXBoL3NyYy9jb3JlL3JlZHVjZS5qc1xuaW1wb3J0IHsgTUFYX0dBVEVfRkFOSU4gfSBmcm9tIFwiLi9jb25zdGFudHMuanNcIjtcbmltcG9ydCB7IElOVkVSVElORywgQkFTRSwgSU5WRVJTRSB9IGZyb20gXCIuL2dhdGVzLmpzXCI7XG5pbXBvcnQgeyBldmFsdWF0ZSB9IGZyb20gXCIuL3NpbS5qc1wiO1xuaW1wb3J0IHsgc3ludGhlc2l6ZSB9IGZyb20gXCIuL3N5bnRoZXNpemUuanNcIjtcbmltcG9ydCB7IGFzc2VtYmxlIH0gZnJvbSBcIi4vcGFyc2VyLmpzXCI7XG5leHBvcnQgY29uc3QgY2lyY3VpdENvc3QgPSAoYykgPT4gKHsgZ2F0ZXM6IGMuZ2F0ZXMubGVuZ3RoLCBwaW5zOiBjLmdhdGVzLnJlZHVjZSgoYSwgZykgPT4gYSArIGcuaW5zLmxlbmd0aCwgMCkgfSk7XG5leHBvcnQgZnVuY3Rpb24gcmVkdWNlU3RydWN0dXJhbChjKSB7XG4gIGxldCBnYXRlcyA9IGMuZ2F0ZXMubWFwKChnKSA9PiAoeyB0eXBlOiBnLnR5cGUsIGluczogZy5pbnMuc2xpY2UoKSwgb3V0OiBnLm91dCwgbGluZTogMCB9KSk7XG4gIGNvbnN0IGlzT3V0ID0gbmV3IFNldChjLm91dHB1dHMpO1xuICBjb25zdCBkcnYgPSAoKSA9PiB7XG4gICAgY29uc3QgZCA9IHt9O1xuICAgIGdhdGVzLmZvckVhY2goKGcpID0+IHtcbiAgICAgIGRbZy5vdXRdID0gZztcbiAgICB9KTtcbiAgICByZXR1cm4gZDtcbiAgfTtcbiAgY29uc3QgZmFub3V0ID0gKCkgPT4ge1xuICAgIGNvbnN0IGYgPSB7fTtcbiAgICBnYXRlcy5mb3JFYWNoKChnKSA9PiBnLmlucy5mb3JFYWNoKCh4KSA9PiB7XG4gICAgICBmW3hdID0gKGZbeF0gfHwgMCkgKyAxO1xuICAgIH0pKTtcbiAgICByZXR1cm4gZjtcbiAgfTtcbiAgY29uc3QgcmVuYW1lID0gKGZyb20sIHRvKSA9PiBnYXRlcy5mb3JFYWNoKChnKSA9PiB7XG4gICAgZy5pbnMgPSBnLmlucy5tYXAoKHgpID0+IHggPT09IGZyb20gPyB0byA6IHgpO1xuICB9KTtcbiAgY29uc3QgbGl2ZSA9IChnKSA9PiBnYXRlcy5pbmNsdWRlcyhnKTtcbiAgZm9yIChsZXQgaXRlciA9IDA7IGl0ZXIgPCAzMDA7IGl0ZXIrKykge1xuICAgIGxldCBjaGFuZ2VkID0gZmFsc2U7XG4gICAgZ2F0ZXMuZm9yRWFjaCgoZykgPT4ge1xuICAgICAgY29uc3QgYmFzZSA9IEJBU0VbZy50eXBlXTtcbiAgICAgIGlmIChiYXNlID09PSBcIkFORFwiIHx8IGJhc2UgPT09IFwiT1JcIikge1xuICAgICAgICBjb25zdCB1ID0gWy4uLm5ldyBTZXQoZy5pbnMpXTtcbiAgICAgICAgaWYgKHUubGVuZ3RoICE9PSBnLmlucy5sZW5ndGgpIHtcbiAgICAgICAgICBnLmlucyA9IHU7XG4gICAgICAgICAgY2hhbmdlZCA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGcuaW5zLmxlbmd0aCA9PT0gMSkge1xuICAgICAgICAgIGcudHlwZSA9IElOVkVSVElOR1tnLnR5cGVdID8gXCJOT1RcIiA6IFwiQlVGXCI7XG4gICAgICAgICAgY2hhbmdlZCA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBpZiAoYmFzZSA9PT0gXCJYT1JcIikge1xuICAgICAgICBjb25zdCBjbnQgPSB7fTtcbiAgICAgICAgZy5pbnMuZm9yRWFjaCgoeCkgPT4ge1xuICAgICAgICAgIGNudFt4XSA9IChjbnRbeF0gfHwgMCkgKyAxO1xuICAgICAgICB9KTtcbiAgICAgICAgY29uc3Qgb2RkID0gT2JqZWN0LmtleXMoY250KS5maWx0ZXIoKHgpID0+IGNudFt4XSAlIDIgPT09IDEpO1xuICAgICAgICBpZiAob2RkLmxlbmd0aCA+IDAgJiYgb2RkLmxlbmd0aCAhPT0gZy5pbnMubGVuZ3RoKSB7XG4gICAgICAgICAgZy5pbnMgPSBvZGQ7XG4gICAgICAgICAgY2hhbmdlZCA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGcuaW5zLmxlbmd0aCA9PT0gMSkge1xuICAgICAgICAgIGcudHlwZSA9IGcudHlwZSA9PT0gXCJYTk9SXCIgPyBcIk5PVFwiIDogXCJCVUZcIjtcbiAgICAgICAgICBjaGFuZ2VkID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0pO1xuICAgIGZvciAoY29uc3QgZyBvZiBnYXRlcy5zbGljZSgpKSB7XG4gICAgICBpZiAoZy50eXBlID09PSBcIkJVRlwiICYmICFpc091dC5oYXMoZy5vdXQpKSB7XG4gICAgICAgIHJlbmFtZShnLm91dCwgZy5pbnNbMF0pO1xuICAgICAgICBnYXRlcyA9IGdhdGVzLmZpbHRlcigoeCkgPT4geCAhPT0gZyk7XG4gICAgICAgIGNoYW5nZWQgPSB0cnVlO1xuICAgICAgfVxuICAgIH1cbiAgICB7XG4gICAgICBjb25zdCBkID0gZHJ2KCksIGYgPSBmYW5vdXQoKTtcbiAgICAgIGZvciAoY29uc3QgZyBvZiBnYXRlcy5zbGljZSgpKSB7XG4gICAgICAgIGlmIChnLnR5cGUgIT09IFwiTk9UXCIgfHwgIWxpdmUoZykpIGNvbnRpbnVlO1xuICAgICAgICBjb25zdCBpbm5lciA9IGRbZy5pbnNbMF1dO1xuICAgICAgICBpZiAoIWlubmVyIHx8ICFsaXZlKGlubmVyKSkgY29udGludWU7XG4gICAgICAgIGlmIChpbm5lci50eXBlID09PSBcIk5PVFwiKSB7XG4gICAgICAgICAgZy50eXBlID0gXCJCVUZcIjtcbiAgICAgICAgICBnLmlucyA9IFtpbm5lci5pbnNbMF1dO1xuICAgICAgICAgIGNoYW5nZWQgPSB0cnVlO1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICAgIGlmIChJTlZFUlNFW2lubmVyLnR5cGVdICYmICFpc091dC5oYXMoaW5uZXIub3V0KSAmJiBmW2lubmVyLm91dF0gPT09IDEpIHtcbiAgICAgICAgICBnLnR5cGUgPSBJTlZFUlNFW2lubmVyLnR5cGVdO1xuICAgICAgICAgIGcuaW5zID0gaW5uZXIuaW5zLnNsaWNlKCk7XG4gICAgICAgICAgZ2F0ZXMgPSBnYXRlcy5maWx0ZXIoKHgpID0+IHggIT09IGlubmVyKTtcbiAgICAgICAgICBjaGFuZ2VkID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICB7XG4gICAgICBjb25zdCBkID0gZHJ2KCksIGYgPSBmYW5vdXQoKTtcbiAgICAgIGZvciAoY29uc3QgZyBvZiBnYXRlcy5zbGljZSgpKSB7XG4gICAgICAgIGNvbnN0IGJhc2UgPSBCQVNFW2cudHlwZV07XG4gICAgICAgIGlmICghYmFzZSB8fCAhbGl2ZShnKSkgY29udGludWU7XG4gICAgICAgIGxldCBhZ2FpbiA9IHRydWU7XG4gICAgICAgIHdoaWxlIChhZ2Fpbikge1xuICAgICAgICAgIGFnYWluID0gZmFsc2U7XG4gICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBnLmlucy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgeCA9IGcuaW5zW2ldLCBpbm5lciA9IGRbeF07XG4gICAgICAgICAgICBpZiAoIWlubmVyIHx8ICFsaXZlKGlubmVyKSB8fCBpbm5lciA9PT0gZyB8fCBpbm5lci50eXBlICE9PSBiYXNlKSBjb250aW51ZTtcbiAgICAgICAgICAgIGlmIChpc091dC5oYXMoeCkgfHwgZlt4XSAhPT0gMSkgY29udGludWU7XG4gICAgICAgICAgICBjb25zdCBtZXJnZWQgPSBnLmlucy5zbGljZSgwLCBpKS5jb25jYXQoaW5uZXIuaW5zLCBnLmlucy5zbGljZShpICsgMSkpO1xuICAgICAgICAgICAgaWYgKG1lcmdlZC5sZW5ndGggPiBNQVhfR0FURV9GQU5JTikgY29udGludWU7XG4gICAgICAgICAgICBnLmlucyA9IG1lcmdlZDtcbiAgICAgICAgICAgIGdhdGVzID0gZ2F0ZXMuZmlsdGVyKCh5KSA9PiB5ICE9PSBpbm5lcik7XG4gICAgICAgICAgICBmW3hdID0gMDtcbiAgICAgICAgICAgIGNoYW5nZWQgPSB0cnVlO1xuICAgICAgICAgICAgYWdhaW4gPSB0cnVlO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHtcbiAgICAgIGNvbnN0IGQgPSBkcnYoKSwgZiA9IGZhbm91dCgpO1xuICAgICAgZm9yIChjb25zdCBnIG9mIGdhdGVzLnNsaWNlKCkpIHtcbiAgICAgICAgY29uc3QgYmFzZSA9IEJBU0VbZy50eXBlXTtcbiAgICAgICAgaWYgKGJhc2UgIT09IFwiQU5EXCIgJiYgYmFzZSAhPT0gXCJPUlwiIHx8ICFsaXZlKGcpKSBjb250aW51ZTtcbiAgICAgICAgY29uc3QgZHVhbCA9IGJhc2UgPT09IFwiQU5EXCIgPyBcIk9SXCIgOiBcIkFORFwiO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGcuaW5zLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgY29uc3QgeCA9IGcuaW5zW2ldLCBpbm5lciA9IGRbeF07XG4gICAgICAgICAgaWYgKCFpbm5lciB8fCAhbGl2ZShpbm5lcikgfHwgaW5uZXIudHlwZSAhPT0gZHVhbCB8fCBpc091dC5oYXMoeCkgfHwgZlt4XSAhPT0gMSkgY29udGludWU7XG4gICAgICAgICAgY29uc3Qgb3RoZXJzID0gZy5pbnMuZmlsdGVyKChfLCBrKSA9PiBrICE9PSBpKTtcbiAgICAgICAgICBpZiAoaW5uZXIuaW5zLnNvbWUoKHkpID0+IG90aGVycy5pbmNsdWRlcyh5KSkpIHtcbiAgICAgICAgICAgIGcuaW5zID0gb3RoZXJzO1xuICAgICAgICAgICAgZ2F0ZXMgPSBnYXRlcy5maWx0ZXIoKHkpID0+IHkgIT09IGlubmVyKTtcbiAgICAgICAgICAgIGNoYW5nZWQgPSB0cnVlO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHtcbiAgICAgIGNvbnN0IHNlZW4gPSAvKiBAX19QVVJFX18gKi8gbmV3IE1hcCgpO1xuICAgICAgZm9yIChjb25zdCBnIG9mIGdhdGVzLnNsaWNlKCkpIHtcbiAgICAgICAgaWYgKCFsaXZlKGcpKSBjb250aW51ZTtcbiAgICAgICAgY29uc3Qga2V5ID0gZy50eXBlICsgXCJ8XCIgKyBbLi4uZy5pbnNdLnNvcnQoKS5qb2luKFwiLFwiKTtcbiAgICAgICAgY29uc3QgcHJldiA9IHNlZW4uZ2V0KGtleSk7XG4gICAgICAgIGlmICghcHJldikge1xuICAgICAgICAgIHNlZW4uc2V0KGtleSwgZyk7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgICAgbGV0IGtlZXAgPSBwcmV2LCBkcm9wID0gZztcbiAgICAgICAgaWYgKGlzT3V0Lmhhcyhkcm9wLm91dCkpIHtcbiAgICAgICAgICBpZiAoaXNPdXQuaGFzKGtlZXAub3V0KSkgY29udGludWU7XG4gICAgICAgICAga2VlcCA9IGc7XG4gICAgICAgICAgZHJvcCA9IHByZXY7XG4gICAgICAgICAgc2Vlbi5zZXQoa2V5LCBrZWVwKTtcbiAgICAgICAgfVxuICAgICAgICByZW5hbWUoZHJvcC5vdXQsIGtlZXAub3V0KTtcbiAgICAgICAgZ2F0ZXMgPSBnYXRlcy5maWx0ZXIoKHkpID0+IHkgIT09IGRyb3ApO1xuICAgICAgICBjaGFuZ2VkID0gdHJ1ZTtcbiAgICAgIH1cbiAgICB9XG4gICAge1xuICAgICAgY29uc3QgZiA9IGZhbm91dCgpLCBuMCA9IGdhdGVzLmxlbmd0aDtcbiAgICAgIGdhdGVzID0gZ2F0ZXMuZmlsdGVyKChnKSA9PiBpc091dC5oYXMoZy5vdXQpIHx8IGZbZy5vdXRdKTtcbiAgICAgIGlmIChnYXRlcy5sZW5ndGggIT09IG4wKSBjaGFuZ2VkID0gdHJ1ZTtcbiAgICB9XG4gICAgaWYgKCFjaGFuZ2VkKSBicmVhaztcbiAgfVxuICByZXR1cm4gYXNzZW1ibGUoZ2F0ZXMsIGMuaW5wdXRzKTtcbn1cbmV4cG9ydCBmdW5jdGlvbiB2ZXJpZnlFcXVpdmFsZW50KGMsIGNpcmN1aXQsIGNvbnN0cywgYWxsKSB7XG4gIGNvbnN0cyA9IGNvbnN0cyB8fCB7fTtcbiAgY29uc3QgY2hlY2sgPSAoaW5zLCByZWYpID0+IHtcbiAgICBjb25zdCB2ID0gY2lyY3VpdCA/IGV2YWx1YXRlKGNpcmN1aXQsIGlucykgOiB7fTtcbiAgICByZXR1cm4gYy5vdXRwdXRzLmV2ZXJ5KChvKSA9PiAobyBpbiBjb25zdHMgPyBjb25zdHNbb10gOiB2W29dKSA9PT0gcmVmW29dKTtcbiAgfTtcbiAgaWYgKGFsbCkge1xuICAgIHJldHVybiBhbGwuZXZlcnkoKHJvdykgPT4ge1xuICAgICAgY29uc3QgaW5zID0ge307XG4gICAgICBjLmlucHV0cy5mb3JFYWNoKCh4KSA9PiB7XG4gICAgICAgIGluc1t4XSA9IHJvd1t4XTtcbiAgICAgIH0pO1xuICAgICAgcmV0dXJuIGNoZWNrKGlucywgcm93KTtcbiAgICB9KSA/IFwiZXhhY3RcIiA6IFwiRkFJTEVEXCI7XG4gIH1cbiAgbGV0IHNlZWQgPSAxMjM0NTY3O1xuICBjb25zdCBybmQgPSAoKSA9PiAoc2VlZCA9IE1hdGguaW11bChzZWVkLCAxNjY0NTI1KSArIDEwMTM5MDQyMjMgPj4+IDApIC8gNDI5NDk2NzI5NjtcbiAgZm9yIChsZXQgayA9IDA7IGsgPCA0MDk2OyBrKyspIHtcbiAgICBjb25zdCBpbnMgPSB7fTtcbiAgICBjLmlucHV0cy5mb3JFYWNoKCh4KSA9PiB7XG4gICAgICBpbnNbeF0gPSBybmQoKSA8IDAuNSA/IDAgOiAxO1xuICAgIH0pO1xuICAgIGlmICghY2hlY2soaW5zLCBldmFsdWF0ZShjLCBpbnMpKSkgcmV0dXJuIFwiRkFJTEVEXCI7XG4gIH1cbiAgcmV0dXJuIFwic2FtcGxlZFwiO1xufVxuZXhwb3J0IGZ1bmN0aW9uIHJlZHVjZUNpcmN1aXQoYywgYWxsLCBtZXRob2QpIHtcbiAgY29uc3QgY2FuZHMgPSBbXTtcbiAgY29uc3QgYWRkID0gKG0pID0+IHtcbiAgICBjb25zdCByID0gbSA9PT0gXCJzdHJ1Y3R1cmFsXCIgPyB7IGNpcmN1aXQ6IHJlZHVjZVN0cnVjdHVyYWwoYyksIGNvbnN0czoge30gfSA6IHN5bnRoZXNpemUoYywgYWxsLCBtKTtcbiAgICByLm1ldGhvZCA9IG07XG4gICAgci5hZnRlciA9IHIuY2lyY3VpdCA/IGNpcmN1aXRDb3N0KHIuY2lyY3VpdCkgOiB7IGdhdGVzOiAwLCBwaW5zOiAwIH07XG4gICAgY2FuZHMucHVzaChyKTtcbiAgfTtcbiAgaWYgKG1ldGhvZCA9PT0gXCJiZXN0XCIpIHtcbiAgICBhZGQoXCJzdHJ1Y3R1cmFsXCIpO1xuICAgIGlmIChhbGwpIFtcInNvcFwiLCBcInBvc1wiLCBcIm5hbmRcIiwgXCJub3JcIl0uZm9yRWFjaChhZGQpO1xuICB9IGVsc2UgYWRkKG1ldGhvZCk7XG4gIGNhbmRzLnNvcnQoKGEsIGIpID0+IGEuYWZ0ZXIuZ2F0ZXMgLSBiLmFmdGVyLmdhdGVzIHx8IGEuYWZ0ZXIucGlucyAtIGIuYWZ0ZXIucGlucyk7XG4gIGNvbnN0IGJlc3QgPSBjYW5kc1swXTtcbiAgYmVzdC5iZWZvcmUgPSBjaXJjdWl0Q29zdChjKTtcbiAgYmVzdC52ZXJpZmllZCA9IHZlcmlmeUVxdWl2YWxlbnQoYywgYmVzdC5jaXJjdWl0LCBiZXN0LmNvbnN0cywgYWxsKTtcbiAgcmV0dXJuIGJlc3Q7XG59XG5cbiIsICIvLyBwYWNrYWdlcy9sb2dpYy1ncmFwaC9zcmMvdWkvZG9tLmpzXG5pbXBvcnQgKiBhcyBpbXBvcnRfb2JzaWRpYW40IGZyb20gXCJvYnNpZGlhblwiO1xuZXhwb3J0IGNvbnN0IFNWR05TID0gXCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiO1xuZXhwb3J0IGZ1bmN0aW9uIGgodGFnLCBjbHMsIHBhcmVudCwgdGV4dCkge1xuICBjb25zdCBlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCh0YWcpO1xuICBpZiAoY2xzKSBlLmNsYXNzTmFtZSA9IGNscztcbiAgaWYgKHRleHQgIT09IHZvaWQgMCkgZS50ZXh0Q29udGVudCA9IHRleHQ7XG4gIGlmIChwYXJlbnQpIHBhcmVudC5hcHBlbmRDaGlsZChlKTtcbiAgcmV0dXJuIGU7XG59XG5leHBvcnQgZnVuY3Rpb24gcyh0YWcsIGF0dHJzLCBwYXJlbnQsIHRleHQpIHtcbiAgY29uc3QgZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnROUyhTVkdOUywgdGFnKTtcbiAgZm9yIChjb25zdCBrIGluIGF0dHJzKSBlLnNldEF0dHJpYnV0ZShrLCBhdHRyc1trXSk7XG4gIGlmICh0ZXh0ICE9PSB2b2lkIDApIGUudGV4dENvbnRlbnQgPSB0ZXh0O1xuICBpZiAocGFyZW50KSBwYXJlbnQuYXBwZW5kQ2hpbGQoZSk7XG4gIHJldHVybiBlO1xufVxuZXhwb3J0IGZ1bmN0aW9uIGNsaWNrYWJsZShlbCwgb25BY3RpdmF0ZSkge1xuICBlbC5zZXRBdHRyaWJ1dGUoXCJ0YWJpbmRleFwiLCBcIjBcIik7XG4gIGVsLnNldEF0dHJpYnV0ZShcInJvbGVcIiwgXCJidXR0b25cIik7XG4gIGVsLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCBvbkFjdGl2YXRlKTtcbiAgZWwuYWRkRXZlbnRMaXN0ZW5lcihcImtleWRvd25cIiwgKGV2dCkgPT4ge1xuICAgIGlmIChldnQua2V5ID09PSBcIkVudGVyXCIgfHwgZXZ0LmtleSA9PT0gXCIgXCIpIHtcbiAgICAgIGV2dC5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgb25BY3RpdmF0ZShldnQpO1xuICAgIH1cbiAgfSk7XG4gIHJldHVybiBlbDtcbn1cbmV4cG9ydCBjb25zdCBsYXRlciA9IChmbikgPT4gdHlwZW9mIHJlcXVlc3RBbmltYXRpb25GcmFtZSA9PT0gXCJmdW5jdGlvblwiID8gcmVxdWVzdEFuaW1hdGlvbkZyYW1lKGZuKSA6IHNldFRpbWVvdXQoZm4sIDApO1xuZXhwb3J0IGZ1bmN0aW9uIG1hdGgobGF0ZXgsIHBhcmVudCkge1xuICBpZiAodHlwZW9mIGltcG9ydF9vYnNpZGlhbjQucmVuZGVyTWF0aCA9PT0gXCJmdW5jdGlvblwiKSBwYXJlbnQuYXBwZW5kQ2hpbGQoKDAsIGltcG9ydF9vYnNpZGlhbjQucmVuZGVyTWF0aCkobGF0ZXgsIGZhbHNlKSk7XG4gIGVsc2UgcGFyZW50LmFwcGVuZENoaWxkKGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKGxhdGV4KSk7XG59XG5cbiIsICIvLyBwYWNrYWdlcy9sb2dpYy1ncmFwaC9zcmMvdWkvY29weS5qc1xuaW1wb3J0IHsgTm90aWNlIH0gZnJvbSBcIm9ic2lkaWFuXCI7XG5pbXBvcnQgeyBubSB9IGZyb20gXCIuLi9jb3JlL2xhdGV4LmpzXCI7XG5pbXBvcnQgKiBhcyBpbXBvcnRfb2JzaWRpYW4zIGZyb20gXCJvYnNpZGlhblwiO1xuZXhwb3J0IGZ1bmN0aW9uIHRvTGF0ZXhTb3VyY2UoZXhwcnMpIHtcbiAgcmV0dXJuIGV4cHJzLm1hcCgoZSkgPT4ge1xuICAgIGNvbnN0IGxpbmVzID0gW107XG4gICAgaWYgKGUucmF3ICYmIGUucmF3ICE9PSBlLm1pbikgbGluZXMucHVzaChgJCQke25tKGUubmFtZSl9ID0gJHtlLnJhd30kJGApO1xuICAgIGlmIChlLm1pbiAhPT0gbnVsbCkgbGluZXMucHVzaChgJCQke25tKGUubmFtZSl9ID0gJHtlLm1pbn0kJGApO1xuICAgIHJldHVybiBsaW5lcy5qb2luKFwiXFxuXCIpO1xuICB9KS5qb2luKFwiXFxuXCIpO1xufVxuZXhwb3J0IGZ1bmN0aW9uIHRvTWVybWFpZChjKSB7XG4gIGNvbnN0IGlkID0ge307XG4gIGMuaW5wdXRzLmZvckVhY2goKG4pID0+IHtcbiAgICBpZFtuXSA9IFwiaW5fXCIgKyBuO1xuICB9KTtcbiAgYy5vcmRlci5mb3JFYWNoKChnLCBpKSA9PiB7XG4gICAgaWRbZy5vdXRdID0gXCJnXCIgKyAoaSArIDEpO1xuICB9KTtcbiAgY29uc3Qgb3V0ID0gW1wiZmxvd2NoYXJ0IExSXCJdO1xuICBjLmlucHV0cy5mb3JFYWNoKChuKSA9PiBvdXQucHVzaChgICAke2lkW25dfShbJHtufV0pYCkpO1xuICBjLm9yZGVyLmZvckVhY2goKGcpID0+IG91dC5wdXNoKGAgICR7aWRbZy5vdXRdfVske2cudHlwZX1dYCkpO1xuICBjLm91dHB1dHMuZm9yRWFjaCgobikgPT4gb3V0LnB1c2goYCAgb3V0XyR7bn0oWyR7bn1dKWApKTtcbiAgYy5vcmRlci5mb3JFYWNoKChnKSA9PiBnLmlucy5mb3JFYWNoKChuKSA9PiBvdXQucHVzaChjLmRyaXZlcltuXSA/IGAgICR7aWRbbl19IC0tPnwke259fCAke2lkW2cub3V0XX1gIDogYCAgJHtpZFtuXX0gLS0+ICR7aWRbZy5vdXRdfWApKSk7XG4gIGMub3V0cHV0cy5mb3JFYWNoKChuKSA9PiBvdXQucHVzaChgICAke2lkW25dfSAtLT4gb3V0XyR7bn1gKSk7XG4gIHJldHVybiBcImBgYG1lcm1haWRcXG5cIiArIG91dC5qb2luKFwiXFxuXCIpICsgXCJcXG5gYGBcIjtcbn1cbmV4cG9ydCBmdW5jdGlvbiBjb3B5KHRleHQpIHtcbiAgY29uc3QgZG9uZSA9ICgpID0+IG5ldyBpbXBvcnRfb2JzaWRpYW4zLk5vdGljZShcIkNvcGllZCB0byBjbGlwYm9hcmRcIik7XG4gIGlmICh0eXBlb2YgbmF2aWdhdG9yICE9PSBcInVuZGVmaW5lZFwiICYmIG5hdmlnYXRvci5jbGlwYm9hcmQpIG5hdmlnYXRvci5jbGlwYm9hcmQud3JpdGVUZXh0KHRleHQpLnRoZW4oZG9uZSk7XG4gIGVsc2UgZG9uZSgpO1xufVxuXG4iLCAiLy8gcGFja2FnZXMvbG9naWMtZ3JhcGgvc3JjL3VpL2hlbHAuanNcbmltcG9ydCB7IGggfSBmcm9tIFwiLi9kb20uanNcIjtcbmltcG9ydCB7IGNvcHkgfSBmcm9tIFwiLi9jb3B5LmpzXCI7XG5pbXBvcnQgeyByZW5kZXJCbG9jayB9IGZyb20gXCIuL2Jsb2NrLmpzXCI7XG5leHBvcnQgY29uc3QgSEFMRl9BRERFUiA9IFwiKGEsYikgWE9SIChzdW0pXFxuKGEsYikgQU5EIChjYXJyeSlcIjtcbmV4cG9ydCBjb25zdCBIRUxQID0gW1xuICB7IHRpdGxlOiBcIkdhdGVzXCIsIG5vdGU6IFwiT25lIGdhdGUgcGVyIGxpbmU6IChpbnB1dHMpIEdBVEUgKG91dHB1dCkuIFVwIHRvIDYgaW5wdXRzIHBlciBnYXRlLlwiLCBpdGVtczogW1xuICAgIFtcIkFORFwiLCBcIk91dHB1dCBpcyAxIG9ubHkgd2hlbiBldmVyeSBpbnB1dCBpcyAxLlwiLCBcIihhLGIpIEFORCAoeSlcIl0sXG4gICAgW1wiT1JcIiwgXCJPdXRwdXQgaXMgMSB3aGVuIGF0IGxlYXN0IG9uZSBpbnB1dCBpcyAxLlwiLCBcIihhLGIpIE9SICh5KVwiXSxcbiAgICBbXCJOQU5EXCIsIFwiQU5EIGZvbGxvd2VkIGJ5IE5PVC5cIiwgXCIoYSxiKSBOQU5EICh5KVwiXSxcbiAgICBbXCJOT1JcIiwgXCJPUiBmb2xsb3dlZCBieSBOT1QuXCIsIFwiKGEsYikgTk9SICh5KVwiXSxcbiAgICBbXCJYT1JcIiwgXCJPdXRwdXQgaXMgMSB3aGVuIGFuIG9kZCBudW1iZXIgb2YgaW5wdXRzIGFyZSAxLlwiLCBcIihhLGIpIFhPUiAoeSlcIl0sXG4gICAgW1wiWE5PUlwiLCBcIk91dHB1dCBpcyAxIHdoZW4gYW4gZXZlbiBudW1iZXIgb2YgaW5wdXRzIGFyZSAxLlwiLCBcIihhLGIpIFhOT1IgKHkpXCJdLFxuICAgIFtcIk5PVFwiLCBcIkludmVydHMgaXRzIHNpbmdsZSBpbnB1dC5cIiwgXCIoYSkgTk9UICh5KVwiXSxcbiAgICBbXCJCVUZcIiwgXCJDb3BpZXMgaXRzIHNpbmdsZSBpbnB1dCAoYSBidWZmZXIpLlwiLCBcIihhKSBCVUYgKHkpXCJdXG4gIF0gfSxcbiAgeyB0aXRsZTogXCJXcml0aW5nIGNpcmN1aXRzXCIsIGl0ZW1zOiBbXG4gICAgW1wiU2V2ZXJhbCBnYXRlc1wiLCBcIlNpZ25hbHMgbm8gZ2F0ZSBkcml2ZXMgYXJlIHRoZSBpbnB1dHMuIFNpZ25hbHMgbm90aGluZyB1c2VzIGFyZSB0aGUgb3V0cHV0cy4gTmFtZXMgbWF5IGNvbnRhaW4gbGV0dGVycywgZGlnaXRzIGFuZCBfLlwiLCBIQUxGX0FEREVSXSxcbiAgICBbXCJXaWRlIGdhdGVzXCIsIFwiR2F0ZXMgY2FuIHRha2UgMiB0byA2IGlucHV0cy5cIiwgXCIoYSxiLGMsZCkgQU5EICh5KVwiXSxcbiAgICBbXCJDb21tZW50c1wiLCBcIkV2ZXJ5dGhpbmcgYWZ0ZXIgIyBvciAvLyBpcyBpZ25vcmVkLlwiLCBcIihhLGIpIEFORCAoeSkgICMgYSBjb21tZW50XFxuLy8gYW5vdGhlciBjb21tZW50XCJdXG4gIF0gfSxcbiAgeyB0aXRsZTogXCJEaXJlY3RpdmVzIChmaXJzdCBsaW5lcyBvZiBhIGJsb2NrKVwiLCBpdGVtczogW1xuICAgIFtcIkBoZWxwXCIsIFwiU2hvd3MgdGhpcyByZWZlcmVuY2UgYWJvdmUgdGhlIGNpcmN1aXQuXCIsIFwiQGhlbHBcXG4oYSxiKSBBTkQgKHkpXCJdLFxuICAgIFtcIkBoaWRlIC8gQHNob3dcIiwgXCJIaWRlIG9yIHNob3c6IHRhYmxlLCBleHByLCBkaWFncmFtLCBrbWFwLCB0aW1pbmcuXCIsIFwiQGhpZGUgdGFibGVcXG5Ac2hvdyBrbWFwXFxuKGEsYixjKSBPUiAoeSlcIl0sXG4gICAgW1wiQHNpbXBsaWZ5IC8gQHJlZHVjZVwiLCBcIkRyYXdzIGEgcmVkdWNlZCBjaXJjdWl0IGFuZCBjaGVja3MgaXQgaXMgZXF1aXZhbGVudC4gTWV0aG9kczogc3RydWN0dXJhbCwgYmVzdCwgc29wLCBwb3MsIG5hbmQsIG5vciwgb2ZmLlwiLCBcIkBzaW1wbGlmeSBzdHJ1Y3R1cmFsXFxuKGEpIE5PVCAobjEpXFxuKG4xKSBOT1QgKG4yKVxcbihuMixiKSBBTkQgKHkpXCJdLFxuICAgIFtcIkBzaW1wbGlmeSBuYW5kXCIsIFwiUmVidWlsZHMgdGhlIGZ1bmN0aW9uIGFzIE5BTkQtTkFORCBmcm9tIHRoZSBtaW5pbWFsIGNvdmVyIChjYW4gYmUgbGFyZ2VyIHRoYW4gdGhlIG9yaWdpbmFsKS5cIiwgXCJAc2ltcGxpZnkgbmFuZFxcbihhLGIpIEFORCAoeClcXG4oYixjKSBBTkQgKHkxKVxcbih4LHkxKSBPUiAoeSlcIl0sXG4gICAgW1wiQGJ1YmJsZXNcIiwgXCJCdWJibGUgcHVzaGluZzogZ2F0ZXMgYXJlIGRyYXduIHdpdGggdGhlaXIgRGUgTW9yZ2FuIHN5bWJvbCBzbyBidWJibGVzIG1hdGNoLiBDbGljayBhIGdhdGUgdG8gZmxpcCBpdCBieSBoYW5kLlwiLCBcIkBidWJibGVzXFxuKGEsYikgTkFORCAocClcXG4oYyxkKSBOQU5EIChxKVxcbihwLHEpIE5BTkQgKHkpXCJdLFxuICAgIFtcIkBjb21wYWN0XCIsIFwiTWVyZ2VzIHRydXRoLXRhYmxlIHJvd3MgdGhhdCBkbyBub3QgZGVwZW5kIG9uIHNvbWUgaW5wdXRzIChzaG93biBhcyBYKS5cIiwgXCJAY29tcGFjdFxcbihhLGIpIEFORCAoeClcXG4oeCxjKSBPUiAoeSlcIl0sXG4gICAgW1wiQGRlbGF5XCIsICdTZWNvbmRzIG9mIGRlbGF5IHBlciBnYXRlICgwIHRvIDMwKSwgXCJyYW5kb21cIiAoMCB0byA1IHMpLCBvciBvZmYuJywgXCJAZGVsYXkgMC41XFxuKGEsYikgQU5EIChjKVxcbihjKSBOT1QgKHkpXCJdLFxuICAgIFtcIkB0aW1pbmctZ3JhcGhcIiwgXCJEZWxheXMgb24sIHdpdGggdGhlIHRpbWluZyBncmFwaCAod2F2ZWZvcm1zKS5cIiwgXCJAdGltaW5nLWdyYXBoXFxuQGRlbGF5IDAuNVxcbihhLGIpIEFORCAoYylcXG4oYyxiKSBYT1IgKHkpXCJdLFxuICAgIFtcIkB0aW1pbmctYW5pbWF0aW9uXCIsIFwiRGVsYXlzIG9uLCB3aXRoIGJpdHMgdHJhdmVsbGluZyBhbG9uZyB0aGUgd2lyZXMgYW5kIGdhdGUgbGFtcHMgKGdyZWVuID0gMSwgcmVkL29yYW5nZSA9IDApLlwiLCBcIkB0aW1pbmctYW5pbWF0aW9uXFxuQGRlbGF5IDFcXG4oYSxiKSBBTkQgKGMpXFxuKGMsYikgWE9SICh5KVwiXSxcbiAgICBbXCJAdGltaW5nLWJvdGhcIiwgXCJHcmFwaCBhbmQgYW5pbWF0aW9uIHRvZ2V0aGVyLlwiLCBcIkB0aW1pbmctYm90aFxcbkBkZWxheSAxXFxuKGEsYikgQU5EIChjKVxcbihjLGIpIFhPUiAoeSlcIl1cbiAgXSB9LFxuICB7IHRpdGxlOiBcIlRoaW5ncyB5b3UgY2FuIGNsaWNrXCIsIGl0ZW1zOiBbXG4gICAgW1wiSW5wdXQgYm94ZXNcIiwgXCJDbGljayBhIGJveCBvbiB0aGUgbGVmdCBvZiB0aGUgZGlhZ3JhbSB0byBmbGlwIHRoYXQgaW5wdXQgYmV0d2VlbiAwIGFuZCAxLlwiLCBudWxsXSxcbiAgICBbXCJUcnV0aC10YWJsZSByb3dzXCIsIFwiQ2xpY2sgYSByb3cgdG8gc2V0IHRoZSBpbnB1dHMgdG8gdGhhdCByb3cuIFRoZSBhY3RpdmUgcm93IGlzIGhpZ2hsaWdodGVkLlwiLCBudWxsXSxcbiAgICBbXCJLYXJuYXVnaCBjZWxsc1wiLCBcIkNsaWNrIGEgY2VsbCB0byBzZXQgdGhlIGlucHV0cyB0byB0aGF0IGNlbGwuIENvbG91cmVkIG91dGxpbmVzIGFyZSB0aGUgZ3JvdXBzOyBvdXRsaW5lcyB0aGF0IHN0b3AgYXQgYW4gZWRnZSB3cmFwIGFyb3VuZC5cIiwgbnVsbF0sXG4gICAgW1wiR2F0ZXMgaW4gQGJ1YmJsZXMgdmlld1wiLCAnQ2xpY2sgYSBnYXRlIHRvIGZsaXAgaXQgYmV0d2VlbiBpdHMgdHdvIERlIE1vcmdhbiBzeW1ib2xzLiBcInJlc2V0XCIgcmVzdG9yZXMgdGhlIGF1dG9tYXRpYyBsYXlvdXQuJywgbnVsbF0sXG4gICAgW1wiZXhwb3J0XCIsIFwiT24gZXZlcnkgZmlndXJlOiBzYXZlIGFzIFBORyBvciBTVkcgaW4geW91ciB2YXVsdCwgb3IgY29weSB0aGUgUE5HLlwiLCBudWxsXSxcbiAgICBbXCJDb3B5IGJ1dHRvbnNcIiwgXCJDb3B5IHRoZSB0cnV0aCB0YWJsZSAoTWFya2Rvd24pLCB0aGUgZXhwcmVzc2lvbnMgKExhVGVYKSBvciB0aGUgY2lyY3VpdCAoTWVybWFpZCkuXCIsIG51bGxdXG4gIF0gfSxcbiAgeyB0aXRsZTogXCJDb21tYW5kcyAoQ3RybC9DbWQgKyBQKVwiLCBpdGVtczogW1xuICAgIFtcIkxvZ2ljIEdyYXBoOiBJbnNlcnQgbG9naWMgYmxvY2tcIiwgXCJJbnNlcnRzIGFuIGV4YW1wbGUgYmxvY2suXCIsIG51bGxdLFxuICAgIFtcIkxvZ2ljIEdyYXBoOiBJbnNlcnQgbG9naWMgYmxvY2sgZnJvbSB0ZW1wbGF0ZVxcdTIwMjZcIiwgXCJIYWxmIGFkZGVyLCBmdWxsIGFkZGVyLCBtdWx0aXBsZXhlciwgZGVjb2RlciwgbWFqb3JpdHksIHBhcml0eSwgWE9SIGZyb20gTkFORC5cIiwgbnVsbF0sXG4gICAgW1wiTG9naWMgR3JhcGg6IFdyYXAgc2VsZWN0aW9uIGluIGxvZ2ljIGJsb2NrXCIsIFwiVHVybnMgdGhlIHNlbGVjdGVkIHRleHQgaW50byBhIGJsb2NrLlwiLCBudWxsXSxcbiAgICBbXCJMb2dpYyBHcmFwaDogSW5zZXJ0IGdhdGUgbGluZSAvIGRpcmVjdGl2ZVwiLCBcIk9uZSBjb21tYW5kIGZvciBlYWNoIGdhdGUgdHlwZSBhbmQgdGhlIGNvbW1vbiBkaXJlY3RpdmVzLlwiLCBudWxsXSxcbiAgICBbXCJJbWFnZSBJbXBvcnQgZXh0ZW5zaW9uXCIsICdPcHRpb25hbCBleHRlbnNpb246IFwiSW1wb3J0IGNpcmN1aXQgZnJvbSBpbWFnZVwiLicsIG51bGxdXG4gIF0gfSxcbiAgeyB0aXRsZTogXCJTZXR0aW5nc1wiLCBpdGVtczogW1xuICAgIFtcIkxpbWl0c1wiLCBcIk1heCBpbnB1dHMgKHVwIHRvIDMyKSBhbmQgbWF4IGdhdGVzICh1cCB0byAyNTYpLiBUcnV0aCB0YWJsZXMsIEthcm5hdWdoIG1hcHMgYW5kIHNpbXBsaWZpY2F0aW9uIHdvcmsgdXAgdG8gMTIgaW5wdXRzLlwiLCBudWxsXSxcbiAgICBbXCJEaXNwbGF5XCIsIFwiU2hvdyB0YWJsZSAvIGV4cHJlc3Npb25zIC8gS2FybmF1Z2ggbWFwcyBieSBkZWZhdWx0LCBjb21wYWN0IHRhYmxlLCBidWJibGUgcHVzaGluZy5cIiwgbnVsbF0sXG4gICAgW1wiVGltaW5nXCIsIFwiR2F0ZSBkZWxheSBhbmQgdGhlIGRlZmF1bHQgdGltaW5nIHZpZXcgKGdyYXBoLCBhbmltYXRpb24gb3IgYm90aCkuXCIsIG51bGxdLFxuICAgIFtcIkdyYXBoaWMgdmFsdWVzXCIsIFwiSG9yaXpvbnRhbCBzcGFjaW5nIGluIHB4IG9yICUgb2YgdGhlIHBhZ2Ugd2lkdGgsIHZlcnRpY2FsIHNwYWNpbmcgaW4gcHguXCIsIG51bGxdLFxuICAgIFtcIkV4cGVyaW1lbnRhbFwiLCBcIkFsd2F5cyBkcmF3IGEgcmVkdWNlZCBjaXJjdWl0LCBhbmQgY2hvb3NlIHRoZSBtZXRob2QuXCIsIG51bGxdXG4gIF0gfVxuXTtcbmV4cG9ydCBmdW5jdGlvbiByZW5kZXJIZWxwKHBhcmVudCwgcGx1Z2luKSB7XG4gIGNvbnN0IHpvbmUgPSBoKFwiZGl2XCIsIFwibGctaGVscFwiLCBwYXJlbnQpO1xuICBoKFwiZGl2XCIsIFwibGctaGVscC10aXRsZVwiLCB6b25lLCBcIkxvZ2ljIEdyYXBoIHJlZmVyZW5jZVwiKTtcbiAgSEVMUC5mb3JFYWNoKChzZWMpID0+IHtcbiAgICBjb25zdCBib3ggPSBoKFwiZGl2XCIsIFwibGctaGVscC1zZWNcIiwgem9uZSk7XG4gICAgaChcImRpdlwiLCBcImxnLXRpdGxlXCIsIGJveCwgc2VjLnRpdGxlKTtcbiAgICBpZiAoc2VjLm5vdGUpIGgoXCJkaXZcIiwgXCJsZy1ub3RlXCIsIGJveCwgc2VjLm5vdGUpO1xuICAgIHNlYy5pdGVtcy5mb3JFYWNoKChbbmFtZSwgZGVzYywgZXhhbXBsZV0pID0+IHtcbiAgICAgIGlmICghZXhhbXBsZSkge1xuICAgICAgICBjb25zdCByb3cgPSBoKFwiZGl2XCIsIFwibGctaGVscC1yb3dcIiwgYm94KTtcbiAgICAgICAgaChcImJcIiwgXCJcIiwgcm93LCBuYW1lKTtcbiAgICAgICAgaChcInNwYW5cIiwgXCJcIiwgcm93LCBcIiAtIFwiICsgZGVzYyk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIGNvbnN0IGRldCA9IGgoXCJkZXRhaWxzXCIsIFwibGctaGVscC1pdGVtXCIsIGJveCk7XG4gICAgICBjb25zdCBzdW0gPSBoKFwic3VtbWFyeVwiLCBcIlwiLCBkZXQpO1xuICAgICAgaChcImJcIiwgXCJcIiwgc3VtLCBuYW1lKTtcbiAgICAgIGgoXCJzcGFuXCIsIFwiXCIsIHN1bSwgXCIgLSBcIiArIGRlc2MpO1xuICAgICAgbGV0IGRvbmUgPSBmYWxzZTtcbiAgICAgIGRldC5hZGRFdmVudExpc3RlbmVyKFwidG9nZ2xlXCIsICgpID0+IHtcbiAgICAgICAgaWYgKCFkZXQub3BlbiB8fCBkb25lKSByZXR1cm47XG4gICAgICAgIGRvbmUgPSB0cnVlO1xuICAgICAgICBoKFwicHJlXCIsIFwibGctaGVscC1jb2RlXCIsIGRldCwgZXhhbXBsZSk7XG4gICAgICAgIGgoXCJidXR0b25cIiwgXCJsZy1zbWFsbFwiLCBkZXQsIFwiY29weSBleGFtcGxlXCIpLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKSA9PiBjb3B5KFwiYGBgbG9naWNcXG5cIiArIGV4YW1wbGUgKyBcIlxcbmBgYFwiKSk7XG4gICAgICAgIHJlbmRlckJsb2NrKGV4YW1wbGUsIGgoXCJkaXZcIiwgXCJsZy1oZWxwLWxpdmVcIiwgZGV0KSwgcGx1Z2luKTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9KTtcbn1cblxuIiwgIi8vIHBhY2thZ2VzL2xvZ2ljLWdyYXBoL3NyYy9jb3JlL2J1YmJsZXMuanNcbmltcG9ydCB7IEdBVEVTIH0gZnJvbSBcIi4vZ2F0ZXMuanNcIjtcbmV4cG9ydCBjb25zdCBEVUFMX1NIQVBFID0geyBBTkQ6IFwiT1JcIiwgT1I6IFwiQU5EXCIsIEJVRjogXCJCVUZcIiwgWE9SOiBcIlhPUlwiIH07XG5leHBvcnQgY29uc3QgYmFzZVJlcCA9IChnKSA9PiB7XG4gIGNvbnN0IHNwID0gR0FURVNbZy50eXBlXTtcbiAgcmV0dXJuIHsgc2hhcGU6IHNwLnNoYXBlLCBvdXQ6ICtzcC5pbnYsIGluczogZy5pbnMubWFwKCgpID0+IDApLCBmaXhlZDogc3Auc2hhcGUgPT09IFwiWE9SXCIgfTtcbn07XG5leHBvcnQgY29uc3QgZmxpcFJlcCA9IChyKSA9PiB7XG4gIHIuc2hhcGUgPSBEVUFMX1NIQVBFW3Iuc2hhcGVdO1xuICByLm91dCBePSAxO1xuICByLmlucyA9IHIuaW5zLm1hcCgoYikgPT4gYiBeIDEpO1xufTtcbmV4cG9ydCBmdW5jdGlvbiBidWJibGVGb3JtcyhjLCBmbGlwcykge1xuICBjb25zdCByZXBzID0gLyogQF9fUFVSRV9fICovIG5ldyBNYXAoKTtcbiAgYy5nYXRlcy5mb3JFYWNoKChnKSA9PiByZXBzLnNldChnLCBiYXNlUmVwKGcpKSk7XG4gIGNvbnN0IGNvbnMgPSB7fTtcbiAgYy5nYXRlcy5mb3JFYWNoKChnKSA9PiBnLmlucy5mb3JFYWNoKChuLCBpKSA9PiB7XG4gICAgKGNvbnNbbl0gPSBjb25zW25dIHx8IFtdKS5wdXNoKFtnLCBpXSk7XG4gIH0pKTtcbiAgZm9yIChsZXQgayA9IGMub3JkZXIubGVuZ3RoIC0gMTsgayA+PSAwOyBrLS0pIHtcbiAgICBjb25zdCBnID0gYy5vcmRlcltrXSwgciA9IHJlcHMuZ2V0KGcpO1xuICAgIGlmIChyLmZpeGVkKSBjb250aW51ZTtcbiAgICBjb25zdCBsaXN0ID0gY29uc1tnLm91dF0gfHwgW107XG4gICAgbGV0IG9uZXMgPSAwO1xuICAgIGxpc3QuZm9yRWFjaCgoW2NnLCBpXSkgPT4ge1xuICAgICAgb25lcyArPSByZXBzLmdldChjZykuaW5zW2ldO1xuICAgIH0pO1xuICAgIGNvbnN0IHdhbnQgPSBsaXN0Lmxlbmd0aCAmJiBvbmVzICogMiA+IGxpc3QubGVuZ3RoID8gMSA6IDA7XG4gICAgaWYgKHIub3V0ICE9PSB3YW50KSBmbGlwUmVwKHIpO1xuICB9XG4gIGlmIChmbGlwcykgZmxpcHMuZm9yRWFjaCgoZykgPT4ge1xuICAgIGNvbnN0IHIgPSByZXBzLmdldChnKTtcbiAgICBpZiAociAmJiAhci5maXhlZCkgZmxpcFJlcChyKTtcbiAgfSk7XG4gIHJldHVybiByZXBzO1xufVxuZXhwb3J0IGZ1bmN0aW9uIG1hdGNoZWRCdWJibGVOZXRzKGMsIHJlcHMpIHtcbiAgY29uc3QgbWF0Y2hlZCA9IC8qIEBfX1BVUkVfXyAqLyBuZXcgU2V0KCk7XG4gIGMuZ2F0ZXMuZm9yRWFjaCgoZCkgPT4ge1xuICAgIGlmICghcmVwcy5nZXQoZCkub3V0KSByZXR1cm47XG4gICAgbGV0IG4gPSAwLCBvayA9IHRydWU7XG4gICAgYy5nYXRlcy5mb3JFYWNoKChnKSA9PiBnLmlucy5mb3JFYWNoKCh4LCBpKSA9PiB7XG4gICAgICBpZiAoeCAhPT0gZC5vdXQpIHJldHVybjtcbiAgICAgIG4rKztcbiAgICAgIGlmICghcmVwcy5nZXQoZykuaW5zW2ldKSBvayA9IGZhbHNlO1xuICAgIH0pKTtcbiAgICBpZiAobiAmJiBvaykgbWF0Y2hlZC5hZGQoZC5vdXQpO1xuICB9KTtcbiAgcmV0dXJuIG1hdGNoZWQ7XG59XG5cbiIsICIvLyBwYWNrYWdlcy9sb2dpYy1ncmFwaC9zcmMvdWkvbGF5b3V0LmpzXG5pbXBvcnQgeyBjbGFtcCB9IGZyb20gXCIuLi9jb3JlL2NvbnN0YW50cy5qc1wiO1xuXG5leHBvcnQgY29uc3QgTEVGVCA9IDkwO1xuZXhwb3J0IGNvbnN0IEdBVEVfVyA9IDY0O1xuZXhwb3J0IGNvbnN0IFRPUCA9IDM0O1xuZXhwb3J0IGNvbnN0IEJVQkJMRV9SID0gNS41O1xuZXhwb3J0IGNvbnN0IEFOSU1fTVMgPSA0NTA7XG5cbmV4cG9ydCBmdW5jdGlvbiBnYXRlUGF0aChzaGFwZSwgSCkge1xuICBjb25zdCByID0gSCAvIDI7XG4gIHN3aXRjaCAoc2hhcGUpIHtcbiAgICBjYXNlIFwiQU5EXCI6IHJldHVybiBgTTAsMCBIJHs1MiAtIHJ9IEEke3J9LCR7cn0gMCAwIDEgJHs1MiAtIHJ9LCR7SH0gSDAgWmA7XG4gICAgY2FzZSBcIk9SXCI6XG4gICAgY2FzZSBcIlhPUlwiOiByZXR1cm4gYE0wLDAgUTMyLDAgNTIsJHtyfSBRMzIsJHtIfSAwLCR7SH0gUTE0LCR7cn0gMCwwIFpgO1xuICAgIGRlZmF1bHQ6IHJldHVybiBgTTAsMCBMNTIsJHtyfSBMMCwke0h9IFpgO1xuICB9XG59XG5cbmV4cG9ydCBjb25zdCBDSF9GSVJTVCA9IDE4O1xuZXhwb3J0IGNvbnN0IENIX1NURVAgPSA2O1xuZXhwb3J0IGNvbnN0IENIX01BUkdJTiA9IDE0O1xuZXhwb3J0IGNvbnN0IGxhbmVZID0gKGxhbmUpID0+IDYgKyA2ICogbGFuZTtcbmV4cG9ydCBjb25zdCBjaGFubmVsTmVlZCA9ICh0cmFja3MpID0+IENIX0ZJUlNUICsgQ0hfU1RFUCAqIE1hdGgubWF4KDAsIHRyYWNrcyAtIDEpICsgQ0hfTUFSR0lOO1xuXG5leHBvcnQgZnVuY3Rpb24gbGF5b3V0KGMsIGdlbykge1xuICAvLyAuLi4gKExlYXZlIHRoaXMgZXhhY3Qgc2FtZSwgbm8gY2hhbmdlcyBuZWVkZWQgaGVyZSlcbiAgY29uc3QgU1AgPSA0MCArIGdlby52Z2FwLCBHQVAgPSBnZW8udmdhcCwgVDAgPSBUT1AgKyAoZ2VvLnRvcFBhZCB8fCAwKTtcbiAgY29uc3QgbGV2ZWwgPSB7fSwgY3kgPSB7fTtcbiAgYy5pbnB1dHMuZm9yRWFjaCgobiwgaSkgPT4ge1xuICAgIGxldmVsW25dID0gMDtcbiAgICBjeVtuXSA9IFQwICsgaSAqIFNQO1xuICB9KTtcbiAgYy5vcmRlci5mb3JFYWNoKChnKSA9PiB7XG4gICAgZy5sZXZlbCA9IDEgKyBNYXRoLm1heCguLi5nLmlucy5tYXAoKHgpID0+IGxldmVsW3hdKSk7XG4gICAgbGV2ZWxbZy5vdXRdID0gZy5sZXZlbDtcbiAgICBnLkggPSBNYXRoLm1heCg0NCwgMTQgKiAoZy5pbnMubGVuZ3RoICsgMSkpO1xuICB9KTtcbiAgY29uc3QgbWF4TCA9IGMub3JkZXIubGVuZ3RoID8gTWF0aC5tYXgoLi4uYy5vcmRlci5tYXAoKGcpID0+IGcubGV2ZWwpKSA6IDA7XG4gIGNvbnN0IGNvbFggPSB7fTtcbiAgZm9yIChsZXQgTCA9IDE7IEwgPD0gbWF4TDsgTCsrKSB7XG4gICAgY29uc3QgbmVlZCA9IGdlby5nYXBCZWZvcmUgJiYgZ2VvLmdhcEJlZm9yZVtMXSB8fCAwO1xuICAgIGNvbFhbTF0gPSBMID09PSAxID8gTEVGVCArIE1hdGgubWF4KDcwLCBuZWVkKSA6IGNvbFhbTCAtIDFdICsgR0FURV9XICsgTWF0aC5tYXgoZ2VvLmhnYXAsIG5lZWQpO1xuICB9XG4gIGMub3JkZXIuZm9yRWFjaCgoZykgPT4geyBnLngwID0gY29sWFtnLmxldmVsXTsgfSk7XG4gIGxldCBib3R0b20gPSBUMCArIE1hdGgubWF4KDAsIGMuaW5wdXRzLmxlbmd0aCAtIDEpICogU1AgKyAxMjtcbiAgZm9yIChsZXQgTCA9IDE7IEwgPD0gbWF4TDsgTCsrKSB7XG4gICAgY29uc3QgZ3MgPSBjLm9yZGVyLmZpbHRlcigoZykgPT4gZy5sZXZlbCA9PT0gTCk7XG4gICAgZ3MuZm9yRWFjaCgoZykgPT4ge1xuICAgICAgZy53YW50ID0gZy5pbnMucmVkdWNlKChhLCB4KSA9PiBhICsgY3lbeF0sIDApIC8gZy5pbnMubGVuZ3RoO1xuICAgIH0pO1xuICAgIGdzLnNvcnQoKGEsIGIpID0+IGEud2FudCAtIGIud2FudCk7XG4gICAgbGV0IHByZXZCb3R0b20gPSAtSW5maW5pdHk7XG4gICAgZ3MuZm9yRWFjaCgoZykgPT4ge1xuICAgICAgY29uc3QgdG9wID0gTWF0aC5tYXgoZy53YW50IC0gZy5IIC8gMiwgcHJldkJvdHRvbSArIEdBUCArIDE0KTtcbiAgICAgIGcuY3kgPSB0b3AgKyBnLkggLyAyO1xuICAgICAgcHJldkJvdHRvbSA9IHRvcCArIGcuSDtcbiAgICAgIGN5W2cub3V0XSA9IGcuY3k7XG4gICAgICBib3R0b20gPSBNYXRoLm1heChib3R0b20sIHByZXZCb3R0b20pO1xuICAgIH0pO1xuICB9XG4gIGxldCByaWdodCA9IExFRlQgKyA0MDtcbiAgYy5vcmRlci5mb3JFYWNoKChnKSA9PiB7IHJpZ2h0ID0gTWF0aC5tYXgocmlnaHQsIGcueDAgKyBHQVRFX1cgKyAxNik7IH0pO1xuICBjLm91dHB1dHMuZm9yRWFjaCgobikgPT4ge1xuICAgIHJpZ2h0ID0gTWF0aC5tYXgocmlnaHQsIGMuZHJpdmVyW25dLngwICsgR0FURV9XICsgNTIgKyBuLmxlbmd0aCAqIDggKyAxMik7XG4gIH0pO1xuICByZXR1cm4geyBjeSwgbWF4TCwgd2lkdGg6IHJpZ2h0LCBoZWlnaHQ6IGJvdHRvbSArIFRPUCB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gd2lyZUNoYW5uZWwoZywgaSwgaGdhcCkge1xuICBjb25zdCBuID0gZy5pbnMubGVuZ3RoLCBhdmFpbCA9IE1hdGgubWF4KDEwLCBoZ2FwIC0gNiksIGZpcnN0ID0gTWF0aC5taW4oMjAsIGF2YWlsIC8gMik7XG4gIGNvbnN0IHN0ZXAgPSBuID4gMSA/IE1hdGgubWluKDcsIChhdmFpbCAtIGZpcnN0KSAvIChuIC0gMSkpIDogMDtcbiAgcmV0dXJuIGcueDAgLSBmaXJzdCAtIHN0ZXAgKiBpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcGxhblJvdXRlcyhjLCBMLCBoZ2FwKSB7XG4gIGNvbnN0IGJveGVzID0gYy5vcmRlci5tYXAoKGcpID0+ICh7IGcsIHgwOiBnLngwIC0gMiwgeDE6IGcueDAgKyBHQVRFX1cgKyAyLCB5MDogZy5jeSAtIGcuSCAvIDIgLSAxNCwgeTE6IGcuY3kgKyBnLkggLyAyICsgMTYgfSkpO1xuICBjb25zdCByb3V0ZXMgPSBuZXcgTWFwKCk7XG4gIGxldCBsYW5lcyA9IDA7XG4gIGMub3JkZXIuZm9yRWFjaCgoZykgPT4gZy5pbnMuZm9yRWFjaCgoc2lnLCBpKSA9PiB7XG4gICAgY29uc3QgZCA9IGMuZHJpdmVyW3NpZ107XG4gICAgY29uc3QgYXggPSBkID8gZC54MCArIEdBVEVfVyA6IExFRlQsIGF5ID0gZCA/IGQuY3kgOiBMLmN5W3NpZ10sIG14ID0gd2lyZUNoYW5uZWwoZywgaSwgaGdhcCk7XG4gICAgaWYgKGJveGVzLnNvbWUoKGIpID0+IGIuZyAhPT0gZyAmJiBiLmcgIT09IGQgJiYgYi54MSA+IGF4ICsgMiAmJiBiLngwIDwgbXggJiYgYXkgPiBiLnkwICYmIGF5IDwgYi55MSkpIHtcbiAgICAgIHJvdXRlcy5zZXQoZy5vdXQgKyBcIjpcIiArIGksIHsgbGFuZTogbGFuZXMgJSA1IH0pO1xuICAgICAgbGFuZXMrKztcbiAgICB9XG4gIH0pKTtcbiAgcmV0dXJuIHsgcm91dGVzLCBsYW5lczogTWF0aC5taW4obGFuZXMsIDUpIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwbGFuQ2hhbm5lbHMoYywgTCwgcGxhbikge1xuICAvLyAuLi4gKExlYXZlIHRoaXMgZXhhY3Qgc2FtZSwgbm8gY2hhbmdlcyBuZWVkZWQgaGVyZSlcbiAgY29uc3QgYnlMZXZlbCA9IG5ldyBNYXAoKTtcbiAgYy5vcmRlci5mb3JFYWNoKChnKSA9PiB7XG4gICAgaWYgKCFieUxldmVsLmhhcyhnLmxldmVsKSkgYnlMZXZlbC5zZXQoZy5sZXZlbCwgW10pO1xuICAgIGJ5TGV2ZWwuZ2V0KGcubGV2ZWwpLnB1c2goZyk7XG4gIH0pO1xuICBjb25zdCB0cmFja09mID0gbmV3IE1hcCgpLCB0cmFja3MgPSB7fSwgbmV0cyA9IHt9O1xuICBmb3IgKGNvbnN0IFtsdmwsIGdhdGVzXSBvZiBieUxldmVsKSB7XG4gICAgY29uc3QgcGVyTmV0ID0gbmV3IE1hcCgpO1xuICAgIGdhdGVzLmZvckVhY2goKGcpID0+IGcuaW5zLmZvckVhY2goKHNpZywgaSkgPT4ge1xuICAgICAgY29uc3Qga2V5ID0gZy5vdXQgKyBcIjpcIiArIGksIGQgPSBjLmRyaXZlcltzaWddLCByb3V0ZSA9IHBsYW4ucm91dGVzLmdldChrZXkpO1xuICAgICAgY29uc3QgYXkgPSByb3V0ZSA/IGxhbmVZKHJvdXRlLmxhbmUpIDogZCA/IGQuY3kgOiBMLmN5W3NpZ107XG4gICAgICBjb25zdCBweSA9IGcuY3kgLSBnLkggLyAyICsgZy5IICogKGkgKyAxKSAvIChnLmlucy5sZW5ndGggKyAxKTtcbiAgICAgIGlmICghcGVyTmV0LmhhcyhzaWcpKSBwZXJOZXQuc2V0KHNpZywgeyBzaWcsIGxvOiBJbmZpbml0eSwgaGk6IC1JbmZpbml0eSwga2V5czogW10sIHRyYWNrOiAwIH0pO1xuICAgICAgY29uc3QgbiA9IHBlck5ldC5nZXQoc2lnKTtcbiAgICAgIG4ubG8gPSBNYXRoLm1pbihuLmxvLCBheSwgcHkpO1xuICAgICAgbi5oaSA9IE1hdGgubWF4KG4uaGksIGF5LCBweSk7XG4gICAgICBuLmtleXMucHVzaChrZXkpO1xuICAgIH0pKTtcbiAgICBjb25zdCBsaXN0ID0gWy4uLnBlck5ldC52YWx1ZXMoKV0uc29ydCgoYSwgYikgPT4gYS5sbyAtIGIubG8gfHwgYS5oaSAtIGIuaGkpO1xuICAgIGNvbnN0IGVuZHMgPSBbXTtcbiAgICBsaXN0LmZvckVhY2goKG4pID0+IHtcbiAgICAgIGlmIChuLmhpIC0gbi5sbyA+PSAxKSB7XG4gICAgICAgIGxldCB0ID0gZW5kcy5maW5kSW5kZXgoKGVuZCkgPT4gZW5kIDwgbi5sbyAtIDUpO1xuICAgICAgICBpZiAodCA8IDApIHtcbiAgICAgICAgICB0ID0gZW5kcy5sZW5ndGg7XG4gICAgICAgICAgZW5kcy5wdXNoKC1JbmZpbml0eSk7XG4gICAgICAgIH1cbiAgICAgICAgZW5kc1t0XSA9IG4uaGk7XG4gICAgICAgIG4udHJhY2sgPSB0O1xuICAgICAgfVxuICAgICAgbi5rZXlzLmZvckVhY2goKGspID0+IHRyYWNrT2Yuc2V0KGssIG4udHJhY2spKTtcbiAgICB9KTtcbiAgICB0cmFja3NbbHZsXSA9IE1hdGgubWF4KDEsIGVuZHMubGVuZ3RoKTtcbiAgICBuZXRzW2x2bF0gPSBsaXN0O1xuICB9XG4gIHJldHVybiB7IHRyYWNrT2YsIHRyYWNrcywgbmV0cyB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc29sdmVHYXAoYywgdmdhcCwgdGFyZ2V0Vykge1xuICBjb25zdCBMMCA9IGxheW91dChjLCB7IGhnYXA6IDkwLCB2Z2FwIH0pO1xuICBpZiAoTDAubWF4TCA8IDIpIHJldHVybiA5MDtcbiAgcmV0dXJuIGNsYW1wKDkwICsgKHRhcmdldFcgLSBMMC53aWR0aCkgLyAoTDAubWF4TCAtIDEpLCA0MCwgMWUzKTtcbn0iLCAiLy8gcGFja2FnZXMvbG9naWMtZ3JhcGgvc3JjL3VpL2V4cG9ydC1pbWFnZS5qc1xuaW1wb3J0IHsgTWVudSwgTm90aWNlIH0gZnJvbSBcIm9ic2lkaWFuXCI7XG5pbXBvcnQgeyBoLCBTVkdOUyB9IGZyb20gXCIuL2RvbS5qc1wiO1xuaW1wb3J0ICogYXMgaW1wb3J0X29ic2lkaWFuNSBmcm9tIFwib2JzaWRpYW5cIjtcbnZhciBTVFlMRV9QUk9QUyA9IFtcbiAgXCJmaWxsXCIsXG4gIFwiZmlsbC1vcGFjaXR5XCIsXG4gIFwic3Ryb2tlXCIsXG4gIFwic3Ryb2tlLXdpZHRoXCIsXG4gIFwic3Ryb2tlLW9wYWNpdHlcIixcbiAgXCJzdHJva2UtbGluZWpvaW5cIixcbiAgXCJzdHJva2UtbGluZWNhcFwiLFxuICBcInN0cm9rZS1kYXNoYXJyYXlcIixcbiAgXCJvcGFjaXR5XCIsXG4gIFwiZm9udC1zaXplXCIsXG4gIFwiZm9udC1mYW1pbHlcIixcbiAgXCJmb250LXdlaWdodFwiLFxuICBcInRleHQtYW5jaG9yXCJcbl07XG5leHBvcnQgZnVuY3Rpb24gc3ZnU25hcHNob3Qoc3ZnKSB7XG4gIGNvbnN0IGNsb25lID0gc3ZnLmNsb25lTm9kZSh0cnVlKTtcbiAgY29uc3Qgc3JjID0gW3N2ZywgLi4uc3ZnLnF1ZXJ5U2VsZWN0b3JBbGwoXCIqXCIpXSwgZHN0ID0gW2Nsb25lLCAuLi5jbG9uZS5xdWVyeVNlbGVjdG9yQWxsKFwiKlwiKV07XG4gIHNyYy5mb3JFYWNoKChlbCwgaSkgPT4ge1xuICAgIGNvbnN0IGNzID0gZ2V0Q29tcHV0ZWRTdHlsZShlbCk7XG4gICAgU1RZTEVfUFJPUFMuZm9yRWFjaCgocCkgPT4ge1xuICAgICAgY29uc3QgdiA9IGNzLmdldFByb3BlcnR5VmFsdWUocCk7XG4gICAgICBpZiAodikgZHN0W2ldLnN0eWxlLnNldFByb3BlcnR5KHAsIHYpO1xuICAgIH0pO1xuICAgIGRzdFtpXS5yZW1vdmVBdHRyaWJ1dGUoXCJjbGFzc1wiKTtcbiAgfSk7XG4gIGNsb25lLnN0eWxlLnJlbW92ZVByb3BlcnR5KFwibWF4LXdpZHRoXCIpO1xuICBjb25zdCB2YiA9IGNsb25lLmdldEF0dHJpYnV0ZShcInZpZXdCb3hcIikuc3BsaXQoL1xccysvKS5tYXAoTnVtYmVyKTtcbiAgY29uc3QgYmcgPSAoZ2V0Q29tcHV0ZWRTdHlsZShkb2N1bWVudC5ib2R5KS5nZXRQcm9wZXJ0eVZhbHVlKFwiLS1iYWNrZ3JvdW5kLXByaW1hcnlcIikgfHwgXCJcIikudHJpbSgpIHx8IFwiI2ZmZmZmZlwiO1xuICBjb25zdCByZWN0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudE5TKFNWR05TLCBcInJlY3RcIik7XG4gIHJlY3Quc2V0QXR0cmlidXRlKFwieFwiLCAwKTtcbiAgcmVjdC5zZXRBdHRyaWJ1dGUoXCJ5XCIsIDApO1xuICByZWN0LnNldEF0dHJpYnV0ZShcIndpZHRoXCIsIHZiWzJdKTtcbiAgcmVjdC5zZXRBdHRyaWJ1dGUoXCJoZWlnaHRcIiwgdmJbM10pO1xuICByZWN0LnNldEF0dHJpYnV0ZShcImZpbGxcIiwgYmcpO1xuICBjbG9uZS5pbnNlcnRCZWZvcmUocmVjdCwgY2xvbmUuZmlyc3RDaGlsZCk7XG4gIGNsb25lLnNldEF0dHJpYnV0ZShcInhtbG5zXCIsIFNWR05TKTtcbiAgY2xvbmUuc2V0QXR0cmlidXRlKFwid2lkdGhcIiwgdmJbMl0pO1xuICBjbG9uZS5zZXRBdHRyaWJ1dGUoXCJoZWlnaHRcIiwgdmJbM10pO1xuICByZXR1cm4geyB0ZXh0OiBuZXcgWE1MU2VyaWFsaXplcigpLnNlcmlhbGl6ZVRvU3RyaW5nKGNsb25lKSwgd2lkdGg6IHZiWzJdLCBoZWlnaHQ6IHZiWzNdIH07XG59XG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gc3ZnVG9Qbmcoc25hcCwgc2NhbGUpIHtcbiAgY29uc3QgdXJsID0gVVJMLmNyZWF0ZU9iamVjdFVSTChuZXcgQmxvYihbc25hcC50ZXh0XSwgeyB0eXBlOiBcImltYWdlL3N2Zyt4bWw7Y2hhcnNldD11dGYtOFwiIH0pKTtcbiAgdHJ5IHtcbiAgICBjb25zdCBpbWcgPSBuZXcgSW1hZ2UoKTtcbiAgICBhd2FpdCBuZXcgUHJvbWlzZSgocmVzLCByZWopID0+IHtcbiAgICAgIGltZy5vbmxvYWQgPSByZXM7XG4gICAgICBpbWcub25lcnJvciA9ICgpID0+IHJlaihuZXcgRXJyb3IoXCJjb3VsZCBub3QgcmVuZGVyIHRoZSBpbWFnZVwiKSk7XG4gICAgICBpbWcuc3JjID0gdXJsO1xuICAgIH0pO1xuICAgIGNvbnN0IGNhbnZhcyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJjYW52YXNcIik7XG4gICAgY2FudmFzLndpZHRoID0gTWF0aC5yb3VuZChzbmFwLndpZHRoICogc2NhbGUpO1xuICAgIGNhbnZhcy5oZWlnaHQgPSBNYXRoLnJvdW5kKHNuYXAuaGVpZ2h0ICogc2NhbGUpO1xuICAgIGNhbnZhcy5nZXRDb250ZXh0KFwiMmRcIikuZHJhd0ltYWdlKGltZywgMCwgMCwgY2FudmFzLndpZHRoLCBjYW52YXMuaGVpZ2h0KTtcbiAgICByZXR1cm4gYXdhaXQgbmV3IFByb21pc2UoKHJlcykgPT4gY2FudmFzLnRvQmxvYihyZXMsIFwiaW1hZ2UvcG5nXCIpKTtcbiAgfSBmaW5hbGx5IHtcbiAgICBVUkwucmV2b2tlT2JqZWN0VVJMKHVybCk7XG4gIH1cbn1cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBzYXZlVG9WYXVsdChhcHAsIGJhc2VOYW1lLCBleHQsIGJ1ZmZlcikge1xuICBjb25zdCBzdGFtcCA9ICgvKiBAX19QVVJFX18gKi8gbmV3IERhdGUoKSkudG9JU09TdHJpbmcoKS5zbGljZSgwLCAxOSkucmVwbGFjZSgvWzpUXS9nLCBcIi1cIik7XG4gIGNvbnN0IGZpbGVuYW1lID0gYCR7YmFzZU5hbWV9LSR7c3RhbXB9LiR7ZXh0fWA7XG4gIGxldCBwYXRoID0gZmlsZW5hbWU7XG4gIHRyeSB7XG4gICAgaWYgKGFwcC5maWxlTWFuYWdlciAmJiBhcHAuZmlsZU1hbmFnZXIuZ2V0QXZhaWxhYmxlUGF0aEZvckF0dGFjaG1lbnQpIHBhdGggPSBhd2FpdCBhcHAuZmlsZU1hbmFnZXIuZ2V0QXZhaWxhYmxlUGF0aEZvckF0dGFjaG1lbnQoZmlsZW5hbWUpO1xuICB9IGNhdGNoIChlKSB7XG4gICAgcGF0aCA9IGZpbGVuYW1lO1xuICB9XG4gIGF3YWl0IGFwcC52YXVsdC5jcmVhdGVCaW5hcnkocGF0aCwgYnVmZmVyKTtcbiAgbmV3IGltcG9ydF9vYnNpZGlhbjUuTm90aWNlKGBTYXZlZCAke3BhdGh9YCk7XG59XG5leHBvcnQgZnVuY3Rpb24gYWRkRXhwb3J0QnV0dG9uKGhlYWQsIGFwcCwgZ2V0U3ZnLCBiYXNlTmFtZSkge1xuICBpZiAoIWFwcCB8fCB0eXBlb2YgaW1wb3J0X29ic2lkaWFuNS5NZW51ID09PSBcInVuZGVmaW5lZFwiKSByZXR1cm47XG4gIGNvbnN0IGJ0biA9IGgoXCJidXR0b25cIiwgXCJsZy1zbWFsbFwiLCBoZWFkLCBcImV4cG9ydFwiKTtcbiAgYnRuLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoZXZ0KSA9PiB7XG4gICAgY29uc3Qgc3ZnID0gZ2V0U3ZnKCk7XG4gICAgaWYgKCFzdmcpIHJldHVybjtcbiAgICBjb25zdCBydW4gPSAoZm4pID0+IGFzeW5jICgpID0+IHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGF3YWl0IGZuKHN2Z1NuYXBzaG90KHN2ZykpO1xuICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICBuZXcgaW1wb3J0X29ic2lkaWFuNS5Ob3RpY2UoXCJFeHBvcnQgZmFpbGVkOiBcIiArIGUubWVzc2FnZSk7XG4gICAgICB9XG4gICAgfTtcbiAgICBjb25zdCBtZW51ID0gbmV3IGltcG9ydF9vYnNpZGlhbjUuTWVudSgpO1xuICAgIG1lbnUuYWRkSXRlbSgoaSkgPT4gaS5zZXRUaXRsZShcIlNhdmUgYXMgUE5HXCIpLnNldEljb24oXCJpbWFnZVwiKS5vbkNsaWNrKHJ1bihhc3luYyAoc25hcCkgPT4ge1xuICAgICAgY29uc3QgYmxvYiA9IGF3YWl0IHN2Z1RvUG5nKHNuYXAsIDIpO1xuICAgICAgYXdhaXQgc2F2ZVRvVmF1bHQoYXBwLCBiYXNlTmFtZSwgXCJwbmdcIiwgYXdhaXQgYmxvYi5hcnJheUJ1ZmZlcigpKTtcbiAgICB9KSkpO1xuICAgIG1lbnUuYWRkSXRlbSgoaSkgPT4gaS5zZXRUaXRsZShcIlNhdmUgYXMgU1ZHXCIpLnNldEljb24oXCJmaWxlLWNvZGVcIikub25DbGljayhydW4oYXN5bmMgKHNuYXApID0+IHtcbiAgICAgIGF3YWl0IHNhdmVUb1ZhdWx0KGFwcCwgYmFzZU5hbWUsIFwic3ZnXCIsIG5ldyBUZXh0RW5jb2RlcigpLmVuY29kZShzbmFwLnRleHQpLmJ1ZmZlcik7XG4gICAgfSkpKTtcbiAgICBtZW51LmFkZEl0ZW0oKGkpID0+IGkuc2V0VGl0bGUoXCJDb3B5IFBORyB0byBjbGlwYm9hcmRcIikuc2V0SWNvbihcImNvcHlcIikub25DbGljayhydW4oYXN5bmMgKHNuYXApID0+IHtcbiAgICAgIGNvbnN0IGJsb2IgPSBhd2FpdCBzdmdUb1BuZyhzbmFwLCAyKTtcbiAgICAgIGlmICh0eXBlb2YgQ2xpcGJvYXJkSXRlbSA9PT0gXCJ1bmRlZmluZWRcIiB8fCAhbmF2aWdhdG9yLmNsaXBib2FyZCB8fCAhbmF2aWdhdG9yLmNsaXBib2FyZC53cml0ZSkge1xuICAgICAgICBuZXcgaW1wb3J0X29ic2lkaWFuNS5Ob3RpY2UoXCJDb3B5aW5nIGltYWdlcyB0byB0aGUgY2xpcGJvYXJkIGlzIG5vdCBzdXBwb3J0ZWQgb24gdGhpcyBkZXZpY2UuXCIpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBhd2FpdCBuYXZpZ2F0b3IuY2xpcGJvYXJkLndyaXRlKFtuZXcgQ2xpcGJvYXJkSXRlbSh7IFwiaW1hZ2UvcG5nXCI6IGJsb2IgfSldKTtcbiAgICAgIG5ldyBpbXBvcnRfb2JzaWRpYW41Lk5vdGljZShcIkltYWdlIGNvcGllZFwiKTtcbiAgICB9KSkpO1xuICAgIG1lbnUuc2hvd0F0TW91c2VFdmVudChldnQpO1xuICB9KTtcbn1cblxuIiwgIi8vIHBhY2thZ2VzL2xvZ2ljLWdyYXBoL3NyYy91aS9kaWFncmFtLmpzXG5pbXBvcnQgeyBjcmVhdGVTaW0gfSBmcm9tIFwiLi4vY29yZS9zaW0uanNcIjtcbmltcG9ydCB7IGJ1YmJsZUZvcm1zLCBtYXRjaGVkQnViYmxlTmV0cywgYmFzZVJlcCB9IGZyb20gXCIuLi9jb3JlL2J1YmJsZXMuanNcIjtcbmltcG9ydCB7IGxheW91dCwgcGxhblJvdXRlcywgcGxhbkNoYW5uZWxzLCBjaGFubmVsTmVlZCwgR0FURV9XLCBMRUZULCBCVUJCTEVfUiwgQ0hfRklSU1QsIENIX1NURVAsIGdhdGVQYXRoLCBzb2x2ZUdhcCwgQU5JTV9NUyB9IGZyb20gXCIuL2xheW91dC5qc1wiO1xuaW1wb3J0IHsgaCwgcywgY2xpY2thYmxlLCBsYXRlciB9IGZyb20gXCIuL2RvbS5qc1wiO1xuaW1wb3J0IHsgYWRkRXhwb3J0QnV0dG9uIH0gZnJvbSBcIi4vZXhwb3J0LWltYWdlLmpzXCI7XG5cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVEaWFncmFtKGMsIHBhcmVudCwgY3R4KSB7XG4gIGNvbnN0IGZsaXBzID0gbmV3IFNldCgpO1xuICBsZXQgcmVwcyA9IG51bGwsIG1hdGNoZWQgPSBuZXcgU2V0KCk7XG4gIGNvbnN0IGNvbXB1dGVSZXBzID0gKCkgPT4ge1xuICAgIGlmIChjdHguYnViYmxlcykge1xuICAgICAgcmVwcyA9IGJ1YmJsZUZvcm1zKGMsIGZsaXBzKTtcbiAgICAgIG1hdGNoZWQgPSBtYXRjaGVkQnViYmxlTmV0cyhjLCByZXBzKTtcbiAgICB9XG4gIH07XG4gIGNvbXB1dGVSZXBzKCk7XG4gIGNvbnN0IHJlcE9mID0gKGcpID0+IHJlcHMgPyByZXBzLmdldChnKSA6IGJhc2VSZXAoZyk7XG4gIGNvbnN0IGZhbiA9IHt9O1xuICBjLmdhdGVzLmZvckVhY2goKGcpID0+IGcuaW5zLmZvckVhY2goKG4pID0+IHtcbiAgICBmYW5bbl0gPSAoZmFuW25dIHx8IDApICsgMTtcbiAgfSkpO1xuICBcbiAgY29uc3Qgc2ltID0gY3JlYXRlU2ltKFxuICAgIGMsXG4gICAgY3R4LmdldERlbGF5LFxuICAgIChzaWcsIHYpID0+IHtcbiAgICAgIHBhaW50KCk7XG4gICAgICBzcGF3bihzaWcsIHYpO1xuICAgICAgaWYgKGN0eC5vbkNoYW5nZSkgY3R4Lm9uQ2hhbmdlKHNpZywgdik7XG4gICAgfSxcbiAgICAoKSA9PiBwYWludCgpXG4gICk7XG4gIFxuICBjb25zdCBib3ggPSBoKFwiZGl2XCIsIFwibGctZGlhZ3JhbVwiLCBwYXJlbnQpO1xuICBjb25zdCBoZWFkID0gaChcImRpdlwiLCBcImxnLXRpdGxlXCIsIGJveCk7XG4gIGgoXCJzcGFuXCIsIFwiXCIsIGhlYWQsIGN0eC50aXRsZSB8fCBcIkNpcmN1aXRcIik7XG4gIGxldCBzdmdFbCA9IG51bGw7XG4gIFxuICBpZiAoY3R4LmJ1YmJsZXMpIHtcbiAgICBoKFwic3BhblwiLCBcImxnLW11dGVkLXRleHRcIiwgaGVhZCwgXCIgIGNsaWNrIGEgZ2F0ZSB0byBmbGlwIGl0cyBzeW1ib2wgXCIpO1xuICAgIGgoXCJidXR0b25cIiwgXCJsZy1zbWFsbFwiLCBoZWFkLCBcInJlc2V0XCIpLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKSA9PiB7XG4gICAgICBmbGlwcy5jbGVhcigpO1xuICAgICAgY29tcHV0ZVJlcHMoKTtcbiAgICAgIGRyYXcoKTtcbiAgICAgIHBhaW50KCk7XG4gICAgfSk7XG4gIH1cbiAgXG4gIGFkZEV4cG9ydEJ1dHRvbihoZWFkLCBjdHguYXBwLCAoKSA9PiBzdmdFbCwgY3R4LmV4cG9ydE5hbWUgfHwgXCJjaXJjdWl0XCIpO1xuICBjb25zdCBzY3JvbGwgPSBoKFwiZGl2XCIsIFwibGctc2Nyb2xsXCIsIGJveCk7XG4gIGxldCBoZ2FwID0gY3R4LmhzcGFjaW5nLnB4IHx8IDkwO1xuICBsZXQgd2lyZXMgPSBbXSwgZG90cyA9IFtdLCBpbkJveGVzID0ge30sIG91dEJveGVzID0ge30sIGxhbXBzID0gW10sIHNwcml0ZXMgPSBbXSwgc3ByaXRlTGF5ZXIgPSBudWxsLCByYWYgPSAwO1xuICBsZXQgZGlzcG9zZWQgPSBmYWxzZTtcbiAgXG4gIGZ1bmN0aW9uIGRyYXcoKSB7XG4gICAgc2Nyb2xsLnRleHRDb250ZW50ID0gXCJcIjtcbiAgICB3aXJlcyA9IFtdO1xuICAgIGRvdHMgPSBbXTtcbiAgICBpbkJveGVzID0ge307XG4gICAgb3V0Qm94ZXMgPSB7fTtcbiAgICBsYW1wcyA9IFtdO1xuICAgIHNwcml0ZXMgPSBbXTtcbiAgICBcbiAgICBsZXQgTCA9IGxheW91dChjLCB7IGhnYXAsIHZnYXA6IGN0eC52Z2FwIH0pO1xuICAgIGNvbnN0IHBsYW4gPSBwbGFuUm91dGVzKGMsIEwsIGhnYXApO1xuICAgIGNvbnN0IHRvcFBhZCA9IHBsYW4ubGFuZXMgPyA4ICsgNiAqIHBsYW4ubGFuZXMgOiAwO1xuICAgIEwgPSBsYXlvdXQoYywgeyBoZ2FwLCB2Z2FwOiBjdHgudmdhcCwgdG9wUGFkIH0pO1xuICAgIGNvbnN0IGNoYW4gPSBwbGFuQ2hhbm5lbHMoYywgTCwgcGxhbik7XG4gICAgY29uc3QgZ2FwQmVmb3JlID0ge307XG4gICAgT2JqZWN0LmtleXMoY2hhbi50cmFja3MpLmZvckVhY2goKGwpID0+IHtcbiAgICAgIGdhcEJlZm9yZVtsXSA9IGNoYW5uZWxOZWVkKGNoYW4udHJhY2tzW2xdKTtcbiAgICB9KTtcbiAgICBMID0gbGF5b3V0KGMsIHsgaGdhcCwgdmdhcDogY3R4LnZnYXAsIHRvcFBhZCwgZ2FwQmVmb3JlIH0pO1xuICAgIFxuICAgIGNvbnN0IHN2ZyA9IHMoXCJzdmdcIiwgeyBjbGFzczogXCJsZy1zdmdcIiwgdmlld0JveDogYDAgMCAke0wud2lkdGh9ICR7TC5oZWlnaHR9YCwgd2lkdGg6IEwud2lkdGgsIGhlaWdodDogTC5oZWlnaHQgfSwgc2Nyb2xsKTtcbiAgICBzdmdFbCA9IHN2ZztcbiAgICBpZiAoY3R4LmhzcGFjaW5nLnBjdCA+IDEwMCkgc3ZnLnN0eWxlLm1heFdpZHRoID0gXCJub25lXCI7XG4gICAgY29uc3Qgd2lyZUxheWVyID0gcyhcImdcIiwge30sIHN2Zyk7XG4gICAgY29uc3QgZ2F0ZUxheWVyID0gcyhcImdcIiwge30sIHN2Zyk7XG4gICAgc3ByaXRlTGF5ZXIgPSBzKFwiZ1wiLCB7fSwgc3ZnKTtcbiAgICBcbiAgICBjb25zdCBzcmNQb2ludCA9IChuKSA9PiBjLmRyaXZlcltuXSA/IHsgeDogYy5kcml2ZXJbbl0ueDAgKyBHQVRFX1csIHk6IGMuZHJpdmVyW25dLmN5IH0gOiB7IHg6IExFRlQsIHk6IEwuY3lbbl0gfTtcbiAgICBjb25zdCBhZGRXaXJlID0gKHNpZywgZCkgPT4gd2lyZXMucHVzaCh7IHNpZywgZWw6IHMoXCJwYXRoXCIsIHsgY2xhc3M6IFwibGctd2lyZVwiLCBkIH0sIHdpcmVMYXllcikgfSk7XG4gICAgXG4gICAgYy5vcmRlci5mb3JFYWNoKChnKSA9PiB7XG4gICAgICBjb25zdCByID0gcmVwT2YoZyksIG4gPSBnLmlucy5sZW5ndGg7XG4gICAgICBnLmlucy5mb3JFYWNoKChzaWcsIGkpID0+IHtcbiAgICAgICAgY29uc3QgYSA9IHNyY1BvaW50KHNpZyk7XG4gICAgICAgIGNvbnN0IHB5ID0gZy5jeSAtIGcuSCAvIDIgKyBnLkggKiAoaSArIDEpIC8gKG4gKyAxKTtcbiAgICAgICAgY29uc3QgbXggPSBnLngwIC0gQ0hfRklSU1QgLSBDSF9TVEVQICogKGNoYW4udHJhY2tPZi5nZXQoZy5vdXQgKyBcIjpcIiArIGkpIHx8IDApO1xuICAgICAgICBjb25zdCBlbmR4ID0gci5pbnNbaV0gPyBnLngwIC0gMiAqIEJVQkJMRV9SIDogZy54MDtcbiAgICAgICAgY29uc3Qgcm91dGUgPSBwbGFuLnJvdXRlcy5nZXQoZy5vdXQgKyBcIjpcIiArIGkpO1xuICAgICAgICBpZiAocm91dGUpIHtcbiAgICAgICAgICBjb25zdCBseSA9IE1hdGgubWluKGEueSwgcHkpIC0gMTAgLSByb3V0ZS5sYW5lICogNjsgXG4gICAgICAgICAgY29uc3QgYzEgPSBhLnggKyAyMCArIDQgKiAocm91dGUubGFuZSAlIDMpO1xuICAgICAgICAgIGFkZFdpcmUoc2lnLCBgTSR7YS54fSwke2EueX0gSCR7YzF9IFYke2x5fSBIJHtteH0gViR7cHl9IEgke2VuZHh9YCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgYWRkV2lyZShzaWcsIGBNJHthLnh9LCR7YS55fSBIJHtteH0gViR7cHl9IEgke2VuZHh9YCk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHIuaW5zW2ldKSB7XG4gICAgICAgICAgcyhcImNpcmNsZVwiLCB7IGNsYXNzOiBcImxnLWJ1YmJsZVwiICsgKG1hdGNoZWQuaGFzKHNpZykgPyBcIiBtYXRjaFwiIDogXCJcIiksIGN4OiBnLngwIC0gQlVCQkxFX1IsIGN5OiBweSwgcjogQlVCQkxFX1IgfSwgZ2F0ZUxheWVyKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSk7XG4gICAgXG4gICAgT2JqZWN0LmtleXMoZmFuKS5mb3JFYWNoKChuKSA9PiB7XG4gICAgICBpZiAoZmFuW25dID4gMSkge1xuICAgICAgICBjb25zdCBhID0gc3JjUG9pbnQobik7XG4gICAgICAgIGRvdHMucHVzaCh7IHNpZzogbiwgZWw6IHMoXCJjaXJjbGVcIiwgeyBjbGFzczogXCJsZy1kb3RcIiwgY3g6IGEueCArIDEwLCBjeTogYS55LCByOiAzLjUgfSwgd2lyZUxheWVyKSB9KTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICBcbiAgICBjLmlucHV0cy5mb3JFYWNoKChuKSA9PiB7XG4gICAgICBjb25zdCB5ID0gTC5jeVtuXTtcbiAgICAgIHMoXCJ0ZXh0XCIsIHsgY2xhc3M6IFwibGctbGFiZWxcIiwgeDogTEVGVCAtIDMwLCB5OiB5ICsgNCwgXCJ0ZXh0LWFuY2hvclwiOiBcImVuZFwiIH0sIGdhdGVMYXllciwgbik7XG4gICAgICBjb25zdCByZWN0ID0gcyhcInJlY3RcIiwgeyBjbGFzczogXCJsZy1ib3ggaW5cIiwgeDogTEVGVCAtIDI0LCB5OiB5IC0gMTAsIHdpZHRoOiAyNCwgaGVpZ2h0OiAyMCwgcng6IDQgfSwgZ2F0ZUxheWVyKTtcbiAgICAgIGNvbnN0IHRleHQgPSBzKFwidGV4dFwiLCB7IGNsYXNzOiBcImxnLWJveHRleHRcIiwgeDogTEVGVCAtIDEyLCB5OiB5ICsgNCwgXCJ0ZXh0LWFuY2hvclwiOiBcIm1pZGRsZVwiIH0sIGdhdGVMYXllciwgXCIwXCIpO1xuICAgICAgY2xpY2thYmxlKHJlY3QsICgpID0+IGN0eC5vblRvZ2dsZShuKSk7XG4gICAgICBpbkJveGVzW25dID0geyByZWN0LCB0ZXh0IH07XG4gICAgfSk7XG4gICAgXG4gICAgYy5vcmRlci5mb3JFYWNoKChnKSA9PiB7XG4gICAgICBjb25zdCByID0gcmVwT2YoZyk7XG4gICAgICBjb25zdCBncnAgPSBzKFwiZ1wiLCB7IHRyYW5zZm9ybTogYHRyYW5zbGF0ZSgke2cueDB9LCR7Zy5jeSAtIGcuSCAvIDJ9KWAgfSwgZ2F0ZUxheWVyKTtcbiAgICAgIGNvbnN0IGZsaXBwYWJsZSA9IGN0eC5idWJibGVzICYmICFyLmZpeGVkO1xuICAgICAgY29uc3QgYm9keSA9IHMoXCJwYXRoXCIsIHsgY2xhc3M6IFwibGctZ2F0ZVwiICsgKGZsaXBwYWJsZSA/IFwiIGZsaXBcIiA6IFwiXCIpLCBkOiBnYXRlUGF0aChyLnNoYXBlLCBnLkgpIH0sIGdycCk7XG4gICAgICBpZiAoZmxpcHBhYmxlKSBjbGlja2FibGUoYm9keSwgKCkgPT4ge1xuICAgICAgICBpZiAoZmxpcHMuaGFzKGcpKSBmbGlwcy5kZWxldGUoZyk7XG4gICAgICAgIGVsc2UgZmxpcHMuYWRkKGcpO1xuICAgICAgICBjb21wdXRlUmVwcygpO1xuICAgICAgICBkcmF3KCk7XG4gICAgICAgIHBhaW50KCk7XG4gICAgICB9KTtcbiAgICAgIGlmIChyLnNoYXBlID09PSBcIlhPUlwiKSBzKFwicGF0aFwiLCB7IGNsYXNzOiBcImxnLWdhdGUtZXh0cmFcIiwgZDogYE0tNywwIFE3LCR7Zy5IIC8gMn0gLTcsJHtnLkh9YCB9LCBncnApO1xuICAgICAgaWYgKHIub3V0KSB7XG4gICAgICAgIHMoXCJjaXJjbGVcIiwgeyBjbGFzczogXCJsZy1idWJibGVcIiArIChtYXRjaGVkLmhhcyhnLm91dCkgPyBcIiBtYXRjaFwiIDogXCJcIiksIGN4OiA1MiArIEJVQkJMRV9SLCBjeTogZy5IIC8gMiwgcjogQlVCQkxFX1IgfSwgZ3JwKTtcbiAgICAgICAgYWRkV2lyZShnLm91dCwgYE0ke2cueDAgKyA1MiArIDIgKiBCVUJCTEVfUn0sJHtnLmN5fSBIJHtnLngwICsgR0FURV9XfWApO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgYWRkV2lyZShnLm91dCwgYE0ke2cueDAgKyA1Mn0sJHtnLmN5fSBIJHtnLngwICsgR0FURV9XfWApO1xuICAgICAgfVxuICAgICAgcyhcInRleHRcIiwgeyBjbGFzczogXCJsZy1tdXRlZFwiLCB4OiAyNiwgeTogZy5IICsgMTIsIFwidGV4dC1hbmNob3JcIjogXCJtaWRkbGVcIiB9LCBncnAsIGcudHlwZSk7XG4gICAgICBpZiAoYy51c2VkLmhhcyhnLm91dCkpIHMoXCJ0ZXh0XCIsIHsgY2xhc3M6IFwibGctbXV0ZWRcIiwgeDogR0FURV9XICsgNCwgeTogZy5IIC8gMiAtIDcgfSwgZ3JwLCBnLm91dCk7XG4gICAgICBpZiAoY3R4LmFuaW0pIGxhbXBzLnB1c2goeyBnLCBib2R5LCBlbDogcyhcImNpcmNsZVwiLCB7IGNsYXNzOiBcImxnLWxhbXAgdjBcIiwgY3g6IDI2LCBjeTogLTksIHI6IDQuNSB9LCBncnApIH0pO1xuICAgIH0pO1xuICAgIFxuICAgIGMub3V0cHV0cy5mb3JFYWNoKChuKSA9PiB7XG4gICAgICBjb25zdCBnID0gYy5kcml2ZXJbbl0sIHggPSBnLngwICsgR0FURV9XO1xuICAgICAgYWRkV2lyZShuLCBgTSR7eH0sJHtnLmN5fSBIJHt4ICsgMjB9YCk7XG4gICAgICBjb25zdCByZWN0ID0gcyhcInJlY3RcIiwgeyBjbGFzczogXCJsZy1ib3hcIiwgeDogeCArIDIwLCB5OiBnLmN5IC0gMTAsIHdpZHRoOiAyNCwgaGVpZ2h0OiAyMCwgcng6IDQgfSwgZ2F0ZUxheWVyKTtcbiAgICAgIGNvbnN0IHRleHQgPSBzKFwidGV4dFwiLCB7IGNsYXNzOiBcImxnLWJveHRleHRcIiwgeDogeCArIDMyLCB5OiBnLmN5ICsgNCwgXCJ0ZXh0LWFuY2hvclwiOiBcIm1pZGRsZVwiIH0sIGdhdGVMYXllciwgXCIwXCIpO1xuICAgICAgcyhcInRleHRcIiwgeyBjbGFzczogXCJsZy1sYWJlbFwiLCB4OiB4ICsgNTIsIHk6IGcuY3kgKyA0IH0sIGdhdGVMYXllciwgbik7XG4gICAgICBvdXRCb3hlc1tuXSA9IHsgcmVjdCwgdGV4dCB9O1xuICAgIH0pO1xuICB9XG4gIFxuICBmdW5jdGlvbiBwYWludCgpIHtcbiAgICBpZiAoZGlzcG9zZWQpIHJldHVybjtcbiAgICBjb25zdCB2ID0gc2ltLnZhbHM7XG4gICAgd2lyZXMuZm9yRWFjaCgodykgPT4gdy5lbC5jbGFzc0xpc3QudG9nZ2xlKFwib25cIiwgISF2W3cuc2lnXSkpO1xuICAgIGRvdHMuZm9yRWFjaCgoZCkgPT4gZC5lbC5jbGFzc0xpc3QudG9nZ2xlKFwib25cIiwgISF2W2Quc2lnXSkpO1xuICAgIGNvbnN0IHNldEJveCA9IChiLCB2YWwpID0+IHtcbiAgICAgIGIucmVjdC5jbGFzc0xpc3QudG9nZ2xlKFwib25cIiwgISF2YWwpO1xuICAgICAgYi50ZXh0LmNsYXNzTGlzdC50b2dnbGUoXCJvblwiLCAhIXZhbCk7XG4gICAgICBiLnRleHQudGV4dENvbnRlbnQgPSBTdHJpbmcodmFsKTtcbiAgICB9O1xuICAgIGMuaW5wdXRzLmZvckVhY2goKG4pID0+IHsgaWYgKGluQm94ZXNbbl0pIHNldEJveChpbkJveGVzW25dLCB2W25dKTsgfSk7XG4gICAgYy5vdXRwdXRzLmZvckVhY2goKG4pID0+IHsgaWYgKG91dEJveGVzW25dKSBzZXRCb3gob3V0Qm94ZXNbbl0sIHZbbl0pOyB9KTtcbiAgICBsYW1wcy5mb3JFYWNoKChsKSA9PiB7XG4gICAgICBjb25zdCB3ID0gc2ltLndvcmtpbmcobC5nKTtcbiAgICAgIGNvbnN0IHZhbCA9IHcgIT09IG51bGwgPyB3IDogdltsLmcub3V0XTtcbiAgICAgIGwuZWwuc2V0QXR0cmlidXRlKFwiY2xhc3NcIiwgYGxnLWxhbXAgJHt2YWwgPyBcInYxXCIgOiBcInYwXCJ9JHt3ICE9PSBudWxsID8gXCIgd29ya1wiIDogXCJcIn1gKTtcbiAgICAgIGNvbnN0IGZsaXBwYWJsZSA9IGN0eC5idWJibGVzICYmICFyZXBPZihsLmcpLmZpeGVkO1xuICAgICAgbC5ib2R5LnNldEF0dHJpYnV0ZShcImNsYXNzXCIsIFwibGctZ2F0ZVwiICsgKGZsaXBwYWJsZSA/IFwiIGZsaXBcIiA6IFwiXCIpICsgKHcgIT09IG51bGwgPyB3ID8gXCIgdzFcIiA6IFwiIHcwXCIgOiBcIlwiKSk7XG4gICAgfSk7XG4gIH1cbiAgXG4gIGZ1bmN0aW9uIHNwYXduKHNpZywgdikge1xuICAgIGlmICghY3R4LmFuaW0gfHwgIXNwcml0ZUxheWVyIHx8IHR5cGVvZiByZXF1ZXN0QW5pbWF0aW9uRnJhbWUgIT09IFwiZnVuY3Rpb25cIiB8fCBkaXNwb3NlZCkgcmV0dXJuO1xuICAgIGlmIChzcHJpdGVzLnNvbWUoKHNwKSA9PiBzcC5zaWcgPT09IHNpZykpIHJldHVybjtcbiAgICB3aXJlcy5mb3JFYWNoKCh3KSA9PiB7XG4gICAgICBpZiAody5zaWcgIT09IHNpZyB8fCBzcHJpdGVzLmxlbmd0aCA+IDI0MCkgcmV0dXJuO1xuICAgICAgbGV0IGxlbjtcbiAgICAgIHRyeSB7IGxlbiA9IHcuZWwuZ2V0VG90YWxMZW5ndGgoKTsgfSBjYXRjaCAoZSkgeyByZXR1cm47IH1cbiAgICAgIGlmICghKGxlbiA+IDApKSByZXR1cm47XG4gICAgICBjb25zdCBnID0gcyhcImdcIiwgeyBjbGFzczogXCJsZy1zcHJpdGUgdlwiICsgdiB9LCBzcHJpdGVMYXllcik7XG4gICAgICBzKFwiY2lyY2xlXCIsIHsgcjogNi41IH0sIGcpO1xuICAgICAgcyhcInRleHRcIiwgeyB5OiAzLjUsIFwidGV4dC1hbmNob3JcIjogXCJtaWRkbGVcIiB9LCBnLCBTdHJpbmcodikpO1xuICAgICAgc3ByaXRlcy5wdXNoKHsgc2lnLCBlbDogZywgcGF0aDogdy5lbCwgbGVuLCB0MDogcGVyZm9ybWFuY2Uubm93KCkgfSk7XG4gICAgfSk7XG4gICAgaWYgKCFyYWYgJiYgc3ByaXRlcy5sZW5ndGgpIHJhZiA9IHJlcXVlc3RBbmltYXRpb25GcmFtZShzdGVwKTtcbiAgfVxuICBcbiAgZnVuY3Rpb24gc3RlcChub3cpIHtcbiAgICByYWYgPSAwO1xuICAgIGlmIChkaXNwb3NlZCkgcmV0dXJuO1xuICAgIGZvciAobGV0IGkgPSBzcHJpdGVzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgICBjb25zdCBzcCA9IHNwcml0ZXNbaV07XG4gICAgICBjb25zdCBrID0gTWF0aC5taW4oMSwgTWF0aC5tYXgoMCwgKG5vdyAtIHNwLnQwKSAvIEFOSU1fTVMpKTtcbiAgICAgIGNvbnN0IHB0ID0gc3AucGF0aC5nZXRQb2ludEF0TGVuZ3RoKGsgKiBzcC5sZW4pO1xuICAgICAgc3AuZWwuc2V0QXR0cmlidXRlKFwidHJhbnNmb3JtXCIsIGB0cmFuc2xhdGUoJHtwdC54fSwke3B0Lnl9KWApO1xuICAgICAgaWYgKGsgPj0gMSkge1xuICAgICAgICBzcC5lbC5yZW1vdmUoKTtcbiAgICAgICAgc3ByaXRlcy5zcGxpY2UoaSwgMSk7XG4gICAgICB9XG4gICAgfVxuICAgIGlmIChzcHJpdGVzLmxlbmd0aCkgcmFmID0gcmVxdWVzdEFuaW1hdGlvbkZyYW1lKHN0ZXApO1xuICB9XG4gIFxuICBkcmF3KCk7XG4gIHBhaW50KCk7XG4gIFxuICBpZiAoY3R4LmhzcGFjaW5nLnBjdCkge1xuICAgIGNvbnN0IHRhcmdldCA9IHNjcm9sbC5jbGllbnRXaWR0aCAqIGN0eC5oc3BhY2luZy5wY3QgLyAxMDA7XG4gICAgaWYgKHRhcmdldCA+IDApIHtcbiAgICAgIGhnYXAgPSBzb2x2ZUdhcChjLCBjdHgudmdhcCwgdGFyZ2V0KTtcbiAgICAgIGRyYXcoKTtcbiAgICAgIHBhaW50KCk7XG4gICAgfVxuICB9XG4gIFxuICBsZXQgcm8gPSBudWxsO1xuICBpZiAoY3R4LmhzcGFjaW5nLnBjdCAmJiB0eXBlb2YgUmVzaXplT2JzZXJ2ZXIgIT09IFwidW5kZWZpbmVkXCIpIHtcbiAgICBsZXQgbGFzdFcgPSAwLCBwZW5kaW5nID0gZmFsc2U7XG4gICAgcm8gPSBuZXcgUmVzaXplT2JzZXJ2ZXIoKGVudHJpZXMpID0+IHtcbiAgICAgIGlmIChkaXNwb3NlZCkgcmV0dXJuO1xuICAgICAgY29uc3QgdyA9IGVudHJpZXNbMF0uY29udGVudFJlY3Qud2lkdGg7XG4gICAgICBpZiAoIXcgfHwgTWF0aC5hYnModyAtIGxhc3RXKSA8IDIgfHwgcGVuZGluZykgcmV0dXJuO1xuICAgICAgbGFzdFcgPSB3O1xuICAgICAgcGVuZGluZyA9IHRydWU7XG4gICAgICBsYXRlcigoKSA9PiB7XG4gICAgICAgIHBlbmRpbmcgPSBmYWxzZTtcbiAgICAgICAgaWYgKGRpc3Bvc2VkKSByZXR1cm47XG4gICAgICAgIGhnYXAgPSBzb2x2ZUdhcChjLCBjdHgudmdhcCwgdyAqIGN0eC5oc3BhY2luZy5wY3QgLyAxMDApO1xuICAgICAgICBkcmF3KCk7XG4gICAgICAgIHBhaW50KCk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgICByby5vYnNlcnZlKHNjcm9sbCk7XG4gIH1cbiAgXG4gIHJldHVybiB7XG4gICAgc2ltLFxuICAgIHBhaW50LFxuICAgIGdldFN2ZzogKCkgPT4gc3ZnRWwsXG4gICAgZGlzcG9zZSgpIHtcbiAgICAgIGRpc3Bvc2VkID0gdHJ1ZTtcbiAgICAgIHNpbS5kaXNwb3NlKCk7XG4gICAgICBpZiAocmFmKSBjYW5jZWxBbmltYXRpb25GcmFtZShyYWYpO1xuICAgICAgaWYgKHJvKSByby5kaXNjb25uZWN0KCk7XG4gICAgfVxuICB9O1xufSIsICIvLyBwYWNrYWdlcy9sb2dpYy1ncmFwaC9zcmMvdWkvdGltaW5nLmpzXG5pbXBvcnQgeyBoLCBzLCBsYXRlciB9IGZyb20gXCIuL2RvbS5qc1wiO1xuaW1wb3J0IHsgYWRkRXhwb3J0QnV0dG9uIH0gZnJvbSBcIi4vZXhwb3J0LWltYWdlLmpzXCI7XG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlVGltaW5nKHBhcmVudCwgc2lnbmFscywga2luZHMsIGFwcCkge1xuICBjb25zdCBib3ggPSBoKFwiZGl2XCIsIFwibGctdGltaW5nXCIsIHBhcmVudCk7XG4gIGNvbnN0IGhlYWQgPSBoKFwiZGl2XCIsIFwibGctdGl0bGVcIiwgYm94KTtcbiAgaChcInNwYW5cIiwgXCJcIiwgaGVhZCwgXCJUaW1pbmcgZ3JhcGhcIik7XG4gIGNvbnN0IGNsZWFyQnRuID0gaChcImJ1dHRvblwiLCBcImxnLXNtYWxsXCIsIGhlYWQsIFwiY2xlYXJcIik7XG4gIGNvbnN0IGhvc3QgPSBoKFwiZGl2XCIsIFwibGctc2Nyb2xsXCIsIGJveCk7XG4gIGxldCB0MCA9IHBlcmZvcm1hbmNlLm5vdygpLCBsYXN0ID0gMCwgaGlzdCA9IHt9LCBxdWV1ZWQgPSBmYWxzZSwgc3ZnRWwgPSBudWxsLCBkaXNwb3NlZCA9IGZhbHNlO1xuICBsZXQgbGFzdFZhbHMgPSAoKSA9PiAoe30pO1xuICBhZGRFeHBvcnRCdXR0b24oaGVhZCwgYXBwLCAoKSA9PiBzdmdFbCwgXCJ0aW1pbmctZ3JhcGhcIik7XG4gIGNvbnN0IHNjaGVkdWxlID0gKCkgPT4ge1xuICAgIGlmICghcXVldWVkKSB7XG4gICAgICBxdWV1ZWQgPSB0cnVlO1xuICAgICAgbGF0ZXIoKCkgPT4ge1xuICAgICAgICBxdWV1ZWQgPSBmYWxzZTtcbiAgICAgICAgaWYgKCFkaXNwb3NlZCkgZHJhdygpO1xuICAgICAgfSk7XG4gICAgfVxuICB9O1xuICBmdW5jdGlvbiBiZWdpbih2YWxzKSB7XG4gICAgaWYgKGRpc3Bvc2VkKSByZXR1cm47XG4gICAgdDAgPSBwZXJmb3JtYW5jZS5ub3coKTtcbiAgICBsYXN0ID0gMDtcbiAgICBoaXN0ID0ge307XG4gICAgc2lnbmFscy5mb3JFYWNoKChuKSA9PiB7XG4gICAgICBoaXN0W25dID0gW1swLCB2YWxzW25dXV07XG4gICAgfSk7XG4gICAgc2NoZWR1bGUoKTtcbiAgfVxuICBmdW5jdGlvbiByZWNvcmQoc2lnLCB2KSB7XG4gICAgaWYgKGRpc3Bvc2VkIHx8ICFoaXN0W3NpZ10pIHJldHVybjtcbiAgICBjb25zdCBoMiA9IGhpc3Rbc2lnXTtcbiAgICBpZiAoaDIubGVuZ3RoICYmIGgyW2gyLmxlbmd0aCAtIDFdWzFdID09PSB2KSByZXR1cm47XG4gICAgY29uc3QgdCA9IChwZXJmb3JtYW5jZS5ub3coKSAtIHQwKSAvIDFlMztcbiAgICBoMi5wdXNoKFt0LCB2XSk7XG4gICAgbGFzdCA9IE1hdGgubWF4KGxhc3QsIHQpO1xuICAgIHNjaGVkdWxlKCk7XG4gIH1cbiAgZnVuY3Rpb24gZHJhdygpIHtcbiAgICBpZiAoZGlzcG9zZWQpIHJldHVybjtcbiAgICBob3N0LnRleHRDb250ZW50ID0gXCJcIjtcbiAgICBjb25zdCBXID0gNjQwLCBMQkwgPSA4NCwgUkggPSAyMiwgUEFEID0gMTA7XG4gICAgY29uc3QgVCA9IE1hdGgubWF4KDEsIGxhc3QgKiAxLjEgKyAwLjIpO1xuICAgIGNvbnN0IEggPSBzaWduYWxzLmxlbmd0aCAqIFJIICsgMjg7XG4gICAgY29uc3QgeCA9ICh0KSA9PiBMQkwgKyB0IC8gVCAqIChXIC0gTEJMIC0gUEFEKTtcbiAgICBjb25zdCBzdmcgPSBzKFwic3ZnXCIsIHsgY2xhc3M6IFwibGctc3ZnXCIsIHZpZXdCb3g6IGAwIDAgJHtXfSAke0h9YCwgd2lkdGg6IFcsIGhlaWdodDogSCB9LCBob3N0KTtcbiAgICBzdmdFbCA9IHN2ZztcbiAgICBjb25zdCBzdGVwID0gWzAuMSwgMC4yLCAwLjUsIDEsIDIsIDUsIDEwLCAyMF0uZmluZCgoc3QpID0+IFQgLyBzdCA8PSAxMCkgfHwgMjA7XG4gICAgZm9yIChsZXQgdCA9IDA7IHQgPD0gVCArIDFlLTk7IHQgKz0gc3RlcCkge1xuICAgICAgcyhcImxpbmVcIiwgeyBjbGFzczogXCJsZy1ncmlkXCIsIHgxOiB4KHQpLCB4MjogeCh0KSwgeTE6IDQsIHkyOiBIIC0gMTggfSwgc3ZnKTtcbiAgICAgIHMoXCJ0ZXh0XCIsIHsgY2xhc3M6IFwibGctbXV0ZWRcIiwgeDogeCh0KSwgeTogSCAtIDYsIFwidGV4dC1hbmNob3JcIjogXCJtaWRkbGVcIiB9LCBzdmcsIE1hdGgucm91bmQodCAqIDEwMCkgLyAxMDAgKyBcInNcIik7XG4gICAgfVxuICAgIHNpZ25hbHMuZm9yRWFjaCgobiwgaSkgPT4ge1xuICAgICAgY29uc3QgdG9wID0gNiArIGkgKiBSSCArIDMsIGJvdCA9IDYgKyBpICogUkggKyBSSCAtIDU7XG4gICAgICBjb25zdCB5ID0gKHYpID0+IHYgPyB0b3AgOiBib3Q7XG4gICAgICBzKFwidGV4dFwiLCB7IGNsYXNzOiBcImxnLWxhYmVsXCIsIHg6IExCTCAtIDgsIHk6IGJvdCwgXCJ0ZXh0LWFuY2hvclwiOiBcImVuZFwiIH0sIHN2Zywgbik7XG4gICAgICBjb25zdCBwdHMgPSBbXTtcbiAgICAgIGZvciAoY29uc3QgW3QsIHZdIG9mIGhpc3Rbbl0gfHwgW10pIHtcbiAgICAgICAgY29uc3QgcHJldiA9IHB0c1twdHMubGVuZ3RoIC0gMV07XG4gICAgICAgIGlmIChwcmV2ICYmIHByZXZbMF0gPT09IHQgJiYgcHJldlsxXSA9PT0gdikgY29udGludWU7XG4gICAgICAgIGlmIChwcmV2ICYmIHByZXZbMF0gPT09IHQpIHByZXZbMV0gPSB2O1xuICAgICAgICBlbHNlIHB0cy5wdXNoKFt0LCB2XSk7XG4gICAgICB9XG4gICAgICBpZiAoIXB0cy5sZW5ndGgpIHJldHVybjtcbiAgICAgIGxldCBkID0gYE0ke3gocHRzWzBdWzBdKX0sJHt5KHB0c1swXVsxXSl9YDtcbiAgICAgIGZvciAobGV0IGsgPSAxOyBrIDwgcHRzLmxlbmd0aDsgaysrKSBkICs9IGAgSCR7eChwdHNba11bMF0pfSBWJHt5KHB0c1trXVsxXSl9YDtcbiAgICAgIGQgKz0gYCBIJHt4KFQpfWA7XG4gICAgICBzKFwicGF0aFwiLCB7IGNsYXNzOiBcImxnLXdhdmUgXCIgKyAoa2luZHNbbl0gfHwgXCJcIiksIGQgfSwgc3ZnKTtcbiAgICB9KTtcbiAgfVxuICBjbGVhckJ0bi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4gYmVnaW4obGFzdFZhbHMoKSkpO1xuICByZXR1cm4ge1xuICAgIGJlZ2luLFxuICAgIHJlY29yZCxcbiAgICBzZXRMYXN0VmFscyhmbikge1xuICAgICAgbGFzdFZhbHMgPSBmbjtcbiAgICB9LFxuICAgIGRpc3Bvc2UoKSB7XG4gICAgICBkaXNwb3NlZCA9IHRydWU7XG4gICAgfVxuICB9O1xufVxuXG4iLCAiLy8gcGFja2FnZXMvbG9naWMtZ3JhcGgvc3JjL2NvcmUvY29tcGFjdC5qc1xuZXhwb3J0IGZ1bmN0aW9uIGNvbXBhY3RSb3dzKGMsIGFsbCkge1xuICBjb25zdCBuID0gYy5pbnB1dHMubGVuZ3RoO1xuICBsZXQgY3VyID0gYWxsLm1hcCgociwgaSkgPT4gKHsgdjogaSwgbWFzazogMCwga2V5OiBjLm91dHB1dHMubWFwKChvKSA9PiByW29dKS5qb2luKFwiXCIpIH0pKTtcbiAgbGV0IGNoYW5nZWQgPSB0cnVlO1xuICB3aGlsZSAoY2hhbmdlZCkge1xuICAgIGNoYW5nZWQgPSBmYWxzZTtcbiAgICBjb25zdCBncm91cHMgPSAvKiBAX19QVVJFX18gKi8gbmV3IE1hcCgpO1xuICAgIGN1ci5mb3JFYWNoKCh0KSA9PiB7XG4gICAgICBjb25zdCBrID0gdC5tYXNrICsgXCJ8XCIgKyB0LmtleTtcbiAgICAgIGlmICghZ3JvdXBzLmhhcyhrKSkgZ3JvdXBzLnNldChrLCAvKiBAX19QVVJFX18gKi8gbmV3IE1hcCgpKTtcbiAgICAgIGdyb3Vwcy5nZXQoaykuc2V0KHQudiwgdCk7XG4gICAgfSk7XG4gICAgY29uc3QgbmV4dCA9IFtdLCB1c2VkID0gLyogQF9fUFVSRV9fICovIG5ldyBTZXQoKTtcbiAgICBmb3IgKGNvbnN0IGdycCBvZiBncm91cHMudmFsdWVzKCkpIHtcbiAgICAgIGZvciAoY29uc3QgdCBvZiBncnAudmFsdWVzKCkpIHtcbiAgICAgICAgaWYgKHVzZWQuaGFzKHQpKSBjb250aW51ZTtcbiAgICAgICAgbGV0IG1lcmdlZCA9IGZhbHNlO1xuICAgICAgICBmb3IgKGxldCBiID0gMDsgYiA8IG4gJiYgIW1lcmdlZDsgYisrKSB7XG4gICAgICAgICAgY29uc3QgYml0ID0gMSA8PCBiO1xuICAgICAgICAgIGlmICh0Lm1hc2sgJiBiaXQpIGNvbnRpbnVlO1xuICAgICAgICAgIGNvbnN0IHAgPSBncnAuZ2V0KHQudiBeIGJpdCk7XG4gICAgICAgICAgaWYgKHAgJiYgIXVzZWQuaGFzKHApKSB7XG4gICAgICAgICAgICB1c2VkLmFkZCh0KTtcbiAgICAgICAgICAgIHVzZWQuYWRkKHApO1xuICAgICAgICAgICAgbmV4dC5wdXNoKHsgdjogdC52ICYgfmJpdCwgbWFzazogdC5tYXNrIHwgYml0LCBrZXk6IHQua2V5IH0pO1xuICAgICAgICAgICAgbWVyZ2VkID0gY2hhbmdlZCA9IHRydWU7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmICghbWVyZ2VkKSB7XG4gICAgICAgICAgdXNlZC5hZGQodCk7XG4gICAgICAgICAgbmV4dC5wdXNoKHQpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIGN1ciA9IG5leHQ7XG4gIH1cbiAgcmV0dXJuIGN1ci5zb3J0KChhLCBiKSA9PiBhLnYgLSBiLnYgfHwgYS5tYXNrIC0gYi5tYXNrKTtcbn1cblxuIiwgIi8vIHBhY2thZ2VzL2xvZ2ljLWdyYXBoL3NyYy91aS90YWJsZS5qc1xuaW1wb3J0IHsgaCB9IGZyb20gXCIuL2RvbS5qc1wiO1xuaW1wb3J0IHsgY29tcGFjdFJvd3MgfSBmcm9tIFwiLi4vY29yZS9jb21wYWN0LmpzXCI7XG5leHBvcnQgZnVuY3Rpb24gcmVuZGVyVGFibGUocGFyZW50LCBjLCBhbGwsIGNvbXBhY3QpIHtcbiAgY29uc3QgbiA9IGMuaW5wdXRzLmxlbmd0aDtcbiAgY29uc3QgdGFibGUgPSBoKFwidGFibGVcIiwgXCJsZy10YWJsZVwiLCBwYXJlbnQpO1xuICBjb25zdCBoZWFkID0gaChcInRyXCIsIFwiXCIsIGgoXCJ0aGVhZFwiLCBcIlwiLCB0YWJsZSkpO1xuICBsZXQgY29scywgcm93cztcbiAgaWYgKGNvbXBhY3QpIHtcbiAgICBjb2xzID0gWy4uLmMuaW5wdXRzLm1hcCgoeCkgPT4gKHsgbjogeCwgY2xzOiBcIlwiIH0pKSwgLi4uYy5vdXRwdXRzLm1hcCgoeCwgaSkgPT4gKHsgbjogeCwgY2xzOiBpID09PSAwID8gXCJsZy1zZXBcIiA6IFwiXCIgfSkpXTtcbiAgICByb3dzID0gY29tcGFjdFJvd3MoYywgYWxsKS5tYXAoKHQpID0+IHtcbiAgICAgIGNvbnN0IHBhdHRlcm4gPSB7fTtcbiAgICAgIGMuaW5wdXRzLmZvckVhY2goKHgsIGspID0+IHtcbiAgICAgICAgY29uc3QgYml0ID0gMSA8PCBuIC0gMSAtIGs7XG4gICAgICAgIHBhdHRlcm5beF0gPSB0Lm1hc2sgJiBiaXQgPyBcIlhcIiA6IHQudiAmIGJpdCA/IDEgOiAwO1xuICAgICAgfSk7XG4gICAgICBjb25zdCByID0gYWxsW3Qudl07XG4gICAgICByZXR1cm4geyB2OiB0LnYsIG1hc2s6IHQubWFzaywgcGF0dGVybiwgY2VsbHM6IFsuLi5jLmlucHV0cy5tYXAoKHgpID0+IFN0cmluZyhwYXR0ZXJuW3hdKSksIC4uLmMub3V0cHV0cy5tYXAoKG8pID0+IFN0cmluZyhyW29dKSldIH07XG4gICAgfSk7XG4gIH0gZWxzZSB7XG4gICAgY29scyA9IFtcbiAgICAgIC4uLmMuaW5wdXRzLm1hcCgoeCkgPT4gKHsgbjogeCwgY2xzOiBcIlwiIH0pKSxcbiAgICAgIC4uLmMubWlkZGxlcy5tYXAoKHgsIGkpID0+ICh7IG46IHgsIGNsczogXCJsZy1taWRcIiArIChpID09PSAwID8gXCIgbGctc2VwXCIgOiBcIlwiKSB9KSksXG4gICAgICAuLi5jLm91dHB1dHMubWFwKCh4LCBpKSA9PiAoeyBuOiB4LCBjbHM6IGkgPT09IDAgPyBcImxnLXNlcFwiIDogXCJcIiB9KSlcbiAgICBdO1xuICAgIHJvd3MgPSBhbGwubWFwKChyLCBpKSA9PiB7XG4gICAgICBjb25zdCBwYXR0ZXJuID0ge307XG4gICAgICBjLmlucHV0cy5mb3JFYWNoKCh4KSA9PiB7XG4gICAgICAgIHBhdHRlcm5beF0gPSByW3hdO1xuICAgICAgfSk7XG4gICAgICByZXR1cm4geyB2OiBpLCBtYXNrOiAwLCBwYXR0ZXJuLCBjZWxsczogY29scy5tYXAoKGNvbCkgPT4gU3RyaW5nKHJbY29sLm5dKSkgfTtcbiAgICB9KTtcbiAgfVxuICBjb2xzLmZvckVhY2goKGNvbCkgPT4gaChcInRoXCIsIGNvbC5jbHMsIGhlYWQsIGNvbC5uKSk7XG4gIGNvbnN0IHRib2R5ID0gaChcInRib2R5XCIsIFwiXCIsIHRhYmxlKTtcbiAgY29uc3QgdHJzID0gcm93cy5tYXAoKHJvdykgPT4ge1xuICAgIGNvbnN0IHRyID0gaChcInRyXCIsIFwiXCIsIHRib2R5KTtcbiAgICByb3cuY2VsbHMuZm9yRWFjaCgodHh0LCBrKSA9PiBoKFwidGRcIiwgY29sc1trXS5jbHMsIHRyLCB0eHQpKTtcbiAgICByZXR1cm4gdHI7XG4gIH0pO1xuICByZXR1cm4ge1xuICAgIHRhYmxlLFxuICAgIHJvd3MsXG4gICAgdHJzLFxuICAgIGNvbE5hbWVzOiBjb2xzLm1hcCgoeCkgPT4geC5uKSxcbiAgICBtYXJrQWN0aXZlKGlkeCkge1xuICAgICAgcm93cy5mb3JFYWNoKChyLCBpKSA9PiB0cnNbaV0uY2xhc3NMaXN0LnRvZ2dsZShcImxnLWFjdGl2ZVwiLCAoaWR4ICYgfnIubWFzaykgPT09IHIudikpO1xuICAgIH1cbiAgfTtcbn1cbmV4cG9ydCBmdW5jdGlvbiB0YWJsZVRvTWFya2Rvd24oY29sTmFtZXMsIGNlbGxSb3dzKSB7XG4gIGNvbnN0IGVzYyA9IChzMikgPT4gU3RyaW5nKHMyKS5yZXBsYWNlKC9cXHwvZywgXCJcXFxcfFwiKTtcbiAgY29uc3Qgcm93ID0gKGNlbGxzKSA9PiBcInwgXCIgKyBjZWxscy5tYXAoZXNjKS5qb2luKFwiIHwgXCIpICsgXCIgfFwiO1xuICBjb25zdCBzZXAgPSBcInwgXCIgKyBjb2xOYW1lcy5tYXAoKCkgPT4gXCI6LTpcIikuam9pbihcIiB8IFwiKSArIFwiIHxcIjtcbiAgcmV0dXJuIFtyb3coY29sTmFtZXMpLCBzZXAsIC4uLmNlbGxSb3dzLm1hcChyb3cpXS5qb2luKFwiXFxuXCIpO1xufVxuXG4iLCAiLy8gcGFja2FnZXMvbG9naWMtZ3JhcGgvc3JjL3VpL2ttYXAuanNcbmltcG9ydCB7IG1hdGgsIHMsIGgsIGNsaWNrYWJsZSB9IGZyb20gXCIuL2RvbS5qc1wiO1xuaW1wb3J0IHsgYWRkRXhwb3J0QnV0dG9uIH0gZnJvbSBcIi4vZXhwb3J0LWltYWdlLmpzXCI7XG5pbXBvcnQgeyBjdWJlTGl0ZXJhbHMsIGN1YmVMYXRleCB9IGZyb20gXCIuLi9jb3JlL21pbmltaXplLmpzXCI7XG5cbmV4cG9ydCBjb25zdCBLR1JBWSA9IChrKSA9PiBrID09PSAwID8gWzBdIDogayA9PT0gMSA/IFswLCAxXSA6IFswLCAxLCAzLCAyXTtcbmV4cG9ydCBjb25zdCBLQ09MT1JTID0gW1wiI2U1NDg0ZFwiLCBcIiMzYjgyZjZcIiwgXCIjMzBhNDZjXCIsIFwiI2Y1YTUyNFwiLCBcIiM4ZTRlYzZcIiwgXCIjMTJhNTk0XCJdO1xuXG5leHBvcnQgZnVuY3Rpb24ga21hcEFyY3MoY3ViZSwgbiwgc3RhcnRWYXIsIGNvdW50KSB7XG4gIGNvbnN0IHNpemUgPSAxIDw8IGNvdW50LCBnID0gS0dSQVkoY291bnQpLCBwb3MgPSBbXTtcbiAgZm9yIChsZXQgcCA9IDA7IHAgPCBzaXplOyBwKyspIHtcbiAgICBsZXQgb2sgPSB0cnVlO1xuICAgIGZvciAobGV0IGogPSAwOyBqIDwgY291bnQgJiYgb2s7IGorKykge1xuICAgICAgY29uc3QgYml0ID0gMSA8PCBuIC0gMSAtIChzdGFydFZhciArIGopO1xuICAgICAgaWYgKGN1YmUubWFzayAmIGJpdCkgY29udGludWU7XG4gICAgICBpZiAoKGN1YmUudiAmIGJpdCA/IDEgOiAwKSAhPT0gKGdbcF0gPj4gY291bnQgLSAxIC0gaiAmIDEpKSBvayA9IGZhbHNlO1xuICAgIH1cbiAgICBpZiAob2spIHBvcy5wdXNoKHApO1xuICB9XG4gIGlmICghcG9zLmxlbmd0aCkgcmV0dXJuIFtdO1xuICBpZiAocG9zLmxlbmd0aCA9PT0gc2l6ZSkgcmV0dXJuIFt7IGE6IDAsIGI6IHNpemUgLSAxLCBvcGVuQTogZmFsc2UsIG9wZW5COiBmYWxzZSB9XTtcbiAgY29uc3QgcnVucyA9IFtdO1xuICBsZXQgc3QgPSBwb3NbMF0sIHByZXYgPSBwb3NbMF07XG4gIGZvciAobGV0IGkgPSAxOyBpIDwgcG9zLmxlbmd0aDsgaSsrKSB7XG4gICAgaWYgKHBvc1tpXSA9PT0gcHJldiArIDEpIHByZXYgPSBwb3NbaV07XG4gICAgZWxzZSB7XG4gICAgICBydW5zLnB1c2goW3N0LCBwcmV2XSk7XG4gICAgICBzdCA9IHBvc1tpXTtcbiAgICAgIHByZXYgPSBwb3NbaV07XG4gICAgfVxuICB9XG4gIHJ1bnMucHVzaChbc3QsIHByZXZdKTtcbiAgaWYgKHJ1bnMubGVuZ3RoID4gMSAmJiBydW5zWzBdWzBdID09PSAwICYmIHJ1bnNbcnVucy5sZW5ndGggLSAxXVsxXSA9PT0gc2l6ZSAtIDEpIHtcbiAgICByZXR1cm4gcnVucy5tYXAoKHIsIGkpID0+ICh7IGE6IHJbMF0sIGI6IHJbMV0sIG9wZW5BOiBpID09PSAwLCBvcGVuQjogaSA9PT0gcnVucy5sZW5ndGggLSAxIH0pKTtcbiAgfVxuICByZXR1cm4gcnVucy5tYXAoKHIpID0+ICh7IGE6IHJbMF0sIGI6IHJbMV0sIG9wZW5BOiBmYWxzZSwgb3BlbkI6IGZhbHNlIH0pKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIG91dGxpbmVQYXRoKHgsIHksIHcsIGhoLCByLCBvTCwgb1IsIG9ULCBvQikge1xuICBjb25zdCByVEwgPSAhb1QgJiYgIW9MID8gciA6IDAsIHJUUiA9ICFvVCAmJiAhb1IgPyByIDogMCwgckJSID0gIW9CICYmICFvUiA/IHIgOiAwLCByQkwgPSAhb0IgJiYgIW9MID8gciA6IDA7XG4gIGNvbnN0IGQgPSBbXTtcbiAgaWYgKCFvVCkgZC5wdXNoKGBNJHt4ICsgclRMfSwke3l9IEwke3ggKyB3IC0gclRSfSwke3l9YCk7XG4gIGlmIChyVFIpIGQucHVzaChgTSR7eCArIHcgLSByVFJ9LCR7eX0gQSR7clRSfSwke3JUUn0gMCAwIDEgJHt4ICsgd30sJHt5ICsgclRSfWApO1xuICBpZiAoIW9SKSBkLnB1c2goYE0ke3ggKyB3fSwke3kgKyByVFJ9IEwke3ggKyB3fSwke3kgKyBoaCAtIHJCUn1gKTtcbiAgaWYgKHJCUikgZC5wdXNoKGBNJHt4ICsgd30sJHt5ICsgaGggLSByQlJ9IEEke3JCUn0sJHtyQlJ9IDAgMCAxICR7eCArIHcgLSByQlJ9LCR7eSArIGhofWApO1xuICBpZiAoIW9CKSBkLnB1c2goYE0ke3ggKyB3IC0gckJSfSwke3kgKyBoaH0gTCR7eCArIHJCTH0sJHt5ICsgaGh9YCk7XG4gIGlmIChyQkwpIGQucHVzaChgTSR7eCArIHJCTH0sJHt5ICsgaGh9IEEke3JCTH0sJHtyQkx9IDAgMCAxICR7eH0sJHt5ICsgaGggLSByQkx9YCk7XG4gIGlmICghb0wpIGQucHVzaChgTSR7eH0sJHt5ICsgaGggLSByQkx9IEwke3h9LCR7eSArIHJUTH1gKTtcbiAgaWYgKHJUTCkgZC5wdXNoKGBNJHt4fSwke3kgKyByVEx9IEEke3JUTH0sJHtyVEx9IDAgMCAxICR7eCArIHJUTH0sJHt5fWApO1xuICByZXR1cm4gZC5qb2luKFwiIFwiKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGttYXBQaWVjZXMoY3ViZSwgbiwgZ3JpZFZhcnMsIHJvd1ZhcnMsIGNvbFZhcnMsIGV4dHJhLCBzbGljZSkge1xuICBmb3IgKGxldCBqID0gMDsgaiA8IGV4dHJhOyBqKyspIHtcbiAgICBjb25zdCBiaXQgPSAxIDw8IG4gLSAxIC0gKGdyaWRWYXJzICsgaik7XG4gICAgaWYgKGN1YmUubWFzayAmIGJpdCkgY29udGludWU7XG4gICAgaWYgKChjdWJlLnYgJiBiaXQgPyAxIDogMCkgIT09IChzbGljZSA+PiBleHRyYSAtIDEgLSBqICYgMSkpIHJldHVybiBbXTtcbiAgfVxuICBjb25zdCByb3dzID0ga21hcEFyY3MoY3ViZSwgbiwgMCwgcm93VmFycyksIGNvbHMgPSBrbWFwQXJjcyhjdWJlLCBuLCByb3dWYXJzLCBjb2xWYXJzKTtcbiAgY29uc3Qgb3V0ID0gW107XG4gIHJvd3MuZm9yRWFjaCgocmEpID0+IGNvbHMuZm9yRWFjaCgoY2EpID0+IG91dC5wdXNoKHtcbiAgICByMDogcmEuYSxcbiAgICByMTogcmEuYixcbiAgICBjMDogY2EuYSxcbiAgICBjMTogY2EuYixcbiAgICBvVDogcmEub3BlbkEsXG4gICAgb0I6IHJhLm9wZW5CLFxuICAgIG9MOiBjYS5vcGVuQSxcbiAgICBvUjogY2Eub3BlbkJcbiAgfSkpKTtcbiAgcmV0dXJuIG91dDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHJlbmRlckttYXBzKHBhcmVudCwgYywgYWxsLCBleHBycywgY3R4KSB7XG4gIGNvbnN0IG4gPSBjLmlucHV0cy5sZW5ndGg7XG4gIGlmIChuIDwgMiB8fCBuID4gNikge1xuICAgIGgoXCJkaXZcIiwgXCJsZy1ub3RlXCIsIHBhcmVudCwgXCJLYXJuYXVnaCBtYXBzIGFyZSBkcmF3biBmb3IgMiB0byA2IGlucHV0cy5cIik7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbiAgY29uc3QgZ3JpZFZhcnMgPSBNYXRoLm1pbihuLCA0KSwgcm93VmFycyA9IE1hdGguZmxvb3IoZ3JpZFZhcnMgLyAyKSwgY29sVmFycyA9IGdyaWRWYXJzIC0gcm93VmFycywgZXh0cmEgPSBuIC0gZ3JpZFZhcnM7XG4gIGNvbnN0IG5SID0gMSA8PCByb3dWYXJzLCBuQyA9IDEgPDwgY29sVmFycztcbiAgY29uc3QgQ1cgPSA0NiwgQ0ggPSAzOCwgTEJMVyA9IDY0LCBIRFJIID0gNDQ7XG4gIGNvbnN0IGJpdHMgPSAodiwgaykgPT4gayA/IHYudG9TdHJpbmcoMikucGFkU3RhcnQoaywgXCIwXCIpIDogXCJcIjtcbiAgY29uc3QgY2VsbEluZGV4ID0gKHJnLCBjZywgc2xpY2UpID0+IHtcbiAgICBsZXQgbSA9IDA7XG4gICAgY29uc3QgcHV0ID0gKHZhbCwgc3RhcnRLLCBjb3VudCkgPT4ge1xuICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCBjb3VudDsgaisrKSBtIHw9ICh2YWwgPj4gY291bnQgLSAxIC0gaiAmIDEpIDw8IG4gLSAxIC0gKHN0YXJ0SyArIGopO1xuICAgIH07XG4gICAgcHV0KHJnLCAwLCByb3dWYXJzKTtcbiAgICBwdXQoY2csIHJvd1ZhcnMsIGNvbFZhcnMpO1xuICAgIHB1dChzbGljZSwgZ3JpZFZhcnMsIGV4dHJhKTtcbiAgICByZXR1cm4gbTtcbiAgfTtcbiAgY29uc3QgYWN0aXZlcyA9IFtdO1xuICBleHBycy5mb3JFYWNoKChlKSA9PiB7XG4gICAgY29uc3QgYmxrID0gaChcImRpdlwiLCBcImxnLWttYXAtYmxvY2tcIiwgcGFyZW50KTtcbiAgICBjb25zdCBoZWFkID0gaChcImRpdlwiLCBcImxnLXRpdGxlXCIsIGJsayk7XG4gICAgaChcInNwYW5cIiwgXCJcIiwgaGVhZCwgYEthcm5hdWdoIG1hcDogJHtlLm5hbWV9YCk7XG4gICAgaWYgKGUuY292LmNvbnN0ICE9PSB2b2lkIDApIHtcbiAgICAgIGgoXCJkaXZcIiwgXCJsZy1ub3RlXCIsIGJsaywgYCR7ZS5uYW1lfSBpcyBjb25zdGFudCAke2UuY292LmNvbnN0fWApO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBoKFwic3BhblwiLCBcImxnLW11dGVkLXRleHRcIiwgaGVhZCwgZS5jb3YuZXhhY3QgPyBcIiAgbWluaW1hbCBjb3ZlciBcIiA6IFwiICBuZWFyLW1pbmltYWwgY292ZXIgXCIpO1xuICAgIGNvbnN0IHN2Z3MgPSBbXTtcbiAgICBhZGRFeHBvcnRCdXR0b24oaGVhZCwgY3R4LmFwcCwgKCkgPT4gc3Znc1swXSwgXCJrYXJuYXVnaC1cIiArIGUubmFtZSk7XG4gICAgY29uc3QgbWFwcyA9IGgoXCJkaXZcIiwgXCJsZy1rbWFwc1wiLCBibGspO1xuICAgIGZvciAobGV0IHNsaWNlID0gMDsgc2xpY2UgPCAxIDw8IGV4dHJhOyBzbGljZSsrKSB7XG4gICAgICBjb25zdCBob2xkZXIgPSBoKFwiZGl2XCIsIFwibGcta21hcC1ob2xkZXJcIiwgbWFwcyk7XG4gICAgICBjb25zdCBXID0gTEJMVyArIG5DICogQ1cgKyA4LCBIID0gSERSSCArIG5SICogQ0ggKyA4O1xuICAgICAgY29uc3Qgc3ZnID0gcyhcInN2Z1wiLCB7IGNsYXNzOiBcImxnLXN2ZyBsZy1rbWFwXCIsIHZpZXdCb3g6IGAwIDAgJHtXfSAke0h9YCwgd2lkdGg6IFcsIGhlaWdodDogSCB9LCBob2xkZXIpO1xuICAgICAgc3Zncy5wdXNoKHN2Zyk7XG4gICAgICBzKFwibGluZVwiLCB7IGNsYXNzOiBcImxnLWtsaW5lXCIsIHgxOiAwLCB5MTogMCwgeDI6IExCTFcsIHkyOiBIRFJIIH0sIHN2Zyk7XG4gICAgICBzKFwidGV4dFwiLCB7IGNsYXNzOiBcImxnLWtsYWJlbFwiLCB4OiBMQkxXIC0gNiwgeTogMTUsIFwidGV4dC1hbmNob3JcIjogXCJlbmRcIiB9LCBzdmcsIGMuaW5wdXRzLnNsaWNlKHJvd1ZhcnMsIGdyaWRWYXJzKS5qb2luKFwiXCIpKTtcbiAgICAgIHMoXCJ0ZXh0XCIsIHsgY2xhc3M6IFwibGcta2xhYmVsXCIsIHg6IDYsIHk6IEhEUkggLSA3IH0sIHN2ZywgYy5pbnB1dHMuc2xpY2UoMCwgcm93VmFycykuam9pbihcIlwiKSk7XG4gICAgICBLR1JBWShjb2xWYXJzKS5mb3JFYWNoKChjZywgaikgPT4gcyhcInRleHRcIiwgeyBjbGFzczogXCJsZy1rY29kZVwiLCB4OiBMQkxXICsgKGogKyAwLjUpICogQ1csIHk6IEhEUkggLSA4LCBcInRleHQtYW5jaG9yXCI6IFwibWlkZGxlXCIgfSwgc3ZnLCBiaXRzKGNnLCBjb2xWYXJzKSkpO1xuICAgICAgS0dSQVkocm93VmFycykuZm9yRWFjaCgocmcsIGkpID0+IHMoXCJ0ZXh0XCIsIHsgY2xhc3M6IFwibGcta2NvZGVcIiwgeDogTEJMVyAtIDgsIHk6IEhEUkggKyAoaSArIDAuNSkgKiBDSCArIDQsIFwidGV4dC1hbmNob3JcIjogXCJlbmRcIiB9LCBzdmcsIGJpdHMocmcsIHJvd1ZhcnMpKSk7XG4gICAgICBcbiAgICAgIEtHUkFZKHJvd1ZhcnMpLmZvckVhY2goKHJnLCBpKSA9PiBLR1JBWShjb2xWYXJzKS5mb3JFYWNoKChjZywgaikgPT4ge1xuICAgICAgICBjb25zdCBtID0gY2VsbEluZGV4KHJnLCBjZywgc2xpY2UpLCB2YWwgPSBhbGxbbV1bZS5uYW1lXTtcbiAgICAgICAgY29uc3QgcmVjdCA9IHMoXCJyZWN0XCIsIHsgY2xhc3M6IFwibGcta2NlbGxcIiwgeDogTEJMVyArIGogKiBDVywgeTogSERSSCArIGkgKiBDSCwgd2lkdGg6IENXLCBoZWlnaHQ6IENIIH0sIHN2Zyk7XG4gICAgICAgIFxuICAgICAgICBjb25zdCBpc0RvbnRDYXJlID0gdmFsID09PSAtMTtcbiAgICAgICAgLy8gVXNlIFNWRy1zcGVjaWZpYyBjbGFzcyBmb3IgRG9uJ3QgQ2FyZSAoWClcbiAgICAgICAgY29uc3QgdGV4dENsYXNzID0gXCJsZy1rdmFsXCIgKyAodmFsID09PSAxID8gXCIgb25lXCIgOiBcIlwiKSArIChpc0RvbnRDYXJlID8gXCIgbGcta3ZhbC14XCIgOiBcIlwiKTtcbiAgICAgICAgcyhcInRleHRcIiwgeyBjbGFzczogdGV4dENsYXNzLCB4OiBMQkxXICsgKGogKyAwLjUpICogQ1csIHk6IEhEUkggKyAoaSArIDAuNSkgKiBDSCArIDUsIFwidGV4dC1hbmNob3JcIjogXCJtaWRkbGVcIiB9LCBzdmcsIGlzRG9udENhcmUgPyBcIlhcIiA6IFN0cmluZyh2YWwpKTtcbiAgICAgICAgXG4gICAgICAgIC8vIEFkZCBjZWxsIG51bWJlciBpbiB0aGUgYm90dG9tIHJpZ2h0IGNvcm5lciB3aXRoIHRoZSBuZXcgaW52ZXJ0ZWQgY2xhc3NcbiAgICAgICAgcyhcInRleHRcIiwgeyBjbGFzczogXCJsZy1rbnVtXCIsIHg6IExCTFcgKyAoaiArIDEpICogQ1cgLSA0LCB5OiBIRFJIICsgKGkgKyAxKSAqIENIIC0gNCwgXCJ0ZXh0LWFuY2hvclwiOiBcImVuZFwiIH0sIHN2ZywgU3RyaW5nKG0pKTtcblxuICAgICAgICBjbGlja2FibGUocmVjdCwgKCkgPT4gY3R4Lm9uUGljayhtKSk7XG4gICAgICAgIGFjdGl2ZXMucHVzaCh7IHJlY3QsIG0gfSk7XG4gICAgICB9KSk7XG4gICAgICBcbiAgICAgIGUuY292LmNvdmVyLmZvckVhY2goKGNiLCBnaSkgPT4ge1xuICAgICAgICBjb25zdCBjb2xvciA9IEtDT0xPUlNbZ2kgJSBLQ09MT1JTLmxlbmd0aF0sIGluc2V0ID0gMyArIGdpICUgMyAqIDM7XG4gICAgICAgIGttYXBQaWVjZXMoY2IsIG4sIGdyaWRWYXJzLCByb3dWYXJzLCBjb2xWYXJzLCBleHRyYSwgc2xpY2UpLmZvckVhY2goKHApID0+IHtcbiAgICAgICAgICBjb25zdCB4MCA9IExCTFcgKyBwLmMwICogQ1cgKyAocC5vTCA/IDAgOiBpbnNldCksIHgxID0gTEJMVyArIChwLmMxICsgMSkgKiBDVyAtIChwLm9SID8gMCA6IGluc2V0KTtcbiAgICAgICAgICBjb25zdCB5MCA9IEhEUkggKyBwLnIwICogQ0ggKyAocC5vVCA/IDAgOiBpbnNldCksIHkxID0gSERSSCArIChwLnIxICsgMSkgKiBDSCAtIChwLm9CID8gMCA6IGluc2V0KTtcbiAgICAgICAgICBzKFwicmVjdFwiLCB7IGNsYXNzOiBcImxnLWtmaWxsXCIsIHg6IHgwLCB5OiB5MCwgd2lkdGg6IHgxIC0geDAsIGhlaWdodDogeTEgLSB5MCwgcng6IDgsIGZpbGw6IGNvbG9yIH0sIHN2Zyk7XG4gICAgICAgICAgcyhcInBhdGhcIiwgeyBjbGFzczogXCJsZy1rZ3JvdXBcIiwgZDogb3V0bGluZVBhdGgoeDAsIHkwLCB4MSAtIHgwLCB5MSAtIHkwLCA4LCBwLm9MLCBwLm9SLCBwLm9ULCBwLm9CKSwgc3Ryb2tlOiBjb2xvciB9LCBzdmcpO1xuICAgICAgICB9KTtcbiAgICAgIH0pO1xuICAgICAgaWYgKGV4dHJhKSBzKFwidGV4dFwiLCB7IGNsYXNzOiBcImxnLWtjb2RlXCIsIHg6IFcgLSA2LCB5OiAxNCwgXCJ0ZXh0LWFuY2hvclwiOiBcImVuZFwiIH0sIHN2ZywgYy5pbnB1dHMuc2xpY2UoZ3JpZFZhcnMpLmpvaW4oXCJcIikgKyBcIj1cIiArIGJpdHMoc2xpY2UsIGV4dHJhKSk7XG4gICAgfVxuICAgIGNvbnN0IGxlZ2VuZCA9IGgoXCJkaXZcIiwgXCJsZy1sZWdlbmRcIiwgYmxrKTtcbiAgICBlLmNvdi5jb3Zlci5mb3JFYWNoKChjYiwgZ2kpID0+IHtcbiAgICAgIGNvbnN0IGl0ZW0gPSBoKFwic3BhblwiLCBcImxnLWxlZ2VuZC1pdGVtXCIsIGxlZ2VuZCk7XG4gICAgICBoKFwic3BhblwiLCBcImxnLXN3YXRjaFwiLCBpdGVtKS5zdHlsZS5iYWNrZ3JvdW5kID0gS0NPTE9SU1tnaSAlIEtDT0xPUlMubGVuZ3RoXTtcbiAgICAgIG1hdGgoY3ViZUxhdGV4KGMsIGNiKSwgaXRlbSk7XG4gICAgfSk7XG4gIH0pO1xuICByZXR1cm4geyBtYXJrQWN0aXZlKGlkeCkge1xuICAgIGFjdGl2ZXMuZm9yRWFjaCgoYSkgPT4gYS5yZWN0LmNsYXNzTGlzdC50b2dnbGUoXCJsZy1rYWN0aXZlXCIsIGEubSA9PT0gaWR4KSk7XG4gIH0gfTtcbn0iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFDQSxJQUFBQSxtQkFBdUI7OztBQ0FoQixJQUFNLFFBQVE7QUFBQSxFQUNuQixLQUFLLEVBQUUsS0FBSyxHQUFHLE9BQU8sT0FBTyxLQUFLLE9BQU8sSUFBSSxDQUFDLE1BQU0sRUFBRSxNQUFNLENBQUMsTUFBTSxDQUFDLEVBQUU7QUFBQSxFQUN0RSxNQUFNLEVBQUUsS0FBSyxHQUFHLE9BQU8sT0FBTyxLQUFLLE1BQU0sSUFBSSxDQUFDLE1BQU0sQ0FBQyxFQUFFLE1BQU0sQ0FBQyxNQUFNLENBQUMsRUFBRTtBQUFBLEVBQ3ZFLElBQUksRUFBRSxLQUFLLEdBQUcsT0FBTyxNQUFNLEtBQUssT0FBTyxJQUFJLENBQUMsTUFBTSxFQUFFLEtBQUssQ0FBQyxNQUFNLENBQUMsRUFBRTtBQUFBLEVBQ25FLEtBQUssRUFBRSxLQUFLLEdBQUcsT0FBTyxNQUFNLEtBQUssTUFBTSxJQUFJLENBQUMsTUFBTSxDQUFDLEVBQUUsS0FBSyxDQUFDLE1BQU0sQ0FBQyxFQUFFO0FBQUEsRUFDcEUsS0FBSyxFQUFFLEtBQUssR0FBRyxPQUFPLE9BQU8sS0FBSyxPQUFPLElBQUksQ0FBQyxNQUFNLEVBQUUsT0FBTyxDQUFDLE1BQU0sQ0FBQyxFQUFFLFNBQVMsTUFBTSxFQUFFO0FBQUEsRUFDeEYsTUFBTSxFQUFFLEtBQUssR0FBRyxPQUFPLE9BQU8sS0FBSyxNQUFNLElBQUksQ0FBQyxNQUFNLEVBQUUsT0FBTyxDQUFDLE1BQU0sQ0FBQyxFQUFFLFNBQVMsTUFBTSxFQUFFO0FBQUEsRUFDeEYsS0FBSyxFQUFFLEtBQUssR0FBRyxLQUFLLEdBQUcsT0FBTyxPQUFPLEtBQUssTUFBTSxJQUFJLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxFQUFFO0FBQUEsRUFDakUsS0FBSyxFQUFFLEtBQUssR0FBRyxLQUFLLEdBQUcsT0FBTyxPQUFPLEtBQUssT0FBTyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUU7QUFDckU7QUFDTyxJQUFNLFVBQVUsRUFBRSxLQUFLLFFBQVEsTUFBTSxPQUFPLElBQUksT0FBTyxLQUFLLE1BQU0sS0FBSyxRQUFRLE1BQU0sTUFBTTtBQUMzRixJQUFNLE9BQU8sRUFBRSxLQUFLLE9BQU8sTUFBTSxPQUFPLElBQUksTUFBTSxLQUFLLE1BQU0sS0FBSyxPQUFPLE1BQU0sTUFBTTtBQUNyRixJQUFNLFlBQVksRUFBRSxNQUFNLEdBQUcsS0FBSyxHQUFHLE1BQU0sR0FBRyxLQUFLLEVBQUU7OztBQ1pyRCxJQUFNQyxtQkFBa0I7QUFDeEIsSUFBTUMsa0JBQWlCO0FBQ3ZCLElBQU1DLHVCQUFzQjtBQUM1QixJQUFNLGlCQUFpQjtBQUN2QixJQUFNLFFBQVE7QUFDZCxJQUFNLFFBQVEsQ0FBQyxHQUFHLElBQUksT0FBTyxLQUFLLElBQUksSUFBSSxLQUFLLElBQUksSUFBSSxDQUFDLENBQUM7QUFDekQsSUFBTSxxQkFBcUI7QUFDM0IsSUFBTSxvQkFBb0I7QUFDMUIsSUFBTSxpQkFBaUIsQ0FBQyxjQUFjLFFBQVEsT0FBTyxPQUFPLFFBQVEsS0FBSztBQUN6RSxJQUFNLGVBQWUsQ0FBQyxTQUFTLGFBQWEsTUFBTTs7O0FDR3pELElBQUksUUFBUSxDQUFDLFNBQVMsUUFBUSxXQUFXLFFBQVEsUUFBUTtBQUN6RCxJQUFJLGlCQUFpQjtBQUVyQixTQUFTLGVBQWUsTUFBTSxHQUFHLEdBQUc7QUFDbEMsUUFBTSxJQUFJLEtBQUssTUFBTSxvQkFBb0I7QUFDekMsTUFBSSxDQUFDO0FBQUcsVUFBTSxJQUFJLE1BQU0sUUFBUSxDQUFDLHVCQUF1QjtBQUN4RCxNQUFJLE9BQU8sRUFBRSxDQUFDLEVBQUUsWUFBWTtBQUM1QixRQUFNLE9BQU8sRUFBRSxDQUFDLEVBQUUsWUFBWSxFQUFFLE1BQU0sUUFBUSxFQUFFLE9BQU8sT0FBTztBQUM5RCxNQUFJLFNBQVM7QUFBVSxXQUFPO0FBQzlCLE1BQUksS0FBSyxXQUFXLFNBQVMsR0FBRztBQUM5QixTQUFLLFFBQVEsS0FBSyxNQUFNLENBQUMsQ0FBQztBQUMxQixXQUFPO0FBQUEsRUFDVDtBQUNBLFVBQVEsTUFBTTtBQUFBLElBQ1osS0FBSztBQUFRLFFBQUUsT0FBTztBQUFNO0FBQUEsSUFDNUIsS0FBSyxVQUFVO0FBQ2IsWUFBTSxJQUFJLEtBQUssQ0FBQyxLQUFLO0FBQ3JCLFVBQUksQ0FBQyxhQUFhLFNBQVMsQ0FBQztBQUFHLGNBQU0sSUFBSSxNQUFNLFFBQVEsQ0FBQyx3REFBd0Q7QUFDaEgsUUFBRSxTQUFTO0FBQ1g7QUFBQSxJQUNGO0FBQUEsSUFDQSxLQUFLO0FBQUEsSUFDTCxLQUFLO0FBQ0gsVUFBSSxDQUFDLEtBQUs7QUFBUSxjQUFNLElBQUksTUFBTSxRQUFRLENBQUMsT0FBTyxJQUFJLFlBQVksTUFBTSxLQUFLLElBQUksQ0FBQyxFQUFFO0FBQ3BGLFdBQUssUUFBUSxDQUFDLE1BQU07QUFDbEIsWUFBSSxDQUFDLE1BQU0sU0FBUyxDQUFDO0FBQUcsZ0JBQU0sSUFBSSxNQUFNLFFBQVEsQ0FBQyxZQUFZLElBQUksS0FBSyxDQUFDLE1BQU0sTUFBTSxLQUFLLElBQUksQ0FBQyxHQUFHO0FBQ2hHLFNBQUMsU0FBUyxTQUFTLEVBQUUsT0FBTyxFQUFFLE1BQU0sSUFBSSxDQUFDO0FBQ3pDLFNBQUMsU0FBUyxTQUFTLEVBQUUsT0FBTyxFQUFFLE1BQU0sT0FBTyxDQUFDO0FBQUEsTUFDOUMsQ0FBQztBQUNEO0FBQUEsSUFDRixLQUFLLFlBQVk7QUFDZixZQUFNLElBQUksS0FBSyxDQUFDLEtBQUs7QUFDckIsVUFBSSxNQUFNO0FBQU8sVUFBRSxXQUFXO0FBQUEsZUFDckIsZUFBZSxTQUFTLENBQUM7QUFBRyxVQUFFLFdBQVc7QUFBQTtBQUM3QyxjQUFNLElBQUksTUFBTSxRQUFRLENBQUMsdUJBQXVCLGVBQWUsS0FBSyxJQUFJLENBQUMsU0FBUztBQUN2RjtBQUFBLElBQ0Y7QUFBQSxJQUNBLEtBQUs7QUFBVyxRQUFFLFVBQVUsS0FBSyxDQUFDLE1BQU07QUFBTztBQUFBLElBQy9DLEtBQUs7QUFBVyxRQUFFLFVBQVUsS0FBSyxDQUFDLE1BQU07QUFBTztBQUFBLElBQy9DLEtBQUssU0FBUztBQUNaLFlBQU0sSUFBSSxLQUFLLENBQUM7QUFDaEIsVUFBSSxNQUFNO0FBQU8sVUFBRSxRQUFRO0FBQUEsZUFDbEIsTUFBTTtBQUFVLFVBQUUsUUFBUTtBQUFBLFdBQzlCO0FBQ0gsY0FBTSxJQUFJLE9BQU8sQ0FBQztBQUNsQixZQUFJLENBQUMsS0FBSyxDQUFDLE9BQU8sU0FBUyxDQUFDLEtBQUssSUFBSSxNQUFNLElBQUk7QUFBSSxnQkFBTSxJQUFJLE1BQU0sUUFBUSxDQUFDLGdEQUFnRDtBQUM1SCxVQUFFLFFBQVEsSUFBSSxJQUFJLEtBQUs7QUFBQSxNQUN6QjtBQUNBO0FBQUEsSUFDRjtBQUFBLElBQ0E7QUFDRSxZQUFNLElBQUksTUFBTSxRQUFRLENBQUMseUJBQXlCLElBQUksaUJBQWlCLGNBQWMsRUFBRTtBQUFBLEVBQzNGO0FBQ0Y7QUFFTyxTQUFTLFNBQVMsT0FBTyxRQUFRO0FBQ3RDLFFBQU0sU0FBUyxDQUFDO0FBQ2hCLFFBQU0sUUFBUSxDQUFDLE1BQU07QUFBRSxXQUFPLEVBQUUsR0FBRyxJQUFJO0FBQUEsRUFBRyxDQUFDO0FBQzNDLFFBQU0sT0FBTyxvQkFBSSxJQUFJO0FBQ3JCLFFBQU0sUUFBUSxDQUFDLE1BQU0sRUFBRSxJQUFJLFFBQVEsQ0FBQyxNQUFNLEtBQUssSUFBSSxDQUFDLENBQUMsQ0FBQztBQUN0RCxNQUFJLENBQUMsUUFBUTtBQUNYLGFBQVMsQ0FBQztBQUNWLFVBQU0sUUFBUSxDQUFDLE1BQU0sRUFBRSxJQUFJLFFBQVEsQ0FBQyxNQUFNO0FBQ3hDLFVBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLE9BQU8sU0FBUyxDQUFDO0FBQUcsZUFBTyxLQUFLLENBQUM7QUFBQSxJQUN0RCxDQUFDLENBQUM7QUFBQSxFQUNKO0FBQ0EsUUFBTSxRQUFRLElBQUksSUFBSSxNQUFNO0FBQzVCLFFBQU0sUUFBUSxDQUFDO0FBQ2YsTUFBSSxVQUFVLE1BQU0sTUFBTTtBQUMxQixTQUFPLFFBQVEsUUFBUTtBQUNyQixVQUFNLFFBQVEsUUFBUSxPQUFPLENBQUMsTUFBTSxFQUFFLElBQUksTUFBTSxDQUFDLE1BQU0sTUFBTSxJQUFJLENBQUMsQ0FBQyxDQUFDO0FBQ3BFLFFBQUksQ0FBQyxNQUFNLFFBQVE7QUFDakIsWUFBTSxJQUFJLE1BQU0sdURBQXVELFFBQVEsSUFBSSxDQUFDLE1BQU0sRUFBRSxHQUFHLEVBQUUsS0FBSyxJQUFJLENBQUM7QUFBQSxJQUM3RztBQUNBLFVBQU0sUUFBUSxDQUFDLE1BQU07QUFDbkIsWUFBTSxJQUFJLEVBQUUsR0FBRztBQUNmLFlBQU0sS0FBSyxDQUFDO0FBQUEsSUFDZCxDQUFDO0FBQ0QsY0FBVSxRQUFRLE9BQU8sQ0FBQyxNQUFNLENBQUMsTUFBTSxTQUFTLENBQUMsQ0FBQztBQUFBLEVBQ3BEO0FBQ0EsUUFBTSxVQUFVLE1BQU0sSUFBSSxDQUFDLE1BQU0sRUFBRSxHQUFHLEVBQUUsT0FBTyxDQUFDLE1BQU0sQ0FBQyxLQUFLLElBQUksQ0FBQyxDQUFDO0FBQ2xFLFFBQU0sVUFBVSxNQUFNLElBQUksQ0FBQyxNQUFNLEVBQUUsR0FBRyxFQUFFLE9BQU8sQ0FBQyxNQUFNLEtBQUssSUFBSSxDQUFDLENBQUM7QUFDakUsU0FBTyxFQUFFLE9BQU8sT0FBTyxRQUFRLFNBQVMsU0FBUyxRQUFRLEtBQUs7QUFDaEU7QUFFTyxTQUFTLE1BQU0sS0FBSyxRQUFRO0FBQ2pDLFdBQVMsT0FBTyxPQUFPLEVBQUUsV0FBVyxvQkFBb0IsVUFBVSxrQkFBa0IsR0FBRyxNQUFNO0FBQzdGLFFBQU0sUUFBUSxDQUFDO0FBQ2YsUUFBTSxTQUFTLENBQUM7QUFDaEIsUUFBTSxPQUFPLEVBQUUsTUFBTSxvQkFBSSxJQUFJLEdBQUcsTUFBTSxvQkFBSSxJQUFJLEdBQUcsVUFBVSxNQUFNLFNBQVMsTUFBTSxPQUFPLE1BQU0sU0FBUyxNQUFNLFFBQVEsTUFBTSxNQUFNLE1BQU07QUFFdEksTUFBSSxNQUFNLElBQUksRUFBRSxRQUFRLENBQUMsS0FBSyxNQUFNO0FBQ2xDLFVBQU0sT0FBTyxJQUFJLFFBQVEsZUFBZSxFQUFFLEVBQUUsS0FBSztBQUNqRCxRQUFJLENBQUM7QUFBTTtBQUNYLFVBQU0sSUFBSSxJQUFJO0FBQ2QsUUFBSSxLQUFLLENBQUMsTUFBTSxLQUFLO0FBQ25CLHFCQUFlLE1BQU0sR0FBRyxJQUFJO0FBQzVCO0FBQUEsSUFDRjtBQUdBLFVBQU0sSUFBSSxLQUFLLE1BQU0sMkNBQTJDO0FBQ2hFLFFBQUksQ0FBQztBQUFHLFlBQU0sSUFBSSxNQUFNLFFBQVEsQ0FBQyxxQ0FBcUM7QUFHdEUsVUFBTSxNQUFNLEVBQUUsQ0FBQyxFQUFFLE1BQU0sUUFBUSxFQUFFLElBQUksT0FBSyxFQUFFLEtBQUssQ0FBQyxFQUFFLE9BQU8sT0FBTztBQUNsRSxVQUFNLE9BQU8sRUFBRSxDQUFDLEVBQUUsTUFBTSxRQUFRLEVBQUUsSUFBSSxPQUFLLEVBQUUsS0FBSyxDQUFDLEVBQUUsT0FBTyxPQUFPO0FBR25FLFVBQU0sT0FBTyxFQUFFLENBQUMsRUFBRSxZQUFZLEVBQUUsS0FBSztBQUNyQyxVQUFNLE9BQU8sTUFBTSxJQUFJO0FBRXZCLFFBQUksQ0FBQztBQUFNLFlBQU0sSUFBSSxNQUFNLFFBQVEsQ0FBQyxtQkFBbUIsRUFBRSxDQUFDLENBQUMsaUJBQWlCLE9BQU8sS0FBSyxLQUFLLEVBQUUsS0FBSyxJQUFJLENBQUMsRUFBRTtBQUMzRyxRQUFJLEtBQUssV0FBVztBQUFHLFlBQU0sSUFBSSxNQUFNLFFBQVEsQ0FBQywwQ0FBMEM7QUFDMUYsUUFBSSxJQUFJLFNBQVMsS0FBSztBQUFLLFlBQU0sSUFBSSxNQUFNLFFBQVEsQ0FBQyxLQUFLLElBQUksbUJBQW1CLEtBQUssR0FBRyxXQUFXO0FBQ25HLFFBQUksS0FBSyxPQUFPLElBQUksU0FBUyxLQUFLO0FBQUssWUFBTSxJQUFJLE1BQU0sUUFBUSxDQUFDLEtBQUssSUFBSSxrQkFBa0IsS0FBSyxHQUFHLFFBQVE7QUFDM0csUUFBSSxJQUFJLFNBQVM7QUFBZ0IsWUFBTSxJQUFJLE1BQU0sUUFBUSxDQUFDLGFBQWEsY0FBYyxrQkFBa0I7QUFFdkcsZUFBVyxLQUFLLENBQUMsR0FBRyxLQUFLLEdBQUcsSUFBSSxHQUFHO0FBQ2pDLFVBQUksQ0FBQyxNQUFNLEtBQUssQ0FBQztBQUFHLGNBQU0sSUFBSSxNQUFNLFFBQVEsQ0FBQywwQkFBMEIsQ0FBQyxHQUFHO0FBQUEsSUFDN0U7QUFFQSxVQUFNLE1BQU0sS0FBSyxDQUFDO0FBQ2xCLFFBQUksSUFBSSxTQUFTLEdBQUc7QUFBRyxZQUFNLElBQUksTUFBTSxRQUFRLENBQUMsTUFBTSxHQUFHLGdDQUFnQztBQUN6RixRQUFJLE9BQU8sR0FBRztBQUFHLFlBQU0sSUFBSSxNQUFNLFFBQVEsQ0FBQyxhQUFhLEdBQUcscUNBQXFDO0FBQy9GLFFBQUksTUFBTSxVQUFVLE9BQU8sVUFBVTtBQUNuQyxZQUFNLElBQUksTUFBTSxRQUFRLENBQUMsZUFBZSxPQUFPLFFBQVEsMkRBQTJEQyxlQUFjLEdBQUc7QUFBQSxJQUNySTtBQUVBLFVBQU0sT0FBTyxFQUFFLE1BQU0sS0FBSyxLQUFLLE1BQU0sRUFBRTtBQUN2QyxXQUFPLEdBQUcsSUFBSTtBQUNkLFVBQU0sS0FBSyxJQUFJO0FBQUEsRUFDakIsQ0FBQztBQUVELE1BQUksQ0FBQyxNQUFNLFFBQVE7QUFDakIsUUFBSSxLQUFLO0FBQU0sYUFBTyxFQUFFLE9BQU8sQ0FBQyxHQUFHLE9BQU8sQ0FBQyxHQUFHLFFBQVEsQ0FBQyxHQUFHLFNBQVMsQ0FBQyxHQUFHLFNBQVMsQ0FBQyxHQUFHLFFBQVEsQ0FBQyxHQUFHLE1BQU0sb0JBQUksSUFBSSxHQUFHLE1BQU0sT0FBTyxLQUFLO0FBQ25JLFVBQU0sSUFBSSxNQUFNLHdFQUF3RTtBQUFBLEVBQzFGO0FBRUEsUUFBTSxJQUFJLFNBQVMsS0FBSztBQUN4QixNQUFJLEVBQUUsT0FBTyxTQUFTLE9BQU8sV0FBVztBQUN0QyxVQUFNLElBQUksTUFBTSxvQkFBb0IsRUFBRSxPQUFPLE1BQU0sU0FBUyxPQUFPLFNBQVMsdURBQXVEQyxnQkFBZSxJQUFJO0FBQUEsRUFDeEo7QUFDQSxJQUFFLE9BQU87QUFDVCxTQUFPO0FBQ1Q7OztBQzdKQSxzQkFBMkU7QUFDM0UsSUFBTUMsbUJBQWtCLEVBQUUsU0FBUyxnQkFBQUMsU0FBVSxrQkFBa0IsZ0JBQUFDLGlCQUFrQjtBQUMxRSxJQUFNLHVCQUF1QixjQUFjRixpQkFBZ0IsaUJBQWlCO0FBQUEsRUFDakYsWUFBWSxLQUFLLFFBQVE7QUFDdkIsVUFBTSxLQUFLLE1BQU07QUFDakIsU0FBSyxTQUFTO0FBQUEsRUFDaEI7QUFBQSxFQUNBLFVBQVU7QUFDUixVQUFNLEVBQUUsWUFBWSxJQUFJO0FBQ3hCLFVBQU0sSUFBSSxLQUFLLFFBQVEsSUFBSSxFQUFFO0FBQzdCLGdCQUFZLE1BQU07QUFDbEIsVUFBTSxPQUFPLFlBQVk7QUFDdkIsWUFBTSxFQUFFLGFBQWE7QUFDckIsUUFBRSxXQUFXO0FBQUEsSUFDZjtBQUNBLFVBQU0sVUFBVSxDQUFDLFNBQVMsSUFBSUEsaUJBQWdCLFFBQVEsV0FBVyxFQUFFLFFBQVEsSUFBSSxFQUFFLFdBQVc7QUFDNUYsVUFBTSxNQUFNLENBQUMsU0FBUyxLQUFLLElBQUksSUFBSSxVQUFVLFFBQVEsUUFBUSxDQUFDLE1BQU0sRUFBRSxTQUFTLE9BQU8sRUFBRSxHQUFHLENBQUMsQ0FBQyxFQUFFLFNBQVMsT0FBTyxNQUFNO0FBQ25ILFlBQU0sSUFBSSxPQUFPLENBQUM7QUFDbEIsVUFBSSxFQUFFLEtBQUssTUFBTSxNQUFNLENBQUMsT0FBTyxTQUFTLENBQUMsS0FBSyxJQUFJLE1BQU0sSUFBSTtBQUFJO0FBQ2hFLFFBQUUsR0FBRyxJQUFJLFFBQVEsS0FBSyxNQUFNLENBQUMsSUFBSTtBQUNqQyxZQUFNLEtBQUs7QUFBQSxJQUNiLENBQUMsQ0FBQztBQUNGLGdCQUFZLFNBQVMsS0FBSyxFQUFFLE1BQU0sZ0JBQWdCLEVBQUUsU0FBUyxPQUFPLDhGQUE4RixDQUFDO0FBQ25LLFlBQVEsUUFBUTtBQUNoQjtBQUFBLE1BQ0UsSUFBSUEsaUJBQWdCLFFBQVEsV0FBVyxFQUFFLFFBQVEsc0JBQXNCLEVBQUUsUUFBUSxpREFBaUQsZUFBZSw2RUFBNkUsbUJBQW1CLHFCQUFxQjtBQUFBLE1BQ3RRO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsSUFDRjtBQUNBLFFBQUksSUFBSUEsaUJBQWdCLFFBQVEsV0FBVyxFQUFFLFFBQVEscUJBQXFCLEVBQUUsUUFBUSxRQUFRLGNBQWMsR0FBRyxHQUFHLFlBQVksR0FBRyxnQkFBZ0IsSUFBSTtBQUNuSixZQUFRLFNBQVM7QUFDakIsUUFBSUEsaUJBQWdCLFFBQVEsV0FBVyxFQUFFLFFBQVEsZ0NBQWdDLEVBQUUsUUFBUSxpRUFBaUUsRUFBRSxVQUFVLENBQUMsTUFBTSxFQUFFLFNBQVMsRUFBRSxTQUFTLEVBQUUsU0FBUyxPQUFPLE1BQU07QUFDM04sUUFBRSxZQUFZO0FBQ2QsWUFBTSxLQUFLO0FBQUEsSUFDYixDQUFDLENBQUM7QUFDRixRQUFJQSxpQkFBZ0IsUUFBUSxXQUFXLEVBQUUsUUFBUSwwQkFBMEIsRUFBRSxVQUFVLENBQUMsTUFBTSxFQUFFLFNBQVMsRUFBRSxRQUFRLEVBQUUsU0FBUyxPQUFPLE1BQU07QUFDekksUUFBRSxXQUFXO0FBQ2IsWUFBTSxLQUFLO0FBQUEsSUFDYixDQUFDLENBQUM7QUFDRixRQUFJQSxpQkFBZ0IsUUFBUSxXQUFXLEVBQUUsUUFBUSxvQkFBb0IsRUFBRSxRQUFRLHFIQUFxSCxFQUFFLFVBQVUsQ0FBQyxNQUFNLEVBQUUsU0FBUyxFQUFFLFFBQVEsRUFBRSxTQUFTLE9BQU8sTUFBTTtBQUNsUSxRQUFFLFdBQVc7QUFDYixZQUFNLEtBQUs7QUFBQSxJQUNiLENBQUMsQ0FBQztBQUNGLFFBQUlBLGlCQUFnQixRQUFRLFdBQVcsRUFBRSxRQUFRLCtDQUErQyxFQUFFLFFBQVEsMkhBQTJILEVBQUUsVUFBVSxDQUFDLE1BQU0sRUFBRSxTQUFTLEVBQUUsZ0JBQWdCLEVBQUUsU0FBUyxPQUFPLE1BQU07QUFDM1MsUUFBRSxtQkFBbUI7QUFDckIsWUFBTSxLQUFLO0FBQUEsSUFDYixDQUFDLENBQUM7QUFDRixRQUFJQSxpQkFBZ0IsUUFBUSxXQUFXLEVBQUUsUUFBUSxxQkFBcUIsRUFBRSxRQUFRLDRNQUE0TSxFQUFFLFVBQVUsQ0FBQyxNQUFNLEVBQUUsU0FBUyxFQUFFLGFBQWEsRUFBRSxTQUFTLE9BQU8sTUFBTTtBQUMvVixRQUFFLGdCQUFnQjtBQUNsQixZQUFNLEtBQUs7QUFBQSxJQUNiLENBQUMsQ0FBQztBQUNGLFlBQVEsUUFBUTtBQUNoQixRQUFJQSxpQkFBZ0IsUUFBUSxXQUFXLEVBQUUsUUFBUSxzQkFBc0IsRUFBRSxRQUFRLHlEQUF5RCxFQUFFLFVBQVUsQ0FBQyxNQUFNLEVBQUUsU0FBUyxFQUFFLFlBQVksRUFBRSxTQUFTLE9BQU8sTUFBTTtBQUM1TSxRQUFFLGVBQWU7QUFDakIsWUFBTSxLQUFLO0FBQUEsSUFDYixDQUFDLENBQUM7QUFDRjtBQUFBLE1BQ0UsSUFBSUEsaUJBQWdCLFFBQVEsV0FBVyxFQUFFLFFBQVEsMEJBQTBCLEVBQUUsUUFBUSxtRkFBbUY7QUFBQSxNQUN4SztBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLElBQ0Y7QUFDQSxRQUFJQSxpQkFBZ0IsUUFBUSxXQUFXLEVBQUUsUUFBUSxhQUFhLEVBQUUsUUFBUSxzTEFBc0wsRUFBRSxZQUFZLENBQUMsTUFBTTtBQUNqUixRQUFFLFVBQVUsU0FBUyxPQUFPO0FBQzVCLFFBQUUsVUFBVSxhQUFhLFdBQVc7QUFDcEMsUUFBRSxVQUFVLFFBQVEsTUFBTTtBQUMxQixRQUFFLFNBQVMsRUFBRSxVQUFVLEVBQUUsU0FBUyxPQUFPLE1BQU07QUFDN0MsVUFBRSxhQUFhO0FBQ2YsY0FBTSxLQUFLO0FBQUEsTUFDYixDQUFDO0FBQUEsSUFDSCxDQUFDO0FBQ0QsWUFBUSxnQkFBZ0I7QUFDeEIsUUFBSUEsaUJBQWdCLFFBQVEsV0FBVyxFQUFFLFFBQVEsb0JBQW9CLEVBQUUsUUFBUSwySkFBMkosRUFBRSxRQUFRLENBQUMsTUFBTSxFQUFFLFNBQVMsT0FBTyxFQUFFLFFBQVEsQ0FBQyxFQUFFLFNBQVMsT0FBTyxNQUFNO0FBQzlTLFVBQUksYUFBYSxDQUFDLEdBQUc7QUFDbkIsVUFBRSxXQUFXLEVBQUUsS0FBSztBQUNwQixjQUFNLEtBQUs7QUFBQSxNQUNiO0FBQUEsSUFDRixDQUFDLENBQUM7QUFDRixRQUFJLElBQUlBLGlCQUFnQixRQUFRLFdBQVcsRUFBRSxRQUFRLHVCQUF1QixFQUFFLFFBQVEsc0RBQXNELEdBQUcsWUFBWSxHQUFHLEtBQUssSUFBSTtBQUN2SyxZQUFRLGlDQUFpQztBQUN6QyxRQUFJQSxpQkFBZ0IsUUFBUSxXQUFXLEVBQUUsUUFBUSwrQkFBK0IsRUFBRSxRQUFRLDJJQUEySSxFQUFFLFVBQVUsQ0FBQyxNQUFNLEVBQUUsU0FBUyxFQUFFLFdBQVcsRUFBRSxTQUFTLE9BQU8sTUFBTTtBQUN0UyxRQUFFLGNBQWM7QUFDaEIsWUFBTSxLQUFLO0FBQUEsSUFDYixDQUFDLENBQUM7QUFDRixRQUFJQSxpQkFBZ0IsUUFBUSxXQUFXLEVBQUUsUUFBUSxrQkFBa0IsRUFBRSxRQUFRLDRNQUE0TSxFQUFFLFlBQVksQ0FBQyxNQUFNO0FBQzVTLGFBQU8sS0FBSyxZQUFZLEVBQUUsUUFBUSxDQUFDLE1BQU0sRUFBRSxVQUFVLEdBQUcsYUFBYSxDQUFDLENBQUMsQ0FBQztBQUN4RSxRQUFFLFNBQVMsRUFBRSxjQUFjLEVBQUUsU0FBUyxPQUFPLE1BQU07QUFDakQsVUFBRSxpQkFBaUI7QUFDbkIsY0FBTSxLQUFLO0FBQUEsTUFDYixDQUFDO0FBQUEsSUFDSCxDQUFDO0FBQ0QsU0FBSyxjQUFjLGFBQWEsSUFBSTtBQUFBLEVBQ3RDO0FBQUEsRUFDQSxjQUFjLGFBQWEsTUFBTTtBQUMvQixVQUFNLElBQUksS0FBSyxRQUFRLElBQUksRUFBRTtBQUM3QixRQUFJQSxpQkFBZ0IsUUFBUSxXQUFXLEVBQUUsUUFBUSxtQkFBbUIsRUFBRSxXQUFXO0FBQ2pGLFVBQU0sWUFBWSxDQUFDLEVBQUUsS0FBSyxJQUFJLFdBQVcsS0FBSyxJQUFJLFFBQVEsV0FBVyxLQUFLLElBQUksUUFBUSxRQUFRLG1CQUFtQjtBQUNqSCxnQkFBWSxTQUFTLEtBQUs7QUFBQSxNQUN4QixLQUFLO0FBQUEsTUFDTCxNQUFNLFlBQ0YsZ0tBQ0E7QUFBQSxJQUNOLENBQUM7QUFBQSxFQUNIO0FBQ0Y7OztBQ3BHTyxJQUFNLFdBQVc7QUFBQSxFQUN0QixXQUFXO0FBQUEsRUFDWCxVQUFVO0FBQUEsRUFDVixXQUFXO0FBQUEsRUFDWCxVQUFVO0FBQUEsRUFDVixVQUFVO0FBQUEsRUFDVixrQkFBa0I7QUFBQSxFQUNsQixjQUFjO0FBQUEsRUFDZCxjQUFjO0FBQUEsRUFDZCxZQUFZO0FBQUEsRUFDWixlQUFlO0FBQUEsRUFDZixhQUFhO0FBQUEsRUFDYixnQkFBZ0I7QUFBQSxFQUNoQixVQUFVO0FBQUEsRUFDVixVQUFVO0FBQUEsRUFDVixnQkFBZ0I7QUFBQSxFQUNoQixNQUFNLEVBQUUsUUFBUSxJQUFJLFFBQVEsSUFBSSxNQUFNLElBQUksVUFBVSxJQUFJLFlBQVksR0FBRztBQUFBLEVBQ3ZFLFFBQVEsRUFBRSxRQUFRLHFCQUFxQixRQUFRLElBQUksTUFBTSxJQUFJLFVBQVUsSUFBSSxZQUFZLEdBQUc7QUFDNUY7QUFDTyxTQUFTLGlCQUFpQixLQUFLO0FBQ3BDLFFBQU0sS0FBSyxPQUFPLE9BQU8sQ0FBQyxHQUFHLFVBQVUsT0FBTyxDQUFDLENBQUM7QUFDaEQsS0FBRyxZQUFZLE1BQU0sS0FBSyxNQUFNLE9BQU8sR0FBRyxTQUFTLENBQUMsS0FBSyxTQUFTLFdBQVcsR0FBR0csZ0JBQWU7QUFDL0YsS0FBRyxXQUFXLE1BQU0sS0FBSyxNQUFNLE9BQU8sR0FBRyxRQUFRLENBQUMsS0FBSyxTQUFTLFVBQVUsR0FBR0MsZUFBYztBQUMzRixRQUFNLElBQUksT0FBTyxHQUFHLFlBQVk7QUFDaEMsS0FBRyxlQUFlLE9BQU8sU0FBUyxDQUFDLElBQUksSUFBSSxJQUFJLEtBQUssTUFBTSxHQUFHLEdBQUcsRUFBRSxJQUFJLFNBQVM7QUFDL0UsUUFBTSxJQUFJLE9BQU8sR0FBRyxRQUFRO0FBQzVCLEtBQUcsV0FBVyxPQUFPLFNBQVMsQ0FBQyxJQUFJLE1BQU0sS0FBSyxNQUFNLENBQUMsR0FBRyxHQUFHLEdBQUcsSUFBSSxTQUFTO0FBQzNFLE1BQUksQ0FBQ0MsY0FBYSxHQUFHLFFBQVE7QUFBRyxPQUFHLFdBQVcsU0FBUztBQUN2RCxNQUFJLENBQUMsZUFBZSxTQUFTLEdBQUcsY0FBYztBQUFHLE9BQUcsaUJBQWlCO0FBQ3JFLE1BQUksQ0FBQyxhQUFhLFNBQVMsR0FBRyxVQUFVO0FBQUcsT0FBRyxhQUFhO0FBQzNELEtBQUcsT0FBTyxPQUFPLE9BQU8sQ0FBQyxHQUFHLFNBQVMsTUFBTSxPQUFPLElBQUksUUFBUSxDQUFDLENBQUM7QUFDaEUsS0FBRyxTQUFTLE9BQU8sT0FBTyxDQUFDLEdBQUcsU0FBUyxRQUFRLE9BQU8sSUFBSSxVQUFVLENBQUMsQ0FBQztBQUN0RSxNQUFJLE9BQU8sSUFBSSxVQUFVLENBQUMsR0FBRyxLQUFLO0FBQVEsT0FBRyxLQUFLLFNBQVMsSUFBSTtBQUMvRCxNQUFJLE9BQU8sSUFBSSxTQUFTLEVBQUUsSUFBSSxVQUFVLElBQUksT0FBTztBQUFTLE9BQUcsT0FBTyxTQUFTLElBQUk7QUFDbkYsU0FBTyxHQUFHO0FBQ1YsU0FBTyxHQUFHO0FBQ1YsTUFBSSxDQUFDLENBQUMsU0FBUyxVQUFVLFVBQVUsUUFBUSxZQUFZLFlBQVksRUFBRSxTQUFTLEdBQUcsY0FBYztBQUFHLE9BQUcsaUJBQWlCO0FBQ3RILFNBQU87QUFDVDtBQUNPLFNBQVNBLGNBQWEsS0FBSztBQUNoQyxRQUFNLElBQUksT0FBTyxHQUFHLEVBQUUsS0FBSyxFQUFFLE1BQU0sOEJBQThCO0FBQ2pFLE1BQUksQ0FBQztBQUFHLFdBQU87QUFDZixRQUFNLElBQUksV0FBVyxFQUFFLENBQUMsQ0FBQztBQUN6QixTQUFPLEVBQUUsQ0FBQyxNQUFNLE1BQU0sRUFBRSxLQUFLLE1BQU0sR0FBRyxJQUFJLEdBQUcsRUFBRSxJQUFJLEVBQUUsSUFBSSxNQUFNLEtBQUssTUFBTSxDQUFDLEdBQUcsSUFBSSxHQUFHLEVBQUU7QUFDekY7OztBQ25ETyxJQUFNLFlBQVk7QUFBQSxFQUN2QixPQUFPLEVBQUUsTUFBTSxxREFBcUQ7QUFBQSxFQUNwRSxRQUFRLEVBQUUsTUFBTSxzQkFBc0IsU0FBUyxpQkFBaUIsV0FBVyxhQUFhO0FBQUEsRUFDeEYsUUFBUSxFQUFFLE1BQU0sbUJBQW1CLFNBQVMsY0FBYyxXQUFXLGFBQWE7QUFBQSxFQUNsRixNQUFNLEVBQUUsTUFBTSxjQUFjLFNBQVMsY0FBYyxXQUFXLGFBQWE7QUFBQSxFQUMzRSxVQUFVLEVBQUUsTUFBTSxZQUFZLFNBQVMsYUFBYSxXQUFXLGFBQWE7QUFBQSxFQUM1RSxZQUFZLEVBQUUsTUFBTSxjQUFjLFNBQVMsZ0JBQWdCLFdBQVcsaUJBQWlCO0FBQ3pGOzs7QUNQQSxJQUFBQyxvQkFBa0M7QUFDM0IsSUFBTSxZQUFZO0FBQUEsRUFDdkIsRUFBRSxNQUFNLHlCQUF5QixNQUFNLGdCQUFnQjtBQUFBLEVBQ3ZELEVBQUUsTUFBTSxjQUFjLE1BQU0scUNBQXFDO0FBQUEsRUFDakUsRUFBRSxNQUFNLGNBQWMsTUFBTSxvRkFBb0Y7QUFBQSxFQUNoSCxFQUFFLE1BQU0sc0JBQXNCLE1BQU0sNERBQTREO0FBQUEsRUFDaEcsRUFBRSxNQUFNLGtCQUFrQixNQUFNLGlHQUFpRztBQUFBLEVBQ2pJLEVBQUUsTUFBTSxvQkFBb0IsTUFBTSxnRUFBZ0U7QUFBQSxFQUNsRyxFQUFFLE1BQU0sMkJBQTJCLE1BQU0sdURBQXVEO0FBQUEsRUFDaEcsRUFBRSxNQUFNLHVCQUF1QixNQUFNLHdFQUF3RTtBQUMvRztBQUNPLElBQU0sUUFBUSxDQUFDLFNBQVMsZUFBZSxPQUFPO0FBQzlDLElBQU0sZ0JBQWdCLGNBQStCLG9DQUFrQjtBQUFBLEVBQzVFLFlBQVksS0FBSyxRQUFRO0FBQ3ZCLFVBQU0sR0FBRztBQUNULFNBQUssU0FBUztBQUNkLFNBQUssZUFBZSxpQ0FBaUM7QUFBQSxFQUN2RDtBQUFBLEVBQ0EsV0FBVztBQUNULFdBQU87QUFBQSxFQUNUO0FBQUEsRUFDQSxZQUFZLEdBQUc7QUFDYixXQUFPLEVBQUU7QUFBQSxFQUNYO0FBQUEsRUFDQSxhQUFhLEdBQUc7QUFDZCxTQUFLLE9BQU8sQ0FBQztBQUFBLEVBQ2Y7QUFDRjs7O0FDM0JBLElBQUFDLG1CQUFpQzs7O0FDRTFCLFNBQVMsU0FBUyxHQUFHLFdBQVc7QUFDckMsUUFBTSxJQUFJLE9BQU8sT0FBTyxDQUFDLEdBQUcsU0FBUztBQUNyQyxJQUFFLE1BQU0sUUFBUSxDQUFDLE1BQU07QUFDckIsTUFBRSxFQUFFLEdBQUcsSUFBSSxDQUFDLE1BQU0sRUFBRSxJQUFJLEVBQUUsR0FBRyxFQUFFLElBQUksSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7QUFBQSxFQUN2RCxDQUFDO0FBQ0QsU0FBTztBQUNUO0FBSU8sU0FBUyxXQUFXLEdBQUcsZUFBZSxPQUFPO0FBQ2xELFFBQU0sSUFBSSxFQUFFLE9BQU87QUFDbkIsUUFBTSxPQUFPLENBQUM7QUFDZCxXQUFTLElBQUksR0FBRyxJQUFJLEtBQUssR0FBRyxLQUFLO0FBQy9CLFVBQU0sTUFBTSxDQUFDO0FBQ2IsTUFBRSxPQUFPLFFBQVEsQ0FBQyxHQUFHLE1BQU07QUFDekIsVUFBSSxDQUFDLElBQUksS0FBSyxJQUFJLElBQUksSUFBSTtBQUFBLElBQzVCLENBQUM7QUFDRCxVQUFNLE1BQU0sU0FBUyxHQUFHLEdBQUc7QUFFM0IsUUFBSSxjQUFjO0FBQ2hCLFFBQUUsUUFBUSxRQUFRLE9BQUs7QUFDckIsWUFBSSxLQUFLLE9BQU8sSUFBSTtBQUFNLGNBQUksQ0FBQyxJQUFJO0FBQUEsTUFDckMsQ0FBQztBQUFBLElBQ0g7QUFFQSxTQUFLLEtBQUssR0FBRztBQUFBLEVBQ2Y7QUFDQSxTQUFPO0FBQ1Q7QUFFTyxTQUFTLFVBQVUsR0FBRyxVQUFVLFVBQVUsUUFBUTtBQUN2RCxRQUFNLE9BQU8sQ0FBQztBQUNkLElBQUUsT0FBTyxRQUFRLENBQUMsTUFBTTtBQUN0QixTQUFLLENBQUMsSUFBSTtBQUFBLEVBQ1osQ0FBQztBQUNELFFBQU0sT0FBTyxTQUFTLEdBQUcsSUFBSTtBQUM3QixRQUFNLFNBQXlCLG9CQUFJLElBQUk7QUFDdkMsUUFBTSxZQUFZLENBQUM7QUFDbkIsTUFBSSxXQUFXO0FBQ2YsSUFBRSxNQUFNLFFBQVEsQ0FBQyxNQUFNLEVBQUUsSUFBSSxRQUFRLENBQUMsTUFBTTtBQUMxQyxLQUFDLFVBQVUsQ0FBQyxJQUFJLFVBQVUsQ0FBQyxLQUFLLENBQUMsR0FBRyxLQUFLLENBQUM7QUFBQSxFQUM1QyxDQUFDLENBQUM7QUFDRixRQUFNLE9BQU8sQ0FBQyxNQUFNO0FBQ2xCLFFBQUksQ0FBQyxZQUFZO0FBQVEsYUFBTyxDQUFDO0FBQUEsRUFDbkM7QUFDQSxXQUFTLElBQUksS0FBSyxHQUFHO0FBQ25CLFFBQUksWUFBWSxLQUFLLEdBQUcsTUFBTTtBQUFHO0FBQ2pDLFNBQUssR0FBRyxJQUFJO0FBQ1osYUFBUyxLQUFLLENBQUM7QUFDZixLQUFDLFVBQVUsR0FBRyxLQUFLLENBQUMsR0FBRyxRQUFRLE1BQU07QUFBQSxFQUN2QztBQUNBLFdBQVMsT0FBTyxHQUFHO0FBQ2pCLFFBQUk7QUFBVTtBQUNkLFVBQU0sU0FBUyxDQUFDLE1BQU0sRUFBRSxJQUFJLEVBQUUsR0FBRyxFQUFFLElBQUksSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7QUFDNUQsVUFBTSxPQUFPLE9BQU8sSUFBSSxDQUFDO0FBQ3pCLFFBQUksTUFBTTtBQUNSLG1CQUFhLEtBQUssQ0FBQztBQUNuQixhQUFPLE9BQU8sQ0FBQztBQUFBLElBQ2pCO0FBQ0EsUUFBSSxXQUFXLEtBQUssRUFBRSxHQUFHLEdBQUc7QUFDMUIsVUFBSTtBQUFNLGFBQUssQ0FBQztBQUNoQjtBQUFBLElBQ0Y7QUFDQSxVQUFNLElBQUksU0FBUztBQUNuQixRQUFJLEVBQUUsSUFBSSxJQUFJO0FBQ1osVUFBSSxFQUFFLEtBQUssTUFBTTtBQUNqQixVQUFJO0FBQU0sYUFBSyxDQUFDO0FBQ2hCO0FBQUEsSUFDRjtBQUNBLFVBQU0sS0FBSyxXQUFXLE1BQU07QUFDMUIsYUFBTyxPQUFPLENBQUM7QUFDZixVQUFJO0FBQVU7QUFDZCxVQUFJLEVBQUUsS0FBSyxNQUFNO0FBQ2pCLFdBQUssQ0FBQztBQUFBLElBQ1IsR0FBRyxJQUFJLEdBQUc7QUFDVixXQUFPLElBQUksR0FBRyxFQUFFLEdBQUcsSUFBSSxPQUFPLENBQUM7QUFDL0IsU0FBSyxDQUFDO0FBQUEsRUFDUjtBQUNBLFNBQU87QUFBQSxJQUNMO0FBQUEsSUFDQSxVQUFVLE9BQU87QUFDZixhQUFPLEtBQUssS0FBSyxFQUFFLFFBQVEsQ0FBQyxNQUFNLElBQUksR0FBRyxNQUFNLENBQUMsQ0FBQyxDQUFDO0FBQUEsSUFDcEQ7QUFBQSxJQUNBLFVBQVU7QUFDUixhQUFPLE9BQU87QUFBQSxJQUNoQjtBQUFBLElBQ0EsUUFBUSxHQUFHO0FBQ1QsWUFBTSxJQUFJLE9BQU8sSUFBSSxDQUFDO0FBQ3RCLGFBQU8sSUFBSSxFQUFFLFNBQVM7QUFBQSxJQUN4QjtBQUFBLElBQ0EsVUFBVTtBQUNSLGlCQUFXO0FBQ1gsYUFBTyxRQUFRLENBQUMsTUFBTSxhQUFhLEVBQUUsQ0FBQyxDQUFDO0FBQ3ZDLGFBQU8sTUFBTTtBQUFBLElBQ2Y7QUFBQSxFQUNGO0FBQ0Y7OztBQ25HTyxJQUFNLEtBQUssQ0FBQyxNQUFNLGFBQWEsS0FBSyxDQUFDLElBQUksSUFBSSxZQUFZLEVBQUUsUUFBUSxNQUFNLEtBQUssQ0FBQztBQUMvRSxTQUFTLFNBQVMsR0FBRyxLQUFLO0FBQy9CLFFBQU0sT0FBdUIsb0JBQUksSUFBSTtBQUNyQyxRQUFNLEtBQUssQ0FBQyxNQUFNO0FBQ2hCLFFBQUksS0FBSyxJQUFJLENBQUM7QUFBRyxhQUFPLEtBQUssSUFBSSxDQUFDO0FBQ2xDLFVBQU0sSUFBSSxFQUFFLE9BQU8sQ0FBQztBQUNwQixRQUFJO0FBQ0osUUFBSSxDQUFDO0FBQUcsVUFBSSxFQUFFLEdBQUcsR0FBRyxDQUFDLEdBQUcsR0FBRyxFQUFFO0FBQUEsU0FDeEI7QUFDSCxZQUFNLE9BQU8sRUFBRSxJQUFJLElBQUksRUFBRTtBQUN6QixZQUFNLE9BQU8sQ0FBQyxJQUFJLE1BQU0sS0FBSyxJQUFJLENBQUMsTUFBTSxFQUFFLElBQUksSUFBSSxVQUFVLEVBQUUsQ0FBQyxhQUFhLEVBQUUsQ0FBQyxFQUFFLEtBQUssRUFBRTtBQUN4RixZQUFNLE1BQU0sTUFBTSxLQUFLLFlBQVksQ0FBQyxHQUFHLEtBQUssTUFBTSxLQUFLLE9BQU8sQ0FBQyxHQUFHLE1BQU0sTUFBTSxLQUFLLGFBQWEsQ0FBQztBQUNqRyxjQUFRLEVBQUUsTUFBTTtBQUFBLFFBQ2QsS0FBSztBQUNILGNBQUksRUFBRSxHQUFHLElBQUksR0FBRyxHQUFHLEVBQUU7QUFDckI7QUFBQSxRQUNGLEtBQUs7QUFDSCxjQUFJLEVBQUUsR0FBRyxHQUFHLEdBQUcsR0FBRyxFQUFFO0FBQ3BCO0FBQUEsUUFDRixLQUFLO0FBQ0gsY0FBSSxFQUFFLEdBQUcsSUFBSSxHQUFHLEdBQUcsRUFBRTtBQUNyQjtBQUFBLFFBQ0YsS0FBSztBQUNILGNBQUksRUFBRSxHQUFHLGNBQWMsSUFBSSxDQUFDLEtBQUssR0FBRyxFQUFFO0FBQ3RDO0FBQUEsUUFDRixLQUFLO0FBQ0gsY0FBSSxFQUFFLEdBQUcsY0FBYyxHQUFHLENBQUMsS0FBSyxHQUFHLEVBQUU7QUFDckM7QUFBQSxRQUNGLEtBQUs7QUFDSCxjQUFJLEVBQUUsR0FBRyxjQUFjLElBQUksQ0FBQyxLQUFLLEdBQUcsRUFBRTtBQUN0QztBQUFBLFFBQ0YsS0FBSztBQUNILGNBQUksRUFBRSxHQUFHLGNBQWMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxLQUFLLEdBQUcsRUFBRTtBQUMxQztBQUFBLFFBQ0Y7QUFDRSxjQUFJLEtBQUssQ0FBQztBQUFBLE1BQ2Q7QUFBQSxJQUNGO0FBQ0EsUUFBSSxFQUFFLEVBQUUsU0FBUztBQUFLLFlBQU0sSUFBSSxNQUFNLFVBQVU7QUFDaEQsU0FBSyxJQUFJLEdBQUcsQ0FBQztBQUNiLFdBQU87QUFBQSxFQUNUO0FBQ0EsU0FBTyxHQUFHLEdBQUcsRUFBRTtBQUNqQjs7O0FDekNPLElBQU0sV0FBVyxDQUFDLE1BQU07QUFDN0IsTUFBSSxJQUFJO0FBQ1IsU0FBTyxHQUFHO0FBQ1IsU0FBSyxJQUFJO0FBQ1QsV0FBTztBQUFBLEVBQ1Q7QUFDQSxTQUFPO0FBQ1Q7QUFFTyxTQUFTLGdCQUFnQixNQUFNO0FBQ3BDLE1BQUksTUFBTSxJQUFJLElBQUksS0FBSyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksTUFBTSxFQUFFLEdBQUcsR0FBRyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUM7QUFDaEUsUUFBTSxTQUFTLENBQUM7QUFDaEIsU0FBTyxJQUFJLE1BQU07QUFDZixVQUFNLFNBQVMsb0JBQUksSUFBSTtBQUN2QixlQUFXLEtBQUssSUFBSSxPQUFPLEdBQUc7QUFDNUIsWUFBTSxJQUFJLEVBQUUsT0FBTyxNQUFNLFNBQVMsRUFBRSxDQUFDO0FBQ3JDLFVBQUksQ0FBQyxPQUFPLElBQUksQ0FBQztBQUFHLGVBQU8sSUFBSSxHQUFHLENBQUMsQ0FBQztBQUNwQyxhQUFPLElBQUksQ0FBQyxFQUFFLEtBQUssQ0FBQztBQUFBLElBQ3RCO0FBQ0EsVUFBTSxPQUFPLG9CQUFJLElBQUksR0FBRyxPQUFPLG9CQUFJLElBQUk7QUFDdkMsZUFBVyxDQUFDLEdBQUcsSUFBSSxLQUFLLFFBQVE7QUFDOUIsWUFBTSxDQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUUsTUFBTSxHQUFHLEVBQUUsSUFBSSxNQUFNO0FBQ3pDLFlBQU0sUUFBUSxPQUFPLElBQUksT0FBTyxPQUFPLElBQUksRUFBRTtBQUM3QyxVQUFJLENBQUM7QUFBTztBQUNaLGlCQUFXLEtBQUs7QUFBTSxtQkFBVyxLQUFLLE9BQU87QUFDM0MsZ0JBQU0sSUFBSSxFQUFFLElBQUksRUFBRTtBQUNsQixjQUFJLEtBQUssRUFBRSxJQUFJLElBQUksSUFBSTtBQUNyQixrQkFBTSxJQUFJLEVBQUUsR0FBRyxFQUFFLElBQUksRUFBRSxHQUFHLE1BQU0sRUFBRSxPQUFPLEVBQUU7QUFDM0MsaUJBQUssSUFBSSxFQUFFLElBQUksTUFBTSxFQUFFLE1BQU0sQ0FBQztBQUM5QixpQkFBSyxJQUFJLENBQUM7QUFDVixpQkFBSyxJQUFJLENBQUM7QUFBQSxVQUNaO0FBQUEsUUFDRjtBQUFBLElBQ0Y7QUFDQSxlQUFXLEtBQUssSUFBSSxPQUFPO0FBQUcsVUFBSSxDQUFDLEtBQUssSUFBSSxDQUFDO0FBQUcsZUFBTyxLQUFLLENBQUM7QUFDN0QsVUFBTTtBQUFBLEVBQ1I7QUFDQSxTQUFPO0FBQ1Q7QUFFTyxTQUFTLFlBQVksUUFBUSxNQUFNLE9BQU87QUFDL0MsUUFBTSxhQUFhO0FBQ25CLFFBQU0sU0FBUyxDQUFDLEdBQUcsT0FBTyxJQUFJLENBQUMsRUFBRSxVQUFVLEVBQUU7QUFDN0MsUUFBTSxPQUFPLENBQUMsTUFBTSxRQUFRLFNBQVMsRUFBRSxJQUFJO0FBQzNDLFFBQU0sT0FBTyxDQUFDLFNBQVMsQ0FBQyxLQUFLLFFBQVEsS0FBSyxPQUFPLENBQUMsR0FBRyxNQUFNLElBQUksS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0FBQzFFLFFBQU0sU0FBUyxDQUFDLEdBQUcsTUFBTSxFQUFFLENBQUMsTUFBTSxFQUFFLENBQUMsSUFBSSxFQUFFLENBQUMsSUFBSSxFQUFFLENBQUMsSUFBSSxFQUFFLENBQUMsSUFBSSxFQUFFLENBQUM7QUFDakUsUUFBTSxVQUFVLENBQUMsR0FBRyxNQUFNLEVBQUUsSUFBSSxFQUFFLEtBQUssRUFBRSxPQUFPLEVBQUU7QUFDbEQsUUFBTSxTQUFTLENBQUMsR0FBRyxPQUFPLElBQUksSUFBSSxJQUFJO0FBQ3RDLE9BQUssUUFBUSxDQUFDLE1BQU07QUFDbEIsVUFBTSxLQUFLLE9BQU8sT0FBTyxDQUFDLE1BQU0sT0FBTyxHQUFHLENBQUMsQ0FBQztBQUM1QyxRQUFJLEdBQUcsV0FBVyxLQUFLLENBQUMsT0FBTyxTQUFTLEdBQUcsQ0FBQyxDQUFDO0FBQUcsYUFBTyxLQUFLLEdBQUcsQ0FBQyxDQUFDO0FBQUEsRUFDbkUsQ0FBQztBQUNELFNBQU8sUUFBUSxDQUFDLE1BQU0sS0FBSyxRQUFRLENBQUMsTUFBTTtBQUN4QyxRQUFJLE9BQU8sR0FBRyxDQUFDO0FBQUcsV0FBSyxPQUFPLENBQUM7QUFBQSxFQUNqQyxDQUFDLENBQUM7QUFDRixRQUFNLE9BQU8sQ0FBQyxHQUFHLElBQUk7QUFDckIsTUFBSSxDQUFDLEtBQUs7QUFBUSxXQUFPLEVBQUUsT0FBTyxPQUFPLEtBQUssT0FBTyxHQUFHLE9BQU8sS0FBSztBQUNwRSxRQUFNLE9BQU8sT0FBTyxPQUFPLENBQUMsTUFBTSxDQUFDLE9BQU8sU0FBUyxDQUFDLEtBQUssS0FBSyxLQUFLLENBQUMsTUFBTSxPQUFPLEdBQUcsQ0FBQyxDQUFDLENBQUM7QUFDdkYsUUFBTSxXQUFXLElBQUksSUFBSSxLQUFLLElBQUksQ0FBQyxNQUFNLENBQUMsR0FBRyxLQUFLLE9BQU8sQ0FBQyxNQUFNLE9BQU8sR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDL0UsTUFBSSxVQUFVLENBQUM7QUFDZjtBQUNFLFVBQU0sTUFBTSxJQUFJLElBQUksSUFBSTtBQUN4QixXQUFPLElBQUksTUFBTTtBQUNmLFVBQUksS0FBSyxNQUFNLEtBQUs7QUFDcEIsV0FBSyxRQUFRLENBQUMsTUFBTTtBQUNsQixZQUFJLElBQUk7QUFDUixZQUFJLFFBQVEsQ0FBQyxNQUFNO0FBQ2pCLGNBQUksT0FBTyxHQUFHLENBQUM7QUFBRztBQUFBLFFBQ3BCLENBQUM7QUFDRCxZQUFJLElBQUksSUFBSTtBQUNWLGVBQUs7QUFDTCxlQUFLO0FBQUEsUUFDUDtBQUFBLE1BQ0YsQ0FBQztBQUNELGNBQVEsS0FBSyxFQUFFO0FBQ2YsT0FBQyxHQUFHLEdBQUcsRUFBRSxRQUFRLENBQUMsTUFBTTtBQUN0QixZQUFJLE9BQU8sSUFBSSxDQUFDO0FBQUcsY0FBSSxPQUFPLENBQUM7QUFBQSxNQUNqQyxDQUFDO0FBQUEsSUFDSDtBQUFBLEVBQ0Y7QUFDQSxNQUFJLFdBQVcsS0FBSyxPQUFPLE9BQU8sT0FBTyxDQUFDO0FBQzFDLE1BQUksUUFBUSxHQUFHLFFBQVE7QUFDdkIsUUFBTSxNQUFNLENBQUMsS0FBSyxRQUFRO0FBQ3hCLFFBQUksRUFBRSxRQUFRLFlBQVk7QUFDeEIsY0FBUTtBQUNSO0FBQUEsSUFDRjtBQUNBLFFBQUksQ0FBQyxJQUFJLFFBQVE7QUFDZixZQUFNLEtBQUssS0FBSyxPQUFPLE9BQU8sR0FBRyxDQUFDO0FBQ2xDLFVBQUksT0FBTyxJQUFJLFFBQVEsR0FBRztBQUN4QixtQkFBVztBQUNYLGtCQUFVLElBQUksTUFBTTtBQUFBLE1BQ3RCO0FBQ0E7QUFBQSxJQUNGO0FBQ0EsUUFBSSxPQUFPLFNBQVMsSUFBSSxTQUFTLElBQUksU0FBUyxDQUFDO0FBQUc7QUFDbEQsUUFBSSxPQUFPLElBQUksQ0FBQyxHQUFHLEtBQUssU0FBUyxJQUFJLElBQUksRUFBRTtBQUMzQyxlQUFXLEtBQUssS0FBSztBQUNuQixZQUFNLElBQUksU0FBUyxJQUFJLENBQUMsRUFBRTtBQUMxQixVQUFJLElBQUksSUFBSTtBQUNWLGVBQU87QUFDUCxhQUFLO0FBQUEsTUFDUDtBQUFBLElBQ0Y7QUFDQSxVQUFNLE9BQU8sU0FBUyxJQUFJLElBQUksRUFBRSxNQUFNLEVBQUUsS0FBSyxDQUFDLEdBQUcsTUFBTSxJQUFJLE9BQU8sQ0FBQyxNQUFNLE9BQU8sR0FBRyxDQUFDLENBQUMsRUFBRSxTQUFTLElBQUksT0FBTyxDQUFDLE1BQU0sT0FBTyxHQUFHLENBQUMsQ0FBQyxFQUFFLE1BQU07QUFDdEksZUFBVyxLQUFLLE1BQU07QUFDcEIsVUFBSSxLQUFLLENBQUM7QUFDVixVQUFJLElBQUksT0FBTyxDQUFDLE1BQU0sQ0FBQyxPQUFPLEdBQUcsQ0FBQyxDQUFDLEdBQUcsR0FBRztBQUN6QyxVQUFJLElBQUk7QUFDUixVQUFJLFFBQVE7QUFBWTtBQUFBLElBQzFCO0FBQUEsRUFDRjtBQUNBLE1BQUksTUFBTSxDQUFDLENBQUM7QUFDWixTQUFPLEVBQUUsT0FBTyxPQUFPLE9BQU8sT0FBTyxFQUFFLEtBQUssT0FBTyxHQUFHLE1BQU07QUFDOUQ7QUFFTyxTQUFTLFFBQVEsS0FBSyxLQUFLLFFBQVEsS0FBSyxvQkFBSSxJQUFJLEdBQUc7QUFDeEQsUUFBTSxNQUFNLENBQUM7QUFDYixNQUFJLFNBQVM7QUFDYixNQUFJLFFBQVEsQ0FBQyxHQUFHLE1BQU07QUFDcEIsUUFBSSxFQUFFLEdBQUc7QUFBRztBQUNaLFFBQUksRUFBRSxHQUFHLE9BQU8sV0FBVyxJQUFJLElBQUk7QUFBSSxVQUFJLEtBQUssQ0FBQztBQUFBLEVBQ25ELENBQUM7QUFDRCxNQUFJLFdBQVc7QUFBRyxXQUFPLEVBQUUsT0FBTyxHQUFHLE9BQU8sS0FBSztBQUNqRCxNQUFJLFdBQVcsSUFBSTtBQUFRLFdBQU8sRUFBRSxPQUFPLEdBQUcsT0FBTyxLQUFLO0FBRTFELFFBQU0sUUFBUSxLQUFLLE1BQU0sS0FBSyxLQUFLLElBQUksTUFBTSxDQUFDO0FBRTlDLFFBQU0sVUFBVSxDQUFDLEdBQUcsS0FBSyxHQUFHLEVBQUU7QUFDOUIsUUFBTSxFQUFFLE9BQU8sTUFBTSxJQUFJLFlBQVksZ0JBQWdCLE9BQU8sR0FBRyxLQUFLLEtBQUs7QUFDekUsU0FBTyxFQUFFLE1BQU0sS0FBSyxPQUFPLE1BQU07QUFDbkM7QUFFTyxTQUFTLGFBQWEsR0FBRyxNQUFNO0FBQ3BDLFFBQU0sSUFBSSxFQUFFLE9BQU8sUUFBUSxNQUFNLENBQUM7QUFDbEMsSUFBRSxPQUFPLFFBQVEsQ0FBQyxNQUFNLE1BQU07QUFDNUIsVUFBTSxNQUFNLEtBQUssSUFBSSxJQUFJO0FBQ3pCLFFBQUksRUFBRSxLQUFLLE9BQU87QUFBTSxVQUFJLEtBQUssRUFBRSxNQUFNLEtBQUssRUFBRSxLQUFLLElBQUksS0FBSyxDQUFDO0FBQUEsRUFDakUsQ0FBQztBQUNELFNBQU87QUFDVDtBQUVPLElBQU0sV0FBVyxDQUFDLE1BQU0sRUFBRSxNQUFNLGNBQWMsR0FBRyxFQUFFLElBQUksQ0FBQyxNQUFNLEdBQUcsRUFBRSxJQUFJO0FBQ3ZFLElBQU0sWUFBWSxDQUFDLEdBQUcsU0FBUyxhQUFhLEdBQUcsSUFBSSxFQUFFLElBQUksUUFBUSxFQUFFLEtBQUssVUFBVTtBQUNsRixJQUFNLFdBQVcsQ0FBQyxHQUFHLFFBQVEsSUFBSSxVQUFVLFNBQVMsT0FBTyxJQUFJLEtBQUssSUFBSSxJQUFJLE1BQU0sSUFBSSxDQUFDLE9BQU8sVUFBVSxHQUFHLEVBQUUsQ0FBQyxFQUFFLEtBQUssS0FBSztBQUUxSCxTQUFTLGlCQUFpQixHQUFHLEtBQUs7QUFDdkMsU0FBTyxFQUFFLFFBQVEsSUFBSSxDQUFDLE1BQU07QUFDMUIsUUFBSTtBQUNKLFFBQUk7QUFDRixZQUFNLFNBQVMsR0FBRyxDQUFDO0FBQUEsSUFDckIsU0FBUyxHQUFHO0FBQ1YsWUFBTTtBQUFBLElBQ1I7QUFDQSxRQUFJLE9BQU8sSUFBSSxTQUFTO0FBQUssWUFBTTtBQUVuQyxRQUFJLE1BQU0sTUFBTSxNQUFNO0FBQ3RCLFFBQUksS0FBSztBQUNQLFlBQU0sS0FBSyxvQkFBSSxJQUFJO0FBQ25CLFVBQUksUUFBUSxDQUFDLEdBQUcsTUFBTTtBQUFFLFlBQUksRUFBRSxDQUFDLE1BQU07QUFBSSxhQUFHLElBQUksQ0FBQztBQUFBLE1BQUcsQ0FBQztBQUVyRCxZQUFNLFFBQVEsS0FBSyxHQUFHLEdBQUcsRUFBRTtBQUMzQixZQUFNLFNBQVMsR0FBRyxHQUFHO0FBQUEsSUFDdkI7QUFDQSxXQUFPLEVBQUUsTUFBTSxHQUFHLEtBQUssS0FBSyxJQUFJO0FBQUEsRUFDbEMsQ0FBQztBQUNIOzs7QUNwS08sSUFBTUMsZ0JBQWU7QUFBQSxFQUMxQixZQUFZO0FBQUEsRUFDWixNQUFNO0FBQUEsRUFDTixLQUFLO0FBQUEsRUFDTCxLQUFLO0FBQUEsRUFDTCxNQUFNO0FBQUEsRUFDTixLQUFLO0FBQ1A7QUFDTyxTQUFTLFdBQVcsR0FBRyxLQUFLLFFBQVE7QUFDekMsUUFBTSxRQUF3QixvQkFBSSxJQUFJLENBQUMsR0FBRyxFQUFFLFFBQVEsR0FBRyxFQUFFLE1BQU0sSUFBSSxDQUFDLE1BQU0sRUFBRSxHQUFHLENBQUMsQ0FBQztBQUNqRixRQUFNLFNBQVMsQ0FBQyxNQUFNLGFBQWE7QUFDakMsUUFBSSxDQUFDLFlBQVksQ0FBQyxNQUFNLElBQUksSUFBSSxHQUFHO0FBQ2pDLFlBQU0sSUFBSSxJQUFJO0FBQ2QsYUFBTztBQUFBLElBQ1Q7QUFDQSxRQUFJLElBQUksV0FBVyxJQUFJLEdBQUc7QUFDMUIsT0FBRztBQUNELFlBQU0sT0FBTztBQUFBLElBQ2YsU0FBUyxNQUFNLElBQUksR0FBRztBQUN0QixVQUFNLElBQUksR0FBRztBQUNiLFdBQU87QUFBQSxFQUNUO0FBQ0EsUUFBTSxRQUFRLENBQUMsR0FBRyxRQUF3QixvQkFBSSxJQUFJLEdBQUcsT0FBdUIsb0JBQUksSUFBSSxHQUFHLFNBQVMsQ0FBQztBQUNqRyxRQUFNLFVBQVUsQ0FBQyxNQUFNLEtBQUssUUFBUTtBQUNsQyxVQUFNLEtBQUssRUFBRSxNQUFNLEtBQUssS0FBSyxNQUFNLEVBQUUsQ0FBQztBQUN0QyxXQUFPO0FBQUEsRUFDVDtBQUNBLFFBQU0sU0FBUyxDQUFDLE1BQU0sS0FBSyxXQUFXO0FBQ3BDLFVBQU0sTUFBTSxPQUFPLE1BQU0sSUFBSSxLQUFLLEdBQUc7QUFDckMsUUFBSSxDQUFDLE1BQU0sSUFBSSxHQUFHO0FBQUcsWUFBTSxJQUFJLEtBQUssUUFBUSxNQUFNLEtBQUssT0FBTyxRQUFRLElBQUksQ0FBQyxDQUFDO0FBQzVFLFdBQU8sTUFBTSxJQUFJLEdBQUc7QUFBQSxFQUN0QjtBQUNBLFFBQU0sUUFBUSxDQUFDLFNBQVM7QUFDdEIsUUFBSSxDQUFDLEtBQUssSUFBSSxJQUFJO0FBQUcsV0FBSyxJQUFJLE1BQU0sUUFBUSxPQUFPLENBQUMsSUFBSSxHQUFHLE9BQU8sT0FBTyxJQUFJLENBQUMsQ0FBQztBQUMvRSxXQUFPLEtBQUssSUFBSSxJQUFJO0FBQUEsRUFDdEI7QUFDQSxRQUFNLE1BQU0sQ0FBQyxNQUFNLEVBQUUsTUFBTSxNQUFNLEVBQUUsSUFBSSxJQUFJLEVBQUU7QUFDN0MsUUFBTSxPQUFPLENBQUMsT0FBTyxFQUFFLE1BQU0sRUFBRSxNQUFNLEtBQUssQ0FBQyxFQUFFLElBQUk7QUFDakQsUUFBTSxRQUFRLENBQUMsTUFBTSxLQUFLLFFBQVEsUUFBUTtBQUN4QyxVQUFNLE9BQU8sS0FBSyxJQUFJO0FBQ3RCLFFBQUksTUFBTTtBQUNWLFdBQU8sSUFBSSxTQUFTLGdCQUFnQjtBQUNsQyxZQUFNLE9BQU8sQ0FBQztBQUNkLGVBQVMsSUFBSSxHQUFHLElBQUksSUFBSSxRQUFRLEtBQUssZ0JBQWdCO0FBQ25ELGNBQU0sUUFBUSxJQUFJLE1BQU0sR0FBRyxJQUFJLGNBQWM7QUFDN0MsYUFBSyxLQUFLLE1BQU0sV0FBVyxJQUFJLE1BQU0sQ0FBQyxJQUFJLE9BQU8sTUFBTSxPQUFPLEdBQUcsQ0FBQztBQUFBLE1BQ3BFO0FBQ0EsWUFBTTtBQUFBLElBQ1I7QUFDQSxXQUFPLE1BQU0sUUFBUSxNQUFNLEtBQUssR0FBRyxJQUFJLE9BQU8sTUFBTSxLQUFLLE1BQU07QUFBQSxFQUNqRTtBQUNBLFFBQU0sU0FBUyxDQUFDLE1BQU0sR0FBRyxRQUFRO0FBQy9CLFFBQUksRUFBRSxXQUFXO0FBQUcsY0FBUSxFQUFFLENBQUMsRUFBRSxNQUFNLFFBQVEsT0FBTyxDQUFDLEVBQUUsQ0FBQyxFQUFFLElBQUksR0FBRyxHQUFHO0FBQUE7QUFDakUsWUFBTSxNQUFNLEVBQUUsSUFBSSxHQUFHLEdBQUcsSUFBSSxHQUFHO0FBQUEsRUFDdEM7QUFDQSxRQUFNLE9BQU8sV0FBVyxTQUFTLFdBQVc7QUFDNUMsSUFBRSxRQUFRLFFBQVEsQ0FBQyxNQUFNO0FBQ3ZCLFVBQU0sTUFBTSxRQUFRLEtBQUssR0FBRyxPQUFPLElBQUksQ0FBQztBQUN4QyxRQUFJLElBQUksVUFBVSxRQUFRO0FBQ3hCLGFBQU8sQ0FBQyxJQUFJLElBQUk7QUFDaEI7QUFBQSxJQUNGO0FBQ0EsVUFBTSxRQUFRLElBQUk7QUFDbEIsVUFBTSxPQUFPLENBQUMsT0FBTyxPQUFPLGFBQWEsR0FBRyxFQUFFLEVBQUUsSUFBSSxJQUFJLElBQUksYUFBYSxHQUFHLEVBQUU7QUFDOUUsUUFBSSxNQUFNLFdBQVcsR0FBRztBQUN0QixhQUFPLE9BQU8sT0FBTyxPQUFPLEtBQUssTUFBTSxDQUFDLENBQUMsR0FBRyxDQUFDO0FBQzdDO0FBQUEsSUFDRjtBQUNBLFFBQUksV0FBVyxPQUFPO0FBQ3BCLFlBQU0sTUFBTSxNQUFNLElBQUksQ0FBQyxPQUFPO0FBQzVCLGNBQU0sSUFBSSxLQUFLLEVBQUU7QUFDakIsZUFBTyxFQUFFLFdBQVcsSUFBSSxJQUFJLEVBQUUsQ0FBQyxDQUFDLElBQUksTUFBTSxPQUFPLEVBQUUsSUFBSSxHQUFHLEdBQUcsR0FBRztBQUFBLE1BQ2xFLENBQUMsR0FBRyxJQUFJLENBQUM7QUFBQSxJQUNYLFdBQVcsV0FBVyxRQUFRO0FBQzVCLFlBQU0sUUFBUSxNQUFNLElBQUksQ0FBQyxPQUFPO0FBQzlCLGNBQU0sSUFBSSxLQUFLLEVBQUU7QUFDakIsZUFBTyxFQUFFLFdBQVcsSUFBSSxFQUFFLENBQUMsRUFBRSxNQUFNLEVBQUUsQ0FBQyxFQUFFLE9BQU8sTUFBTSxFQUFFLENBQUMsRUFBRSxJQUFJLElBQUksTUFBTSxRQUFRLEVBQUUsSUFBSSxHQUFHLEdBQUcsR0FBRztBQUFBLE1BQ2pHLENBQUMsR0FBRyxJQUFJLENBQUM7QUFBQSxJQUNYLFdBQVcsV0FBVyxPQUFPO0FBQzNCLFlBQU0sT0FBTyxNQUFNLElBQUksQ0FBQyxPQUFPO0FBQzdCLGNBQU0sSUFBSSxLQUFLLEVBQUU7QUFDakIsZUFBTyxFQUFFLFdBQVcsSUFBSSxJQUFJLEVBQUUsQ0FBQyxDQUFDLElBQUksTUFBTSxNQUFNLEVBQUUsSUFBSSxHQUFHLEdBQUcsR0FBRztBQUFBLE1BQ2pFLENBQUMsR0FBRyxJQUFJLENBQUM7QUFBQSxJQUNYLE9BQU87QUFDTCxZQUFNLE9BQU8sTUFBTSxJQUFJLENBQUMsT0FBTztBQUM3QixjQUFNLElBQUksS0FBSyxFQUFFO0FBQ2pCLGVBQU8sRUFBRSxXQUFXLElBQUksRUFBRSxDQUFDLEVBQUUsTUFBTSxFQUFFLENBQUMsRUFBRSxPQUFPLE1BQU0sRUFBRSxDQUFDLEVBQUUsSUFBSSxJQUFJLE1BQU0sT0FBTyxFQUFFLElBQUksR0FBRyxHQUFHLEdBQUc7QUFBQSxNQUNoRyxDQUFDLEdBQUcsSUFBSSxDQUFDO0FBQUEsSUFDWDtBQUFBLEVBQ0YsQ0FBQztBQUNELFNBQU8sRUFBRSxTQUFTLE1BQU0sU0FBUyxTQUFTLE9BQU8sRUFBRSxNQUFNLElBQUksTUFBTSxPQUFPO0FBQzVFOzs7QUMxRk8sSUFBTSxjQUFjLENBQUMsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLFFBQVEsTUFBTSxFQUFFLE1BQU0sT0FBTyxDQUFDLEdBQUcsTUFBTSxJQUFJLEVBQUUsSUFBSSxRQUFRLENBQUMsRUFBRTtBQUN6RyxTQUFTLGlCQUFpQixHQUFHO0FBQ2xDLE1BQUksUUFBUSxFQUFFLE1BQU0sSUFBSSxDQUFDLE9BQU8sRUFBRSxNQUFNLEVBQUUsTUFBTSxLQUFLLEVBQUUsSUFBSSxNQUFNLEdBQUcsS0FBSyxFQUFFLEtBQUssTUFBTSxFQUFFLEVBQUU7QUFDMUYsUUFBTSxRQUFRLElBQUksSUFBSSxFQUFFLE9BQU87QUFDL0IsUUFBTSxNQUFNLE1BQU07QUFDaEIsVUFBTSxJQUFJLENBQUM7QUFDWCxVQUFNLFFBQVEsQ0FBQyxNQUFNO0FBQ25CLFFBQUUsRUFBRSxHQUFHLElBQUk7QUFBQSxJQUNiLENBQUM7QUFDRCxXQUFPO0FBQUEsRUFDVDtBQUNBLFFBQU0sU0FBUyxNQUFNO0FBQ25CLFVBQU0sSUFBSSxDQUFDO0FBQ1gsVUFBTSxRQUFRLENBQUMsTUFBTSxFQUFFLElBQUksUUFBUSxDQUFDLE1BQU07QUFDeEMsUUFBRSxDQUFDLEtBQUssRUFBRSxDQUFDLEtBQUssS0FBSztBQUFBLElBQ3ZCLENBQUMsQ0FBQztBQUNGLFdBQU87QUFBQSxFQUNUO0FBQ0EsUUFBTSxTQUFTLENBQUMsTUFBTSxPQUFPLE1BQU0sUUFBUSxDQUFDLE1BQU07QUFDaEQsTUFBRSxNQUFNLEVBQUUsSUFBSSxJQUFJLENBQUMsTUFBTSxNQUFNLE9BQU8sS0FBSyxDQUFDO0FBQUEsRUFDOUMsQ0FBQztBQUNELFFBQU0sT0FBTyxDQUFDLE1BQU0sTUFBTSxTQUFTLENBQUM7QUFDcEMsV0FBUyxPQUFPLEdBQUcsT0FBTyxLQUFLLFFBQVE7QUFDckMsUUFBSSxVQUFVO0FBQ2QsVUFBTSxRQUFRLENBQUMsTUFBTTtBQUNuQixZQUFNLE9BQU8sS0FBSyxFQUFFLElBQUk7QUFDeEIsVUFBSSxTQUFTLFNBQVMsU0FBUyxNQUFNO0FBQ25DLGNBQU0sSUFBSSxDQUFDLEdBQUcsSUFBSSxJQUFJLEVBQUUsR0FBRyxDQUFDO0FBQzVCLFlBQUksRUFBRSxXQUFXLEVBQUUsSUFBSSxRQUFRO0FBQzdCLFlBQUUsTUFBTTtBQUNSLG9CQUFVO0FBQUEsUUFDWjtBQUNBLFlBQUksRUFBRSxJQUFJLFdBQVcsR0FBRztBQUN0QixZQUFFLE9BQU8sVUFBVSxFQUFFLElBQUksSUFBSSxRQUFRO0FBQ3JDLG9CQUFVO0FBQUEsUUFDWjtBQUFBLE1BQ0YsV0FBVyxTQUFTLE9BQU87QUFDekIsY0FBTSxNQUFNLENBQUM7QUFDYixVQUFFLElBQUksUUFBUSxDQUFDLE1BQU07QUFDbkIsY0FBSSxDQUFDLEtBQUssSUFBSSxDQUFDLEtBQUssS0FBSztBQUFBLFFBQzNCLENBQUM7QUFDRCxjQUFNLE1BQU0sT0FBTyxLQUFLLEdBQUcsRUFBRSxPQUFPLENBQUMsTUFBTSxJQUFJLENBQUMsSUFBSSxNQUFNLENBQUM7QUFDM0QsWUFBSSxJQUFJLFNBQVMsS0FBSyxJQUFJLFdBQVcsRUFBRSxJQUFJLFFBQVE7QUFDakQsWUFBRSxNQUFNO0FBQ1Isb0JBQVU7QUFBQSxRQUNaO0FBQ0EsWUFBSSxFQUFFLElBQUksV0FBVyxHQUFHO0FBQ3RCLFlBQUUsT0FBTyxFQUFFLFNBQVMsU0FBUyxRQUFRO0FBQ3JDLG9CQUFVO0FBQUEsUUFDWjtBQUFBLE1BQ0Y7QUFBQSxJQUNGLENBQUM7QUFDRCxlQUFXLEtBQUssTUFBTSxNQUFNLEdBQUc7QUFDN0IsVUFBSSxFQUFFLFNBQVMsU0FBUyxDQUFDLE1BQU0sSUFBSSxFQUFFLEdBQUcsR0FBRztBQUN6QyxlQUFPLEVBQUUsS0FBSyxFQUFFLElBQUksQ0FBQyxDQUFDO0FBQ3RCLGdCQUFRLE1BQU0sT0FBTyxDQUFDLE1BQU0sTUFBTSxDQUFDO0FBQ25DLGtCQUFVO0FBQUEsTUFDWjtBQUFBLElBQ0Y7QUFDQTtBQUNFLFlBQU0sSUFBSSxJQUFJLEdBQUcsSUFBSSxPQUFPO0FBQzVCLGlCQUFXLEtBQUssTUFBTSxNQUFNLEdBQUc7QUFDN0IsWUFBSSxFQUFFLFNBQVMsU0FBUyxDQUFDLEtBQUssQ0FBQztBQUFHO0FBQ2xDLGNBQU0sUUFBUSxFQUFFLEVBQUUsSUFBSSxDQUFDLENBQUM7QUFDeEIsWUFBSSxDQUFDLFNBQVMsQ0FBQyxLQUFLLEtBQUs7QUFBRztBQUM1QixZQUFJLE1BQU0sU0FBUyxPQUFPO0FBQ3hCLFlBQUUsT0FBTztBQUNULFlBQUUsTUFBTSxDQUFDLE1BQU0sSUFBSSxDQUFDLENBQUM7QUFDckIsb0JBQVU7QUFDVjtBQUFBLFFBQ0Y7QUFDQSxZQUFJLFFBQVEsTUFBTSxJQUFJLEtBQUssQ0FBQyxNQUFNLElBQUksTUFBTSxHQUFHLEtBQUssRUFBRSxNQUFNLEdBQUcsTUFBTSxHQUFHO0FBQ3RFLFlBQUUsT0FBTyxRQUFRLE1BQU0sSUFBSTtBQUMzQixZQUFFLE1BQU0sTUFBTSxJQUFJLE1BQU07QUFDeEIsa0JBQVEsTUFBTSxPQUFPLENBQUMsTUFBTSxNQUFNLEtBQUs7QUFDdkMsb0JBQVU7QUFBQSxRQUNaO0FBQUEsTUFDRjtBQUFBLElBQ0Y7QUFDQTtBQUNFLFlBQU0sSUFBSSxJQUFJLEdBQUcsSUFBSSxPQUFPO0FBQzVCLGlCQUFXLEtBQUssTUFBTSxNQUFNLEdBQUc7QUFDN0IsY0FBTSxPQUFPLEtBQUssRUFBRSxJQUFJO0FBQ3hCLFlBQUksQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDO0FBQUc7QUFDdkIsWUFBSSxRQUFRO0FBQ1osZUFBTyxPQUFPO0FBQ1osa0JBQVE7QUFDUixtQkFBUyxJQUFJLEdBQUcsSUFBSSxFQUFFLElBQUksUUFBUSxLQUFLO0FBQ3JDLGtCQUFNLElBQUksRUFBRSxJQUFJLENBQUMsR0FBRyxRQUFRLEVBQUUsQ0FBQztBQUMvQixnQkFBSSxDQUFDLFNBQVMsQ0FBQyxLQUFLLEtBQUssS0FBSyxVQUFVLEtBQUssTUFBTSxTQUFTO0FBQU07QUFDbEUsZ0JBQUksTUFBTSxJQUFJLENBQUMsS0FBSyxFQUFFLENBQUMsTUFBTTtBQUFHO0FBQ2hDLGtCQUFNLFNBQVMsRUFBRSxJQUFJLE1BQU0sR0FBRyxDQUFDLEVBQUUsT0FBTyxNQUFNLEtBQUssRUFBRSxJQUFJLE1BQU0sSUFBSSxDQUFDLENBQUM7QUFDckUsZ0JBQUksT0FBTyxTQUFTO0FBQWdCO0FBQ3BDLGNBQUUsTUFBTTtBQUNSLG9CQUFRLE1BQU0sT0FBTyxDQUFDLE1BQU0sTUFBTSxLQUFLO0FBQ3ZDLGNBQUUsQ0FBQyxJQUFJO0FBQ1Asc0JBQVU7QUFDVixvQkFBUTtBQUNSO0FBQUEsVUFDRjtBQUFBLFFBQ0Y7QUFBQSxNQUNGO0FBQUEsSUFDRjtBQUNBO0FBQ0UsWUFBTSxJQUFJLElBQUksR0FBRyxJQUFJLE9BQU87QUFDNUIsaUJBQVcsS0FBSyxNQUFNLE1BQU0sR0FBRztBQUM3QixjQUFNLE9BQU8sS0FBSyxFQUFFLElBQUk7QUFDeEIsWUFBSSxTQUFTLFNBQVMsU0FBUyxRQUFRLENBQUMsS0FBSyxDQUFDO0FBQUc7QUFDakQsY0FBTSxPQUFPLFNBQVMsUUFBUSxPQUFPO0FBQ3JDLGlCQUFTLElBQUksR0FBRyxJQUFJLEVBQUUsSUFBSSxRQUFRLEtBQUs7QUFDckMsZ0JBQU0sSUFBSSxFQUFFLElBQUksQ0FBQyxHQUFHLFFBQVEsRUFBRSxDQUFDO0FBQy9CLGNBQUksQ0FBQyxTQUFTLENBQUMsS0FBSyxLQUFLLEtBQUssTUFBTSxTQUFTLFFBQVEsTUFBTSxJQUFJLENBQUMsS0FBSyxFQUFFLENBQUMsTUFBTTtBQUFHO0FBQ2pGLGdCQUFNLFNBQVMsRUFBRSxJQUFJLE9BQU8sQ0FBQyxHQUFHLE1BQU0sTUFBTSxDQUFDO0FBQzdDLGNBQUksTUFBTSxJQUFJLEtBQUssQ0FBQyxNQUFNLE9BQU8sU0FBUyxDQUFDLENBQUMsR0FBRztBQUM3QyxjQUFFLE1BQU07QUFDUixvQkFBUSxNQUFNLE9BQU8sQ0FBQyxNQUFNLE1BQU0sS0FBSztBQUN2QyxzQkFBVTtBQUNWO0FBQUEsVUFDRjtBQUFBLFFBQ0Y7QUFBQSxNQUNGO0FBQUEsSUFDRjtBQUNBO0FBQ0UsWUFBTSxPQUF1QixvQkFBSSxJQUFJO0FBQ3JDLGlCQUFXLEtBQUssTUFBTSxNQUFNLEdBQUc7QUFDN0IsWUFBSSxDQUFDLEtBQUssQ0FBQztBQUFHO0FBQ2QsY0FBTSxNQUFNLEVBQUUsT0FBTyxNQUFNLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxLQUFLLEVBQUUsS0FBSyxHQUFHO0FBQ3JELGNBQU0sT0FBTyxLQUFLLElBQUksR0FBRztBQUN6QixZQUFJLENBQUMsTUFBTTtBQUNULGVBQUssSUFBSSxLQUFLLENBQUM7QUFDZjtBQUFBLFFBQ0Y7QUFDQSxZQUFJLE9BQU8sTUFBTSxPQUFPO0FBQ3hCLFlBQUksTUFBTSxJQUFJLEtBQUssR0FBRyxHQUFHO0FBQ3ZCLGNBQUksTUFBTSxJQUFJLEtBQUssR0FBRztBQUFHO0FBQ3pCLGlCQUFPO0FBQ1AsaUJBQU87QUFDUCxlQUFLLElBQUksS0FBSyxJQUFJO0FBQUEsUUFDcEI7QUFDQSxlQUFPLEtBQUssS0FBSyxLQUFLLEdBQUc7QUFDekIsZ0JBQVEsTUFBTSxPQUFPLENBQUMsTUFBTSxNQUFNLElBQUk7QUFDdEMsa0JBQVU7QUFBQSxNQUNaO0FBQUEsSUFDRjtBQUNBO0FBQ0UsWUFBTSxJQUFJLE9BQU8sR0FBRyxLQUFLLE1BQU07QUFDL0IsY0FBUSxNQUFNLE9BQU8sQ0FBQyxNQUFNLE1BQU0sSUFBSSxFQUFFLEdBQUcsS0FBSyxFQUFFLEVBQUUsR0FBRyxDQUFDO0FBQ3hELFVBQUksTUFBTSxXQUFXO0FBQUksa0JBQVU7QUFBQSxJQUNyQztBQUNBLFFBQUksQ0FBQztBQUFTO0FBQUEsRUFDaEI7QUFDQSxTQUFPLFNBQVMsT0FBTyxFQUFFLE1BQU07QUFDakM7QUFDTyxTQUFTLGlCQUFpQixHQUFHLFNBQVMsUUFBUSxLQUFLO0FBQ3hELFdBQVMsVUFBVSxDQUFDO0FBQ3BCLFFBQU0sUUFBUSxDQUFDLEtBQUssUUFBUTtBQUMxQixVQUFNLElBQUksVUFBVSxTQUFTLFNBQVMsR0FBRyxJQUFJLENBQUM7QUFDOUMsV0FBTyxFQUFFLFFBQVEsTUFBTSxDQUFDLE9BQU8sS0FBSyxTQUFTLE9BQU8sQ0FBQyxJQUFJLEVBQUUsQ0FBQyxPQUFPLElBQUksQ0FBQyxDQUFDO0FBQUEsRUFDM0U7QUFDQSxNQUFJLEtBQUs7QUFDUCxXQUFPLElBQUksTUFBTSxDQUFDLFFBQVE7QUFDeEIsWUFBTSxNQUFNLENBQUM7QUFDYixRQUFFLE9BQU8sUUFBUSxDQUFDLE1BQU07QUFDdEIsWUFBSSxDQUFDLElBQUksSUFBSSxDQUFDO0FBQUEsTUFDaEIsQ0FBQztBQUNELGFBQU8sTUFBTSxLQUFLLEdBQUc7QUFBQSxJQUN2QixDQUFDLElBQUksVUFBVTtBQUFBLEVBQ2pCO0FBQ0EsTUFBSSxPQUFPO0FBQ1gsUUFBTSxNQUFNLE9BQU8sT0FBTyxLQUFLLEtBQUssTUFBTSxPQUFPLElBQUksZUFBZSxLQUFLO0FBQ3pFLFdBQVMsSUFBSSxHQUFHLElBQUksTUFBTSxLQUFLO0FBQzdCLFVBQU0sTUFBTSxDQUFDO0FBQ2IsTUFBRSxPQUFPLFFBQVEsQ0FBQyxNQUFNO0FBQ3RCLFVBQUksQ0FBQyxJQUFJLElBQUksSUFBSSxNQUFNLElBQUk7QUFBQSxJQUM3QixDQUFDO0FBQ0QsUUFBSSxDQUFDLE1BQU0sS0FBSyxTQUFTLEdBQUcsR0FBRyxDQUFDO0FBQUcsYUFBTztBQUFBLEVBQzVDO0FBQ0EsU0FBTztBQUNUO0FBQ08sU0FBUyxjQUFjLEdBQUcsS0FBSyxRQUFRO0FBQzVDLFFBQU0sUUFBUSxDQUFDO0FBQ2YsUUFBTSxNQUFNLENBQUMsTUFBTTtBQUNqQixVQUFNLElBQUksTUFBTSxlQUFlLEVBQUUsU0FBUyxpQkFBaUIsQ0FBQyxHQUFHLFFBQVEsQ0FBQyxFQUFFLElBQUksV0FBVyxHQUFHLEtBQUssQ0FBQztBQUNsRyxNQUFFLFNBQVM7QUFDWCxNQUFFLFFBQVEsRUFBRSxVQUFVLFlBQVksRUFBRSxPQUFPLElBQUksRUFBRSxPQUFPLEdBQUcsTUFBTSxFQUFFO0FBQ25FLFVBQU0sS0FBSyxDQUFDO0FBQUEsRUFDZDtBQUNBLE1BQUksV0FBVyxRQUFRO0FBQ3JCLFFBQUksWUFBWTtBQUNoQixRQUFJO0FBQUssT0FBQyxPQUFPLE9BQU8sUUFBUSxLQUFLLEVBQUUsUUFBUSxHQUFHO0FBQUEsRUFDcEQ7QUFBTyxRQUFJLE1BQU07QUFDakIsUUFBTSxLQUFLLENBQUMsR0FBRyxNQUFNLEVBQUUsTUFBTSxRQUFRLEVBQUUsTUFBTSxTQUFTLEVBQUUsTUFBTSxPQUFPLEVBQUUsTUFBTSxJQUFJO0FBQ2pGLFFBQU0sT0FBTyxNQUFNLENBQUM7QUFDcEIsT0FBSyxTQUFTLFlBQVksQ0FBQztBQUMzQixPQUFLLFdBQVcsaUJBQWlCLEdBQUcsS0FBSyxTQUFTLEtBQUssUUFBUSxHQUFHO0FBQ2xFLFNBQU87QUFDVDs7O0FDek1BLHVCQUFrQztBQUMzQixJQUFNLFFBQVE7QUFDZCxTQUFTLEVBQUUsS0FBSyxLQUFLLFFBQVEsTUFBTTtBQUN4QyxRQUFNLElBQUksU0FBUyxjQUFjLEdBQUc7QUFDcEMsTUFBSTtBQUFLLE1BQUUsWUFBWTtBQUN2QixNQUFJLFNBQVM7QUFBUSxNQUFFLGNBQWM7QUFDckMsTUFBSTtBQUFRLFdBQU8sWUFBWSxDQUFDO0FBQ2hDLFNBQU87QUFDVDtBQUNPLFNBQVMsRUFBRSxLQUFLLE9BQU8sUUFBUSxNQUFNO0FBQzFDLFFBQU0sSUFBSSxTQUFTLGdCQUFnQixPQUFPLEdBQUc7QUFDN0MsYUFBVyxLQUFLO0FBQU8sTUFBRSxhQUFhLEdBQUcsTUFBTSxDQUFDLENBQUM7QUFDakQsTUFBSSxTQUFTO0FBQVEsTUFBRSxjQUFjO0FBQ3JDLE1BQUk7QUFBUSxXQUFPLFlBQVksQ0FBQztBQUNoQyxTQUFPO0FBQ1Q7QUFDTyxTQUFTLFVBQVUsSUFBSSxZQUFZO0FBQ3hDLEtBQUcsYUFBYSxZQUFZLEdBQUc7QUFDL0IsS0FBRyxhQUFhLFFBQVEsUUFBUTtBQUNoQyxLQUFHLGlCQUFpQixTQUFTLFVBQVU7QUFDdkMsS0FBRyxpQkFBaUIsV0FBVyxDQUFDLFFBQVE7QUFDdEMsUUFBSSxJQUFJLFFBQVEsV0FBVyxJQUFJLFFBQVEsS0FBSztBQUMxQyxVQUFJLGVBQWU7QUFDbkIsaUJBQVcsR0FBRztBQUFBLElBQ2hCO0FBQUEsRUFDRixDQUFDO0FBQ0QsU0FBTztBQUNUO0FBQ08sSUFBTSxRQUFRLENBQUMsT0FBTyxPQUFPLDBCQUEwQixhQUFhLHNCQUFzQixFQUFFLElBQUksV0FBVyxJQUFJLENBQUM7QUFDaEgsU0FBUyxLQUFLLE9BQU8sUUFBUTtBQUNsQyxNQUFJLE9BQXdCLGdDQUFlO0FBQVksV0FBTyxhQUFhLEdBQW9CLDZCQUFZLE9BQU8sS0FBSyxDQUFDO0FBQUE7QUFDbkgsV0FBTyxZQUFZLFNBQVMsZUFBZSxLQUFLLENBQUM7QUFDeEQ7OztBQ2hDQSxJQUFBQyxtQkFBdUI7QUFFdkIsSUFBQUMsb0JBQWtDO0FBQzNCLFNBQVMsY0FBYyxPQUFPO0FBQ25DLFNBQU8sTUFBTSxJQUFJLENBQUMsTUFBTTtBQUN0QixVQUFNLFFBQVEsQ0FBQztBQUNmLFFBQUksRUFBRSxPQUFPLEVBQUUsUUFBUSxFQUFFO0FBQUssWUFBTSxLQUFLLEtBQUssR0FBRyxFQUFFLElBQUksQ0FBQyxNQUFNLEVBQUUsR0FBRyxJQUFJO0FBQ3ZFLFFBQUksRUFBRSxRQUFRO0FBQU0sWUFBTSxLQUFLLEtBQUssR0FBRyxFQUFFLElBQUksQ0FBQyxNQUFNLEVBQUUsR0FBRyxJQUFJO0FBQzdELFdBQU8sTUFBTSxLQUFLLElBQUk7QUFBQSxFQUN4QixDQUFDLEVBQUUsS0FBSyxJQUFJO0FBQ2Q7QUFDTyxTQUFTLFVBQVUsR0FBRztBQUMzQixRQUFNLEtBQUssQ0FBQztBQUNaLElBQUUsT0FBTyxRQUFRLENBQUMsTUFBTTtBQUN0QixPQUFHLENBQUMsSUFBSSxRQUFRO0FBQUEsRUFDbEIsQ0FBQztBQUNELElBQUUsTUFBTSxRQUFRLENBQUMsR0FBRyxNQUFNO0FBQ3hCLE9BQUcsRUFBRSxHQUFHLElBQUksT0FBTyxJQUFJO0FBQUEsRUFDekIsQ0FBQztBQUNELFFBQU0sTUFBTSxDQUFDLGNBQWM7QUFDM0IsSUFBRSxPQUFPLFFBQVEsQ0FBQyxNQUFNLElBQUksS0FBSyxLQUFLLEdBQUcsQ0FBQyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUM7QUFDdEQsSUFBRSxNQUFNLFFBQVEsQ0FBQyxNQUFNLElBQUksS0FBSyxLQUFLLEdBQUcsRUFBRSxHQUFHLENBQUMsSUFBSSxFQUFFLElBQUksR0FBRyxDQUFDO0FBQzVELElBQUUsUUFBUSxRQUFRLENBQUMsTUFBTSxJQUFJLEtBQUssU0FBUyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUM7QUFDdkQsSUFBRSxNQUFNLFFBQVEsQ0FBQyxNQUFNLEVBQUUsSUFBSSxRQUFRLENBQUMsTUFBTSxJQUFJLEtBQUssRUFBRSxPQUFPLENBQUMsSUFBSSxLQUFLLEdBQUcsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxLQUFLLEdBQUcsRUFBRSxHQUFHLENBQUMsS0FBSyxLQUFLLEdBQUcsQ0FBQyxDQUFDLFFBQVEsR0FBRyxFQUFFLEdBQUcsQ0FBQyxFQUFFLENBQUMsQ0FBQztBQUN4SSxJQUFFLFFBQVEsUUFBUSxDQUFDLE1BQU0sSUFBSSxLQUFLLEtBQUssR0FBRyxDQUFDLENBQUMsWUFBWSxDQUFDLEVBQUUsQ0FBQztBQUM1RCxTQUFPLGlCQUFpQixJQUFJLEtBQUssSUFBSSxJQUFJO0FBQzNDO0FBQ08sU0FBUyxLQUFLLE1BQU07QUFDekIsUUFBTSxPQUFPLE1BQU0sSUFBcUIseUJBQU8scUJBQXFCO0FBQ3BFLE1BQUksT0FBTyxjQUFjLGVBQWUsVUFBVTtBQUFXLGNBQVUsVUFBVSxVQUFVLElBQUksRUFBRSxLQUFLLElBQUk7QUFBQTtBQUNyRyxTQUFLO0FBQ1o7OztBQzVCTyxJQUFNLGFBQWE7QUFDbkIsSUFBTSxPQUFPO0FBQUEsRUFDbEIsRUFBRSxPQUFPLFNBQVMsTUFBTSx1RUFBdUUsT0FBTztBQUFBLElBQ3BHLENBQUMsT0FBTywyQ0FBMkMsZUFBZTtBQUFBLElBQ2xFLENBQUMsTUFBTSw2Q0FBNkMsY0FBYztBQUFBLElBQ2xFLENBQUMsUUFBUSx3QkFBd0IsZ0JBQWdCO0FBQUEsSUFDakQsQ0FBQyxPQUFPLHVCQUF1QixlQUFlO0FBQUEsSUFDOUMsQ0FBQyxPQUFPLG1EQUFtRCxlQUFlO0FBQUEsSUFDMUUsQ0FBQyxRQUFRLG9EQUFvRCxnQkFBZ0I7QUFBQSxJQUM3RSxDQUFDLE9BQU8sNkJBQTZCLGFBQWE7QUFBQSxJQUNsRCxDQUFDLE9BQU8sdUNBQXVDLGFBQWE7QUFBQSxFQUM5RCxFQUFFO0FBQUEsRUFDRixFQUFFLE9BQU8sb0JBQW9CLE9BQU87QUFBQSxJQUNsQyxDQUFDLGlCQUFpQix5SEFBeUgsVUFBVTtBQUFBLElBQ3JKLENBQUMsY0FBYyxpQ0FBaUMsbUJBQW1CO0FBQUEsSUFDbkUsQ0FBQyxZQUFZLHdDQUF3QyxnREFBZ0Q7QUFBQSxFQUN2RyxFQUFFO0FBQUEsRUFDRixFQUFFLE9BQU8sdUNBQXVDLE9BQU87QUFBQSxJQUNyRCxDQUFDLFNBQVMsMkNBQTJDLHNCQUFzQjtBQUFBLElBQzNFLENBQUMsaUJBQWlCLHFEQUFxRCx5Q0FBeUM7QUFBQSxJQUNoSCxDQUFDLHVCQUF1Qiw2R0FBNkcsbUVBQW1FO0FBQUEsSUFDeE0sQ0FBQyxrQkFBa0IsZ0dBQWdHLDhEQUE4RDtBQUFBLElBQ2pMLENBQUMsWUFBWSxrSEFBa0gsMERBQTBEO0FBQUEsSUFDekwsQ0FBQyxZQUFZLDJFQUEyRSx1Q0FBdUM7QUFBQSxJQUMvSCxDQUFDLFVBQVUscUVBQXFFLHdDQUF3QztBQUFBLElBQ3hILENBQUMsaUJBQWlCLGlEQUFpRCx5REFBeUQ7QUFBQSxJQUM1SCxDQUFDLHFCQUFxQiwrRkFBK0YsMkRBQTJEO0FBQUEsSUFDaEwsQ0FBQyxnQkFBZ0IsaUNBQWlDLHNEQUFzRDtBQUFBLEVBQzFHLEVBQUU7QUFBQSxFQUNGLEVBQUUsT0FBTyx3QkFBd0IsT0FBTztBQUFBLElBQ3RDLENBQUMsZUFBZSw4RUFBOEUsSUFBSTtBQUFBLElBQ2xHLENBQUMsb0JBQW9CLDZFQUE2RSxJQUFJO0FBQUEsSUFDdEcsQ0FBQyxrQkFBa0IsNkhBQTZILElBQUk7QUFBQSxJQUNwSixDQUFDLDBCQUEwQixxR0FBcUcsSUFBSTtBQUFBLElBQ3BJLENBQUMsVUFBVSx1RUFBdUUsSUFBSTtBQUFBLElBQ3RGLENBQUMsZ0JBQWdCLHNGQUFzRixJQUFJO0FBQUEsRUFDN0csRUFBRTtBQUFBLEVBQ0YsRUFBRSxPQUFPLDJCQUEyQixPQUFPO0FBQUEsSUFDekMsQ0FBQyxtQ0FBbUMsNkJBQTZCLElBQUk7QUFBQSxJQUNyRSxDQUFDLHVEQUF1RCxrRkFBa0YsSUFBSTtBQUFBLElBQzlJLENBQUMsOENBQThDLHlDQUF5QyxJQUFJO0FBQUEsSUFDNUYsQ0FBQyw2Q0FBNkMsNkRBQTZELElBQUk7QUFBQSxJQUMvRyxDQUFDLDBCQUEwQixvREFBb0QsSUFBSTtBQUFBLEVBQ3JGLEVBQUU7QUFBQSxFQUNGLEVBQUUsT0FBTyxZQUFZLE9BQU87QUFBQSxJQUMxQixDQUFDLFVBQVUseUhBQXlILElBQUk7QUFBQSxJQUN4SSxDQUFDLFdBQVcsdUZBQXVGLElBQUk7QUFBQSxJQUN2RyxDQUFDLFVBQVUsc0VBQXNFLElBQUk7QUFBQSxJQUNyRixDQUFDLGtCQUFrQiw0RUFBNEUsSUFBSTtBQUFBLElBQ25HLENBQUMsZ0JBQWdCLHlEQUF5RCxJQUFJO0FBQUEsRUFDaEYsRUFBRTtBQUNKO0FBQ08sU0FBUyxXQUFXLFFBQVEsUUFBUTtBQUN6QyxRQUFNLE9BQU8sRUFBRSxPQUFPLFdBQVcsTUFBTTtBQUN2QyxJQUFFLE9BQU8saUJBQWlCLE1BQU0sdUJBQXVCO0FBQ3ZELE9BQUssUUFBUSxDQUFDLFFBQVE7QUFDcEIsVUFBTSxNQUFNLEVBQUUsT0FBTyxlQUFlLElBQUk7QUFDeEMsTUFBRSxPQUFPLFlBQVksS0FBSyxJQUFJLEtBQUs7QUFDbkMsUUFBSSxJQUFJO0FBQU0sUUFBRSxPQUFPLFdBQVcsS0FBSyxJQUFJLElBQUk7QUFDL0MsUUFBSSxNQUFNLFFBQVEsQ0FBQyxDQUFDLE1BQU0sTUFBTSxPQUFPLE1BQU07QUFDM0MsVUFBSSxDQUFDLFNBQVM7QUFDWixjQUFNLE1BQU0sRUFBRSxPQUFPLGVBQWUsR0FBRztBQUN2QyxVQUFFLEtBQUssSUFBSSxLQUFLLElBQUk7QUFDcEIsVUFBRSxRQUFRLElBQUksS0FBSyxRQUFRLElBQUk7QUFDL0I7QUFBQSxNQUNGO0FBQ0EsWUFBTSxNQUFNLEVBQUUsV0FBVyxnQkFBZ0IsR0FBRztBQUM1QyxZQUFNLE1BQU0sRUFBRSxXQUFXLElBQUksR0FBRztBQUNoQyxRQUFFLEtBQUssSUFBSSxLQUFLLElBQUk7QUFDcEIsUUFBRSxRQUFRLElBQUksS0FBSyxRQUFRLElBQUk7QUFDL0IsVUFBSSxPQUFPO0FBQ1gsVUFBSSxpQkFBaUIsVUFBVSxNQUFNO0FBQ25DLFlBQUksQ0FBQyxJQUFJLFFBQVE7QUFBTTtBQUN2QixlQUFPO0FBQ1AsVUFBRSxPQUFPLGdCQUFnQixLQUFLLE9BQU87QUFDckMsVUFBRSxVQUFVLFlBQVksS0FBSyxjQUFjLEVBQUUsaUJBQWlCLFNBQVMsTUFBTSxLQUFLLGVBQWUsVUFBVSxPQUFPLENBQUM7QUFDbkgsb0JBQVksU0FBUyxFQUFFLE9BQU8sZ0JBQWdCLEdBQUcsR0FBRyxNQUFNO0FBQUEsTUFDNUQsQ0FBQztBQUFBLElBQ0gsQ0FBQztBQUFBLEVBQ0gsQ0FBQztBQUNIOzs7QUNsRk8sSUFBTSxhQUFhLEVBQUUsS0FBSyxNQUFNLElBQUksT0FBTyxLQUFLLE9BQU8sS0FBSyxNQUFNO0FBQ2xFLElBQU0sVUFBVSxDQUFDLE1BQU07QUFDNUIsUUFBTSxLQUFLLE1BQU0sRUFBRSxJQUFJO0FBQ3ZCLFNBQU8sRUFBRSxPQUFPLEdBQUcsT0FBTyxLQUFLLENBQUMsR0FBRyxLQUFLLEtBQUssRUFBRSxJQUFJLElBQUksTUFBTSxDQUFDLEdBQUcsT0FBTyxHQUFHLFVBQVUsTUFBTTtBQUM3RjtBQUNPLElBQU0sVUFBVSxDQUFDLE1BQU07QUFDNUIsSUFBRSxRQUFRLFdBQVcsRUFBRSxLQUFLO0FBQzVCLElBQUUsT0FBTztBQUNULElBQUUsTUFBTSxFQUFFLElBQUksSUFBSSxDQUFDLE1BQU0sSUFBSSxDQUFDO0FBQ2hDO0FBQ08sU0FBUyxZQUFZLEdBQUcsT0FBTztBQUNwQyxRQUFNLE9BQXVCLG9CQUFJLElBQUk7QUFDckMsSUFBRSxNQUFNLFFBQVEsQ0FBQyxNQUFNLEtBQUssSUFBSSxHQUFHLFFBQVEsQ0FBQyxDQUFDLENBQUM7QUFDOUMsUUFBTSxPQUFPLENBQUM7QUFDZCxJQUFFLE1BQU0sUUFBUSxDQUFDLE1BQU0sRUFBRSxJQUFJLFFBQVEsQ0FBQyxHQUFHLE1BQU07QUFDN0MsS0FBQyxLQUFLLENBQUMsSUFBSSxLQUFLLENBQUMsS0FBSyxDQUFDLEdBQUcsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0FBQUEsRUFDdkMsQ0FBQyxDQUFDO0FBQ0YsV0FBUyxJQUFJLEVBQUUsTUFBTSxTQUFTLEdBQUcsS0FBSyxHQUFHLEtBQUs7QUFDNUMsVUFBTSxJQUFJLEVBQUUsTUFBTSxDQUFDLEdBQUcsSUFBSSxLQUFLLElBQUksQ0FBQztBQUNwQyxRQUFJLEVBQUU7QUFBTztBQUNiLFVBQU0sT0FBTyxLQUFLLEVBQUUsR0FBRyxLQUFLLENBQUM7QUFDN0IsUUFBSSxPQUFPO0FBQ1gsU0FBSyxRQUFRLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTTtBQUN4QixjQUFRLEtBQUssSUFBSSxFQUFFLEVBQUUsSUFBSSxDQUFDO0FBQUEsSUFDNUIsQ0FBQztBQUNELFVBQU0sT0FBTyxLQUFLLFVBQVUsT0FBTyxJQUFJLEtBQUssU0FBUyxJQUFJO0FBQ3pELFFBQUksRUFBRSxRQUFRO0FBQU0sY0FBUSxDQUFDO0FBQUEsRUFDL0I7QUFDQSxNQUFJO0FBQU8sVUFBTSxRQUFRLENBQUMsTUFBTTtBQUM5QixZQUFNLElBQUksS0FBSyxJQUFJLENBQUM7QUFDcEIsVUFBSSxLQUFLLENBQUMsRUFBRTtBQUFPLGdCQUFRLENBQUM7QUFBQSxJQUM5QixDQUFDO0FBQ0QsU0FBTztBQUNUO0FBQ08sU0FBUyxrQkFBa0IsR0FBRyxNQUFNO0FBQ3pDLFFBQU0sVUFBMEIsb0JBQUksSUFBSTtBQUN4QyxJQUFFLE1BQU0sUUFBUSxDQUFDLE1BQU07QUFDckIsUUFBSSxDQUFDLEtBQUssSUFBSSxDQUFDLEVBQUU7QUFBSztBQUN0QixRQUFJLElBQUksR0FBRyxLQUFLO0FBQ2hCLE1BQUUsTUFBTSxRQUFRLENBQUMsTUFBTSxFQUFFLElBQUksUUFBUSxDQUFDLEdBQUcsTUFBTTtBQUM3QyxVQUFJLE1BQU0sRUFBRTtBQUFLO0FBQ2pCO0FBQ0EsVUFBSSxDQUFDLEtBQUssSUFBSSxDQUFDLEVBQUUsSUFBSSxDQUFDO0FBQUcsYUFBSztBQUFBLElBQ2hDLENBQUMsQ0FBQztBQUNGLFFBQUksS0FBSztBQUFJLGNBQVEsSUFBSSxFQUFFLEdBQUc7QUFBQSxFQUNoQyxDQUFDO0FBQ0QsU0FBTztBQUNUOzs7QUM5Q08sSUFBTSxPQUFPO0FBQ2IsSUFBTSxTQUFTO0FBQ2YsSUFBTSxNQUFNO0FBQ1osSUFBTSxXQUFXO0FBQ2pCLElBQU0sVUFBVTtBQUVoQixTQUFTLFNBQVMsT0FBTyxHQUFHO0FBQ2pDLFFBQU0sSUFBSSxJQUFJO0FBQ2QsVUFBUSxPQUFPO0FBQUEsSUFDYixLQUFLO0FBQU8sYUFBTyxTQUFTLEtBQUssQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLFVBQVUsS0FBSyxDQUFDLElBQUksQ0FBQztBQUFBLElBQ2xFLEtBQUs7QUFBQSxJQUNMLEtBQUs7QUFBTyxhQUFPLGlCQUFpQixDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDO0FBQUEsSUFDOUQ7QUFBUyxhQUFPLFlBQVksQ0FBQyxPQUFPLENBQUM7QUFBQSxFQUN2QztBQUNGO0FBRU8sSUFBTSxXQUFXO0FBQ2pCLElBQU0sVUFBVTtBQUNoQixJQUFNLFlBQVk7QUFDbEIsSUFBTSxRQUFRLENBQUMsU0FBUyxJQUFJLElBQUk7QUFDaEMsSUFBTSxjQUFjLENBQUMsV0FBVyxXQUFXLFVBQVUsS0FBSyxJQUFJLEdBQUcsU0FBUyxDQUFDLElBQUk7QUFFL0UsU0FBUyxPQUFPLEdBQUcsS0FBSztBQUU3QixRQUFNLEtBQUssS0FBSyxJQUFJLE1BQU0sTUFBTSxJQUFJLE1BQU0sS0FBSyxPQUFPLElBQUksVUFBVTtBQUNwRSxRQUFNLFFBQVEsQ0FBQyxHQUFHLEtBQUssQ0FBQztBQUN4QixJQUFFLE9BQU8sUUFBUSxDQUFDLEdBQUcsTUFBTTtBQUN6QixVQUFNLENBQUMsSUFBSTtBQUNYLE9BQUcsQ0FBQyxJQUFJLEtBQUssSUFBSTtBQUFBLEVBQ25CLENBQUM7QUFDRCxJQUFFLE1BQU0sUUFBUSxDQUFDLE1BQU07QUFDckIsTUFBRSxRQUFRLElBQUksS0FBSyxJQUFJLEdBQUcsRUFBRSxJQUFJLElBQUksQ0FBQyxNQUFNLE1BQU0sQ0FBQyxDQUFDLENBQUM7QUFDcEQsVUFBTSxFQUFFLEdBQUcsSUFBSSxFQUFFO0FBQ2pCLE1BQUUsSUFBSSxLQUFLLElBQUksSUFBSSxNQUFNLEVBQUUsSUFBSSxTQUFTLEVBQUU7QUFBQSxFQUM1QyxDQUFDO0FBQ0QsUUFBTSxPQUFPLEVBQUUsTUFBTSxTQUFTLEtBQUssSUFBSSxHQUFHLEVBQUUsTUFBTSxJQUFJLENBQUMsTUFBTSxFQUFFLEtBQUssQ0FBQyxJQUFJO0FBQ3pFLFFBQU0sT0FBTyxDQUFDO0FBQ2QsV0FBUyxJQUFJLEdBQUcsS0FBSyxNQUFNLEtBQUs7QUFDOUIsVUFBTSxPQUFPLElBQUksYUFBYSxJQUFJLFVBQVUsQ0FBQyxLQUFLO0FBQ2xELFNBQUssQ0FBQyxJQUFJLE1BQU0sSUFBSSxPQUFPLEtBQUssSUFBSSxJQUFJLElBQUksSUFBSSxLQUFLLElBQUksQ0FBQyxJQUFJLFNBQVMsS0FBSyxJQUFJLElBQUksTUFBTSxJQUFJO0FBQUEsRUFDaEc7QUFDQSxJQUFFLE1BQU0sUUFBUSxDQUFDLE1BQU07QUFBRSxNQUFFLEtBQUssS0FBSyxFQUFFLEtBQUs7QUFBQSxFQUFHLENBQUM7QUFDaEQsTUFBSSxTQUFTLEtBQUssS0FBSyxJQUFJLEdBQUcsRUFBRSxPQUFPLFNBQVMsQ0FBQyxJQUFJLEtBQUs7QUFDMUQsV0FBUyxJQUFJLEdBQUcsS0FBSyxNQUFNLEtBQUs7QUFDOUIsVUFBTSxLQUFLLEVBQUUsTUFBTSxPQUFPLENBQUMsTUFBTSxFQUFFLFVBQVUsQ0FBQztBQUM5QyxPQUFHLFFBQVEsQ0FBQyxNQUFNO0FBQ2hCLFFBQUUsT0FBTyxFQUFFLElBQUksT0FBTyxDQUFDLEdBQUcsTUFBTSxJQUFJLEdBQUcsQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLElBQUk7QUFBQSxJQUN4RCxDQUFDO0FBQ0QsT0FB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QUk7QUFBQSxNQUNoQztBQUFBLElBQ0YsQ0FBQztBQUFBLEVBQ0g7QUFBQSxFQUVBLE1BQU0sZUFBZTtBQUNuQixTQUFLLFdBQVcsaUJBQWlCLE1BQU0sS0FBSyxTQUFTLENBQUM7QUFBQSxFQUN4RDtBQUFBLEVBRUEsTUFBTSxlQUFlO0FBQ25CLFNBQUssV0FBVyxPQUFPLE9BQU8sS0FBSyxVQUFVLGlCQUFpQixLQUFLLFFBQVEsQ0FBQztBQUM1RSxVQUFNLEtBQUssU0FBUyxLQUFLLFFBQVE7QUFBQSxFQUNuQztBQUNGOyIsCiAgIm5hbWVzIjogWyJpbXBvcnRfb2JzaWRpYW4iLCAiSEFSRF9NQVhfSU5QVVRTIiwgIkhBUkRfTUFYX0dBVEVTIiwgIkFOQUxZU0lTX01BWF9JTlBVVFMiLCAiSEFSRF9NQVhfR0FURVMiLCAiSEFSRF9NQVhfSU5QVVRTIiwgImltcG9ydF9vYnNpZGlhbiIsICJfU2V0dGluZyIsICJfUGx1Z2luU2V0dGluZ1RhYiIsICJIQVJEX01BWF9JTlBVVFMiLCAiSEFSRF9NQVhfR0FURVMiLCAicGFyc2VTcGFjaW5nIiwgImltcG9ydF9vYnNpZGlhbjIiLCAiaW1wb3J0X29ic2lkaWFuIiwgIk1FVEhPRF9MQUJFTCIsICJpbXBvcnRfb2JzaWRpYW4iLCAiaW1wb3J0X29ic2lkaWFuMyIsICJpbXBvcnRfb2JzaWRpYW4iLCAiaW1wb3J0X29ic2lkaWFuNSIsICJBTkFMWVNJU19NQVhfSU5QVVRTIiwgInBhcnNlU3BhY2luZyIsICJNRVRIT0RfTEFCRUwiXQp9Cg==
