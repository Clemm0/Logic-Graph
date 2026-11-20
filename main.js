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
  BUF: { min: 1, max: 1, shape: "BUF", inv: false, fn: (v) => !!v[0] },
  MUX: {
    min: 3,
    shape: "MUX",
    inv: false,
    fn: (v) => {
      const n = v.length;
      let k = 1;
      while ((1 << k) + k < n)
        k++;
      const data = v.slice(0, n - k);
      let idx = 0;
      for (let i = 0; i < k; i++)
        idx = idx << 1 | (v[n - k + i] ? 1 : 0);
      return !!data[idx];
    }
  }
};
var INVERSE = { AND: "NAND", NAND: "AND", OR: "NOR", NOR: "OR", XOR: "XNOR", XNOR: "XOR" };
var BASE = { AND: "AND", NAND: "AND", OR: "OR", NOR: "OR", XOR: "XOR", XNOR: "XOR" };
var INVERTING = { NAND: 1, NOR: 1, XNOR: 1, NOT: 1 };

// src/core/constants.js
var HARD_MAX_INPUTS = 32;
var HARD_MAX_GATES = 256;
var ANALYSIS_MAX_INPUTS = 12;
var MAX_GATE_FANIN = 6;
var HARD_MAX_MUX_INPUTS = 16;
var DEFAULT_MAX_MUX_INPUTS = 8;
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
  limits = Object.assign({
    maxInputs: DEFAULT_MAX_INPUTS,
    maxGates: DEFAULT_MAX_GATES,
    maxMuxInputs: DEFAULT_MAX_MUX_INPUTS
  }, limits);
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
    const m = line.match(/^\(([^)]*)\)\s*([A-Za-z&|^!~]+)\s*\(([^)]*)\)$/);
    if (!m)
      throw new Error(`Line ${n}: expected "(inputs) GATE (output)"`);
    const ins = m[1].split(/[,\s]+/).map((x) => x.trim()).filter(Boolean);
    const outs = m[3].split(/[,\s]+/).map((x) => x.trim()).filter(Boolean);
    let rawType = m[2].toUpperCase().trim();
    const ALIASES = {
      "&": "AND",
      "&&": "AND",
      "|": "OR",
      "||": "OR",
      "^": "XOR",
      "!": "NOT",
      "~": "NOT",
      "MULTIPLEXER": "MUX",
      "MUX": "MUX"
    };
    const type = ALIASES[rawType] || rawType;
    const spec = GATES[type];
    if (!spec)
      throw new Error(`Line ${n}: unknown gate "${m[2]}". Available: ${Object.keys(GATES).join(", ")}`);
    if (outs.length !== 1)
      throw new Error(`Line ${n}: a gate needs exactly one output signal`);
    if (ins.length < spec.min)
      throw new Error(`Line ${n}: ${type} needs at least ${spec.min} input(s)`);
    if (spec.max && ins.length > spec.max)
      throw new Error(`Line ${n}: ${type} takes at most ${spec.max} inputs`);
    if (type === "MUX") {
      if (ins.length > limits.maxMuxInputs) {
        throw new Error(`Line ${n}: MUX takes at most ${limits.maxMuxInputs} inputs. (Raise "Max MUX inputs" in settings, up to ${HARD_MAX_MUX_INPUTS})`);
      }
      let k = 1;
      while ((1 << k) + k < ins.length)
        k++;
      if ((1 << k) + k !== ins.length) {
        throw new Error(`Line ${n}: MUX requires a number of inputs equal to 2^sel + sel (e.g., 3, 6, 11, 20). Got ${ins.length}.`);
      }
    } else if (ins.length > MAX_GATE_FANIN) {
      throw new Error(`Line ${n}: at most ${MAX_GATE_FANIN} inputs per gate`);
    }
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
      throw new Error(`Line ${n}: more than ${limits.maxGates} gates (raise "Max gates" in the plugin settings, up to ${HARD_MAX_GATES})`);
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
    throw new Error(`Too many inputs (${c.inputs.length}, max ${limits.maxInputs}). Raise "Max inputs" in the plugin settings (up to ${HARD_MAX_INPUTS}).`);
  }
  c.opts = opts;
  return c;
}

// src/settings/tab.js
var import_obsidian = require("obsidian");

// src/settings/settings.js
var DEFAULTS = {
  maxInputs: DEFAULT_MAX_INPUTS,
  maxGates: DEFAULT_MAX_GATES,
  maxMuxInputs: DEFAULT_MAX_MUX_INPUTS,
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
  s2.maxInputs = clamp(Math.round(Number(s2.maxInputs)) || DEFAULTS.maxInputs, 1, HARD_MAX_INPUTS);
  s2.maxGates = clamp(Math.round(Number(s2.maxGates)) || DEFAULTS.maxGates, 1, HARD_MAX_GATES);
  s2.maxMuxInputs = clamp(Math.round(Number(s2.maxMuxInputs)) || DEFAULTS.maxMuxInputs, 2, HARD_MAX_MUX_INPUTS);
  const d = Number(s2.delaySeconds);
  s2.delaySeconds = Number.isFinite(d) ? d < 0 ? -1 : clamp(d, 0, 30) : DEFAULTS.delaySeconds;
  const v = Number(s2.vSpacing);
  s2.vSpacing = Number.isFinite(v) ? clamp(Math.round(v), 0, 200) : DEFAULTS.vSpacing;
  if (!parseSpacing(s2.hSpacing))
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
function parseSpacing(str) {
  const m = String(str).trim().match(/^(\d+(?:\.\d+)?)\s*(%|px)?$/i);
  if (!m)
    return null;
  const v = parseFloat(m[1]);
  return m[2] === "%" ? { pct: clamp(v, 10, 400) } : { px: clamp(Math.round(v), 40, 1e3) };
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
var METHOD_LABEL = {
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

// src/settings/providers.js
var PROVIDERS = {
  local: { name: "Local recognizer (offline, Image Import extension)" },
  claude: { name: "Claude (Anthropic)", keyHint: "sk-ant-\u2026", modelHint: "model name" },
  gemini: { name: "Gemini (Google)", keyHint: "AIza\u2026", modelHint: "model name" },
  grok: { name: "Grok (xAI)", keyHint: "xai-\u2026", modelHint: "model name" },
  deepseek: { name: "DeepSeek", keyHint: "sk-\u2026", modelHint: "model name" },
  openrouter: { name: "OpenRouter", keyHint: "sk-or-\u2026", modelHint: "provider/model" }
};
var IMPORT_EXTENSION_ID = "logic-graph-import";

// src/settings/tab.js
var LogicGraphSettingTab = class extends import_obsidian.PluginSettingTab {
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
    const heading = (name) => new import_obsidian.Setting(containerEl).setName(name).setHeading();
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
      new import_obsidian.Setting(containerEl).setName("Max inputs at a time").setDesc(`Circuits with more inputs show an error. 1 to ${HARD_MAX_INPUTS}. Truth tables, Karnaugh maps and simplification are only available up to ${ANALYSIS_MAX_INPUTS} inputs (2^n rows).`),
      "maxInputs",
      1,
      HARD_MAX_INPUTS,
      true
    );
    num(new import_obsidian.Setting(containerEl).setName("Max gates at a time").setDesc(`1 to ${HARD_MAX_GATES}.`), "maxGates", 1, HARD_MAX_GATES, true);
    num(
      new import_obsidian.Setting(containerEl).setName("Max MUX inputs").setDesc(`The maximum number of inputs a single MUX gate can take. 2 to ${HARD_MAX_MUX_INPUTS}. Note: Valid MUX sizes are 3, 6, 11, 20 inputs.`),
      "maxMuxInputs",
      2,
      HARD_MAX_MUX_INPUTS,
      true
    );
    heading("Display");
    new import_obsidian.Setting(containerEl).setName("Show truth table automatically").setDesc('Per block you can override with "@hide table" or "@show table".').addToggle((t) => t.setValue(S.showTable).onChange(async (v) => {
      S.showTable = v;
      await save();
    }));
    new import_obsidian.Setting(containerEl).setName("Show boolean expressions").addToggle((t) => t.setValue(S.showExpr).onChange(async (v) => {
      S.showExpr = v;
      await save();
    }));
    new import_obsidian.Setting(containerEl).setName("Show Karnaugh maps").setDesc("2 to 6 inputs. Groups come from the Quine\u2013McCluskey result (an exact minimum when the search is small enough).").addToggle((t) => t.setValue(S.showKmap).onChange(async (v) => {
      S.showKmap = v;
      await save();
    }));
    new import_obsidian.Setting(containerEl).setName(`Collapse "don't care" rows in the truth table`).setDesc("Rows whose outputs do not depend on some inputs are merged and shown with X (the middle signals are hidden in this mode).").addToggle((t) => t.setValue(S.collapseDontCare).onChange(async (v) => {
      S.collapseDontCare = v;
      await save();
    }));
    new import_obsidian.Setting(containerEl).setName("Bubble pushing view").setDesc("Draws each gate with the De Morgan symbol that makes its bubbles match the next gate (e.g. NAND-NAND shows as AND-OR with matching bubbles). No gate is added or removed; click a gate to flip it by hand.").addToggle((t) => t.setValue(S.bubblePushing).onChange(async (v) => {
      S.bubblePushing = v;
      await save();
    }));
    heading("Timing");
    new import_obsidian.Setting(containerEl).setName("Simulate gate delays").setDesc("Signals propagate through the gates one step at a time.").addToggle((t) => t.setValue(S.delayEnabled).onChange(async (v) => {
      S.delayEnabled = v;
      await save();
    }));
    num(new import_obsidian.Setting(containerEl).setName("Delay per gate (seconds)").setDesc("0 to 30. Use -1 for a random delay between 0 and 5 seconds for every gate change."), "delaySeconds", -1, 30, false);
    new import_obsidian.Setting(containerEl).setName("Timing view").setDesc("Graph = waveforms. Animation = bits travelling along the wires, gates light up green (output 1) or red/orange (output 0). Per block: @timing-graph, @timing-animation, @timing-both.").addDropdown((d) => {
      d.addOption("graph", "Graph");
      d.addOption("animation", "Animation");
      d.addOption("both", "Both");
      d.setValue(S.timingView).onChange(async (v) => {
        S.timingView = v;
        await save();
      });
    });
    heading("Graphic values");
    new import_obsidian.Setting(containerEl).setName("Horizontal spacing").setDesc("Distance between gate columns. A whole number of pixels (e.g. 90), or a percentage (e.g. 100%) to spread the circuit across that share of the page width.").addText((t) => t.setValue(String(S.hSpacing)).onChange(async (v) => {
      if (parseSpacing(v)) {
        S.hSpacing = v.trim();
        await save();
      }
    }));
    num(new import_obsidian.Setting(containerEl).setName("Vertical spacing (px)").setDesc("Distance between gates in the same column. 0 to 200."), "vSpacing", 0, 200, true);
    heading("Experimental: circuit reduction");
    new import_obsidian.Setting(containerEl).setName("Always draw a reduced circuit").setDesc('Off by default. Every reduced circuit is checked against the original before it is shown. Per block: "@simplify structural" (or @reduce).').addToggle((t) => t.setValue(S.expSimplify).onChange(async (v) => {
      S.expSimplify = v;
      await save();
    }));
    new import_obsidian.Setting(containerEl).setName("Reduction method").setDesc("Structural rewrites your actual circuit and never adds gates. The two-level methods rebuild the function from the Quine\u2013McCluskey cover and can be larger than the original. Best picks the smallest.").addDropdown((d) => {
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
    new import_obsidian.Setting(containerEl).setName("Import from image").setHeading();
    const installed = !!(this.app.plugins && this.app.plugins.plugins && this.app.plugins.plugins[IMPORT_EXTENSION_ID]);
    containerEl.createEl("p", {
      cls: "lg-note",
      text: installed ? 'The "Logic Graph - Image Import" extension is installed. Use the command "Import circuit from image" (Ctrl/Cmd + P) \u2014 everything stays on your device.' : 'Image import is provided by the separate "Logic Graph - Image Import" extension. Copy its folder into .obsidian/plugins/ and enable it, then use the command "Import circuit from image".'
    });
  }
};

// src/templates.js
var import_obsidian2 = __toESM(require("obsidian"));
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
var TemplateModal = class extends import_obsidian2.FuzzySuggestModal {
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
    c = parse(src, { maxInputs: S.maxInputs, maxGates: S.maxGates, maxMuxInputs: S.maxMuxInputs });
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
  const analyzable = c.inputs.length <= ANALYSIS_MAX_INPUTS;
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
  const hspacing = parseSpacing(S.hSpacing) || { px: 90 };
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
      h("div", "lg-note", wrap, `"${method}" needs at most ${ANALYSIS_MAX_INPUTS} inputs. "structural" works at any size.`);
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
            title: `Reduced, ${METHOD_LABEL[r.method]}${chosen}: ${r.before.gates} to ${r.after.gates} gates (${check})`,
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
      h("div", "lg-note", box, `More than ${ANALYSIS_MAX_INPUTS} inputs: only the structural expression is shown.`);
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
    h("div", "lg-note", wrap, `Truth table hidden: more than ${ANALYSIS_MAX_INPUTS} inputs (2^${c.inputs.length} rows). The diagram is still interactive.`);
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsic3JjL21haW4uanMiLCAic3JjL2NvcmUvZ2F0ZXMuanMiLCAic3JjL2NvcmUvY29uc3RhbnRzLmpzIiwgInNyYy9jb3JlL3BhcnNlci5qcyIsICJzcmMvc2V0dGluZ3MvdGFiLmpzIiwgInNyYy9zZXR0aW5ncy9zZXR0aW5ncy5qcyIsICJzcmMvY29yZS9sYXRleC5qcyIsICJzcmMvY29yZS9taW5pbWl6ZS5qcyIsICJzcmMvY29yZS9zeW50aGVzaXplLmpzIiwgInNyYy9zZXR0aW5ncy9wcm92aWRlcnMuanMiLCAic3JjL3RlbXBsYXRlcy5qcyIsICJzcmMvdWkvYmxvY2suanMiLCAic3JjL2NvcmUvc2ltLmpzIiwgInNyYy9jb3JlL3JlZHVjZS5qcyIsICJzcmMvdWkvZG9tLmpzIiwgInNyYy91aS9jb3B5LmpzIiwgInNyYy91aS9oZWxwLmpzIiwgInNyYy9jb3JlL2J1YmJsZXMuanMiLCAic3JjL3VpL2xheW91dC5qcyIsICJzcmMvdWkvZXhwb3J0LWltYWdlLmpzIiwgInNyYy91aS9kaWFncmFtLmpzIiwgInNyYy91aS90aW1pbmcuanMiLCAic3JjL2NvcmUvY29tcGFjdC5qcyIsICJzcmMvdWkvdGFibGUuanMiLCAic3JjL3VpL2ttYXAuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8vIHBhY2thZ2VzL2xvZ2ljLWdyYXBoL3NyYy9tYWluLmpzXG5pbXBvcnQgeyBQbHVnaW4gfSBmcm9tIFwib2JzaWRpYW5cIjtcbmltcG9ydCB7IEdBVEVTIH0gZnJvbSBcIi4vY29yZS9nYXRlcy5qc1wiO1xuaW1wb3J0IHsgcGFyc2UgfSBmcm9tIFwiLi9jb3JlL3BhcnNlci5qc1wiO1xuaW1wb3J0IHsgTG9naWNHcmFwaFNldHRpbmdUYWIgfSBmcm9tIFwiLi9zZXR0aW5ncy90YWIuanNcIjtcbmltcG9ydCB7IHNhbml0aXplU2V0dGluZ3MgfSBmcm9tIFwiLi9zZXR0aW5ncy9zZXR0aW5ncy5qc1wiO1xuaW1wb3J0IHsgUFJPVklERVJTIH0gZnJvbSBcIi4vc2V0dGluZ3MvcHJvdmlkZXJzLmpzXCI7XG5pbXBvcnQgeyBmZW5jZSwgVGVtcGxhdGVNb2RhbCB9IGZyb20gXCIuL3RlbXBsYXRlcy5qc1wiO1xuaW1wb3J0IHsgcmVuZGVyQmxvY2sgfSBmcm9tIFwiLi91aS9ibG9jay5qc1wiO1xuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBMb2dpY0dyYXBoUGx1Z2luIGV4dGVuZHMgUGx1Z2luIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoLi4uYXJndW1lbnRzKTtcbiAgICB0aGlzLmxpdmVCbG9ja3MgPSBuZXcgU2V0KCk7XG4gIH1cblxuICBhc3luYyBvbmxvYWQoKSB7XG4gICAgYXdhaXQgdGhpcy5sb2FkU2V0dGluZ3MoKTtcbiAgICB0aGlzLmFkZFNldHRpbmdUYWIobmV3IExvZ2ljR3JhcGhTZXR0aW5nVGFiKHRoaXMuYXBwLCB0aGlzKSk7XG4gICAgXG4gICAgdGhpcy5hcGkgPSB7XG4gICAgICB2ZXJzaW9uOiB0aGlzLm1hbmlmZXN0LnZlcnNpb24sIC8vIEZpeGVkOiB1c2UgT2JzaWRpYW4ncyBuYXRpdmUgbWFuaWZlc3RcbiAgICAgIHBhcnNlOiAoc3JjLCBsaW1pdHMpID0+IHBhcnNlKHNyYywgbGltaXRzKSxcbiAgICAgIGdldFNldHRpbmdzOiAoKSA9PiB0aGlzLnNldHRpbmdzLFxuICAgICAgcHJvdmlkZXJzOiBQUk9WSURFUlMsXG4gICAgICBmZW5jZVxuICAgIH07XG5cbiAgICBbXCJsb2dpY1wiLCBcIkxvZ2ljXCIsIFwibG9naWMtZ3JhcGhcIl0uZm9yRWFjaCgobGFuZykgPT4ge1xuICAgICAgdGhpcy5yZWdpc3Rlck1hcmtkb3duQ29kZUJsb2NrUHJvY2Vzc29yKGxhbmcsIChzb3VyY2UsIGVsKSA9PiB7XG4gICAgICAgIGNvbnN0IGhhbmRsZSA9IHJlbmRlckJsb2NrKHNvdXJjZSwgZWwsIHRoaXMpO1xuICAgICAgICBpZiAoaGFuZGxlICYmIGhhbmRsZS5kaXNwb3NlKSB0aGlzLmxpdmVCbG9ja3MuYWRkKGhhbmRsZSk7XG4gICAgICAgIFxuICAgICAgICBpZiAodHlwZW9mIE11dGF0aW9uT2JzZXJ2ZXIgIT09IFwidW5kZWZpbmVkXCIpIHtcbiAgICAgICAgICBjb25zdCBtbyA9IG5ldyBNdXRhdGlvbk9ic2VydmVyKCgpID0+IHtcbiAgICAgICAgICAgIGlmICghZWwuaXNDb25uZWN0ZWQpIHtcbiAgICAgICAgICAgICAgbW8uZGlzY29ubmVjdCgpO1xuICAgICAgICAgICAgICBpZiAoaGFuZGxlICYmIGhhbmRsZS5kaXNwb3NlKSB7XG4gICAgICAgICAgICAgICAgaGFuZGxlLmRpc3Bvc2UoKTtcbiAgICAgICAgICAgICAgICB0aGlzLmxpdmVCbG9ja3MuZGVsZXRlKGhhbmRsZSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9KTtcbiAgICAgICAgICBtby5vYnNlcnZlKGRvY3VtZW50LmJvZHksIHsgY2hpbGRMaXN0OiB0cnVlLCBzdWJ0cmVlOiB0cnVlIH0pO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9KTtcblxuICAgIHRoaXMuYWRkQ29tbWFuZCh7XG4gICAgICBpZDogXCJpbnNlcnQtYmxvY2tcIixcbiAgICAgIG5hbWU6IFwiSW5zZXJ0IGxvZ2ljIGJsb2NrXCIsXG4gICAgICBlZGl0b3JDYWxsYmFjazogKGVkKSA9PiBlZC5yZXBsYWNlU2VsZWN0aW9uKGZlbmNlKFwiKGEsYikgQU5EIChjKVxcbihjLGIpIFhPUiAoZClcXG4oZCkgTk9UICh5KVwiKSlcbiAgICB9KTtcbiAgICBcbiAgICB0aGlzLmFkZENvbW1hbmQoe1xuICAgICAgaWQ6IFwiaW5zZXJ0LWhlbHBcIixcbiAgICAgIG5hbWU6IFwiSW5zZXJ0IGhlbHAgYmxvY2sgKEBoZWxwKVwiLFxuICAgICAgZWRpdG9yQ2FsbGJhY2s6IChlZCkgPT4gZWQucmVwbGFjZVNlbGVjdGlvbihmZW5jZShcIkBoZWxwXCIpKVxuICAgIH0pO1xuICAgIFxuICAgIHRoaXMuYWRkQ29tbWFuZCh7XG4gICAgICBpZDogXCJpbnNlcnQtdGVtcGxhdGVcIixcbiAgICAgIG5hbWU6IFwiSW5zZXJ0IGxvZ2ljIGJsb2NrIGZyb20gdGVtcGxhdGVcdTIwMjZcIixcbiAgICAgIGVkaXRvckNhbGxiYWNrOiAoZWQpID0+IG5ldyBUZW1wbGF0ZU1vZGFsKHRoaXMuYXBwLCAodCkgPT4gZWQucmVwbGFjZVNlbGVjdGlvbihmZW5jZSh0LmNvZGUpKSkub3BlbigpXG4gICAgfSk7XG4gICAgXG4gICAgdGhpcy5hZGRDb21tYW5kKHtcbiAgICAgIGlkOiBcIndyYXAtc2VsZWN0aW9uXCIsXG4gICAgICBuYW1lOiBcIldyYXAgc2VsZWN0aW9uIGluIGxvZ2ljIGJsb2NrXCIsXG4gICAgICBlZGl0b3JDYWxsYmFjazogKGVkKSA9PiB7XG4gICAgICAgIGNvbnN0IHNlbCA9IGVkLmdldFNlbGVjdGlvbigpO1xuICAgICAgICBlZC5yZXBsYWNlU2VsZWN0aW9uKGZlbmNlKHNlbCB8fCBcIihhLGIpIEFORCAoeSlcIikpO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgT2JqZWN0LmtleXMoR0FURVMpLmZvckVhY2goKHR5cGUpID0+IHtcbiAgICAgIHRoaXMuYWRkQ29tbWFuZCh7XG4gICAgICAgIGlkOiBcImdhdGUtXCIgKyB0eXBlLnRvTG93ZXJDYXNlKCksXG4gICAgICAgIG5hbWU6IGBJbnNlcnQgZ2F0ZSBsaW5lOiAke3R5cGV9YCxcbiAgICAgICAgZWRpdG9yQ2FsbGJhY2s6IChlZCkgPT4gZWQucmVwbGFjZVNlbGVjdGlvbihHQVRFU1t0eXBlXS5taW4gPT09IDEgPyBgKGEpICR7dHlwZX0gKHkpXFxuYCA6IGAoYSxiKSAke3R5cGV9ICh5KVxcbmApXG4gICAgICB9KTtcbiAgICB9KTtcblxuICAgIFtcIkBzaW1wbGlmeSBzdHJ1Y3R1cmFsXCIsIFwiQGJ1YmJsZXNcIiwgXCJAdGltaW5nLWJvdGhcIiwgXCJAdGltaW5nLWdyYXBoXCIsIFwiQHRpbWluZy1hbmltYXRpb25cIiwgXCJAaGlkZSB0YWJsZVwiLCBcIkBzaG93IGttYXBcIl0uZm9yRWFjaCgoZCkgPT4ge1xuICAgICAgdGhpcy5hZGRDb21tYW5kKHtcbiAgICAgICAgaWQ6IFwiZGlyZWN0aXZlLVwiICsgZC5zbGljZSgxKS5yZXBsYWNlKC9cXHMrL2csIFwiLVwiKSxcbiAgICAgICAgbmFtZTogYEluc2VydCBkaXJlY3RpdmU6ICR7ZH1gLFxuICAgICAgICBlZGl0b3JDYWxsYmFjazogKGVkKSA9PiBlZC5yZXBsYWNlU2VsZWN0aW9uKGQgKyBcIlxcblwiKVxuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cblxuICBvbnVubG9hZCgpIHtcbiAgICB0aGlzLmxpdmVCbG9ja3MuZm9yRWFjaCgoYikgPT4ge1xuICAgICAgaWYgKGIuZGlzcG9zZSkgYi5kaXNwb3NlKCk7XG4gICAgfSk7XG4gICAgdGhpcy5saXZlQmxvY2tzLmNsZWFyKCk7XG4gIH1cblxuICByZWZyZXNoQWxsKCkge1xuICAgIHRoaXMuYXBwLndvcmtzcGFjZS5nZXRMZWF2ZXNPZlR5cGUoXCJtYXJrZG93blwiKS5mb3JFYWNoKChsZWFmKSA9PiB7XG4gICAgICBjb25zdCB2aWV3ID0gbGVhZi52aWV3O1xuICAgICAgaWYgKCF2aWV3KSByZXR1cm47XG4gICAgICBpZiAodmlldy5wcmV2aWV3TW9kZSAmJiB0eXBlb2Ygdmlldy5wcmV2aWV3TW9kZS5yZXJlbmRlciA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgIHZpZXcucHJldmlld01vZGUucmVyZW5kZXIodHJ1ZSk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICBhc3luYyBsb2FkU2V0dGluZ3MoKSB7XG4gICAgdGhpcy5zZXR0aW5ncyA9IHNhbml0aXplU2V0dGluZ3MoYXdhaXQgdGhpcy5sb2FkRGF0YSgpKTtcbiAgfVxuXG4gIGFzeW5jIHNhdmVTZXR0aW5ncygpIHtcbiAgICB0aGlzLnNldHRpbmdzID0gT2JqZWN0LmFzc2lnbih0aGlzLnNldHRpbmdzLCBzYW5pdGl6ZVNldHRpbmdzKHRoaXMuc2V0dGluZ3MpKTtcbiAgICBhd2FpdCB0aGlzLnNhdmVEYXRhKHRoaXMuc2V0dGluZ3MpO1xuICB9XG59IiwgImV4cG9ydCBjb25zdCBHQVRFUyA9IHtcbiAgQU5EOiB7IG1pbjogMiwgc2hhcGU6IFwiQU5EXCIsIGludjogZmFsc2UsIGZuOiAodikgPT4gdi5ldmVyeSgoeCkgPT4geCkgfSxcbiAgTkFORDogeyBtaW46IDIsIHNoYXBlOiBcIkFORFwiLCBpbnY6IHRydWUsIGZuOiAodikgPT4gIXYuZXZlcnkoKHgpID0+IHgpIH0sXG4gIE9SOiB7IG1pbjogMiwgc2hhcGU6IFwiT1JcIiwgaW52OiBmYWxzZSwgZm46ICh2KSA9PiB2LnNvbWUoKHgpID0+IHgpIH0sXG4gIE5PUjogeyBtaW46IDIsIHNoYXBlOiBcIk9SXCIsIGludjogdHJ1ZSwgZm46ICh2KSA9PiAhdi5zb21lKCh4KSA9PiB4KSB9LFxuICBYT1I6IHsgbWluOiAyLCBzaGFwZTogXCJYT1JcIiwgaW52OiBmYWxzZSwgZm46ICh2KSA9PiB2LmZpbHRlcigoeCkgPT4geCkubGVuZ3RoICUgMiA9PT0gMSB9LFxuICBYTk9SOiB7IG1pbjogMiwgc2hhcGU6IFwiWE9SXCIsIGludjogdHJ1ZSwgZm46ICh2KSA9PiB2LmZpbHRlcigoeCkgPT4geCkubGVuZ3RoICUgMiA9PT0gMCB9LFxuICBOT1Q6IHsgbWluOiAxLCBtYXg6IDEsIHNoYXBlOiBcIkJVRlwiLCBpbnY6IHRydWUsIGZuOiAodikgPT4gIXZbMF0gfSxcbiAgQlVGOiB7IG1pbjogMSwgbWF4OiAxLCBzaGFwZTogXCJCVUZcIiwgaW52OiBmYWxzZSwgZm46ICh2KSA9PiAhIXZbMF0gfSxcbiAgTVVYOiB7IFxuICAgIG1pbjogMywgXG4gICAgc2hhcGU6IFwiTVVYXCIsIFxuICAgIGludjogZmFsc2UsIFxuICAgIGZuOiAodikgPT4ge1xuICAgICAgY29uc3QgbiA9IHYubGVuZ3RoO1xuICAgICAgbGV0IGsgPSAxO1xuICAgICAgd2hpbGUgKCgxIDw8IGspICsgayA8IG4pIGsrKztcbiAgICAgIGNvbnN0IGRhdGEgPSB2LnNsaWNlKDAsIG4gLSBrKTtcbiAgICAgIGxldCBpZHggPSAwO1xuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBrOyBpKyspIGlkeCA9IChpZHggPDwgMSkgfCAodltuIC0gayArIGldID8gMSA6IDApO1xuICAgICAgcmV0dXJuICEhZGF0YVtpZHhdO1xuICAgIH0gXG4gIH1cbn07XG5leHBvcnQgY29uc3QgSU5WRVJTRSA9IHsgQU5EOiBcIk5BTkRcIiwgTkFORDogXCJBTkRcIiwgT1I6IFwiTk9SXCIsIE5PUjogXCJPUlwiLCBYT1I6IFwiWE5PUlwiLCBYTk9SOiBcIlhPUlwiIH07XG5leHBvcnQgY29uc3QgQkFTRSA9IHsgQU5EOiBcIkFORFwiLCBOQU5EOiBcIkFORFwiLCBPUjogXCJPUlwiLCBOT1I6IFwiT1JcIiwgWE9SOiBcIlhPUlwiLCBYTk9SOiBcIlhPUlwiIH07XG5leHBvcnQgY29uc3QgSU5WRVJUSU5HID0geyBOQU5EOiAxLCBOT1I6IDEsIFhOT1I6IDEsIE5PVDogMSB9OyIsICIvLyBwYWNrYWdlcy9sb2dpYy1ncmFwaC9zcmMvY29yZS9jb25zdGFudHMuanNcbmV4cG9ydCBjb25zdCBIQVJEX01BWF9JTlBVVFMgPSAzMjtcbmV4cG9ydCBjb25zdCBIQVJEX01BWF9HQVRFUyA9IDI1NjtcbmV4cG9ydCBjb25zdCBBTkFMWVNJU19NQVhfSU5QVVRTID0gMTI7XG5leHBvcnQgY29uc3QgTUFYX0dBVEVfRkFOSU4gPSA2O1xuXG4vLyBOZXcgTVVYIGxpbWl0c1xuZXhwb3J0IGNvbnN0IEhBUkRfTUFYX01VWF9JTlBVVFMgPSAxNjtcbmV4cG9ydCBjb25zdCBERUZBVUxUX01BWF9NVVhfSU5QVVRTID0gODtcblxuZXhwb3J0IGNvbnN0IElEX1JFID0gL15bQS1aYS16X11bQS1aYS16MC05X10qJC87XG5leHBvcnQgY29uc3QgY2xhbXAgPSAoeCwgbG8sIGhpKSA9PiBNYXRoLm1pbihoaSwgTWF0aC5tYXgobG8sIHgpKTtcbmV4cG9ydCBjb25zdCBERUZBVUxUX01BWF9JTlBVVFMgPSAxMjtcbmV4cG9ydCBjb25zdCBERUZBVUxUX01BWF9HQVRFUyA9IDY0O1xuZXhwb3J0IGNvbnN0IFJFRFVDRV9NRVRIT0RTID0gW1wic3RydWN0dXJhbFwiLCBcImJlc3RcIiwgXCJzb3BcIiwgXCJwb3NcIiwgXCJuYW5kXCIsIFwibm9yXCJdO1xuZXhwb3J0IGNvbnN0IFRJTUlOR19WSUVXUyA9IFtcImdyYXBoXCIsIFwiYW5pbWF0aW9uXCIsIFwiYm90aFwiXTsiLCAiaW1wb3J0IHsgXG4gIFRJTUlOR19WSUVXUywgUkVEVUNFX01FVEhPRFMsIERFRkFVTFRfTUFYX0dBVEVTLCBERUZBVUxUX01BWF9JTlBVVFMsIFxuICBJRF9SRSwgTUFYX0dBVEVfRkFOSU4sIEhBUkRfTUFYX0dBVEVTLCBIQVJEX01BWF9JTlBVVFMsIFxuICBERUZBVUxUX01BWF9NVVhfSU5QVVRTLCBIQVJEX01BWF9NVVhfSU5QVVRTIFxufSBmcm9tIFwiLi9jb25zdGFudHMuanNcIjtcbmltcG9ydCB7IEdBVEVTIH0gZnJvbSBcIi4vZ2F0ZXMuanNcIjtcblxudmFyIFBBUlRTID0gW1widGFibGVcIiwgXCJleHByXCIsIFwiZGlhZ3JhbVwiLCBcImttYXBcIiwgXCJ0aW1pbmdcIl07XG52YXIgRElSRUNUSVZFX0xJU1QgPSBcIkBoZWxwLCBAaGlkZSwgQHNob3csIEBzaW1wbGlmeSAoQHJlZHVjZSksIEBidWJibGVzLCBAY29tcGFjdCwgQGRlbGF5LCBAdGltaW5nLWdyYXBoLCBAdGltaW5nLWFuaW1hdGlvbiwgQHRpbWluZy1ib3RoXCI7XG5cbmZ1bmN0aW9uIGFwcGx5RGlyZWN0aXZlKGxpbmUsIG4sIG8pIHtcbiAgY29uc3QgbSA9IGxpbmUubWF0Y2goL15AKFtcXHctXSspXFxzKiguKikkLyk7XG4gIGlmICghbSkgdGhyb3cgbmV3IEVycm9yKGBMaW5lICR7bn06IG1hbGZvcm1lZCBkaXJlY3RpdmVgKTtcbiAgbGV0IG5hbWUgPSBtWzFdLnRvTG93ZXJDYXNlKCk7XG4gIGNvbnN0IGFyZ3MgPSBtWzJdLnRvTG93ZXJDYXNlKCkuc3BsaXQoL1ssXFxzXSsvKS5maWx0ZXIoQm9vbGVhbik7XG4gIGlmIChuYW1lID09PSBcInJlZHVjZVwiKSBuYW1lID0gXCJzaW1wbGlmeVwiO1xuICBpZiAobmFtZS5zdGFydHNXaXRoKFwidGltaW5nLVwiKSkge1xuICAgIGFyZ3MudW5zaGlmdChuYW1lLnNsaWNlKDcpKTtcbiAgICBuYW1lID0gXCJ0aW1pbmdcIjtcbiAgfVxuICBzd2l0Y2ggKG5hbWUpIHtcbiAgICBjYXNlIFwiaGVscFwiOiBvLmhlbHAgPSB0cnVlOyBicmVhaztcbiAgICBjYXNlIFwidGltaW5nXCI6IHtcbiAgICAgIGNvbnN0IGEgPSBhcmdzWzBdIHx8IFwiZ3JhcGhcIjtcbiAgICAgIGlmICghVElNSU5HX1ZJRVdTLmluY2x1ZGVzKGEpKSB0aHJvdyBuZXcgRXJyb3IoYExpbmUgJHtufTogdXNlIEB0aW1pbmctZ3JhcGgsIEB0aW1pbmctYW5pbWF0aW9uIG9yIEB0aW1pbmctYm90aGApO1xuICAgICAgby50aW1pbmcgPSBhO1xuICAgICAgYnJlYWs7XG4gICAgfVxuICAgIGNhc2UgXCJoaWRlXCI6XG4gICAgY2FzZSBcInNob3dcIjpcbiAgICAgIGlmICghYXJncy5sZW5ndGgpIHRocm93IG5ldyBFcnJvcihgTGluZSAke259OiBcIkAke25hbWV9XCIgbmVlZHM6ICR7UEFSVFMuam9pbihcIiwgXCIpfWApO1xuICAgICAgYXJncy5mb3JFYWNoKChhKSA9PiB7XG4gICAgICAgIGlmICghUEFSVFMuaW5jbHVkZXMoYSkpIHRocm93IG5ldyBFcnJvcihgTGluZSAke259OiBjYW5ub3QgJHtuYW1lfSBcIiR7YX1cIiAoJHtQQVJUUy5qb2luKFwiLCBcIil9KWApO1xuICAgICAgICAobmFtZSA9PT0gXCJoaWRlXCIgPyBvLmhpZGUgOiBvLnNob3cpLmFkZChhKTtcbiAgICAgICAgKG5hbWUgPT09IFwiaGlkZVwiID8gby5zaG93IDogby5oaWRlKS5kZWxldGUoYSk7XG4gICAgICB9KTtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgXCJzaW1wbGlmeVwiOiB7XG4gICAgICBjb25zdCBhID0gYXJnc1swXSB8fCBcInN0cnVjdHVyYWxcIjtcbiAgICAgIGlmIChhID09PSBcIm9mZlwiKSBvLnNpbXBsaWZ5ID0gXCJvZmZcIjtcbiAgICAgIGVsc2UgaWYgKFJFRFVDRV9NRVRIT0RTLmluY2x1ZGVzKGEpKSBvLnNpbXBsaWZ5ID0gYTtcbiAgICAgIGVsc2UgdGhyb3cgbmV3IEVycm9yKGBMaW5lICR7bn06IFwiQHNpbXBsaWZ5XCIgdGFrZXMgJHtSRURVQ0VfTUVUSE9EUy5qb2luKFwiLCBcIil9IG9yIG9mZmApO1xuICAgICAgYnJlYWs7XG4gICAgfVxuICAgIGNhc2UgXCJidWJibGVzXCI6IG8uYnViYmxlcyA9IGFyZ3NbMF0gIT09IFwib2ZmXCI7IGJyZWFrO1xuICAgIGNhc2UgXCJjb21wYWN0XCI6IG8uY29tcGFjdCA9IGFyZ3NbMF0gIT09IFwib2ZmXCI7IGJyZWFrO1xuICAgIGNhc2UgXCJkZWxheVwiOiB7XG4gICAgICBjb25zdCBhID0gYXJnc1swXTtcbiAgICAgIGlmIChhID09PSBcIm9mZlwiKSBvLmRlbGF5ID0gMDtcbiAgICAgIGVsc2UgaWYgKGEgPT09IFwicmFuZG9tXCIpIG8uZGVsYXkgPSAtMTtcbiAgICAgIGVsc2Uge1xuICAgICAgICBjb25zdCB4ID0gTnVtYmVyKGEpO1xuICAgICAgICBpZiAoIWEgfHwgIU51bWJlci5pc0Zpbml0ZSh4KSB8fCB4IDwgLTEgfHwgeCA+IDMwKSB0aHJvdyBuZXcgRXJyb3IoYExpbmUgJHtufTogXCJAZGVsYXlcIiB0YWtlcyBzZWNvbmRzICgwLTMwKSwgcmFuZG9tIG9yIG9mZmApO1xuICAgICAgICBvLmRlbGF5ID0geCA8IDAgPyAtMSA6IHg7XG4gICAgICB9XG4gICAgICBicmVhaztcbiAgICB9XG4gICAgZGVmYXVsdDpcbiAgICAgIHRocm93IG5ldyBFcnJvcihgTGluZSAke259OiB1bmtub3duIGRpcmVjdGl2ZSBcIkAke25hbWV9XCIuIEF2YWlsYWJsZTogJHtESVJFQ1RJVkVfTElTVH1gKTtcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gYXNzZW1ibGUoZ2F0ZXMsIGlucHV0cykge1xuICBjb25zdCBkcml2ZXIgPSB7fTtcbiAgZ2F0ZXMuZm9yRWFjaCgoZykgPT4geyBkcml2ZXJbZy5vdXRdID0gZzsgfSk7XG4gIGNvbnN0IHVzZWQgPSBuZXcgU2V0KCk7XG4gIGdhdGVzLmZvckVhY2goKGcpID0+IGcuaW5zLmZvckVhY2goKHgpID0+IHVzZWQuYWRkKHgpKSk7XG4gIGlmICghaW5wdXRzKSB7XG4gICAgaW5wdXRzID0gW107XG4gICAgZ2F0ZXMuZm9yRWFjaCgoZykgPT4gZy5pbnMuZm9yRWFjaCgoeCkgPT4ge1xuICAgICAgaWYgKCFkcml2ZXJbeF0gJiYgIWlucHV0cy5pbmNsdWRlcyh4KSkgaW5wdXRzLnB1c2goeCk7XG4gICAgfSkpO1xuICB9XG4gIGNvbnN0IGtub3duID0gbmV3IFNldChpbnB1dHMpO1xuICBjb25zdCBvcmRlciA9IFtdO1xuICBsZXQgcGVuZGluZyA9IGdhdGVzLnNsaWNlKCk7XG4gIHdoaWxlIChwZW5kaW5nLmxlbmd0aCkge1xuICAgIGNvbnN0IHJlYWR5ID0gcGVuZGluZy5maWx0ZXIoKGcpID0+IGcuaW5zLmV2ZXJ5KCh4KSA9PiBrbm93bi5oYXMoeCkpKTtcbiAgICBpZiAoIXJlYWR5Lmxlbmd0aCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiTG9vcCBkZXRlY3RlZCAoY29tYmluYXRpb25hbCBmZWVkYmFjaykgaW52b2x2aW5nOiBcIiArIHBlbmRpbmcubWFwKChnKSA9PiBnLm91dCkuam9pbihcIiwgXCIpKTtcbiAgICB9XG4gICAgcmVhZHkuZm9yRWFjaCgoZykgPT4ge1xuICAgICAga25vd24uYWRkKGcub3V0KTtcbiAgICAgIG9yZGVyLnB1c2goZyk7XG4gICAgfSk7XG4gICAgcGVuZGluZyA9IHBlbmRpbmcuZmlsdGVyKChnKSA9PiAhcmVhZHkuaW5jbHVkZXMoZykpO1xuICB9XG4gIGNvbnN0IG91dHB1dHMgPSBnYXRlcy5tYXAoKGcpID0+IGcub3V0KS5maWx0ZXIoKHgpID0+ICF1c2VkLmhhcyh4KSk7XG4gIGNvbnN0IG1pZGRsZXMgPSBnYXRlcy5tYXAoKGcpID0+IGcub3V0KS5maWx0ZXIoKHgpID0+IHVzZWQuaGFzKHgpKTtcbiAgcmV0dXJuIHsgZ2F0ZXMsIG9yZGVyLCBpbnB1dHMsIG91dHB1dHMsIG1pZGRsZXMsIGRyaXZlciwgdXNlZCB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcGFyc2Uoc3JjLCBsaW1pdHMpIHtcbiAgbGltaXRzID0gT2JqZWN0LmFzc2lnbih7IFxuICAgIG1heElucHV0czogREVGQVVMVF9NQVhfSU5QVVRTLCBcbiAgICBtYXhHYXRlczogREVGQVVMVF9NQVhfR0FURVMsXG4gICAgbWF4TXV4SW5wdXRzOiBERUZBVUxUX01BWF9NVVhfSU5QVVRTIFxuICB9LCBsaW1pdHMpO1xuICBcbiAgY29uc3QgZ2F0ZXMgPSBbXTtcbiAgY29uc3QgZHJpdmVyID0ge307XG4gIGNvbnN0IG9wdHMgPSB7IGhpZGU6IG5ldyBTZXQoKSwgc2hvdzogbmV3IFNldCgpLCBzaW1wbGlmeTogbnVsbCwgYnViYmxlczogbnVsbCwgZGVsYXk6IG51bGwsIGNvbXBhY3Q6IG51bGwsIHRpbWluZzogbnVsbCwgaGVscDogZmFsc2UgfTtcbiAgXG4gIHNyYy5zcGxpdChcIlxcblwiKS5mb3JFYWNoKChyYXcsIGkpID0+IHtcbiAgICBjb25zdCBsaW5lID0gcmF3LnJlcGxhY2UoLygjfFxcL1xcLykuKiQvLCBcIlwiKS50cmltKCk7XG4gICAgaWYgKCFsaW5lKSByZXR1cm47XG4gICAgY29uc3QgbiA9IGkgKyAxO1xuICAgIGlmIChsaW5lWzBdID09PSBcIkBcIikge1xuICAgICAgYXBwbHlEaXJlY3RpdmUobGluZSwgbiwgb3B0cyk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIFxuICAgIGNvbnN0IG0gPSBsaW5lLm1hdGNoKC9eXFwoKFteKV0qKVxcKVxccyooW0EtWmEteiZ8XiF+XSspXFxzKlxcKChbXildKilcXCkkLyk7XG4gICAgaWYgKCFtKSB0aHJvdyBuZXcgRXJyb3IoYExpbmUgJHtufTogZXhwZWN0ZWQgXCIoaW5wdXRzKSBHQVRFIChvdXRwdXQpXCJgKTtcbiAgICBcbiAgICBjb25zdCBpbnMgPSBtWzFdLnNwbGl0KC9bLFxcc10rLykubWFwKCh4KSA9PiB4LnRyaW0oKSkuZmlsdGVyKEJvb2xlYW4pO1xuICAgIGNvbnN0IG91dHMgPSBtWzNdLnNwbGl0KC9bLFxcc10rLykubWFwKCh4KSA9PiB4LnRyaW0oKSkuZmlsdGVyKEJvb2xlYW4pO1xuICAgIFxuICAgIGxldCByYXdUeXBlID0gbVsyXS50b1VwcGVyQ2FzZSgpLnRyaW0oKTtcbiAgICBjb25zdCBBTElBU0VTID0geyBcbiAgICAgIFwiJlwiOiBcIkFORFwiLCBcIiYmXCI6IFwiQU5EXCIsIFxuICAgICAgXCJ8XCI6IFwiT1JcIiwgXCJ8fFwiOiBcIk9SXCIsIFxuICAgICAgXCJeXCI6IFwiWE9SXCIsIFxuICAgICAgXCIhXCI6IFwiTk9UXCIsIFwiflwiOiBcIk5PVFwiLCBcbiAgICAgIFwiTVVMVElQTEVYRVJcIjogXCJNVVhcIiwgXCJNVVhcIjogXCJNVVhcIiBcbiAgICB9O1xuICAgIGNvbnN0IHR5cGUgPSBBTElBU0VTW3Jhd1R5cGVdIHx8IHJhd1R5cGU7XG4gICAgY29uc3Qgc3BlYyA9IEdBVEVTW3R5cGVdO1xuXG4gICAgaWYgKCFzcGVjKSB0aHJvdyBuZXcgRXJyb3IoYExpbmUgJHtufTogdW5rbm93biBnYXRlIFwiJHttWzJdfVwiLiBBdmFpbGFibGU6ICR7T2JqZWN0LmtleXMoR0FURVMpLmpvaW4oXCIsIFwiKX1gKTtcbiAgICBpZiAob3V0cy5sZW5ndGggIT09IDEpIHRocm93IG5ldyBFcnJvcihgTGluZSAke259OiBhIGdhdGUgbmVlZHMgZXhhY3RseSBvbmUgb3V0cHV0IHNpZ25hbGApO1xuICAgIGlmIChpbnMubGVuZ3RoIDwgc3BlYy5taW4pIHRocm93IG5ldyBFcnJvcihgTGluZSAke259OiAke3R5cGV9IG5lZWRzIGF0IGxlYXN0ICR7c3BlYy5taW59IGlucHV0KHMpYCk7XG4gICAgaWYgKHNwZWMubWF4ICYmIGlucy5sZW5ndGggPiBzcGVjLm1heCkgdGhyb3cgbmV3IEVycm9yKGBMaW5lICR7bn06ICR7dHlwZX0gdGFrZXMgYXQgbW9zdCAke3NwZWMubWF4fSBpbnB1dHNgKTtcbiAgICBcbiAgICBpZiAodHlwZSA9PT0gXCJNVVhcIikge1xuICAgICAgaWYgKGlucy5sZW5ndGggPiBsaW1pdHMubWF4TXV4SW5wdXRzKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgTGluZSAke259OiBNVVggdGFrZXMgYXQgbW9zdCAke2xpbWl0cy5tYXhNdXhJbnB1dHN9IGlucHV0cy4gKFJhaXNlIFwiTWF4IE1VWCBpbnB1dHNcIiBpbiBzZXR0aW5ncywgdXAgdG8gJHtIQVJEX01BWF9NVVhfSU5QVVRTfSlgKTtcbiAgICAgIH1cbiAgICAgIGxldCBrID0gMTtcbiAgICAgIHdoaWxlICgoMSA8PCBrKSArIGsgPCBpbnMubGVuZ3RoKSBrKys7XG4gICAgICBpZiAoKDEgPDwgaykgKyBrICE9PSBpbnMubGVuZ3RoKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgTGluZSAke259OiBNVVggcmVxdWlyZXMgYSBudW1iZXIgb2YgaW5wdXRzIGVxdWFsIHRvIDJec2VsICsgc2VsIChlLmcuLCAzLCA2LCAxMSwgMjApLiBHb3QgJHtpbnMubGVuZ3RofS5gKTtcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKGlucy5sZW5ndGggPiBNQVhfR0FURV9GQU5JTikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBMaW5lICR7bn06IGF0IG1vc3QgJHtNQVhfR0FURV9GQU5JTn0gaW5wdXRzIHBlciBnYXRlYCk7XG4gICAgfVxuXG4gICAgZm9yIChjb25zdCB4IG9mIFsuLi5pbnMsIC4uLm91dHNdKSB7XG4gICAgICBpZiAoIUlEX1JFLnRlc3QoeCkpIHRocm93IG5ldyBFcnJvcihgTGluZSAke259OiBpbnZhbGlkIHNpZ25hbCBuYW1lIFwiJHt4fVwiYCk7XG4gICAgfVxuICAgIFxuICAgIGNvbnN0IG91dCA9IG91dHNbMF07XG4gICAgaWYgKGlucy5pbmNsdWRlcyhvdXQpKSB0aHJvdyBuZXcgRXJyb3IoYExpbmUgJHtufTogXCIke291dH1cIiBmZWVkcyBiYWNrIGludG8gaXRzIG93biBnYXRlYCk7XG4gICAgaWYgKGRyaXZlcltvdXRdKSB0aHJvdyBuZXcgRXJyb3IoYExpbmUgJHtufTogc2lnbmFsIFwiJHtvdXR9XCIgaXMgYWxyZWFkeSBkcml2ZW4gYnkgYW5vdGhlciBnYXRlYCk7XG4gICAgaWYgKGdhdGVzLmxlbmd0aCA+PSBsaW1pdHMubWF4R2F0ZXMpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgTGluZSAke259OiBtb3JlIHRoYW4gJHtsaW1pdHMubWF4R2F0ZXN9IGdhdGVzIChyYWlzZSBcIk1heCBnYXRlc1wiIGluIHRoZSBwbHVnaW4gc2V0dGluZ3MsIHVwIHRvICR7SEFSRF9NQVhfR0FURVN9KWApO1xuICAgIH1cbiAgICBcbiAgICBjb25zdCBnYXRlID0geyB0eXBlLCBpbnMsIG91dCwgbGluZTogbiB9O1xuICAgIGRyaXZlcltvdXRdID0gZ2F0ZTtcbiAgICBnYXRlcy5wdXNoKGdhdGUpO1xuICB9KTtcbiAgXG4gIGlmICghZ2F0ZXMubGVuZ3RoKSB7XG4gICAgaWYgKG9wdHMuaGVscCkgcmV0dXJuIHsgZ2F0ZXM6IFtdLCBvcmRlcjogW10sIGlucHV0czogW10sIG91dHB1dHM6IFtdLCBtaWRkbGVzOiBbXSwgZHJpdmVyOiB7fSwgdXNlZDogbmV3IFNldCgpLCBvcHRzLCBlbXB0eTogdHJ1ZSB9O1xuICAgIHRocm93IG5ldyBFcnJvcihcIkVtcHR5IGNpcmN1aXQuIEV4YW1wbGU6IChhLGIpIEFORCAoeSkgICAob3IgYWRkIEBoZWxwIGZvciBhIHJlZmVyZW5jZSlcIik7XG4gIH1cbiAgXG4gIGNvbnN0IGMgPSBhc3NlbWJsZShnYXRlcyk7XG4gIGlmIChjLmlucHV0cy5sZW5ndGggPiBsaW1pdHMubWF4SW5wdXRzKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBUb28gbWFueSBpbnB1dHMgKCR7Yy5pbnB1dHMubGVuZ3RofSwgbWF4ICR7bGltaXRzLm1heElucHV0c30pLiBSYWlzZSBcIk1heCBpbnB1dHNcIiBpbiB0aGUgcGx1Z2luIHNldHRpbmdzICh1cCB0byAke0hBUkRfTUFYX0lOUFVUU30pLmApO1xuICB9XG4gIGMub3B0cyA9IG9wdHM7XG4gIHJldHVybiBjO1xufSIsICJpbXBvcnQgeyBQbHVnaW5TZXR0aW5nVGFiLCBTZXR0aW5nIH0gZnJvbSBcIm9ic2lkaWFuXCI7XG5pbXBvcnQgeyBcbiAgSEFSRF9NQVhfSU5QVVRTLCBIQVJEX01BWF9HQVRFUywgQU5BTFlTSVNfTUFYX0lOUFVUUywgXG4gIFJFRFVDRV9NRVRIT0RTLCBUSU1JTkdfVklFV1MsIEhBUkRfTUFYX01VWF9JTlBVVFMgXG59IGZyb20gXCIuLi9jb3JlL2NvbnN0YW50cy5qc1wiO1xuaW1wb3J0IHsgcGFyc2VTcGFjaW5nIH0gZnJvbSBcIi4vc2V0dGluZ3MuanNcIjtcbmltcG9ydCB7IE1FVEhPRF9MQUJFTCB9IGZyb20gXCIuLi9jb3JlL3N5bnRoZXNpemUuanNcIjtcbmltcG9ydCB7IElNUE9SVF9FWFRFTlNJT05fSUQgfSBmcm9tIFwiLi9wcm92aWRlcnMuanNcIjtcblxuZXhwb3J0IGNsYXNzIExvZ2ljR3JhcGhTZXR0aW5nVGFiIGV4dGVuZHMgUGx1Z2luU2V0dGluZ1RhYiB7XG4gIGNvbnN0cnVjdG9yKGFwcCwgcGx1Z2luKSB7XG4gICAgc3VwZXIoYXBwLCBwbHVnaW4pO1xuICAgIHRoaXMucGx1Z2luID0gcGx1Z2luO1xuICB9XG4gIFxuICBkaXNwbGF5KCkge1xuICAgIGNvbnN0IHsgY29udGFpbmVyRWwgfSA9IHRoaXM7XG4gICAgY29uc3QgUCA9IHRoaXMucGx1Z2luLCBTID0gUC5zZXR0aW5ncztcbiAgICBjb250YWluZXJFbC5lbXB0eSgpO1xuICAgIFxuICAgIGNvbnN0IHNhdmUgPSBhc3luYyAoKSA9PiB7XG4gICAgICBhd2FpdCBQLnNhdmVTZXR0aW5ncygpO1xuICAgICAgUC5yZWZyZXNoQWxsKCk7XG4gICAgfTtcbiAgICBcbiAgICBjb25zdCBoZWFkaW5nID0gKG5hbWUpID0+IG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKS5zZXROYW1lKG5hbWUpLnNldEhlYWRpbmcoKTtcbiAgICBjb25zdCBudW0gPSAoc2V0dGluZywga2V5LCBsbywgaGksIGlzSW50KSA9PiBzZXR0aW5nLmFkZFRleHQoKHQpID0+IHQuc2V0VmFsdWUoU3RyaW5nKFNba2V5XSkpLm9uQ2hhbmdlKGFzeW5jICh2KSA9PiB7XG4gICAgICBjb25zdCB4ID0gTnVtYmVyKHYpO1xuICAgICAgaWYgKHYudHJpbSgpID09PSBcIlwiIHx8ICFOdW1iZXIuaXNGaW5pdGUoeCkgfHwgeCA8IGxvIHx8IHggPiBoaSkgcmV0dXJuO1xuICAgICAgU1trZXldID0gaXNJbnQgPyBNYXRoLnJvdW5kKHgpIDogeDtcbiAgICAgIGF3YWl0IHNhdmUoKTtcbiAgICB9KSk7XG4gICAgXG4gICAgY29udGFpbmVyRWwuY3JlYXRlRWwoXCJwXCIsIHsgdGV4dDogYExvZ2ljIEdyYXBoIHYke1AubWFuaWZlc3QudmVyc2lvbn0uIENoYW5nZXMgYXBwbHkgaW1tZWRpYXRlbHkgdG8gb3BlbiBub3Rlcy4gQWRkIEBoZWxwIHRvIGEgbG9naWMgYmxvY2sgZm9yIGEgZnVsbCByZWZlcmVuY2UuYCB9KTtcbiAgICBcbiAgICBoZWFkaW5nKFwiTGltaXRzXCIpO1xuICAgIG51bShcbiAgICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKS5zZXROYW1lKFwiTWF4IGlucHV0cyBhdCBhIHRpbWVcIikuc2V0RGVzYyhgQ2lyY3VpdHMgd2l0aCBtb3JlIGlucHV0cyBzaG93IGFuIGVycm9yLiAxIHRvICR7SEFSRF9NQVhfSU5QVVRTfS4gVHJ1dGggdGFibGVzLCBLYXJuYXVnaCBtYXBzIGFuZCBzaW1wbGlmaWNhdGlvbiBhcmUgb25seSBhdmFpbGFibGUgdXAgdG8gJHtBTkFMWVNJU19NQVhfSU5QVVRTfSBpbnB1dHMgKDJebiByb3dzKS5gKSxcbiAgICAgIFwibWF4SW5wdXRzXCIsIDEsIEhBUkRfTUFYX0lOUFVUUywgdHJ1ZVxuICAgICk7XG4gICAgbnVtKG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKS5zZXROYW1lKFwiTWF4IGdhdGVzIGF0IGEgdGltZVwiKS5zZXREZXNjKGAxIHRvICR7SEFSRF9NQVhfR0FURVN9LmApLCBcIm1heEdhdGVzXCIsIDEsIEhBUkRfTUFYX0dBVEVTLCB0cnVlKTtcbiAgICBcbiAgICBudW0oXG4gICAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcbiAgICAgICAgLnNldE5hbWUoXCJNYXggTVVYIGlucHV0c1wiKVxuICAgICAgICAuc2V0RGVzYyhgVGhlIG1heGltdW0gbnVtYmVyIG9mIGlucHV0cyBhIHNpbmdsZSBNVVggZ2F0ZSBjYW4gdGFrZS4gMiB0byAke0hBUkRfTUFYX01VWF9JTlBVVFN9LiBOb3RlOiBWYWxpZCBNVVggc2l6ZXMgYXJlIDMsIDYsIDExLCAyMCBpbnB1dHMuYCksIFxuICAgICAgXCJtYXhNdXhJbnB1dHNcIiwgMiwgSEFSRF9NQVhfTVVYX0lOUFVUUywgdHJ1ZVxuICAgICk7XG5cbiAgICBoZWFkaW5nKFwiRGlzcGxheVwiKTtcbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbCkuc2V0TmFtZShcIlNob3cgdHJ1dGggdGFibGUgYXV0b21hdGljYWxseVwiKS5zZXREZXNjKCdQZXIgYmxvY2sgeW91IGNhbiBvdmVycmlkZSB3aXRoIFwiQGhpZGUgdGFibGVcIiBvciBcIkBzaG93IHRhYmxlXCIuJykuYWRkVG9nZ2xlKCh0KSA9PiB0LnNldFZhbHVlKFMuc2hvd1RhYmxlKS5vbkNoYW5nZShhc3luYyAodikgPT4geyBTLnNob3dUYWJsZSA9IHY7IGF3YWl0IHNhdmUoKTsgfSkpO1xuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKS5zZXROYW1lKFwiU2hvdyBib29sZWFuIGV4cHJlc3Npb25zXCIpLmFkZFRvZ2dsZSgodCkgPT4gdC5zZXRWYWx1ZShTLnNob3dFeHByKS5vbkNoYW5nZShhc3luYyAodikgPT4geyBTLnNob3dFeHByID0gdjsgYXdhaXQgc2F2ZSgpOyB9KSk7XG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpLnNldE5hbWUoXCJTaG93IEthcm5hdWdoIG1hcHNcIikuc2V0RGVzYyhcIjIgdG8gNiBpbnB1dHMuIEdyb3VwcyBjb21lIGZyb20gdGhlIFF1aW5lXHUyMDEzTWNDbHVza2V5IHJlc3VsdCAoYW4gZXhhY3QgbWluaW11bSB3aGVuIHRoZSBzZWFyY2ggaXMgc21hbGwgZW5vdWdoKS5cIikuYWRkVG9nZ2xlKCh0KSA9PiB0LnNldFZhbHVlKFMuc2hvd0ttYXApLm9uQ2hhbmdlKGFzeW5jICh2KSA9PiB7IFMuc2hvd0ttYXAgPSB2OyBhd2FpdCBzYXZlKCk7IH0pKTtcbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbCkuc2V0TmFtZShgQ29sbGFwc2UgXCJkb24ndCBjYXJlXCIgcm93cyBpbiB0aGUgdHJ1dGggdGFibGVgKS5zZXREZXNjKFwiUm93cyB3aG9zZSBvdXRwdXRzIGRvIG5vdCBkZXBlbmQgb24gc29tZSBpbnB1dHMgYXJlIG1lcmdlZCBhbmQgc2hvd24gd2l0aCBYICh0aGUgbWlkZGxlIHNpZ25hbHMgYXJlIGhpZGRlbiBpbiB0aGlzIG1vZGUpLlwiKS5hZGRUb2dnbGUoKHQpID0+IHQuc2V0VmFsdWUoUy5jb2xsYXBzZURvbnRDYXJlKS5vbkNoYW5nZShhc3luYyAodikgPT4geyBTLmNvbGxhcHNlRG9udENhcmUgPSB2OyBhd2FpdCBzYXZlKCk7IH0pKTtcbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbCkuc2V0TmFtZShcIkJ1YmJsZSBwdXNoaW5nIHZpZXdcIikuc2V0RGVzYyhcIkRyYXdzIGVhY2ggZ2F0ZSB3aXRoIHRoZSBEZSBNb3JnYW4gc3ltYm9sIHRoYXQgbWFrZXMgaXRzIGJ1YmJsZXMgbWF0Y2ggdGhlIG5leHQgZ2F0ZSAoZS5nLiBOQU5ELU5BTkQgc2hvd3MgYXMgQU5ELU9SIHdpdGggbWF0Y2hpbmcgYnViYmxlcykuIE5vIGdhdGUgaXMgYWRkZWQgb3IgcmVtb3ZlZDsgY2xpY2sgYSBnYXRlIHRvIGZsaXAgaXQgYnkgaGFuZC5cIikuYWRkVG9nZ2xlKCh0KSA9PiB0LnNldFZhbHVlKFMuYnViYmxlUHVzaGluZykub25DaGFuZ2UoYXN5bmMgKHYpID0+IHsgUy5idWJibGVQdXNoaW5nID0gdjsgYXdhaXQgc2F2ZSgpOyB9KSk7XG4gICAgXG4gICAgaGVhZGluZyhcIlRpbWluZ1wiKTtcbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbCkuc2V0TmFtZShcIlNpbXVsYXRlIGdhdGUgZGVsYXlzXCIpLnNldERlc2MoXCJTaWduYWxzIHByb3BhZ2F0ZSB0aHJvdWdoIHRoZSBnYXRlcyBvbmUgc3RlcCBhdCBhIHRpbWUuXCIpLmFkZFRvZ2dsZSgodCkgPT4gdC5zZXRWYWx1ZShTLmRlbGF5RW5hYmxlZCkub25DaGFuZ2UoYXN5bmMgKHYpID0+IHsgUy5kZWxheUVuYWJsZWQgPSB2OyBhd2FpdCBzYXZlKCk7IH0pKTtcbiAgICBudW0obmV3IFNldHRpbmcoY29udGFpbmVyRWwpLnNldE5hbWUoXCJEZWxheSBwZXIgZ2F0ZSAoc2Vjb25kcylcIikuc2V0RGVzYyhcIjAgdG8gMzAuIFVzZSAtMSBmb3IgYSByYW5kb20gZGVsYXkgYmV0d2VlbiAwIGFuZCA1IHNlY29uZHMgZm9yIGV2ZXJ5IGdhdGUgY2hhbmdlLlwiKSwgXCJkZWxheVNlY29uZHNcIiwgLTEsIDMwLCBmYWxzZSk7XG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpLnNldE5hbWUoXCJUaW1pbmcgdmlld1wiKS5zZXREZXNjKFwiR3JhcGggPSB3YXZlZm9ybXMuIEFuaW1hdGlvbiA9IGJpdHMgdHJhdmVsbGluZyBhbG9uZyB0aGUgd2lyZXMsIGdhdGVzIGxpZ2h0IHVwIGdyZWVuIChvdXRwdXQgMSkgb3IgcmVkL29yYW5nZSAob3V0cHV0IDApLiBQZXIgYmxvY2s6IEB0aW1pbmctZ3JhcGgsIEB0aW1pbmctYW5pbWF0aW9uLCBAdGltaW5nLWJvdGguXCIpLmFkZERyb3Bkb3duKChkKSA9PiB7XG4gICAgICBkLmFkZE9wdGlvbihcImdyYXBoXCIsIFwiR3JhcGhcIik7XG4gICAgICBkLmFkZE9wdGlvbihcImFuaW1hdGlvblwiLCBcIkFuaW1hdGlvblwiKTtcbiAgICAgIGQuYWRkT3B0aW9uKFwiYm90aFwiLCBcIkJvdGhcIik7XG4gICAgICBkLnNldFZhbHVlKFMudGltaW5nVmlldykub25DaGFuZ2UoYXN5bmMgKHYpID0+IHsgUy50aW1pbmdWaWV3ID0gdjsgYXdhaXQgc2F2ZSgpOyB9KTtcbiAgICB9KTtcbiAgICBcbiAgICBoZWFkaW5nKFwiR3JhcGhpYyB2YWx1ZXNcIik7XG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpLnNldE5hbWUoXCJIb3Jpem9udGFsIHNwYWNpbmdcIikuc2V0RGVzYyhcIkRpc3RhbmNlIGJldHdlZW4gZ2F0ZSBjb2x1bW5zLiBBIHdob2xlIG51bWJlciBvZiBwaXhlbHMgKGUuZy4gOTApLCBvciBhIHBlcmNlbnRhZ2UgKGUuZy4gMTAwJSkgdG8gc3ByZWFkIHRoZSBjaXJjdWl0IGFjcm9zcyB0aGF0IHNoYXJlIG9mIHRoZSBwYWdlIHdpZHRoLlwiKS5hZGRUZXh0KCh0KSA9PiB0LnNldFZhbHVlKFN0cmluZyhTLmhTcGFjaW5nKSkub25DaGFuZ2UoYXN5bmMgKHYpID0+IHtcbiAgICAgIGlmIChwYXJzZVNwYWNpbmcodikpIHsgUy5oU3BhY2luZyA9IHYudHJpbSgpOyBhd2FpdCBzYXZlKCk7IH1cbiAgICB9KSk7XG4gICAgbnVtKG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKS5zZXROYW1lKFwiVmVydGljYWwgc3BhY2luZyAocHgpXCIpLnNldERlc2MoXCJEaXN0YW5jZSBiZXR3ZWVuIGdhdGVzIGluIHRoZSBzYW1lIGNvbHVtbi4gMCB0byAyMDAuXCIpLCBcInZTcGFjaW5nXCIsIDAsIDIwMCwgdHJ1ZSk7XG4gICAgXG4gICAgaGVhZGluZyhcIkV4cGVyaW1lbnRhbDogY2lyY3VpdCByZWR1Y3Rpb25cIik7XG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpLnNldE5hbWUoXCJBbHdheXMgZHJhdyBhIHJlZHVjZWQgY2lyY3VpdFwiKS5zZXREZXNjKCdPZmYgYnkgZGVmYXVsdC4gRXZlcnkgcmVkdWNlZCBjaXJjdWl0IGlzIGNoZWNrZWQgYWdhaW5zdCB0aGUgb3JpZ2luYWwgYmVmb3JlIGl0IGlzIHNob3duLiBQZXIgYmxvY2s6IFwiQHNpbXBsaWZ5IHN0cnVjdHVyYWxcIiAob3IgQHJlZHVjZSkuJykuYWRkVG9nZ2xlKCh0KSA9PiB0LnNldFZhbHVlKFMuZXhwU2ltcGxpZnkpLm9uQ2hhbmdlKGFzeW5jICh2KSA9PiB7IFMuZXhwU2ltcGxpZnkgPSB2OyBhd2FpdCBzYXZlKCk7IH0pKTtcbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbCkuc2V0TmFtZShcIlJlZHVjdGlvbiBtZXRob2RcIikuc2V0RGVzYyhcIlN0cnVjdHVyYWwgcmV3cml0ZXMgeW91ciBhY3R1YWwgY2lyY3VpdCBhbmQgbmV2ZXIgYWRkcyBnYXRlcy4gVGhlIHR3by1sZXZlbCBtZXRob2RzIHJlYnVpbGQgdGhlIGZ1bmN0aW9uIGZyb20gdGhlIFF1aW5lXHUyMDEzTWNDbHVza2V5IGNvdmVyIGFuZCBjYW4gYmUgbGFyZ2VyIHRoYW4gdGhlIG9yaWdpbmFsLiBCZXN0IHBpY2tzIHRoZSBzbWFsbGVzdC5cIikuYWRkRHJvcGRvd24oKGQpID0+IHtcbiAgICAgIE9iamVjdC5rZXlzKE1FVEhPRF9MQUJFTCkuZm9yRWFjaCgoaykgPT4gZC5hZGRPcHRpb24oaywgTUVUSE9EX0xBQkVMW2tdKSk7XG4gICAgICBkLnNldFZhbHVlKFMuc2ltcGxpZnlNZXRob2QpLm9uQ2hhbmdlKGFzeW5jICh2KSA9PiB7IFMuc2ltcGxpZnlNZXRob2QgPSB2OyBhd2FpdCBzYXZlKCk7IH0pO1xuICAgIH0pO1xuICAgIFxuICAgIHRoaXMuZGlzcGxheUltcG9ydChjb250YWluZXJFbCwgc2F2ZSk7XG4gIH1cbiAgXG4gIGRpc3BsYXlJbXBvcnQoY29udGFpbmVyRWwsIHNhdmUpIHtcbiAgICBjb25zdCBQID0gdGhpcy5wbHVnaW4sIFMgPSBQLnNldHRpbmdzO1xuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKS5zZXROYW1lKFwiSW1wb3J0IGZyb20gaW1hZ2VcIikuc2V0SGVhZGluZygpO1xuICAgIGNvbnN0IGluc3RhbGxlZCA9ICEhKHRoaXMuYXBwLnBsdWdpbnMgJiYgdGhpcy5hcHAucGx1Z2lucy5wbHVnaW5zICYmIHRoaXMuYXBwLnBsdWdpbnMucGx1Z2luc1tJTVBPUlRfRVhURU5TSU9OX0lEXSk7XG4gICAgY29udGFpbmVyRWwuY3JlYXRlRWwoXCJwXCIsIHtcbiAgICAgIGNsczogXCJsZy1ub3RlXCIsXG4gICAgICB0ZXh0OiBpbnN0YWxsZWQgPyAnVGhlIFwiTG9naWMgR3JhcGggLSBJbWFnZSBJbXBvcnRcIiBleHRlbnNpb24gaXMgaW5zdGFsbGVkLiBVc2UgdGhlIGNvbW1hbmQgXCJJbXBvcnQgY2lyY3VpdCBmcm9tIGltYWdlXCIgKEN0cmwvQ21kICsgUCkgXHUyMDE0IGV2ZXJ5dGhpbmcgc3RheXMgb24geW91ciBkZXZpY2UuJyA6ICdJbWFnZSBpbXBvcnQgaXMgcHJvdmlkZWQgYnkgdGhlIHNlcGFyYXRlIFwiTG9naWMgR3JhcGggLSBJbWFnZSBJbXBvcnRcIiBleHRlbnNpb24uIENvcHkgaXRzIGZvbGRlciBpbnRvIC5vYnNpZGlhbi9wbHVnaW5zLyBhbmQgZW5hYmxlIGl0LCB0aGVuIHVzZSB0aGUgY29tbWFuZCBcIkltcG9ydCBjaXJjdWl0IGZyb20gaW1hZ2VcIi4nXG4gICAgfSk7XG4gIH1cbn0iLCAiaW1wb3J0IHsgXG4gIGNsYW1wLCBERUZBVUxUX01BWF9JTlBVVFMsIERFRkFVTFRfTUFYX0dBVEVTLCBcbiAgSEFSRF9NQVhfSU5QVVRTLCBIQVJEX01BWF9HQVRFUywgUkVEVUNFX01FVEhPRFMsIFRJTUlOR19WSUVXUyxcbiAgSEFSRF9NQVhfTVVYX0lOUFVUUywgREVGQVVMVF9NQVhfTVVYX0lOUFVUUyBcbn0gZnJvbSBcIi4uL2NvcmUvY29uc3RhbnRzLmpzXCI7XG5cbmV4cG9ydCBjb25zdCBERUZBVUxUUyA9IHtcbiAgbWF4SW5wdXRzOiBERUZBVUxUX01BWF9JTlBVVFMsXG4gIG1heEdhdGVzOiBERUZBVUxUX01BWF9HQVRFUyxcbiAgbWF4TXV4SW5wdXRzOiBERUZBVUxUX01BWF9NVVhfSU5QVVRTLFxuICBzaG93VGFibGU6IHRydWUsXG4gIHNob3dFeHByOiB0cnVlLFxuICBzaG93S21hcDogZmFsc2UsXG4gIGNvbGxhcHNlRG9udENhcmU6IGZhbHNlLFxuICBkZWxheUVuYWJsZWQ6IGZhbHNlLFxuICBkZWxheVNlY29uZHM6IDEsXG4gIHRpbWluZ1ZpZXc6IFwiZ3JhcGhcIixcbiAgYnViYmxlUHVzaGluZzogZmFsc2UsXG4gIGV4cFNpbXBsaWZ5OiBmYWxzZSxcbiAgc2ltcGxpZnlNZXRob2Q6IFwic3RydWN0dXJhbFwiLFxuICBoU3BhY2luZzogXCI5MFwiLFxuICB2U3BhY2luZzogMTYsXG4gIGltcG9ydFByb3ZpZGVyOiBcImxvY2FsXCIsXG4gIGtleXM6IHsgY2xhdWRlOiBcIlwiLCBnZW1pbmk6IFwiXCIsIGdyb2s6IFwiXCIsIGRlZXBzZWVrOiBcIlwiLCBvcGVucm91dGVyOiBcIlwiIH0sXG4gIG1vZGVsczogeyBjbGF1ZGU6IFwiY2xhdWRlLXNvbm5ldC00LTVcIiwgZ2VtaW5pOiBcIlwiLCBncm9rOiBcIlwiLCBkZWVwc2VlazogXCJcIiwgb3BlbnJvdXRlcjogXCJcIiB9XG59O1xuXG5leHBvcnQgZnVuY3Rpb24gc2FuaXRpemVTZXR0aW5ncyhyYXcpIHtcbiAgY29uc3QgcyA9IE9iamVjdC5hc3NpZ24oe30sIERFRkFVTFRTLCByYXcgfHwge30pO1xuICBzLm1heElucHV0cyA9IGNsYW1wKE1hdGgucm91bmQoTnVtYmVyKHMubWF4SW5wdXRzKSkgfHwgREVGQVVMVFMubWF4SW5wdXRzLCAxLCBIQVJEX01BWF9JTlBVVFMpO1xuICBzLm1heEdhdGVzID0gY2xhbXAoTWF0aC5yb3VuZChOdW1iZXIocy5tYXhHYXRlcykpIHx8IERFRkFVTFRTLm1heEdhdGVzLCAxLCBIQVJEX01BWF9HQVRFUyk7XG4gIHMubWF4TXV4SW5wdXRzID0gY2xhbXAoTWF0aC5yb3VuZChOdW1iZXIocy5tYXhNdXhJbnB1dHMpKSB8fCBERUZBVUxUUy5tYXhNdXhJbnB1dHMsIDIsIEhBUkRfTUFYX01VWF9JTlBVVFMpO1xuICBcbiAgY29uc3QgZCA9IE51bWJlcihzLmRlbGF5U2Vjb25kcyk7XG4gIHMuZGVsYXlTZWNvbmRzID0gTnVtYmVyLmlzRmluaXRlKGQpID8gZCA8IDAgPyAtMSA6IGNsYW1wKGQsIDAsIDMwKSA6IERFRkFVTFRTLmRlbGF5U2Vjb25kcztcbiAgY29uc3QgdiA9IE51bWJlcihzLnZTcGFjaW5nKTtcbiAgcy52U3BhY2luZyA9IE51bWJlci5pc0Zpbml0ZSh2KSA/IGNsYW1wKE1hdGgucm91bmQodiksIDAsIDIwMCkgOiBERUZBVUxUUy52U3BhY2luZztcbiAgXG4gIGlmICghcGFyc2VTcGFjaW5nKHMuaFNwYWNpbmcpKSBzLmhTcGFjaW5nID0gREVGQVVMVFMuaFNwYWNpbmc7XG4gIGlmICghUkVEVUNFX01FVEhPRFMuaW5jbHVkZXMocy5zaW1wbGlmeU1ldGhvZCkpIHMuc2ltcGxpZnlNZXRob2QgPSBcInN0cnVjdHVyYWxcIjtcbiAgaWYgKCFUSU1JTkdfVklFV1MuaW5jbHVkZXMocy50aW1pbmdWaWV3KSkgcy50aW1pbmdWaWV3ID0gXCJncmFwaFwiO1xuICBcbiAgcy5rZXlzID0gT2JqZWN0LmFzc2lnbih7fSwgREVGQVVMVFMua2V5cywgcmF3ICYmIHJhdy5rZXlzIHx8IHt9KTtcbiAgcy5tb2RlbHMgPSBPYmplY3QuYXNzaWduKHt9LCBERUZBVUxUUy5tb2RlbHMsIHJhdyAmJiByYXcubW9kZWxzIHx8IHt9KTtcbiAgaWYgKHJhdyAmJiByYXcuYXBpS2V5ICYmICFzLmtleXMuY2xhdWRlKSBzLmtleXMuY2xhdWRlID0gcmF3LmFwaUtleTtcbiAgaWYgKHJhdyAmJiByYXcubW9kZWwgJiYgIShyYXcubW9kZWxzICYmIHJhdy5tb2RlbHMuY2xhdWRlKSkgcy5tb2RlbHMuY2xhdWRlID0gcmF3Lm1vZGVsO1xuICBcbiAgZGVsZXRlIHMuYXBpS2V5O1xuICBkZWxldGUgcy5tb2RlbDtcbiAgaWYgKCFbXCJsb2NhbFwiLCBcImNsYXVkZVwiLCBcImdlbWluaVwiLCBcImdyb2tcIiwgXCJkZWVwc2Vla1wiLCBcIm9wZW5yb3V0ZXJcIl0uaW5jbHVkZXMocy5pbXBvcnRQcm92aWRlcikpIHMuaW1wb3J0UHJvdmlkZXIgPSBcImxvY2FsXCI7XG4gIFxuICByZXR1cm4gcztcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlU3BhY2luZyhzdHIpIHtcbiAgY29uc3QgbSA9IFN0cmluZyhzdHIpLnRyaW0oKS5tYXRjaCgvXihcXGQrKD86XFwuXFxkKyk/KVxccyooJXxweCk/JC9pKTtcbiAgaWYgKCFtKSByZXR1cm4gbnVsbDtcbiAgY29uc3QgdiA9IHBhcnNlRmxvYXQobVsxXSk7XG4gIHJldHVybiBtWzJdID09PSBcIiVcIiA/IHsgcGN0OiBjbGFtcCh2LCAxMCwgNDAwKSB9IDogeyBweDogY2xhbXAoTWF0aC5yb3VuZCh2KSwgNDAsIDFlMykgfTtcbn0iLCAiLy8gcGFja2FnZXMvbG9naWMtZ3JhcGgvc3JjL2NvcmUvbGF0ZXguanNcbmV4cG9ydCBjb25zdCBubSA9IChuKSA9PiAvXltBLVphLXpdJC8udGVzdChuKSA/IG4gOiBgXFxcXG1hdGhybXske24ucmVwbGFjZSgvXy9nLCBcIlxcXFxfXCIpfX1gO1xuZXhwb3J0IGZ1bmN0aW9uIHJhd0xhdGV4KGMsIHNpZykge1xuICBjb25zdCBtZW1vID0gLyogQF9fUFVSRV9fICovIG5ldyBNYXAoKTtcbiAgY29uc3QgZ28gPSAoeCkgPT4ge1xuICAgIGlmIChtZW1vLmhhcyh4KSkgcmV0dXJuIG1lbW8uZ2V0KHgpO1xuICAgIGNvbnN0IGcgPSBjLmRyaXZlclt4XTtcbiAgICBsZXQgcjtcbiAgICBpZiAoIWcpIHIgPSB7IHM6IG5tKHgpLCBwOiA1IH07XG4gICAgZWxzZSB7XG4gICAgICBjb25zdCBraWRzID0gZy5pbnMubWFwKGdvKTtcbiAgICAgIGNvbnN0IGpvaW4gPSAob3AsIHApID0+IGtpZHMubWFwKChrKSA9PiBrLnAgPCBwID8gYFxcXFxsZWZ0KCR7ay5zfVxcXFxyaWdodClgIDogay5zKS5qb2luKG9wKTtcbiAgICAgIGNvbnN0IEFORCA9ICgpID0+IGpvaW4oXCIgXFxcXGNkb3QgXCIsIDMpLCBPUiA9ICgpID0+IGpvaW4oXCIgKyBcIiwgMSksIFhPUiA9ICgpID0+IGpvaW4oXCIgXFxcXG9wbHVzIFwiLCAyKTtcbiAgICAgIHN3aXRjaCAoZy50eXBlKSB7XG4gICAgICAgIGNhc2UgXCJBTkRcIjpcbiAgICAgICAgICByID0geyBzOiBBTkQoKSwgcDogMyB9O1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIFwiT1JcIjpcbiAgICAgICAgICByID0geyBzOiBPUigpLCBwOiAxIH07XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgXCJYT1JcIjpcbiAgICAgICAgICByID0geyBzOiBYT1IoKSwgcDogMiB9O1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIFwiTkFORFwiOlxuICAgICAgICAgIHIgPSB7IHM6IGBcXFxcb3ZlcmxpbmV7JHtBTkQoKX19YCwgcDogNSB9O1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIFwiTk9SXCI6XG4gICAgICAgICAgciA9IHsgczogYFxcXFxvdmVybGluZXske09SKCl9fWAsIHA6IDUgfTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBcIlhOT1JcIjpcbiAgICAgICAgICByID0geyBzOiBgXFxcXG92ZXJsaW5leyR7WE9SKCl9fWAsIHA6IDUgfTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBcIk5PVFwiOlxuICAgICAgICAgIHIgPSB7IHM6IGBcXFxcb3ZlcmxpbmV7JHtraWRzWzBdLnN9fWAsIHA6IDUgfTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICByID0ga2lkc1swXTtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKHIucy5sZW5ndGggPiAyZTMpIHRocm93IG5ldyBFcnJvcihcInRvbyBsb25nXCIpO1xuICAgIG1lbW8uc2V0KHgsIHIpO1xuICAgIHJldHVybiByO1xuICB9O1xuICByZXR1cm4gZ28oc2lnKS5zO1xufVxuXG4iLCAiLy8gcGFja2FnZXMvbG9naWMtZ3JhcGgvc3JjL2NvcmUvbWluaW1pemUuanNcbmltcG9ydCB7IG5tLCByYXdMYXRleCB9IGZyb20gXCIuL2xhdGV4LmpzXCI7XG5cbmV4cG9ydCBjb25zdCBwb3Bjb3VudCA9ICh4KSA9PiB7XG4gIGxldCBrID0gMDtcbiAgd2hpbGUgKHgpIHtcbiAgICBrICs9IHggJiAxO1xuICAgIHggPj4+PSAxO1xuICB9XG4gIHJldHVybiBrO1xufTtcblxuZXhwb3J0IGZ1bmN0aW9uIHByaW1lSW1wbGljYW50cyhvbmVzKSB7XG4gIGxldCBjdXIgPSBuZXcgTWFwKG9uZXMubWFwKChtKSA9PiBbbSArIFwiOjBcIiwgeyB2OiBtLCBtYXNrOiAwIH1dKSk7XG4gIGNvbnN0IHByaW1lcyA9IFtdO1xuICB3aGlsZSAoY3VyLnNpemUpIHtcbiAgICBjb25zdCBncm91cHMgPSBuZXcgTWFwKCk7XG4gICAgZm9yIChjb25zdCB0IG9mIGN1ci52YWx1ZXMoKSkge1xuICAgICAgY29uc3QgayA9IHQubWFzayArIFwifFwiICsgcG9wY291bnQodC52KTtcbiAgICAgIGlmICghZ3JvdXBzLmhhcyhrKSkgZ3JvdXBzLnNldChrLCBbXSk7XG4gICAgICBncm91cHMuZ2V0KGspLnB1c2godCk7XG4gICAgfVxuICAgIGNvbnN0IHVzZWQgPSBuZXcgU2V0KCksIG5leHQgPSBuZXcgTWFwKCk7XG4gICAgZm9yIChjb25zdCBbaywgbGlzdF0gb2YgZ3JvdXBzKSB7XG4gICAgICBjb25zdCBbbWFzaywgcF0gPSBrLnNwbGl0KFwifFwiKS5tYXAoTnVtYmVyKTtcbiAgICAgIGNvbnN0IG90aGVyID0gZ3JvdXBzLmdldChtYXNrICsgXCJ8XCIgKyAocCArIDEpKTtcbiAgICAgIGlmICghb3RoZXIpIGNvbnRpbnVlO1xuICAgICAgZm9yIChjb25zdCBhIG9mIGxpc3QpIGZvciAoY29uc3QgYiBvZiBvdGhlcikge1xuICAgICAgICBjb25zdCBkID0gYS52IF4gYi52O1xuICAgICAgICBpZiAoZCAmJiAhKGQgJiBkIC0gMSkpIHtcbiAgICAgICAgICBjb25zdCB0ID0geyB2OiBhLnYgJiBiLnYsIG1hc2s6IGEubWFzayB8IGQgfTtcbiAgICAgICAgICBuZXh0LnNldCh0LnYgKyBcIjpcIiArIHQubWFzaywgdCk7XG4gICAgICAgICAgdXNlZC5hZGQoYSk7XG4gICAgICAgICAgdXNlZC5hZGQoYik7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgZm9yIChjb25zdCB0IG9mIGN1ci52YWx1ZXMoKSkgaWYgKCF1c2VkLmhhcyh0KSkgcHJpbWVzLnB1c2godCk7XG4gICAgY3VyID0gbmV4dDtcbiAgfVxuICByZXR1cm4gcHJpbWVzO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY2hvb3NlQ292ZXIocHJpbWVzLCBvbmVzLCBudmFycykge1xuICBjb25zdCBOT0RFX0xJTUlUID0gNmU0O1xuICBjb25zdCBjb3ZlcnMgPSAocCwgbSkgPT4gKG0gJiB+cC5tYXNrKSA9PT0gcC52O1xuICBjb25zdCBsaXRzID0gKHApID0+IG52YXJzIC0gcG9wY291bnQocC5tYXNrKTtcbiAgY29uc3QgY29zdCA9IChsaXN0KSA9PiBbbGlzdC5sZW5ndGgsIGxpc3QucmVkdWNlKChhLCBwKSA9PiBhICsgbGl0cyhwKSwgMCldO1xuICBjb25zdCBiZXR0ZXIgPSAoYSwgYikgPT4gYVswXSAhPT0gYlswXSA/IGFbMF0gPCBiWzBdIDogYVsxXSA8IGJbMV07XG4gIGNvbnN0IGJ5T3JkZXIgPSAoYSwgYikgPT4gYS52IC0gYi52IHx8IGEubWFzayAtIGIubWFzaztcbiAgY29uc3QgY2hvc2VuID0gW10sIGxlZnQgPSBuZXcgU2V0KG9uZXMpO1xuICBvbmVzLmZvckVhY2goKG0pID0+IHtcbiAgICBjb25zdCBwcyA9IHByaW1lcy5maWx0ZXIoKHApID0+IGNvdmVycyhwLCBtKSk7XG4gICAgaWYgKHBzLmxlbmd0aCA9PT0gMSAmJiAhY2hvc2VuLmluY2x1ZGVzKHBzWzBdKSkgY2hvc2VuLnB1c2gocHNbMF0pO1xuICB9KTtcbiAgY2hvc2VuLmZvckVhY2goKHApID0+IG9uZXMuZm9yRWFjaCgobSkgPT4ge1xuICAgIGlmIChjb3ZlcnMocCwgbSkpIGxlZnQuZGVsZXRlKG0pO1xuICB9KSk7XG4gIGNvbnN0IHJlc3QgPSBbLi4ubGVmdF07XG4gIGlmICghcmVzdC5sZW5ndGgpIHJldHVybiB7IGNvdmVyOiBjaG9zZW4uc29ydChieU9yZGVyKSwgZXhhY3Q6IHRydWUgfTtcbiAgY29uc3QgY2FuZCA9IHByaW1lcy5maWx0ZXIoKHApID0+ICFjaG9zZW4uaW5jbHVkZXMocCkgJiYgcmVzdC5zb21lKChtKSA9PiBjb3ZlcnMocCwgbSkpKTtcbiAgY29uc3QgY292ZXJlcnMgPSBuZXcgTWFwKHJlc3QubWFwKChtKSA9PiBbbSwgY2FuZC5maWx0ZXIoKHApID0+IGNvdmVycyhwLCBtKSldKSk7XG4gIGxldCBiZXN0U2VsID0gW107XG4gIHtcbiAgICBjb25zdCB1bmMgPSBuZXcgU2V0KHJlc3QpO1xuICAgIHdoaWxlICh1bmMuc2l6ZSkge1xuICAgICAgbGV0IGJwID0gbnVsbCwgYmMgPSAtMTtcbiAgICAgIGNhbmQuZm9yRWFjaCgocCkgPT4ge1xuICAgICAgICBsZXQgayA9IDA7XG4gICAgICAgIHVuYy5mb3JFYWNoKChtKSA9PiB7XG4gICAgICAgICAgaWYgKGNvdmVycyhwLCBtKSkgaysrO1xuICAgICAgICB9KTtcbiAgICAgICAgaWYgKGsgPiBiYykge1xuICAgICAgICAgIGJjID0gaztcbiAgICAgICAgICBicCA9IHA7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgICAgYmVzdFNlbC5wdXNoKGJwKTtcbiAgICAgIFsuLi51bmNdLmZvckVhY2goKG0pID0+IHtcbiAgICAgICAgaWYgKGNvdmVycyhicCwgbSkpIHVuYy5kZWxldGUobSk7XG4gICAgICB9KTtcbiAgICB9XG4gIH1cbiAgbGV0IGJlc3RDb3N0ID0gY29zdChjaG9zZW4uY29uY2F0KGJlc3RTZWwpKTtcbiAgbGV0IG5vZGVzID0gMCwgZXhhY3QgPSB0cnVlO1xuICBjb25zdCByZWMgPSAodW5jLCBzZWwpID0+IHtcbiAgICBpZiAoKytub2RlcyA+IE5PREVfTElNSVQpIHtcbiAgICAgIGV4YWN0ID0gZmFsc2U7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGlmICghdW5jLmxlbmd0aCkge1xuICAgICAgY29uc3QgYzIgPSBjb3N0KGNob3Nlbi5jb25jYXQoc2VsKSk7XG4gICAgICBpZiAoYmV0dGVyKGMyLCBiZXN0Q29zdCkpIHtcbiAgICAgICAgYmVzdENvc3QgPSBjMjtcbiAgICAgICAgYmVzdFNlbCA9IHNlbC5zbGljZSgpO1xuICAgICAgfVxuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBpZiAoY2hvc2VuLmxlbmd0aCArIHNlbC5sZW5ndGggKyAxID4gYmVzdENvc3RbMF0pIHJldHVybjtcbiAgICBsZXQgcGljayA9IHVuY1swXSwgcGMgPSBjb3ZlcmVycy5nZXQocGljaykubGVuZ3RoO1xuICAgIGZvciAoY29uc3QgbSBvZiB1bmMpIHtcbiAgICAgIGNvbnN0IGsgPSBjb3ZlcmVycy5nZXQobSkubGVuZ3RoO1xuICAgICAgaWYgKGsgPCBwYykge1xuICAgICAgICBwaWNrID0gbTtcbiAgICAgICAgcGMgPSBrO1xuICAgICAgfVxuICAgIH1cbiAgICBjb25zdCBvcHRzID0gY292ZXJlcnMuZ2V0KHBpY2spLnNsaWNlKCkuc29ydCgoYSwgYikgPT4gdW5jLmZpbHRlcigobSkgPT4gY292ZXJzKGIsIG0pKS5sZW5ndGggLSB1bmMuZmlsdGVyKChtKSA9PiBjb3ZlcnMoYSwgbSkpLmxlbmd0aCk7XG4gICAgZm9yIChjb25zdCBwIG9mIG9wdHMpIHtcbiAgICAgIHNlbC5wdXNoKHApO1xuICAgICAgcmVjKHVuYy5maWx0ZXIoKG0pID0+ICFjb3ZlcnMocCwgbSkpLCBzZWwpO1xuICAgICAgc2VsLnBvcCgpO1xuICAgICAgaWYgKG5vZGVzID4gTk9ERV9MSU1JVCkgcmV0dXJuO1xuICAgIH1cbiAgfTtcbiAgcmVjKHJlc3QsIFtdKTtcbiAgcmV0dXJuIHsgY292ZXI6IGNob3Nlbi5jb25jYXQoYmVzdFNlbCkuc29ydChieU9yZGVyKSwgZXhhY3QgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNvdmVyT2YoYWxsLCBvdXQsIHRhcmdldCwgZGMgPSBuZXcgU2V0KCkpIHtcbiAgY29uc3QgaWR4ID0gW107XG4gIGxldCBjb3VudDEgPSAwO1xuICBhbGwuZm9yRWFjaCgociwgaSkgPT4ge1xuICAgIGlmIChyW291dF0pIGNvdW50MSsrO1xuICAgIGlmIChyW291dF0gPT09ICh0YXJnZXQgPT09IDAgPyAwIDogMSkpIGlkeC5wdXNoKGkpO1xuICB9KTtcbiAgaWYgKGNvdW50MSA9PT0gMCkgcmV0dXJuIHsgY29uc3Q6IDAsIGV4YWN0OiB0cnVlIH07XG4gIGlmIChjb3VudDEgPT09IGFsbC5sZW5ndGgpIHJldHVybiB7IGNvbnN0OiAxLCBleGFjdDogdHJ1ZSB9O1xuICBcbiAgY29uc3QgbnZhcnMgPSBNYXRoLnJvdW5kKE1hdGgubG9nMihhbGwubGVuZ3RoKSk7XG4gIC8vIEFkZCBkb24ndCBjYXJlcyB0byB0aGUgbGlzdCBvZiBvbmVzIHVzZWQgZm9yIHByaW1lIGltcGxpY2FudHNcbiAgY29uc3QgYWxsT25lcyA9IFsuLi5pZHgsIC4uLmRjXTsgXG4gIGNvbnN0IHsgY292ZXIsIGV4YWN0IH0gPSBjaG9vc2VDb3ZlcihwcmltZUltcGxpY2FudHMoYWxsT25lcyksIGlkeCwgbnZhcnMpO1xuICByZXR1cm4geyBvbmVzOiBpZHgsIGNvdmVyLCBleGFjdCB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY3ViZUxpdGVyYWxzKGMsIGN1YmUpIHtcbiAgY29uc3QgbiA9IGMuaW5wdXRzLmxlbmd0aCwgb3V0ID0gW107XG4gIGMuaW5wdXRzLmZvckVhY2goKG5hbWUsIGspID0+IHtcbiAgICBjb25zdCBiaXQgPSAxIDw8IG4gLSAxIC0gaztcbiAgICBpZiAoIShjdWJlLm1hc2sgJiBiaXQpKSBvdXQucHVzaCh7IG5hbWUsIG5lZzogIShjdWJlLnYgJiBiaXQpIH0pO1xuICB9KTtcbiAgcmV0dXJuIG91dDtcbn1cblxuZXhwb3J0IGNvbnN0IGxpdExhdGV4ID0gKGwpID0+IGwubmVnID8gYFxcXFxvdmVybGluZXske25tKGwubmFtZSl9fWAgOiBubShsLm5hbWUpO1xuZXhwb3J0IGNvbnN0IGN1YmVMYXRleCA9IChjLCBjdWJlKSA9PiBjdWJlTGl0ZXJhbHMoYywgY3ViZSkubWFwKGxpdExhdGV4KS5qb2luKFwiIFxcXFxjZG90IFwiKTtcbmV4cG9ydCBjb25zdCBzb3BMYXRleCA9IChjLCBjb3YpID0+IGNvdi5jb25zdCAhPT0gdm9pZCAwID8gU3RyaW5nKGNvdi5jb25zdCkgOiBjb3YuY292ZXIubWFwKChjYikgPT4gY3ViZUxhdGV4KGMsIGNiKSkuam9pbihcIiArIFwiKTtcblxuZXhwb3J0IGZ1bmN0aW9uIGJ1aWxkRXhwcmVzc2lvbnMoYywgYWxsKSB7XG4gIHJldHVybiBjLm91dHB1dHMubWFwKChvKSA9PiB7XG4gICAgbGV0IHJhdztcbiAgICB0cnkge1xuICAgICAgcmF3ID0gcmF3TGF0ZXgoYywgbyk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgcmF3ID0gbnVsbDtcbiAgICB9XG4gICAgaWYgKHJhdyAmJiByYXcubGVuZ3RoID4gODAwKSByYXcgPSBudWxsO1xuICAgIFxuICAgIGxldCBjb3YgPSBudWxsLCBtaW4gPSBudWxsO1xuICAgIGlmIChhbGwpIHtcbiAgICAgIGNvbnN0IGRjID0gbmV3IFNldCgpO1xuICAgICAgYWxsLmZvckVhY2goKHIsIGkpID0+IHsgaWYgKHJbb10gPT09IC0xKSBkYy5hZGQoaSk7IH0pO1xuICAgICAgXG4gICAgICBjb3YgPSBjb3Zlck9mKGFsbCwgbywgMSwgZGMpO1xuICAgICAgbWluID0gc29wTGF0ZXgoYywgY292KTtcbiAgICB9XG4gICAgcmV0dXJuIHsgbmFtZTogbywgcmF3LCBtaW4sIGNvdiB9O1xuICB9KTtcbn0iLCAiLy8gcGFja2FnZXMvbG9naWMtZ3JhcGgvc3JjL2NvcmUvc3ludGhlc2l6ZS5qc1xuaW1wb3J0IHsgTUFYX0dBVEVfRkFOSU4gfSBmcm9tIFwiLi9jb25zdGFudHMuanNcIjtcbmltcG9ydCB7IEJBU0UgfSBmcm9tIFwiLi9nYXRlcy5qc1wiO1xuaW1wb3J0IHsgY292ZXJPZiwgY3ViZUxpdGVyYWxzIH0gZnJvbSBcIi4vbWluaW1pemUuanNcIjtcbmltcG9ydCB7IGFzc2VtYmxlIH0gZnJvbSBcIi4vcGFyc2VyLmpzXCI7XG5leHBvcnQgY29uc3QgTUVUSE9EX0xBQkVMID0ge1xuICBzdHJ1Y3R1cmFsOiBcIlN0cnVjdHVyYWwgKHJld3JpdGVzIHlvdXIgYWN0dWFsIGNpcmN1aXQpXCIsXG4gIGJlc3Q6IFwiQmVzdCBvZiBhbGwgbWV0aG9kc1wiLFxuICBzb3A6IFwiQU5ELU9SIChzdW0gb2YgcHJvZHVjdHMpXCIsXG4gIHBvczogXCJPUi1BTkQgKHByb2R1Y3Qgb2Ygc3VtcylcIixcbiAgbmFuZDogXCJOQU5ELU5BTkRcIixcbiAgbm9yOiBcIk5PUi1OT1JcIlxufTtcbmV4cG9ydCBmdW5jdGlvbiBzeW50aGVzaXplKGMsIGFsbCwgbWV0aG9kKSB7XG4gIGNvbnN0IG5hbWVzID0gLyogQF9fUFVSRV9fICovIG5ldyBTZXQoWy4uLmMuaW5wdXRzLCAuLi5jLmdhdGVzLm1hcCgoZykgPT4gZy5vdXQpXSk7XG4gIGNvbnN0IGdlbnN5bSA9IChiYXNlLCBudW1iZXJlZCkgPT4ge1xuICAgIGlmICghbnVtYmVyZWQgJiYgIW5hbWVzLmhhcyhiYXNlKSkge1xuICAgICAgbmFtZXMuYWRkKGJhc2UpO1xuICAgICAgcmV0dXJuIGJhc2U7XG4gICAgfVxuICAgIGxldCBrID0gbnVtYmVyZWQgPyAxIDogMiwgbm1lO1xuICAgIGRvIHtcbiAgICAgIG5tZSA9IGJhc2UgKyBrKys7XG4gICAgfSB3aGlsZSAobmFtZXMuaGFzKG5tZSkpO1xuICAgIG5hbWVzLmFkZChubWUpO1xuICAgIHJldHVybiBubWU7XG4gIH07XG4gIGNvbnN0IGdhdGVzID0gW10sIGNhY2hlID0gLyogQF9fUFVSRV9fICovIG5ldyBNYXAoKSwgbm90cyA9IC8qIEBfX1BVUkVfXyAqLyBuZXcgTWFwKCksIGNvbnN0cyA9IHt9O1xuICBjb25zdCBhZGRHYXRlID0gKHR5cGUsIGlucywgb3V0KSA9PiB7XG4gICAgZ2F0ZXMucHVzaCh7IHR5cGUsIGlucywgb3V0LCBsaW5lOiAwIH0pO1xuICAgIHJldHVybiBvdXQ7XG4gIH07XG4gIGNvbnN0IHNoYXJlZCA9ICh0eXBlLCBpbnMsIHByZWZpeCkgPT4ge1xuICAgIGNvbnN0IGtleSA9IHR5cGUgKyBcInxcIiArIGlucy5qb2luKFwiLFwiKTtcbiAgICBpZiAoIWNhY2hlLmhhcyhrZXkpKSBjYWNoZS5zZXQoa2V5LCBhZGRHYXRlKHR5cGUsIGlucywgZ2Vuc3ltKHByZWZpeCwgdHJ1ZSkpKTtcbiAgICByZXR1cm4gY2FjaGUuZ2V0KGtleSk7XG4gIH07XG4gIGNvbnN0IG5vdE9mID0gKG5hbWUpID0+IHtcbiAgICBpZiAoIW5vdHMuaGFzKG5hbWUpKSBub3RzLnNldChuYW1lLCBhZGRHYXRlKFwiTk9UXCIsIFtuYW1lXSwgZ2Vuc3ltKG5hbWUgKyBcIl9uXCIpKSk7XG4gICAgcmV0dXJuIG5vdHMuZ2V0KG5hbWUpO1xuICB9O1xuICBjb25zdCBsaXQgPSAobCkgPT4gbC5uZWcgPyBub3RPZihsLm5hbWUpIDogbC5uYW1lO1xuICBjb25zdCBjb21wID0gKGwpID0+ICh7IG5hbWU6IGwubmFtZSwgbmVnOiAhbC5uZWcgfSk7XG4gIGNvbnN0IGJ1aWxkID0gKHR5cGUsIGlucywgcHJlZml4LCBvdXQpID0+IHtcbiAgICBjb25zdCBiYXNlID0gQkFTRVt0eXBlXTtcbiAgICBsZXQgY3VyID0gaW5zO1xuICAgIHdoaWxlIChjdXIubGVuZ3RoID4gTUFYX0dBVEVfRkFOSU4pIHtcbiAgICAgIGNvbnN0IG5leHQgPSBbXTtcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgY3VyLmxlbmd0aDsgaSArPSBNQVhfR0FURV9GQU5JTikge1xuICAgICAgICBjb25zdCBjaHVuayA9IGN1ci5zbGljZShpLCBpICsgTUFYX0dBVEVfRkFOSU4pO1xuICAgICAgICBuZXh0LnB1c2goY2h1bmsubGVuZ3RoID09PSAxID8gY2h1bmtbMF0gOiBzaGFyZWQoYmFzZSwgY2h1bmssIFwidFwiKSk7XG4gICAgICB9XG4gICAgICBjdXIgPSBuZXh0O1xuICAgIH1cbiAgICByZXR1cm4gb3V0ID8gYWRkR2F0ZSh0eXBlLCBjdXIsIG91dCkgOiBzaGFyZWQodHlwZSwgY3VyLCBwcmVmaXgpO1xuICB9O1xuICBjb25zdCBzaW5nbGUgPSAodHlwZSwgTCwgb3V0KSA9PiB7XG4gICAgaWYgKEwubGVuZ3RoID09PSAxKSBhZGRHYXRlKExbMF0ubmVnID8gXCJOT1RcIiA6IFwiQlVGXCIsIFtMWzBdLm5hbWVdLCBvdXQpO1xuICAgIGVsc2UgYnVpbGQodHlwZSwgTC5tYXAobGl0KSwgXCJcIiwgb3V0KTtcbiAgfTtcbiAgY29uc3QgZHVhbCA9IG1ldGhvZCA9PT0gXCJwb3NcIiB8fCBtZXRob2QgPT09IFwibm9yXCI7XG4gIGMub3V0cHV0cy5mb3JFYWNoKChvKSA9PiB7XG4gICAgY29uc3QgY292ID0gY292ZXJPZihhbGwsIG8sIGR1YWwgPyAwIDogMSk7XG4gICAgaWYgKGNvdi5jb25zdCAhPT0gdm9pZCAwKSB7XG4gICAgICBjb25zdHNbb10gPSBjb3YuY29uc3Q7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGNvbnN0IGN1YmVzID0gY292LmNvdmVyO1xuICAgIGNvbnN0IGxpdHMgPSAoY2IpID0+IGR1YWwgPyBjdWJlTGl0ZXJhbHMoYywgY2IpLm1hcChjb21wKSA6IGN1YmVMaXRlcmFscyhjLCBjYik7XG4gICAgaWYgKGN1YmVzLmxlbmd0aCA9PT0gMSkge1xuICAgICAgc2luZ2xlKGR1YWwgPyBcIk9SXCIgOiBcIkFORFwiLCBsaXRzKGN1YmVzWzBdKSwgbyk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGlmIChtZXRob2QgPT09IFwic29wXCIpIHtcbiAgICAgIGJ1aWxkKFwiT1JcIiwgY3ViZXMubWFwKChjYikgPT4ge1xuICAgICAgICBjb25zdCBMID0gbGl0cyhjYik7XG4gICAgICAgIHJldHVybiBMLmxlbmd0aCA9PT0gMSA/IGxpdChMWzBdKSA6IGJ1aWxkKFwiQU5EXCIsIEwubWFwKGxpdCksIFwicFwiKTtcbiAgICAgIH0pLCBcIlwiLCBvKTtcbiAgICB9IGVsc2UgaWYgKG1ldGhvZCA9PT0gXCJuYW5kXCIpIHtcbiAgICAgIGJ1aWxkKFwiTkFORFwiLCBjdWJlcy5tYXAoKGNiKSA9PiB7XG4gICAgICAgIGNvbnN0IEwgPSBsaXRzKGNiKTtcbiAgICAgICAgcmV0dXJuIEwubGVuZ3RoID09PSAxID8gTFswXS5uZWcgPyBMWzBdLm5hbWUgOiBub3RPZihMWzBdLm5hbWUpIDogYnVpbGQoXCJOQU5EXCIsIEwubWFwKGxpdCksIFwicFwiKTtcbiAgICAgIH0pLCBcIlwiLCBvKTtcbiAgICB9IGVsc2UgaWYgKG1ldGhvZCA9PT0gXCJwb3NcIikge1xuICAgICAgYnVpbGQoXCJBTkRcIiwgY3ViZXMubWFwKChjYikgPT4ge1xuICAgICAgICBjb25zdCBMID0gbGl0cyhjYik7XG4gICAgICAgIHJldHVybiBMLmxlbmd0aCA9PT0gMSA/IGxpdChMWzBdKSA6IGJ1aWxkKFwiT1JcIiwgTC5tYXAobGl0KSwgXCJzXCIpO1xuICAgICAgfSksIFwiXCIsIG8pO1xuICAgIH0gZWxzZSB7XG4gICAgICBidWlsZChcIk5PUlwiLCBjdWJlcy5tYXAoKGNiKSA9PiB7XG4gICAgICAgIGNvbnN0IEwgPSBsaXRzKGNiKTtcbiAgICAgICAgcmV0dXJuIEwubGVuZ3RoID09PSAxID8gTFswXS5uZWcgPyBMWzBdLm5hbWUgOiBub3RPZihMWzBdLm5hbWUpIDogYnVpbGQoXCJOT1JcIiwgTC5tYXAobGl0KSwgXCJzXCIpO1xuICAgICAgfSksIFwiXCIsIG8pO1xuICAgIH1cbiAgfSk7XG4gIHJldHVybiB7IGNpcmN1aXQ6IGdhdGVzLmxlbmd0aCA/IGFzc2VtYmxlKGdhdGVzLCBjLmlucHV0cykgOiBudWxsLCBjb25zdHMgfTtcbn1cblxuIiwgIi8vIHBhY2thZ2VzL2xvZ2ljLWdyYXBoL3NyYy9zZXR0aW5ncy9wcm92aWRlcnMuanNcbmV4cG9ydCBjb25zdCBQUk9WSURFUlMgPSB7XG4gIGxvY2FsOiB7IG5hbWU6IFwiTG9jYWwgcmVjb2duaXplciAob2ZmbGluZSwgSW1hZ2UgSW1wb3J0IGV4dGVuc2lvbilcIiB9LFxuICBjbGF1ZGU6IHsgbmFtZTogXCJDbGF1ZGUgKEFudGhyb3BpYylcIiwga2V5SGludDogXCJzay1hbnQtXFx1MjAyNlwiLCBtb2RlbEhpbnQ6IFwibW9kZWwgbmFtZVwiIH0sXG4gIGdlbWluaTogeyBuYW1lOiBcIkdlbWluaSAoR29vZ2xlKVwiLCBrZXlIaW50OiBcIkFJemFcXHUyMDI2XCIsIG1vZGVsSGludDogXCJtb2RlbCBuYW1lXCIgfSxcbiAgZ3JvazogeyBuYW1lOiBcIkdyb2sgKHhBSSlcIiwga2V5SGludDogXCJ4YWktXFx1MjAyNlwiLCBtb2RlbEhpbnQ6IFwibW9kZWwgbmFtZVwiIH0sXG4gIGRlZXBzZWVrOiB7IG5hbWU6IFwiRGVlcFNlZWtcIiwga2V5SGludDogXCJzay1cXHUyMDI2XCIsIG1vZGVsSGludDogXCJtb2RlbCBuYW1lXCIgfSxcbiAgb3BlbnJvdXRlcjogeyBuYW1lOiBcIk9wZW5Sb3V0ZXJcIiwga2V5SGludDogXCJzay1vci1cXHUyMDI2XCIsIG1vZGVsSGludDogXCJwcm92aWRlci9tb2RlbFwiIH1cbn07XG5leHBvcnQgY29uc3QgSU1QT1JUX0VYVEVOU0lPTl9JRCA9IFwibG9naWMtZ3JhcGgtaW1wb3J0XCI7XG5cbiIsICIvLyBwYWNrYWdlcy9sb2dpYy1ncmFwaC9zcmMvdGVtcGxhdGVzLmpzXG5pbXBvcnQgKiBhcyBpbXBvcnRfb2JzaWRpYW4yIGZyb20gXCJvYnNpZGlhblwiO1xuZXhwb3J0IGNvbnN0IFRFTVBMQVRFUyA9IFtcbiAgeyBuYW1lOiBcIkJsYW5rICh0d28taW5wdXQgQU5EKVwiLCBjb2RlOiBcIihhLGIpIEFORCAoeSlcIiB9LFxuICB7IG5hbWU6IFwiSGFsZiBhZGRlclwiLCBjb2RlOiBcIihhLGIpIFhPUiAoc3VtKVxcbihhLGIpIEFORCAoY2FycnkpXCIgfSxcbiAgeyBuYW1lOiBcIkZ1bGwgYWRkZXJcIiwgY29kZTogXCIoYSxiKSBYT1IgKHQpXFxuKHQsY2luKSBYT1IgKHN1bSlcXG4oYSxiKSBBTkQgKHgpXFxuKHQsY2luKSBBTkQgKHopXFxuKHgseikgT1IgKGNvdXQpXCIgfSxcbiAgeyBuYW1lOiBcIjItdG8tMSBtdWx0aXBsZXhlclwiLCBjb2RlOiBcIihzKSBOT1QgKG5zKVxcbihhLG5zKSBBTkQgKHgpXFxuKGIscykgQU5EICh6KVxcbih4LHopIE9SICh5KVwiIH0sXG4gIHsgbmFtZTogXCIyLXRvLTQgZGVjb2RlclwiLCBjb2RlOiBcIihhKSBOT1QgKG5hKVxcbihiKSBOT1QgKG5iKVxcbihuYSxuYikgQU5EICh5MClcXG4obmEsYikgQU5EICh5MSlcXG4oYSxuYikgQU5EICh5MilcXG4oYSxiKSBBTkQgKHkzKVwiIH0sXG4gIHsgbmFtZTogXCIzLWlucHV0IG1ham9yaXR5XCIsIGNvZGU6IFwiKGEsYikgQU5EICh4KVxcbihiLGMpIEFORCAoeSlcXG4oYSxjKSBBTkQgKHopXFxuKHgseSx6KSBPUiAobWFqKVwiIH0sXG4gIHsgbmFtZTogXCI0LWJpdCBwYXJpdHkgKFhPUiB0cmVlKVwiLCBjb2RlOiBcIihhLGIpIFhPUiAocDEpXFxuKGMsZCkgWE9SIChwMilcXG4ocDEscDIpIFhPUiAocGFyaXR5KVwiIH0sXG4gIHsgbmFtZTogXCJYT1IgZnJvbSBOQU5EIGdhdGVzXCIsIGNvZGU6IFwiKGEsYikgTkFORCAobjEpXFxuKGEsbjEpIE5BTkQgKG4yKVxcbihiLG4xKSBOQU5EIChuMylcXG4objIsbjMpIE5BTkQgKHkpXCIgfVxuXTtcbmV4cG9ydCBjb25zdCBmZW5jZSA9IChjb2RlKSA9PiBcImBgYGxvZ2ljXFxuXCIgKyBjb2RlICsgXCJcXG5gYGBcXG5cIjtcbmV4cG9ydCBjb25zdCBUZW1wbGF0ZU1vZGFsID0gY2xhc3MgZXh0ZW5kcyBpbXBvcnRfb2JzaWRpYW4yLkZ1enp5U3VnZ2VzdE1vZGFsIHtcbiAgY29uc3RydWN0b3IoYXBwLCBvblBpY2spIHtcbiAgICBzdXBlcihhcHApO1xuICAgIHRoaXMub25QaWNrID0gb25QaWNrO1xuICAgIHRoaXMuc2V0UGxhY2Vob2xkZXIoXCJDaG9vc2UgYSBjaXJjdWl0IHRlbXBsYXRlXFx1MjAyNlwiKTtcbiAgfVxuICBnZXRJdGVtcygpIHtcbiAgICByZXR1cm4gVEVNUExBVEVTO1xuICB9XG4gIGdldEl0ZW1UZXh0KHQpIHtcbiAgICByZXR1cm4gdC5uYW1lO1xuICB9XG4gIG9uQ2hvb3NlSXRlbSh0KSB7XG4gICAgdGhpcy5vblBpY2sodCk7XG4gIH1cbn07XG5cbiIsICJpbXBvcnQgeyBmaW5pc2hSZW5kZXJNYXRoIH0gZnJvbSBcIm9ic2lkaWFuXCI7XG5pbXBvcnQgeyBBTkFMWVNJU19NQVhfSU5QVVRTIH0gZnJvbSBcIi4uL2NvcmUvY29uc3RhbnRzLmpzXCI7XG5pbXBvcnQgeyBwYXJzZSB9IGZyb20gXCIuLi9jb3JlL3BhcnNlci5qc1wiO1xuaW1wb3J0IHsgdHJ1dGhUYWJsZSB9IGZyb20gXCIuLi9jb3JlL3NpbS5qc1wiO1xuaW1wb3J0IHsgYnVpbGRFeHByZXNzaW9ucyB9IGZyb20gXCIuLi9jb3JlL21pbmltaXplLmpzXCI7XG5pbXBvcnQgeyBubSB9IGZyb20gXCIuLi9jb3JlL2xhdGV4LmpzXCI7XG5pbXBvcnQgeyBwYXJzZVNwYWNpbmcgfSBmcm9tIFwiLi4vc2V0dGluZ3Mvc2V0dGluZ3MuanNcIjtcbmltcG9ydCB7IHJlZHVjZUNpcmN1aXQgfSBmcm9tIFwiLi4vY29yZS9yZWR1Y2UuanNcIjtcbmltcG9ydCB7IE1FVEhPRF9MQUJFTCB9IGZyb20gXCIuLi9jb3JlL3N5bnRoZXNpemUuanNcIjtcbmltcG9ydCB7IGgsIG1hdGggfSBmcm9tIFwiLi9kb20uanNcIjtcbmltcG9ydCB7IHJlbmRlckhlbHAgfSBmcm9tIFwiLi9oZWxwLmpzXCI7XG5pbXBvcnQgeyBjcmVhdGVEaWFncmFtIH0gZnJvbSBcIi4vZGlhZ3JhbS5qc1wiO1xuaW1wb3J0IHsgY3JlYXRlVGltaW5nIH0gZnJvbSBcIi4vdGltaW5nLmpzXCI7XG5pbXBvcnQgeyByZW5kZXJUYWJsZSwgdGFibGVUb01hcmtkb3duIH0gZnJvbSBcIi4vdGFibGUuanNcIjtcbmltcG9ydCB7IHJlbmRlckttYXBzIH0gZnJvbSBcIi4va21hcC5qc1wiO1xuaW1wb3J0IHsgY29weSwgdG9MYXRleFNvdXJjZSwgdG9NZXJtYWlkIH0gZnJvbSBcIi4vY29weS5qc1wiO1xuXG5leHBvcnQgZnVuY3Rpb24gcmVuZGVyQmxvY2soc3JjLCBlbCwgcGx1Z2luKSB7XG4gIGNvbnN0IFMgPSBwbHVnaW4uc2V0dGluZ3MsIGFwcCA9IHBsdWdpbi5hcHA7XG4gIGNvbnN0IHdyYXAgPSBoKFwiZGl2XCIsIFwibGctd3JhcFwiLCBlbCk7XG4gIGxldCBjO1xuICB0cnkge1xuICAgIGMgPSBwYXJzZShzcmMsIHsgbWF4SW5wdXRzOiBTLm1heElucHV0cywgbWF4R2F0ZXM6IFMubWF4R2F0ZXMsIG1heE11eElucHV0czogUy5tYXhNdXhJbnB1dHMgfSk7XG4gIH0gY2F0Y2ggKGUpIHtcbiAgICBoKFwiZGl2XCIsIFwibGctZXJyb3JcIiwgd3JhcCwgZS5tZXNzYWdlKTtcbiAgICByZXR1cm4geyBkaXNwb3NlKCkge30gfTtcbiAgfVxuICBcbiAgY29uc3QgTyA9IGMub3B0cztcbiAgaWYgKE8uaGVscCkgcmVuZGVySGVscCh3cmFwLCBwbHVnaW4pO1xuICBpZiAoYy5lbXB0eSkgcmV0dXJuIHsgZGlzcG9zZSgpIHt9IH07XG4gIFxuICBjb25zdCBwYXJ0ID0gKG5hbWUsIGRlZikgPT4gTy5oaWRlLmhhcyhuYW1lKSA/IGZhbHNlIDogTy5zaG93LmhhcyhuYW1lKSA/IHRydWUgOiBkZWY7XG4gIGNvbnN0IGFuYWx5emFibGUgPSBjLmlucHV0cy5sZW5ndGggPD0gQU5BTFlTSVNfTUFYX0lOUFVUUztcbiAgY29uc3QgYWxsID0gYW5hbHl6YWJsZSA/IHRydXRoVGFibGUoYykgOiBudWxsO1xuICBjb25zdCBleHBycyA9IGJ1aWxkRXhwcmVzc2lvbnMoYywgYWxsKTtcbiAgY29uc3QgYnViYmxlcyA9IE8uYnViYmxlcyAhPT0gbnVsbCA/IE8uYnViYmxlcyA6IFMuYnViYmxlUHVzaGluZztcbiAgY29uc3QgbWV0aG9kID0gTy5zaW1wbGlmeSAhPT0gbnVsbCA/IE8uc2ltcGxpZnkgPT09IFwib2ZmXCIgPyBudWxsIDogTy5zaW1wbGlmeSA6IFMuZXhwU2ltcGxpZnkgPyBTLnNpbXBsaWZ5TWV0aG9kIDogbnVsbDtcbiAgY29uc3QgY29tcGFjdCA9IE8uY29tcGFjdCAhPT0gbnVsbCA/IE8uY29tcGFjdCA6IFMuY29sbGFwc2VEb250Q2FyZTtcbiAgY29uc3QgdmlldyA9IE8udGltaW5nIHx8IFMudGltaW5nVmlldztcbiAgbGV0IGRlbGF5U2VjID0gTy5kZWxheSAhPT0gbnVsbCA/IE8uZGVsYXkgOiBTLmRlbGF5RW5hYmxlZCA/IFMuZGVsYXlTZWNvbmRzIDogMDtcbiAgaWYgKE8udGltaW5nICYmIGRlbGF5U2VjID09PSAwKSBkZWxheVNlYyA9IDE7XG4gIGNvbnN0IGdldERlbGF5ID0gKCkgPT4gZGVsYXlTZWMgPCAwID8gTWF0aC5yYW5kb20oKSAqIDUgOiBkZWxheVNlYztcbiAgY29uc3Qgc2hvd0dyYXBoID0gZGVsYXlTZWMgIT09IDAgJiYgKHZpZXcgPT09IFwiZ3JhcGhcIiB8fCB2aWV3ID09PSBcImJvdGhcIikgJiYgcGFydChcInRpbWluZ1wiLCB0cnVlKTtcbiAgY29uc3QgYW5pbSA9IGRlbGF5U2VjICE9PSAwICYmICh2aWV3ID09PSBcImFuaW1hdGlvblwiIHx8IHZpZXcgPT09IFwiYm90aFwiKTtcbiAgY29uc3QgaHNwYWNpbmcgPSBwYXJzZVNwYWNpbmcoUy5oU3BhY2luZykgfHwgeyBweDogOTAgfTtcbiAgXG4gIGNvbnN0IGlucHV0U3RhdGUgPSB7fTtcbiAgYy5pbnB1dHMuZm9yRWFjaCgobikgPT4geyBpbnB1dFN0YXRlW25dID0gMDsgfSk7XG4gIFxuICBjb25zdCBkaWFncmFtcyA9IFtdO1xuICBsZXQgbWFpbkRpYWdyYW0gPSBudWxsLCB0aW1pbmcgPSBudWxsLCB0YWJsZSA9IG51bGwsIGttYXBzID0gbnVsbDtcbiAgXG4gIGZ1bmN0aW9uIGhpZ2hsaWdodCgpIHtcbiAgICBjb25zdCBpZHggPSBjLmlucHV0cy5yZWR1Y2UoKGEsIG4pID0+IGEgKiAyICsgKGlucHV0U3RhdGVbbl0gPyAxIDogMCksIDApO1xuICAgIGlmICh0YWJsZSkgdGFibGUubWFya0FjdGl2ZShpZHgpO1xuICAgIGlmIChrbWFwcykga21hcHMubWFya0FjdGl2ZShpZHgpO1xuICB9XG4gIFxuICBmdW5jdGlvbiBzZXRJbnB1dHMocGF0Y2gpIHtcbiAgICBpZiAodGltaW5nICYmIG1haW5EaWFncmFtICYmIG1haW5EaWFncmFtLnNpbS5wZW5kaW5nKCkgPT09IDApIHRpbWluZy5iZWdpbihtYWluRGlhZ3JhbS5zaW0udmFscyk7XG4gICAgT2JqZWN0LmFzc2lnbihpbnB1dFN0YXRlLCBwYXRjaCk7XG4gICAgZGlhZ3JhbXMuZm9yRWFjaCgoZCkgPT4gZC5zaW0uc2V0SW5wdXRzKHBhdGNoKSk7XG4gICAgaGlnaGxpZ2h0KCk7XG4gIH1cbiAgXG4gIGNvbnN0IHRvZ2dsZSA9IChuKSA9PiBzZXRJbnB1dHMoeyBbbl06IGlucHV0U3RhdGVbbl0gPyAwIDogMSB9KTtcbiAgY29uc3QgcGlja0luZGV4ID0gKG0pID0+IHtcbiAgICBjb25zdCBwYXRjaCA9IHt9O1xuICAgIGMuaW5wdXRzLmZvckVhY2goKG4sIGspID0+IHsgcGF0Y2hbbl0gPSBtID4+IGMuaW5wdXRzLmxlbmd0aCAtIDEgLSBrICYgMTsgfSk7XG4gICAgc2V0SW5wdXRzKHBhdGNoKTtcbiAgfTtcbiAgXG4gIGNvbnN0IGJhc2UgPSB7IGFwcCwgaHNwYWNpbmcsIHZnYXA6IFMudlNwYWNpbmcsIGJ1YmJsZXMsIGFuaW0sIGdldERlbGF5LCBvblRvZ2dsZTogdG9nZ2xlIH07XG4gIFxuICBpZiAocGFydChcImRpYWdyYW1cIiwgdHJ1ZSkpIHtcbiAgICBjb25zdCBob2xkZXIgPSBoKFwiZGl2XCIsIFwiXCIsIHdyYXApO1xuICAgIG1haW5EaWFncmFtID0gY3JlYXRlRGlhZ3JhbShjLCBob2xkZXIsIE9iamVjdC5hc3NpZ24oe30sIGJhc2UsIHtcbiAgICAgIHRpdGxlOiBcIkNpcmN1aXRcIixcbiAgICAgIGV4cG9ydE5hbWU6IFwiY2lyY3VpdFwiLFxuICAgICAgb25DaGFuZ2U6IChzaWcsIHYpID0+IHsgaWYgKHRpbWluZykgdGltaW5nLnJlY29yZChzaWcsIHYpOyB9XG4gICAgfSkpO1xuICAgIGlmIChzaG93R3JhcGgpIHtcbiAgICAgIGNvbnN0IGtpbmRzID0ge307XG4gICAgICBjLmlucHV0cy5mb3JFYWNoKChuKSA9PiB7IGtpbmRzW25dID0gXCJpblwiOyB9KTtcbiAgICAgIGMub3V0cHV0cy5mb3JFYWNoKChuKSA9PiB7IGtpbmRzW25dID0gXCJvdXRcIjsgfSk7XG4gICAgICB0aW1pbmcgPSBjcmVhdGVUaW1pbmcoaG9sZGVyLCBbLi4uYy5pbnB1dHMsIC4uLmMubWlkZGxlcywgLi4uYy5vdXRwdXRzXSwga2luZHMsIGFwcCk7XG4gICAgICB0aW1pbmcuc2V0TGFzdFZhbHMoKCkgPT4gbWFpbkRpYWdyYW0uc2ltLnZhbHMpO1xuICAgICAgdGltaW5nLmJlZ2luKG1haW5EaWFncmFtLnNpbS52YWxzKTtcbiAgICB9XG4gICAgZGlhZ3JhbXMucHVzaChtYWluRGlhZ3JhbSk7XG4gIH1cbiAgXG4gIGlmIChtZXRob2QgJiYgcGFydChcImRpYWdyYW1cIiwgdHJ1ZSkpIHtcbiAgICBpZiAoIWFuYWx5emFibGUgJiYgbWV0aG9kICE9PSBcInN0cnVjdHVyYWxcIikge1xuICAgICAgaChcImRpdlwiLCBcImxnLW5vdGVcIiwgd3JhcCwgYFwiJHttZXRob2R9XCIgbmVlZHMgYXQgbW9zdCAke0FOQUxZU0lTX01BWF9JTlBVVFN9IGlucHV0cy4gXCJzdHJ1Y3R1cmFsXCIgd29ya3MgYXQgYW55IHNpemUuYCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGxldCByID0gbnVsbDtcbiAgICAgIHRyeSB7XG4gICAgICAgIHIgPSByZWR1Y2VDaXJjdWl0KGMsIGFsbCwgbWV0aG9kKTtcbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgaChcImRpdlwiLCBcImxnLW5vdGVcIiwgd3JhcCwgXCJSZWR1Y3Rpb24gZmFpbGVkOiBcIiArIGUubWVzc2FnZSk7XG4gICAgICB9XG4gICAgICBpZiAocikge1xuICAgICAgICBjb25zdCBjaG9zZW4gPSBtZXRob2QgPT09IFwiYmVzdFwiID8gYCAoJHtyLm1ldGhvZH0pYCA6IFwiXCI7XG4gICAgICAgIE9iamVjdC5rZXlzKHIuY29uc3RzKS5mb3JFYWNoKChvKSA9PiBoKFwiZGl2XCIsIFwibGctbm90ZVwiLCB3cmFwLCBgJHtvfSByZWR1Y2VzIHRvIHRoZSBjb25zdGFudCAke3IuY29uc3RzW29dfWApKTtcbiAgICAgICAgaWYgKHIudmVyaWZpZWQgPT09IFwiRkFJTEVEXCIpIHtcbiAgICAgICAgICBoKFwiZGl2XCIsIFwibGctZXJyb3JcIiwgd3JhcCwgXCJUaGUgcmVkdWNlZCBjaXJjdWl0IGRpZCBub3QgbWF0Y2ggdGhlIG9yaWdpbmFsLCBzbyBpdCBpcyBub3Qgc2hvd24uIFBsZWFzZSByZXBvcnQgdGhpcyBjaXJjdWl0LlwiKTtcbiAgICAgICAgfSBlbHNlIGlmIChyLmNpcmN1aXQgJiYgIShyLm1ldGhvZCA9PT0gXCJzdHJ1Y3R1cmFsXCIgJiYgci5hZnRlci5nYXRlcyA+PSByLmJlZm9yZS5nYXRlcykpIHtcbiAgICAgICAgICBjb25zdCBjaGVjayA9IHIudmVyaWZpZWQgPT09IFwiZXhhY3RcIiA/IFwiY2hlY2tlZCBvbiBhbGwgaW5wdXRzXCIgOiBcImNoZWNrZWQgb24gNDA5NiByYW5kb20gaW5wdXRzXCI7XG4gICAgICAgICAgZGlhZ3JhbXMucHVzaChjcmVhdGVEaWFncmFtKHIuY2lyY3VpdCwgd3JhcCwgT2JqZWN0LmFzc2lnbih7fSwgYmFzZSwge1xuICAgICAgICAgICAgdGl0bGU6IGBSZWR1Y2VkLCAke01FVEhPRF9MQUJFTFtyLm1ldGhvZF19JHtjaG9zZW59OiAke3IuYmVmb3JlLmdhdGVzfSB0byAke3IuYWZ0ZXIuZ2F0ZXN9IGdhdGVzICgke2NoZWNrfSlgLFxuICAgICAgICAgICAgZXhwb3J0TmFtZTogXCJjaXJjdWl0LXJlZHVjZWRcIlxuICAgICAgICAgIH0pKSk7XG4gICAgICAgICAgaWYgKHIuYWZ0ZXIuZ2F0ZXMgPiByLmJlZm9yZS5nYXRlcykgaChcImRpdlwiLCBcImxnLW5vdGVcIiwgd3JhcCwgJ1RoaXMgZm9ybSBoYXMgbW9yZSBnYXRlcyB0aGFuIHlvdXIgY2lyY3VpdDogdHdvLWxldmVsIGxvZ2ljIGNhbiBiZSBsYXJnZXIgKHBhcml0eS9YT1IgY2lyY3VpdHMgYXJlIHRoZSBjbGFzc2ljIGNhc2UpLiBUcnkgXCJzdHJ1Y3R1cmFsXCIgb3IgXCJiZXN0XCIuJyk7XG4gICAgICAgIH0gZWxzZSBpZiAoci5tZXRob2QgPT09IFwic3RydWN0dXJhbFwiKSB7XG4gICAgICAgICAgaChcImRpdlwiLCBcImxnLW5vdGVcIiwgd3JhcCwgYE5vIHN0cnVjdHVyYWwgcmVkdWN0aW9uIGZvdW5kOiAke3IuYmVmb3JlLmdhdGVzfSBnYXRlcyBpcyBhbHJlYWR5IG1pbmltYWwgZm9yIHRoZXNlIHJld3JpdGUgcnVsZXMuYCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgXG4gIGlmIChwYXJ0KFwiZXhwclwiLCBTLnNob3dFeHByKSkge1xuICAgIGNvbnN0IGJveCA9IGgoXCJkaXZcIiwgXCJsZy1leHByXCIsIHdyYXApO1xuICAgIGV4cHJzLmZvckVhY2goKGUpID0+IHtcbiAgICAgIGNvbnN0IHNhbWUgPSBlLnJhdyA9PT0gZS5taW47XG4gICAgICBpZiAoZS5yYXcgJiYgIXNhbWUpIG1hdGgoYCR7bm0oZS5uYW1lKX0gPSAke2UucmF3fWAsIGgoXCJkaXZcIiwgXCJsZy1leHByLXJvd1wiLCBib3gpKTtcbiAgICAgIGlmIChlLm1pbiAhPT0gbnVsbCkge1xuICAgICAgICBjb25zdCByMiA9IGgoXCJkaXZcIiwgXCJsZy1leHByLXJvd1wiLCBib3gpO1xuICAgICAgICBtYXRoKGAke25tKGUubmFtZSl9ID0gJHtlLm1pbn1gLCByMik7XG4gICAgICAgIGlmIChlLnJhdyAmJiAhc2FtZSkgaChcInNwYW5cIiwgXCJsZy1leHByLXRhZ1wiLCByMiwgZS5jb3YuZXhhY3QgPT09IGZhbHNlID8gXCIgc2ltcGxpZmllZCAobmVhci1taW5pbWFsKVwiIDogXCIgc2ltcGxpZmllZFwiKTtcbiAgICAgIH0gZWxzZSBpZiAoIWUucmF3KSB7XG4gICAgICAgIGgoXCJkaXZcIiwgXCJsZy1ub3RlXCIsIGJveCwgYCR7ZS5uYW1lfTogZXhwcmVzc2lvbiB0b28gbG9uZyB0byBkaXNwbGF5YCk7XG4gICAgICB9XG4gICAgfSk7XG4gICAgaWYgKCFhbmFseXphYmxlKSBoKFwiZGl2XCIsIFwibGctbm90ZVwiLCBib3gsIGBNb3JlIHRoYW4gJHtBTkFMWVNJU19NQVhfSU5QVVRTfSBpbnB1dHM6IG9ubHkgdGhlIHN0cnVjdHVyYWwgZXhwcmVzc2lvbiBpcyBzaG93bi5gKTtcbiAgICBpZiAodHlwZW9mIGZpbmlzaFJlbmRlck1hdGggPT09IFwiZnVuY3Rpb25cIikgZmluaXNoUmVuZGVyTWF0aCgpO1xuICB9XG4gIFxuICBpZiAoYW5hbHl6YWJsZSAmJiBwYXJ0KFwia21hcFwiLCBTLnNob3dLbWFwKSkge1xuICAgIGNvbnN0IGtiID0gaChcImRpdlwiLCBcImxnLWttYXAtd3JhcFwiLCB3cmFwKTtcbiAgICBrbWFwcyA9IHJlbmRlckttYXBzKGtiLCBjLCBhbGwsIGV4cHJzLCB7IGFwcCwgb25QaWNrOiBwaWNrSW5kZXggfSk7XG4gICAgaWYgKHR5cGVvZiBmaW5pc2hSZW5kZXJNYXRoID09PSBcImZ1bmN0aW9uXCIpIGZpbmlzaFJlbmRlck1hdGgoKTtcbiAgfVxuICBcbiAgY29uc3Qgc2hvd1RhYmxlID0gcGFydChcInRhYmxlXCIsIFMuc2hvd1RhYmxlKTtcbiAgaWYgKGFuYWx5emFibGUgJiYgc2hvd1RhYmxlKSB7XG4gICAgdGFibGUgPSByZW5kZXJUYWJsZSh3cmFwLCBjLCBhbGwsIGNvbXBhY3QpO1xuICAgIHRhYmxlLnRycy5mb3JFYWNoKCh0ciwgaSkgPT4gdHIuYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHtcbiAgICAgIGNvbnN0IHBhdGNoID0ge307XG4gICAgICBjLmlucHV0cy5mb3JFYWNoKChuKSA9PiB7XG4gICAgICAgIGNvbnN0IHAgPSB0YWJsZS5yb3dzW2ldLnBhdHRlcm5bbl07XG4gICAgICAgIHBhdGNoW25dID0gcCA9PT0gXCJYXCIgPyBpbnB1dFN0YXRlW25dIDogcDtcbiAgICAgIH0pO1xuICAgICAgc2V0SW5wdXRzKHBhdGNoKTtcbiAgICB9KSk7XG4gIH0gZWxzZSBpZiAoIWFuYWx5emFibGUgJiYgc2hvd1RhYmxlKSB7XG4gICAgaChcImRpdlwiLCBcImxnLW5vdGVcIiwgd3JhcCwgYFRydXRoIHRhYmxlIGhpZGRlbjogbW9yZSB0aGFuICR7QU5BTFlTSVNfTUFYX0lOUFVUU30gaW5wdXRzICgyXiR7Yy5pbnB1dHMubGVuZ3RofSByb3dzKS4gVGhlIGRpYWdyYW0gaXMgc3RpbGwgaW50ZXJhY3RpdmUuYCk7XG4gIH1cbiAgXG4gIGhpZ2hsaWdodCgpO1xuICBjb25zdCBhY3Rpb25zID0gaChcImRpdlwiLCBcImxnLWFjdGlvbnNcIiwgd3JhcCk7XG4gIGNvbnN0IGJ0biA9IChsYWJlbCwgZm4pID0+IGgoXCJidXR0b25cIiwgXCJcIiwgYWN0aW9ucywgbGFiZWwpLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKSA9PiBjb3B5KGZuKCkpKTtcbiAgaWYgKHRhYmxlKSBidG4oXCJDb3B5IHRhYmxlIChNYXJrZG93bilcIiwgKCkgPT4gdGFibGVUb01hcmtkb3duKHRhYmxlLmNvbE5hbWVzLCB0YWJsZS5yb3dzLm1hcCgocikgPT4gci5jZWxscykpKTtcbiAgaWYgKGFuYWx5emFibGUpIGJ0bihcIkNvcHkgZXhwcmVzc2lvbnMgKExhVGVYKVwiLCAoKSA9PiB0b0xhdGV4U291cmNlKGV4cHJzKSk7XG4gIGJ0bihcIkNvcHkgZGlhZ3JhbSAoTWVybWFpZClcIiwgKCkgPT4gdG9NZXJtYWlkKGMpKTtcbiAgXG4gIHJldHVybiB7XG4gICAgZGlzcG9zZSgpIHtcbiAgICAgIGRpYWdyYW1zLmZvckVhY2goKGQpID0+IGQuZGlzcG9zZSgpKTtcbiAgICAgIGlmICh0aW1pbmcpIHRpbWluZy5kaXNwb3NlKCk7XG4gICAgfVxuICB9O1xufSIsICIvLyBwYWNrYWdlcy9sb2dpYy1ncmFwaC9zcmMvY29yZS9zaW0uanNcbmltcG9ydCB7IEdBVEVTIH0gZnJvbSBcIi4vZ2F0ZXMuanNcIjtcblxuZXhwb3J0IGZ1bmN0aW9uIGV2YWx1YXRlKGMsIGlucHV0VmFscykge1xuICBjb25zdCB2ID0gT2JqZWN0LmFzc2lnbih7fSwgaW5wdXRWYWxzKTtcbiAgYy5vcmRlci5mb3JFYWNoKChnKSA9PiB7XG4gICAgdltnLm91dF0gPSArR0FURVNbZy50eXBlXS5mbihnLmlucy5tYXAoKHgpID0+ICEhdlt4XSkpO1xuICB9KTtcbiAgcmV0dXJuIHY7XG59XG5cbi8vIGV4ZXJjaXNlTW9kZTogaWYgdHJ1ZSwgaXQgd2lsbCByYW5kb21seSBzZXQgc29tZSBvdXRwdXRzIHRvIC0xIChEb24ndCBDYXJlKVxuLy8gc28gdGhlIHVzZXIgY2FuIHByYWN0aWNlIGZpbGxpbmcgdGhlbSBpbi5cbmV4cG9ydCBmdW5jdGlvbiB0cnV0aFRhYmxlKGMsIGV4ZXJjaXNlTW9kZSA9IGZhbHNlKSB7XG4gIGNvbnN0IG4gPSBjLmlucHV0cy5sZW5ndGg7XG4gIGNvbnN0IHJvd3MgPSBbXTtcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCAxIDw8IG47IGkrKykge1xuICAgIGNvbnN0IGlucyA9IHt9O1xuICAgIGMuaW5wdXRzLmZvckVhY2goKHgsIGspID0+IHtcbiAgICAgIGluc1t4XSA9IGkgPj4gbiAtIDEgLSBrICYgMTtcbiAgICB9KTtcbiAgICBjb25zdCByb3cgPSBldmFsdWF0ZShjLCBpbnMpO1xuICAgIFxuICAgIGlmIChleGVyY2lzZU1vZGUpIHtcbiAgICAgIGMub3V0cHV0cy5mb3JFYWNoKG8gPT4ge1xuICAgICAgICBpZiAoTWF0aC5yYW5kb20oKSA8IDAuMTUpIHJvd1tvXSA9IC0xOyAvLyAxNSUgY2hhbmNlIHRvIGhpZGUgYSBjZWxsXG4gICAgICB9KTtcbiAgICB9XG4gICAgXG4gICAgcm93cy5wdXNoKHJvdyk7XG4gIH1cbiAgcmV0dXJuIHJvd3M7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVTaW0oYywgZ2V0RGVsYXksIG9uQ2hhbmdlLCBvbldvcmspIHtcbiAgY29uc3QgemVybyA9IHt9O1xuICBjLmlucHV0cy5mb3JFYWNoKChuKSA9PiB7XG4gICAgemVyb1tuXSA9IDA7XG4gIH0pO1xuICBjb25zdCB2YWxzID0gZXZhbHVhdGUoYywgemVybyk7XG4gIGNvbnN0IHRpbWVycyA9IC8qIEBfX1BVUkVfXyAqLyBuZXcgTWFwKCk7XG4gIGNvbnN0IGNvbnN1bWVycyA9IHt9O1xuICBsZXQgZGlzcG9zZWQgPSBmYWxzZTtcbiAgYy5nYXRlcy5mb3JFYWNoKChnKSA9PiBnLmlucy5mb3JFYWNoKChuKSA9PiB7XG4gICAgKGNvbnN1bWVyc1tuXSA9IGNvbnN1bWVyc1tuXSB8fCBbXSkucHVzaChnKTtcbiAgfSkpO1xuICBjb25zdCB3b3JrID0gKGcpID0+IHtcbiAgICBpZiAoIWRpc3Bvc2VkICYmIG9uV29yaykgb25Xb3JrKGcpO1xuICB9O1xuICBmdW5jdGlvbiBzZXQoc2lnLCB2KSB7XG4gICAgaWYgKGRpc3Bvc2VkIHx8IHZhbHNbc2lnXSA9PT0gdikgcmV0dXJuO1xuICAgIHZhbHNbc2lnXSA9IHY7XG4gICAgb25DaGFuZ2Uoc2lnLCB2KTtcbiAgICAoY29uc3VtZXJzW3NpZ10gfHwgW10pLmZvckVhY2gocmVldmFsKTtcbiAgfVxuICBmdW5jdGlvbiByZWV2YWwoZykge1xuICAgIGlmIChkaXNwb3NlZCkgcmV0dXJuO1xuICAgIGNvbnN0IHRhcmdldCA9ICtHQVRFU1tnLnR5cGVdLmZuKGcuaW5zLm1hcCgoeCkgPT4gISF2YWxzW3hdKSk7XG4gICAgY29uc3QgcGVuZCA9IHRpbWVycy5nZXQoZyk7XG4gICAgaWYgKHBlbmQpIHtcbiAgICAgIGNsZWFyVGltZW91dChwZW5kLmgpO1xuICAgICAgdGltZXJzLmRlbGV0ZShnKTtcbiAgICB9XG4gICAgaWYgKHRhcmdldCA9PT0gdmFsc1tnLm91dF0pIHtcbiAgICAgIGlmIChwZW5kKSB3b3JrKGcpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBjb25zdCBkID0gZ2V0RGVsYXkoKTtcbiAgICBpZiAoIShkID4gMCkpIHtcbiAgICAgIHNldChnLm91dCwgdGFyZ2V0KTtcbiAgICAgIGlmIChwZW5kKSB3b3JrKGcpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBjb25zdCBoMiA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgdGltZXJzLmRlbGV0ZShnKTtcbiAgICAgIGlmIChkaXNwb3NlZCkgcmV0dXJuO1xuICAgICAgc2V0KGcub3V0LCB0YXJnZXQpO1xuICAgICAgd29yayhnKTtcbiAgICB9LCBkICogMWUzKTtcbiAgICB0aW1lcnMuc2V0KGcsIHsgaDogaDIsIHRhcmdldCB9KTtcbiAgICB3b3JrKGcpO1xuICB9XG4gIHJldHVybiB7XG4gICAgdmFscyxcbiAgICBzZXRJbnB1dHMocGF0Y2gpIHtcbiAgICAgIE9iamVjdC5rZXlzKHBhdGNoKS5mb3JFYWNoKChuKSA9PiBzZXQobiwgcGF0Y2hbbl0pKTtcbiAgICB9LFxuICAgIHBlbmRpbmcoKSB7XG4gICAgICByZXR1cm4gdGltZXJzLnNpemU7XG4gICAgfSxcbiAgICB3b3JraW5nKGcpIHtcbiAgICAgIGNvbnN0IHAgPSB0aW1lcnMuZ2V0KGcpO1xuICAgICAgcmV0dXJuIHAgPyBwLnRhcmdldCA6IG51bGw7XG4gICAgfSxcbiAgICBkaXNwb3NlKCkge1xuICAgICAgZGlzcG9zZWQgPSB0cnVlO1xuICAgICAgdGltZXJzLmZvckVhY2goKHApID0+IGNsZWFyVGltZW91dChwLmgpKTtcbiAgICAgIHRpbWVycy5jbGVhcigpO1xuICAgIH1cbiAgfTtcbn0iLCAiLy8gcGFja2FnZXMvbG9naWMtZ3JhcGgvc3JjL2NvcmUvcmVkdWNlLmpzXG5pbXBvcnQgeyBNQVhfR0FURV9GQU5JTiB9IGZyb20gXCIuL2NvbnN0YW50cy5qc1wiO1xuaW1wb3J0IHsgSU5WRVJUSU5HLCBCQVNFLCBJTlZFUlNFIH0gZnJvbSBcIi4vZ2F0ZXMuanNcIjtcbmltcG9ydCB7IGV2YWx1YXRlIH0gZnJvbSBcIi4vc2ltLmpzXCI7XG5pbXBvcnQgeyBzeW50aGVzaXplIH0gZnJvbSBcIi4vc3ludGhlc2l6ZS5qc1wiO1xuaW1wb3J0IHsgYXNzZW1ibGUgfSBmcm9tIFwiLi9wYXJzZXIuanNcIjtcbmV4cG9ydCBjb25zdCBjaXJjdWl0Q29zdCA9IChjKSA9PiAoeyBnYXRlczogYy5nYXRlcy5sZW5ndGgsIHBpbnM6IGMuZ2F0ZXMucmVkdWNlKChhLCBnKSA9PiBhICsgZy5pbnMubGVuZ3RoLCAwKSB9KTtcbmV4cG9ydCBmdW5jdGlvbiByZWR1Y2VTdHJ1Y3R1cmFsKGMpIHtcbiAgbGV0IGdhdGVzID0gYy5nYXRlcy5tYXAoKGcpID0+ICh7IHR5cGU6IGcudHlwZSwgaW5zOiBnLmlucy5zbGljZSgpLCBvdXQ6IGcub3V0LCBsaW5lOiAwIH0pKTtcbiAgY29uc3QgaXNPdXQgPSBuZXcgU2V0KGMub3V0cHV0cyk7XG4gIGNvbnN0IGRydiA9ICgpID0+IHtcbiAgICBjb25zdCBkID0ge307XG4gICAgZ2F0ZXMuZm9yRWFjaCgoZykgPT4ge1xuICAgICAgZFtnLm91dF0gPSBnO1xuICAgIH0pO1xuICAgIHJldHVybiBkO1xuICB9O1xuICBjb25zdCBmYW5vdXQgPSAoKSA9PiB7XG4gICAgY29uc3QgZiA9IHt9O1xuICAgIGdhdGVzLmZvckVhY2goKGcpID0+IGcuaW5zLmZvckVhY2goKHgpID0+IHtcbiAgICAgIGZbeF0gPSAoZlt4XSB8fCAwKSArIDE7XG4gICAgfSkpO1xuICAgIHJldHVybiBmO1xuICB9O1xuICBjb25zdCByZW5hbWUgPSAoZnJvbSwgdG8pID0+IGdhdGVzLmZvckVhY2goKGcpID0+IHtcbiAgICBnLmlucyA9IGcuaW5zLm1hcCgoeCkgPT4geCA9PT0gZnJvbSA/IHRvIDogeCk7XG4gIH0pO1xuICBjb25zdCBsaXZlID0gKGcpID0+IGdhdGVzLmluY2x1ZGVzKGcpO1xuICBmb3IgKGxldCBpdGVyID0gMDsgaXRlciA8IDMwMDsgaXRlcisrKSB7XG4gICAgbGV0IGNoYW5nZWQgPSBmYWxzZTtcbiAgICBnYXRlcy5mb3JFYWNoKChnKSA9PiB7XG4gICAgICBjb25zdCBiYXNlID0gQkFTRVtnLnR5cGVdO1xuICAgICAgaWYgKGJhc2UgPT09IFwiQU5EXCIgfHwgYmFzZSA9PT0gXCJPUlwiKSB7XG4gICAgICAgIGNvbnN0IHUgPSBbLi4ubmV3IFNldChnLmlucyldO1xuICAgICAgICBpZiAodS5sZW5ndGggIT09IGcuaW5zLmxlbmd0aCkge1xuICAgICAgICAgIGcuaW5zID0gdTtcbiAgICAgICAgICBjaGFuZ2VkID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoZy5pbnMubGVuZ3RoID09PSAxKSB7XG4gICAgICAgICAgZy50eXBlID0gSU5WRVJUSU5HW2cudHlwZV0gPyBcIk5PVFwiIDogXCJCVUZcIjtcbiAgICAgICAgICBjaGFuZ2VkID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmIChiYXNlID09PSBcIlhPUlwiKSB7XG4gICAgICAgIGNvbnN0IGNudCA9IHt9O1xuICAgICAgICBnLmlucy5mb3JFYWNoKCh4KSA9PiB7XG4gICAgICAgICAgY250W3hdID0gKGNudFt4XSB8fCAwKSArIDE7XG4gICAgICAgIH0pO1xuICAgICAgICBjb25zdCBvZGQgPSBPYmplY3Qua2V5cyhjbnQpLmZpbHRlcigoeCkgPT4gY250W3hdICUgMiA9PT0gMSk7XG4gICAgICAgIGlmIChvZGQubGVuZ3RoID4gMCAmJiBvZGQubGVuZ3RoICE9PSBnLmlucy5sZW5ndGgpIHtcbiAgICAgICAgICBnLmlucyA9IG9kZDtcbiAgICAgICAgICBjaGFuZ2VkID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoZy5pbnMubGVuZ3RoID09PSAxKSB7XG4gICAgICAgICAgZy50eXBlID0gZy50eXBlID09PSBcIlhOT1JcIiA/IFwiTk9UXCIgOiBcIkJVRlwiO1xuICAgICAgICAgIGNoYW5nZWQgPSB0cnVlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSk7XG4gICAgZm9yIChjb25zdCBnIG9mIGdhdGVzLnNsaWNlKCkpIHtcbiAgICAgIGlmIChnLnR5cGUgPT09IFwiQlVGXCIgJiYgIWlzT3V0LmhhcyhnLm91dCkpIHtcbiAgICAgICAgcmVuYW1lKGcub3V0LCBnLmluc1swXSk7XG4gICAgICAgIGdhdGVzID0gZ2F0ZXMuZmlsdGVyKCh4KSA9PiB4ICE9PSBnKTtcbiAgICAgICAgY2hhbmdlZCA9IHRydWU7XG4gICAgICB9XG4gICAgfVxuICAgIHtcbiAgICAgIGNvbnN0IGQgPSBkcnYoKSwgZiA9IGZhbm91dCgpO1xuICAgICAgZm9yIChjb25zdCBnIG9mIGdhdGVzLnNsaWNlKCkpIHtcbiAgICAgICAgaWYgKGcudHlwZSAhPT0gXCJOT1RcIiB8fCAhbGl2ZShnKSkgY29udGludWU7XG4gICAgICAgIGNvbnN0IGlubmVyID0gZFtnLmluc1swXV07XG4gICAgICAgIGlmICghaW5uZXIgfHwgIWxpdmUoaW5uZXIpKSBjb250aW51ZTtcbiAgICAgICAgaWYgKGlubmVyLnR5cGUgPT09IFwiTk9UXCIpIHtcbiAgICAgICAgICBnLnR5cGUgPSBcIkJVRlwiO1xuICAgICAgICAgIGcuaW5zID0gW2lubmVyLmluc1swXV07XG4gICAgICAgICAgY2hhbmdlZCA9IHRydWU7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKElOVkVSU0VbaW5uZXIudHlwZV0gJiYgIWlzT3V0Lmhhcyhpbm5lci5vdXQpICYmIGZbaW5uZXIub3V0XSA9PT0gMSkge1xuICAgICAgICAgIGcudHlwZSA9IElOVkVSU0VbaW5uZXIudHlwZV07XG4gICAgICAgICAgZy5pbnMgPSBpbm5lci5pbnMuc2xpY2UoKTtcbiAgICAgICAgICBnYXRlcyA9IGdhdGVzLmZpbHRlcigoeCkgPT4geCAhPT0gaW5uZXIpO1xuICAgICAgICAgIGNoYW5nZWQgPSB0cnVlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHtcbiAgICAgIGNvbnN0IGQgPSBkcnYoKSwgZiA9IGZhbm91dCgpO1xuICAgICAgZm9yIChjb25zdCBnIG9mIGdhdGVzLnNsaWNlKCkpIHtcbiAgICAgICAgY29uc3QgYmFzZSA9IEJBU0VbZy50eXBlXTtcbiAgICAgICAgaWYgKCFiYXNlIHx8ICFsaXZlKGcpKSBjb250aW51ZTtcbiAgICAgICAgbGV0IGFnYWluID0gdHJ1ZTtcbiAgICAgICAgd2hpbGUgKGFnYWluKSB7XG4gICAgICAgICAgYWdhaW4gPSBmYWxzZTtcbiAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGcuaW5zLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCB4ID0gZy5pbnNbaV0sIGlubmVyID0gZFt4XTtcbiAgICAgICAgICAgIGlmICghaW5uZXIgfHwgIWxpdmUoaW5uZXIpIHx8IGlubmVyID09PSBnIHx8IGlubmVyLnR5cGUgIT09IGJhc2UpIGNvbnRpbnVlO1xuICAgICAgICAgICAgaWYgKGlzT3V0Lmhhcyh4KSB8fCBmW3hdICE9PSAxKSBjb250aW51ZTtcbiAgICAgICAgICAgIGNvbnN0IG1lcmdlZCA9IGcuaW5zLnNsaWNlKDAsIGkpLmNvbmNhdChpbm5lci5pbnMsIGcuaW5zLnNsaWNlKGkgKyAxKSk7XG4gICAgICAgICAgICBpZiAobWVyZ2VkLmxlbmd0aCA+IE1BWF9HQVRFX0ZBTklOKSBjb250aW51ZTtcbiAgICAgICAgICAgIGcuaW5zID0gbWVyZ2VkO1xuICAgICAgICAgICAgZ2F0ZXMgPSBnYXRlcy5maWx0ZXIoKHkpID0+IHkgIT09IGlubmVyKTtcbiAgICAgICAgICAgIGZbeF0gPSAwO1xuICAgICAgICAgICAgY2hhbmdlZCA9IHRydWU7XG4gICAgICAgICAgICBhZ2FpbiA9IHRydWU7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAge1xuICAgICAgY29uc3QgZCA9IGRydigpLCBmID0gZmFub3V0KCk7XG4gICAgICBmb3IgKGNvbnN0IGcgb2YgZ2F0ZXMuc2xpY2UoKSkge1xuICAgICAgICBjb25zdCBiYXNlID0gQkFTRVtnLnR5cGVdO1xuICAgICAgICBpZiAoYmFzZSAhPT0gXCJBTkRcIiAmJiBiYXNlICE9PSBcIk9SXCIgfHwgIWxpdmUoZykpIGNvbnRpbnVlO1xuICAgICAgICBjb25zdCBkdWFsID0gYmFzZSA9PT0gXCJBTkRcIiA/IFwiT1JcIiA6IFwiQU5EXCI7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZy5pbnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICBjb25zdCB4ID0gZy5pbnNbaV0sIGlubmVyID0gZFt4XTtcbiAgICAgICAgICBpZiAoIWlubmVyIHx8ICFsaXZlKGlubmVyKSB8fCBpbm5lci50eXBlICE9PSBkdWFsIHx8IGlzT3V0Lmhhcyh4KSB8fCBmW3hdICE9PSAxKSBjb250aW51ZTtcbiAgICAgICAgICBjb25zdCBvdGhlcnMgPSBnLmlucy5maWx0ZXIoKF8sIGspID0+IGsgIT09IGkpO1xuICAgICAgICAgIGlmIChpbm5lci5pbnMuc29tZSgoeSkgPT4gb3RoZXJzLmluY2x1ZGVzKHkpKSkge1xuICAgICAgICAgICAgZy5pbnMgPSBvdGhlcnM7XG4gICAgICAgICAgICBnYXRlcyA9IGdhdGVzLmZpbHRlcigoeSkgPT4geSAhPT0gaW5uZXIpO1xuICAgICAgICAgICAgY2hhbmdlZCA9IHRydWU7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAge1xuICAgICAgY29uc3Qgc2VlbiA9IC8qIEBfX1BVUkVfXyAqLyBuZXcgTWFwKCk7XG4gICAgICBmb3IgKGNvbnN0IGcgb2YgZ2F0ZXMuc2xpY2UoKSkge1xuICAgICAgICBpZiAoIWxpdmUoZykpIGNvbnRpbnVlO1xuICAgICAgICBjb25zdCBrZXkgPSBnLnR5cGUgKyBcInxcIiArIFsuLi5nLmluc10uc29ydCgpLmpvaW4oXCIsXCIpO1xuICAgICAgICBjb25zdCBwcmV2ID0gc2Vlbi5nZXQoa2V5KTtcbiAgICAgICAgaWYgKCFwcmV2KSB7XG4gICAgICAgICAgc2Vlbi5zZXQoa2V5LCBnKTtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuICAgICAgICBsZXQga2VlcCA9IHByZXYsIGRyb3AgPSBnO1xuICAgICAgICBpZiAoaXNPdXQuaGFzKGRyb3Aub3V0KSkge1xuICAgICAgICAgIGlmIChpc091dC5oYXMoa2VlcC5vdXQpKSBjb250aW51ZTtcbiAgICAgICAgICBrZWVwID0gZztcbiAgICAgICAgICBkcm9wID0gcHJldjtcbiAgICAgICAgICBzZWVuLnNldChrZXksIGtlZXApO1xuICAgICAgICB9XG4gICAgICAgIHJlbmFtZShkcm9wLm91dCwga2VlcC5vdXQpO1xuICAgICAgICBnYXRlcyA9IGdhdGVzLmZpbHRlcigoeSkgPT4geSAhPT0gZHJvcCk7XG4gICAgICAgIGNoYW5nZWQgPSB0cnVlO1xuICAgICAgfVxuICAgIH1cbiAgICB7XG4gICAgICBjb25zdCBmID0gZmFub3V0KCksIG4wID0gZ2F0ZXMubGVuZ3RoO1xuICAgICAgZ2F0ZXMgPSBnYXRlcy5maWx0ZXIoKGcpID0+IGlzT3V0LmhhcyhnLm91dCkgfHwgZltnLm91dF0pO1xuICAgICAgaWYgKGdhdGVzLmxlbmd0aCAhPT0gbjApIGNoYW5nZWQgPSB0cnVlO1xuICAgIH1cbiAgICBpZiAoIWNoYW5nZWQpIGJyZWFrO1xuICB9XG4gIHJldHVybiBhc3NlbWJsZShnYXRlcywgYy5pbnB1dHMpO1xufVxuZXhwb3J0IGZ1bmN0aW9uIHZlcmlmeUVxdWl2YWxlbnQoYywgY2lyY3VpdCwgY29uc3RzLCBhbGwpIHtcbiAgY29uc3RzID0gY29uc3RzIHx8IHt9O1xuICBjb25zdCBjaGVjayA9IChpbnMsIHJlZikgPT4ge1xuICAgIGNvbnN0IHYgPSBjaXJjdWl0ID8gZXZhbHVhdGUoY2lyY3VpdCwgaW5zKSA6IHt9O1xuICAgIHJldHVybiBjLm91dHB1dHMuZXZlcnkoKG8pID0+IChvIGluIGNvbnN0cyA/IGNvbnN0c1tvXSA6IHZbb10pID09PSByZWZbb10pO1xuICB9O1xuICBpZiAoYWxsKSB7XG4gICAgcmV0dXJuIGFsbC5ldmVyeSgocm93KSA9PiB7XG4gICAgICBjb25zdCBpbnMgPSB7fTtcbiAgICAgIGMuaW5wdXRzLmZvckVhY2goKHgpID0+IHtcbiAgICAgICAgaW5zW3hdID0gcm93W3hdO1xuICAgICAgfSk7XG4gICAgICByZXR1cm4gY2hlY2soaW5zLCByb3cpO1xuICAgIH0pID8gXCJleGFjdFwiIDogXCJGQUlMRURcIjtcbiAgfVxuICBsZXQgc2VlZCA9IDEyMzQ1Njc7XG4gIGNvbnN0IHJuZCA9ICgpID0+IChzZWVkID0gTWF0aC5pbXVsKHNlZWQsIDE2NjQ1MjUpICsgMTAxMzkwNDIyMyA+Pj4gMCkgLyA0Mjk0OTY3Mjk2O1xuICBmb3IgKGxldCBrID0gMDsgayA8IDQwOTY7IGsrKykge1xuICAgIGNvbnN0IGlucyA9IHt9O1xuICAgIGMuaW5wdXRzLmZvckVhY2goKHgpID0+IHtcbiAgICAgIGluc1t4XSA9IHJuZCgpIDwgMC41ID8gMCA6IDE7XG4gICAgfSk7XG4gICAgaWYgKCFjaGVjayhpbnMsIGV2YWx1YXRlKGMsIGlucykpKSByZXR1cm4gXCJGQUlMRURcIjtcbiAgfVxuICByZXR1cm4gXCJzYW1wbGVkXCI7XG59XG5leHBvcnQgZnVuY3Rpb24gcmVkdWNlQ2lyY3VpdChjLCBhbGwsIG1ldGhvZCkge1xuICBjb25zdCBjYW5kcyA9IFtdO1xuICBjb25zdCBhZGQgPSAobSkgPT4ge1xuICAgIGNvbnN0IHIgPSBtID09PSBcInN0cnVjdHVyYWxcIiA/IHsgY2lyY3VpdDogcmVkdWNlU3RydWN0dXJhbChjKSwgY29uc3RzOiB7fSB9IDogc3ludGhlc2l6ZShjLCBhbGwsIG0pO1xuICAgIHIubWV0aG9kID0gbTtcbiAgICByLmFmdGVyID0gci5jaXJjdWl0ID8gY2lyY3VpdENvc3Qoci5jaXJjdWl0KSA6IHsgZ2F0ZXM6IDAsIHBpbnM6IDAgfTtcbiAgICBjYW5kcy5wdXNoKHIpO1xuICB9O1xuICBpZiAobWV0aG9kID09PSBcImJlc3RcIikge1xuICAgIGFkZChcInN0cnVjdHVyYWxcIik7XG4gICAgaWYgKGFsbCkgW1wic29wXCIsIFwicG9zXCIsIFwibmFuZFwiLCBcIm5vclwiXS5mb3JFYWNoKGFkZCk7XG4gIH0gZWxzZSBhZGQobWV0aG9kKTtcbiAgY2FuZHMuc29ydCgoYSwgYikgPT4gYS5hZnRlci5nYXRlcyAtIGIuYWZ0ZXIuZ2F0ZXMgfHwgYS5hZnRlci5waW5zIC0gYi5hZnRlci5waW5zKTtcbiAgY29uc3QgYmVzdCA9IGNhbmRzWzBdO1xuICBiZXN0LmJlZm9yZSA9IGNpcmN1aXRDb3N0KGMpO1xuICBiZXN0LnZlcmlmaWVkID0gdmVyaWZ5RXF1aXZhbGVudChjLCBiZXN0LmNpcmN1aXQsIGJlc3QuY29uc3RzLCBhbGwpO1xuICByZXR1cm4gYmVzdDtcbn1cblxuIiwgIi8vIHBhY2thZ2VzL2xvZ2ljLWdyYXBoL3NyYy91aS9kb20uanNcbmltcG9ydCAqIGFzIGltcG9ydF9vYnNpZGlhbjQgZnJvbSBcIm9ic2lkaWFuXCI7XG5leHBvcnQgY29uc3QgU1ZHTlMgPSBcImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCI7XG5leHBvcnQgZnVuY3Rpb24gaCh0YWcsIGNscywgcGFyZW50LCB0ZXh0KSB7XG4gIGNvbnN0IGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KHRhZyk7XG4gIGlmIChjbHMpIGUuY2xhc3NOYW1lID0gY2xzO1xuICBpZiAodGV4dCAhPT0gdm9pZCAwKSBlLnRleHRDb250ZW50ID0gdGV4dDtcbiAgaWYgKHBhcmVudCkgcGFyZW50LmFwcGVuZENoaWxkKGUpO1xuICByZXR1cm4gZTtcbn1cbmV4cG9ydCBmdW5jdGlvbiBzKHRhZywgYXR0cnMsIHBhcmVudCwgdGV4dCkge1xuICBjb25zdCBlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudE5TKFNWR05TLCB0YWcpO1xuICBmb3IgKGNvbnN0IGsgaW4gYXR0cnMpIGUuc2V0QXR0cmlidXRlKGssIGF0dHJzW2tdKTtcbiAgaWYgKHRleHQgIT09IHZvaWQgMCkgZS50ZXh0Q29udGVudCA9IHRleHQ7XG4gIGlmIChwYXJlbnQpIHBhcmVudC5hcHBlbmRDaGlsZChlKTtcbiAgcmV0dXJuIGU7XG59XG5leHBvcnQgZnVuY3Rpb24gY2xpY2thYmxlKGVsLCBvbkFjdGl2YXRlKSB7XG4gIGVsLnNldEF0dHJpYnV0ZShcInRhYmluZGV4XCIsIFwiMFwiKTtcbiAgZWwuc2V0QXR0cmlidXRlKFwicm9sZVwiLCBcImJ1dHRvblwiKTtcbiAgZWwuYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIG9uQWN0aXZhdGUpO1xuICBlbC5hZGRFdmVudExpc3RlbmVyKFwia2V5ZG93blwiLCAoZXZ0KSA9PiB7XG4gICAgaWYgKGV2dC5rZXkgPT09IFwiRW50ZXJcIiB8fCBldnQua2V5ID09PSBcIiBcIikge1xuICAgICAgZXZ0LnByZXZlbnREZWZhdWx0KCk7XG4gICAgICBvbkFjdGl2YXRlKGV2dCk7XG4gICAgfVxuICB9KTtcbiAgcmV0dXJuIGVsO1xufVxuZXhwb3J0IGNvbnN0IGxhdGVyID0gKGZuKSA9PiB0eXBlb2YgcmVxdWVzdEFuaW1hdGlvbkZyYW1lID09PSBcImZ1bmN0aW9uXCIgPyByZXF1ZXN0QW5pbWF0aW9uRnJhbWUoZm4pIDogc2V0VGltZW91dChmbiwgMCk7XG5leHBvcnQgZnVuY3Rpb24gbWF0aChsYXRleCwgcGFyZW50KSB7XG4gIGlmICh0eXBlb2YgaW1wb3J0X29ic2lkaWFuNC5yZW5kZXJNYXRoID09PSBcImZ1bmN0aW9uXCIpIHBhcmVudC5hcHBlbmRDaGlsZCgoMCwgaW1wb3J0X29ic2lkaWFuNC5yZW5kZXJNYXRoKShsYXRleCwgZmFsc2UpKTtcbiAgZWxzZSBwYXJlbnQuYXBwZW5kQ2hpbGQoZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUobGF0ZXgpKTtcbn1cblxuIiwgIi8vIHBhY2thZ2VzL2xvZ2ljLWdyYXBoL3NyYy91aS9jb3B5LmpzXG5pbXBvcnQgeyBOb3RpY2UgfSBmcm9tIFwib2JzaWRpYW5cIjtcbmltcG9ydCB7IG5tIH0gZnJvbSBcIi4uL2NvcmUvbGF0ZXguanNcIjtcbmltcG9ydCAqIGFzIGltcG9ydF9vYnNpZGlhbjMgZnJvbSBcIm9ic2lkaWFuXCI7XG5leHBvcnQgZnVuY3Rpb24gdG9MYXRleFNvdXJjZShleHBycykge1xuICByZXR1cm4gZXhwcnMubWFwKChlKSA9PiB7XG4gICAgY29uc3QgbGluZXMgPSBbXTtcbiAgICBpZiAoZS5yYXcgJiYgZS5yYXcgIT09IGUubWluKSBsaW5lcy5wdXNoKGAkJCR7bm0oZS5uYW1lKX0gPSAke2UucmF3fSQkYCk7XG4gICAgaWYgKGUubWluICE9PSBudWxsKSBsaW5lcy5wdXNoKGAkJCR7bm0oZS5uYW1lKX0gPSAke2UubWlufSQkYCk7XG4gICAgcmV0dXJuIGxpbmVzLmpvaW4oXCJcXG5cIik7XG4gIH0pLmpvaW4oXCJcXG5cIik7XG59XG5leHBvcnQgZnVuY3Rpb24gdG9NZXJtYWlkKGMpIHtcbiAgY29uc3QgaWQgPSB7fTtcbiAgYy5pbnB1dHMuZm9yRWFjaCgobikgPT4ge1xuICAgIGlkW25dID0gXCJpbl9cIiArIG47XG4gIH0pO1xuICBjLm9yZGVyLmZvckVhY2goKGcsIGkpID0+IHtcbiAgICBpZFtnLm91dF0gPSBcImdcIiArIChpICsgMSk7XG4gIH0pO1xuICBjb25zdCBvdXQgPSBbXCJmbG93Y2hhcnQgTFJcIl07XG4gIGMuaW5wdXRzLmZvckVhY2goKG4pID0+IG91dC5wdXNoKGAgICR7aWRbbl19KFske259XSlgKSk7XG4gIGMub3JkZXIuZm9yRWFjaCgoZykgPT4gb3V0LnB1c2goYCAgJHtpZFtnLm91dF19WyR7Zy50eXBlfV1gKSk7XG4gIGMub3V0cHV0cy5mb3JFYWNoKChuKSA9PiBvdXQucHVzaChgICBvdXRfJHtufShbJHtufV0pYCkpO1xuICBjLm9yZGVyLmZvckVhY2goKGcpID0+IGcuaW5zLmZvckVhY2goKG4pID0+IG91dC5wdXNoKGMuZHJpdmVyW25dID8gYCAgJHtpZFtuXX0gLS0+fCR7bn18ICR7aWRbZy5vdXRdfWAgOiBgICAke2lkW25dfSAtLT4gJHtpZFtnLm91dF19YCkpKTtcbiAgYy5vdXRwdXRzLmZvckVhY2goKG4pID0+IG91dC5wdXNoKGAgICR7aWRbbl19IC0tPiBvdXRfJHtufWApKTtcbiAgcmV0dXJuIFwiYGBgbWVybWFpZFxcblwiICsgb3V0LmpvaW4oXCJcXG5cIikgKyBcIlxcbmBgYFwiO1xufVxuZXhwb3J0IGZ1bmN0aW9uIGNvcHkodGV4dCkge1xuICBjb25zdCBkb25lID0gKCkgPT4gbmV3IGltcG9ydF9vYnNpZGlhbjMuTm90aWNlKFwiQ29waWVkIHRvIGNsaXBib2FyZFwiKTtcbiAgaWYgKHR5cGVvZiBuYXZpZ2F0b3IgIT09IFwidW5kZWZpbmVkXCIgJiYgbmF2aWdhdG9yLmNsaXBib2FyZCkgbmF2aWdhdG9yLmNsaXBib2FyZC53cml0ZVRleHQodGV4dCkudGhlbihkb25lKTtcbiAgZWxzZSBkb25lKCk7XG59XG5cbiIsICIvLyBwYWNrYWdlcy9sb2dpYy1ncmFwaC9zcmMvdWkvaGVscC5qc1xuaW1wb3J0IHsgaCB9IGZyb20gXCIuL2RvbS5qc1wiO1xuaW1wb3J0IHsgY29weSB9IGZyb20gXCIuL2NvcHkuanNcIjtcbmltcG9ydCB7IHJlbmRlckJsb2NrIH0gZnJvbSBcIi4vYmxvY2suanNcIjtcbmV4cG9ydCBjb25zdCBIQUxGX0FEREVSID0gXCIoYSxiKSBYT1IgKHN1bSlcXG4oYSxiKSBBTkQgKGNhcnJ5KVwiO1xuZXhwb3J0IGNvbnN0IEhFTFAgPSBbXG4gIHsgdGl0bGU6IFwiR2F0ZXNcIiwgbm90ZTogXCJPbmUgZ2F0ZSBwZXIgbGluZTogKGlucHV0cykgR0FURSAob3V0cHV0KS4gVXAgdG8gNiBpbnB1dHMgcGVyIGdhdGUuXCIsIGl0ZW1zOiBbXG4gICAgW1wiQU5EXCIsIFwiT3V0cHV0IGlzIDEgb25seSB3aGVuIGV2ZXJ5IGlucHV0IGlzIDEuXCIsIFwiKGEsYikgQU5EICh5KVwiXSxcbiAgICBbXCJPUlwiLCBcIk91dHB1dCBpcyAxIHdoZW4gYXQgbGVhc3Qgb25lIGlucHV0IGlzIDEuXCIsIFwiKGEsYikgT1IgKHkpXCJdLFxuICAgIFtcIk5BTkRcIiwgXCJBTkQgZm9sbG93ZWQgYnkgTk9ULlwiLCBcIihhLGIpIE5BTkQgKHkpXCJdLFxuICAgIFtcIk5PUlwiLCBcIk9SIGZvbGxvd2VkIGJ5IE5PVC5cIiwgXCIoYSxiKSBOT1IgKHkpXCJdLFxuICAgIFtcIlhPUlwiLCBcIk91dHB1dCBpcyAxIHdoZW4gYW4gb2RkIG51bWJlciBvZiBpbnB1dHMgYXJlIDEuXCIsIFwiKGEsYikgWE9SICh5KVwiXSxcbiAgICBbXCJYTk9SXCIsIFwiT3V0cHV0IGlzIDEgd2hlbiBhbiBldmVuIG51bWJlciBvZiBpbnB1dHMgYXJlIDEuXCIsIFwiKGEsYikgWE5PUiAoeSlcIl0sXG4gICAgW1wiTk9UXCIsIFwiSW52ZXJ0cyBpdHMgc2luZ2xlIGlucHV0LlwiLCBcIihhKSBOT1QgKHkpXCJdLFxuICAgIFtcIkJVRlwiLCBcIkNvcGllcyBpdHMgc2luZ2xlIGlucHV0IChhIGJ1ZmZlcikuXCIsIFwiKGEpIEJVRiAoeSlcIl1cbiAgXSB9LFxuICB7IHRpdGxlOiBcIldyaXRpbmcgY2lyY3VpdHNcIiwgaXRlbXM6IFtcbiAgICBbXCJTZXZlcmFsIGdhdGVzXCIsIFwiU2lnbmFscyBubyBnYXRlIGRyaXZlcyBhcmUgdGhlIGlucHV0cy4gU2lnbmFscyBub3RoaW5nIHVzZXMgYXJlIHRoZSBvdXRwdXRzLiBOYW1lcyBtYXkgY29udGFpbiBsZXR0ZXJzLCBkaWdpdHMgYW5kIF8uXCIsIEhBTEZfQURERVJdLFxuICAgIFtcIldpZGUgZ2F0ZXNcIiwgXCJHYXRlcyBjYW4gdGFrZSAyIHRvIDYgaW5wdXRzLlwiLCBcIihhLGIsYyxkKSBBTkQgKHkpXCJdLFxuICAgIFtcIkNvbW1lbnRzXCIsIFwiRXZlcnl0aGluZyBhZnRlciAjIG9yIC8vIGlzIGlnbm9yZWQuXCIsIFwiKGEsYikgQU5EICh5KSAgIyBhIGNvbW1lbnRcXG4vLyBhbm90aGVyIGNvbW1lbnRcIl1cbiAgXSB9LFxuICB7IHRpdGxlOiBcIkRpcmVjdGl2ZXMgKGZpcnN0IGxpbmVzIG9mIGEgYmxvY2spXCIsIGl0ZW1zOiBbXG4gICAgW1wiQGhlbHBcIiwgXCJTaG93cyB0aGlzIHJlZmVyZW5jZSBhYm92ZSB0aGUgY2lyY3VpdC5cIiwgXCJAaGVscFxcbihhLGIpIEFORCAoeSlcIl0sXG4gICAgW1wiQGhpZGUgLyBAc2hvd1wiLCBcIkhpZGUgb3Igc2hvdzogdGFibGUsIGV4cHIsIGRpYWdyYW0sIGttYXAsIHRpbWluZy5cIiwgXCJAaGlkZSB0YWJsZVxcbkBzaG93IGttYXBcXG4oYSxiLGMpIE9SICh5KVwiXSxcbiAgICBbXCJAc2ltcGxpZnkgLyBAcmVkdWNlXCIsIFwiRHJhd3MgYSByZWR1Y2VkIGNpcmN1aXQgYW5kIGNoZWNrcyBpdCBpcyBlcXVpdmFsZW50LiBNZXRob2RzOiBzdHJ1Y3R1cmFsLCBiZXN0LCBzb3AsIHBvcywgbmFuZCwgbm9yLCBvZmYuXCIsIFwiQHNpbXBsaWZ5IHN0cnVjdHVyYWxcXG4oYSkgTk9UIChuMSlcXG4objEpIE5PVCAobjIpXFxuKG4yLGIpIEFORCAoeSlcIl0sXG4gICAgW1wiQHNpbXBsaWZ5IG5hbmRcIiwgXCJSZWJ1aWxkcyB0aGUgZnVuY3Rpb24gYXMgTkFORC1OQU5EIGZyb20gdGhlIG1pbmltYWwgY292ZXIgKGNhbiBiZSBsYXJnZXIgdGhhbiB0aGUgb3JpZ2luYWwpLlwiLCBcIkBzaW1wbGlmeSBuYW5kXFxuKGEsYikgQU5EICh4KVxcbihiLGMpIEFORCAoeTEpXFxuKHgseTEpIE9SICh5KVwiXSxcbiAgICBbXCJAYnViYmxlc1wiLCBcIkJ1YmJsZSBwdXNoaW5nOiBnYXRlcyBhcmUgZHJhd24gd2l0aCB0aGVpciBEZSBNb3JnYW4gc3ltYm9sIHNvIGJ1YmJsZXMgbWF0Y2guIENsaWNrIGEgZ2F0ZSB0byBmbGlwIGl0IGJ5IGhhbmQuXCIsIFwiQGJ1YmJsZXNcXG4oYSxiKSBOQU5EIChwKVxcbihjLGQpIE5BTkQgKHEpXFxuKHAscSkgTkFORCAoeSlcIl0sXG4gICAgW1wiQGNvbXBhY3RcIiwgXCJNZXJnZXMgdHJ1dGgtdGFibGUgcm93cyB0aGF0IGRvIG5vdCBkZXBlbmQgb24gc29tZSBpbnB1dHMgKHNob3duIGFzIFgpLlwiLCBcIkBjb21wYWN0XFxuKGEsYikgQU5EICh4KVxcbih4LGMpIE9SICh5KVwiXSxcbiAgICBbXCJAZGVsYXlcIiwgJ1NlY29uZHMgb2YgZGVsYXkgcGVyIGdhdGUgKDAgdG8gMzApLCBcInJhbmRvbVwiICgwIHRvIDUgcyksIG9yIG9mZi4nLCBcIkBkZWxheSAwLjVcXG4oYSxiKSBBTkQgKGMpXFxuKGMpIE5PVCAoeSlcIl0sXG4gICAgW1wiQHRpbWluZy1ncmFwaFwiLCBcIkRlbGF5cyBvbiwgd2l0aCB0aGUgdGltaW5nIGdyYXBoICh3YXZlZm9ybXMpLlwiLCBcIkB0aW1pbmctZ3JhcGhcXG5AZGVsYXkgMC41XFxuKGEsYikgQU5EIChjKVxcbihjLGIpIFhPUiAoeSlcIl0sXG4gICAgW1wiQHRpbWluZy1hbmltYXRpb25cIiwgXCJEZWxheXMgb24sIHdpdGggYml0cyB0cmF2ZWxsaW5nIGFsb25nIHRoZSB3aXJlcyBhbmQgZ2F0ZSBsYW1wcyAoZ3JlZW4gPSAxLCByZWQvb3JhbmdlID0gMCkuXCIsIFwiQHRpbWluZy1hbmltYXRpb25cXG5AZGVsYXkgMVxcbihhLGIpIEFORCAoYylcXG4oYyxiKSBYT1IgKHkpXCJdLFxuICAgIFtcIkB0aW1pbmctYm90aFwiLCBcIkdyYXBoIGFuZCBhbmltYXRpb24gdG9nZXRoZXIuXCIsIFwiQHRpbWluZy1ib3RoXFxuQGRlbGF5IDFcXG4oYSxiKSBBTkQgKGMpXFxuKGMsYikgWE9SICh5KVwiXVxuICBdIH0sXG4gIHsgdGl0bGU6IFwiVGhpbmdzIHlvdSBjYW4gY2xpY2tcIiwgaXRlbXM6IFtcbiAgICBbXCJJbnB1dCBib3hlc1wiLCBcIkNsaWNrIGEgYm94IG9uIHRoZSBsZWZ0IG9mIHRoZSBkaWFncmFtIHRvIGZsaXAgdGhhdCBpbnB1dCBiZXR3ZWVuIDAgYW5kIDEuXCIsIG51bGxdLFxuICAgIFtcIlRydXRoLXRhYmxlIHJvd3NcIiwgXCJDbGljayBhIHJvdyB0byBzZXQgdGhlIGlucHV0cyB0byB0aGF0IHJvdy4gVGhlIGFjdGl2ZSByb3cgaXMgaGlnaGxpZ2h0ZWQuXCIsIG51bGxdLFxuICAgIFtcIkthcm5hdWdoIGNlbGxzXCIsIFwiQ2xpY2sgYSBjZWxsIHRvIHNldCB0aGUgaW5wdXRzIHRvIHRoYXQgY2VsbC4gQ29sb3VyZWQgb3V0bGluZXMgYXJlIHRoZSBncm91cHM7IG91dGxpbmVzIHRoYXQgc3RvcCBhdCBhbiBlZGdlIHdyYXAgYXJvdW5kLlwiLCBudWxsXSxcbiAgICBbXCJHYXRlcyBpbiBAYnViYmxlcyB2aWV3XCIsICdDbGljayBhIGdhdGUgdG8gZmxpcCBpdCBiZXR3ZWVuIGl0cyB0d28gRGUgTW9yZ2FuIHN5bWJvbHMuIFwicmVzZXRcIiByZXN0b3JlcyB0aGUgYXV0b21hdGljIGxheW91dC4nLCBudWxsXSxcbiAgICBbXCJleHBvcnRcIiwgXCJPbiBldmVyeSBmaWd1cmU6IHNhdmUgYXMgUE5HIG9yIFNWRyBpbiB5b3VyIHZhdWx0LCBvciBjb3B5IHRoZSBQTkcuXCIsIG51bGxdLFxuICAgIFtcIkNvcHkgYnV0dG9uc1wiLCBcIkNvcHkgdGhlIHRydXRoIHRhYmxlIChNYXJrZG93biksIHRoZSBleHByZXNzaW9ucyAoTGFUZVgpIG9yIHRoZSBjaXJjdWl0IChNZXJtYWlkKS5cIiwgbnVsbF1cbiAgXSB9LFxuICB7IHRpdGxlOiBcIkNvbW1hbmRzIChDdHJsL0NtZCArIFApXCIsIGl0ZW1zOiBbXG4gICAgW1wiTG9naWMgR3JhcGg6IEluc2VydCBsb2dpYyBibG9ja1wiLCBcIkluc2VydHMgYW4gZXhhbXBsZSBibG9jay5cIiwgbnVsbF0sXG4gICAgW1wiTG9naWMgR3JhcGg6IEluc2VydCBsb2dpYyBibG9jayBmcm9tIHRlbXBsYXRlXFx1MjAyNlwiLCBcIkhhbGYgYWRkZXIsIGZ1bGwgYWRkZXIsIG11bHRpcGxleGVyLCBkZWNvZGVyLCBtYWpvcml0eSwgcGFyaXR5LCBYT1IgZnJvbSBOQU5ELlwiLCBudWxsXSxcbiAgICBbXCJMb2dpYyBHcmFwaDogV3JhcCBzZWxlY3Rpb24gaW4gbG9naWMgYmxvY2tcIiwgXCJUdXJucyB0aGUgc2VsZWN0ZWQgdGV4dCBpbnRvIGEgYmxvY2suXCIsIG51bGxdLFxuICAgIFtcIkxvZ2ljIEdyYXBoOiBJbnNlcnQgZ2F0ZSBsaW5lIC8gZGlyZWN0aXZlXCIsIFwiT25lIGNvbW1hbmQgZm9yIGVhY2ggZ2F0ZSB0eXBlIGFuZCB0aGUgY29tbW9uIGRpcmVjdGl2ZXMuXCIsIG51bGxdLFxuICAgIFtcIkltYWdlIEltcG9ydCBleHRlbnNpb25cIiwgJ09wdGlvbmFsIGV4dGVuc2lvbjogXCJJbXBvcnQgY2lyY3VpdCBmcm9tIGltYWdlXCIuJywgbnVsbF1cbiAgXSB9LFxuICB7IHRpdGxlOiBcIlNldHRpbmdzXCIsIGl0ZW1zOiBbXG4gICAgW1wiTGltaXRzXCIsIFwiTWF4IGlucHV0cyAodXAgdG8gMzIpIGFuZCBtYXggZ2F0ZXMgKHVwIHRvIDI1NikuIFRydXRoIHRhYmxlcywgS2FybmF1Z2ggbWFwcyBhbmQgc2ltcGxpZmljYXRpb24gd29yayB1cCB0byAxMiBpbnB1dHMuXCIsIG51bGxdLFxuICAgIFtcIkRpc3BsYXlcIiwgXCJTaG93IHRhYmxlIC8gZXhwcmVzc2lvbnMgLyBLYXJuYXVnaCBtYXBzIGJ5IGRlZmF1bHQsIGNvbXBhY3QgdGFibGUsIGJ1YmJsZSBwdXNoaW5nLlwiLCBudWxsXSxcbiAgICBbXCJUaW1pbmdcIiwgXCJHYXRlIGRlbGF5IGFuZCB0aGUgZGVmYXVsdCB0aW1pbmcgdmlldyAoZ3JhcGgsIGFuaW1hdGlvbiBvciBib3RoKS5cIiwgbnVsbF0sXG4gICAgW1wiR3JhcGhpYyB2YWx1ZXNcIiwgXCJIb3Jpem9udGFsIHNwYWNpbmcgaW4gcHggb3IgJSBvZiB0aGUgcGFnZSB3aWR0aCwgdmVydGljYWwgc3BhY2luZyBpbiBweC5cIiwgbnVsbF0sXG4gICAgW1wiRXhwZXJpbWVudGFsXCIsIFwiQWx3YXlzIGRyYXcgYSByZWR1Y2VkIGNpcmN1aXQsIGFuZCBjaG9vc2UgdGhlIG1ldGhvZC5cIiwgbnVsbF1cbiAgXSB9XG5dO1xuZXhwb3J0IGZ1bmN0aW9uIHJlbmRlckhlbHAocGFyZW50LCBwbHVnaW4pIHtcbiAgY29uc3Qgem9uZSA9IGgoXCJkaXZcIiwgXCJsZy1oZWxwXCIsIHBhcmVudCk7XG4gIGgoXCJkaXZcIiwgXCJsZy1oZWxwLXRpdGxlXCIsIHpvbmUsIFwiTG9naWMgR3JhcGggcmVmZXJlbmNlXCIpO1xuICBIRUxQLmZvckVhY2goKHNlYykgPT4ge1xuICAgIGNvbnN0IGJveCA9IGgoXCJkaXZcIiwgXCJsZy1oZWxwLXNlY1wiLCB6b25lKTtcbiAgICBoKFwiZGl2XCIsIFwibGctdGl0bGVcIiwgYm94LCBzZWMudGl0bGUpO1xuICAgIGlmIChzZWMubm90ZSkgaChcImRpdlwiLCBcImxnLW5vdGVcIiwgYm94LCBzZWMubm90ZSk7XG4gICAgc2VjLml0ZW1zLmZvckVhY2goKFtuYW1lLCBkZXNjLCBleGFtcGxlXSkgPT4ge1xuICAgICAgaWYgKCFleGFtcGxlKSB7XG4gICAgICAgIGNvbnN0IHJvdyA9IGgoXCJkaXZcIiwgXCJsZy1oZWxwLXJvd1wiLCBib3gpO1xuICAgICAgICBoKFwiYlwiLCBcIlwiLCByb3csIG5hbWUpO1xuICAgICAgICBoKFwic3BhblwiLCBcIlwiLCByb3csIFwiIC0gXCIgKyBkZXNjKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgY29uc3QgZGV0ID0gaChcImRldGFpbHNcIiwgXCJsZy1oZWxwLWl0ZW1cIiwgYm94KTtcbiAgICAgIGNvbnN0IHN1bSA9IGgoXCJzdW1tYXJ5XCIsIFwiXCIsIGRldCk7XG4gICAgICBoKFwiYlwiLCBcIlwiLCBzdW0sIG5hbWUpO1xuICAgICAgaChcInNwYW5cIiwgXCJcIiwgc3VtLCBcIiAtIFwiICsgZGVzYyk7XG4gICAgICBsZXQgZG9uZSA9IGZhbHNlO1xuICAgICAgZGV0LmFkZEV2ZW50TGlzdGVuZXIoXCJ0b2dnbGVcIiwgKCkgPT4ge1xuICAgICAgICBpZiAoIWRldC5vcGVuIHx8IGRvbmUpIHJldHVybjtcbiAgICAgICAgZG9uZSA9IHRydWU7XG4gICAgICAgIGgoXCJwcmVcIiwgXCJsZy1oZWxwLWNvZGVcIiwgZGV0LCBleGFtcGxlKTtcbiAgICAgICAgaChcImJ1dHRvblwiLCBcImxnLXNtYWxsXCIsIGRldCwgXCJjb3B5IGV4YW1wbGVcIikuYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IGNvcHkoXCJgYGBsb2dpY1xcblwiICsgZXhhbXBsZSArIFwiXFxuYGBgXCIpKTtcbiAgICAgICAgcmVuZGVyQmxvY2soZXhhbXBsZSwgaChcImRpdlwiLCBcImxnLWhlbHAtbGl2ZVwiLCBkZXQpLCBwbHVnaW4pO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH0pO1xufVxuXG4iLCAiLy8gcGFja2FnZXMvbG9naWMtZ3JhcGgvc3JjL2NvcmUvYnViYmxlcy5qc1xuaW1wb3J0IHsgR0FURVMgfSBmcm9tIFwiLi9nYXRlcy5qc1wiO1xuZXhwb3J0IGNvbnN0IERVQUxfU0hBUEUgPSB7IEFORDogXCJPUlwiLCBPUjogXCJBTkRcIiwgQlVGOiBcIkJVRlwiLCBYT1I6IFwiWE9SXCIgfTtcbmV4cG9ydCBjb25zdCBiYXNlUmVwID0gKGcpID0+IHtcbiAgY29uc3Qgc3AgPSBHQVRFU1tnLnR5cGVdO1xuICByZXR1cm4geyBzaGFwZTogc3Auc2hhcGUsIG91dDogK3NwLmludiwgaW5zOiBnLmlucy5tYXAoKCkgPT4gMCksIGZpeGVkOiBzcC5zaGFwZSA9PT0gXCJYT1JcIiB9O1xufTtcbmV4cG9ydCBjb25zdCBmbGlwUmVwID0gKHIpID0+IHtcbiAgci5zaGFwZSA9IERVQUxfU0hBUEVbci5zaGFwZV07XG4gIHIub3V0IF49IDE7XG4gIHIuaW5zID0gci5pbnMubWFwKChiKSA9PiBiIF4gMSk7XG59O1xuZXhwb3J0IGZ1bmN0aW9uIGJ1YmJsZUZvcm1zKGMsIGZsaXBzKSB7XG4gIGNvbnN0IHJlcHMgPSAvKiBAX19QVVJFX18gKi8gbmV3IE1hcCgpO1xuICBjLmdhdGVzLmZvckVhY2goKGcpID0+IHJlcHMuc2V0KGcsIGJhc2VSZXAoZykpKTtcbiAgY29uc3QgY29ucyA9IHt9O1xuICBjLmdhdGVzLmZvckVhY2goKGcpID0+IGcuaW5zLmZvckVhY2goKG4sIGkpID0+IHtcbiAgICAoY29uc1tuXSA9IGNvbnNbbl0gfHwgW10pLnB1c2goW2csIGldKTtcbiAgfSkpO1xuICBmb3IgKGxldCBrID0gYy5vcmRlci5sZW5ndGggLSAxOyBrID49IDA7IGstLSkge1xuICAgIGNvbnN0IGcgPSBjLm9yZGVyW2tdLCByID0gcmVwcy5nZXQoZyk7XG4gICAgaWYgKHIuZml4ZWQpIGNvbnRpbnVlO1xuICAgIGNvbnN0IGxpc3QgPSBjb25zW2cub3V0XSB8fCBbXTtcbiAgICBsZXQgb25lcyA9IDA7XG4gICAgbGlzdC5mb3JFYWNoKChbY2csIGldKSA9PiB7XG4gICAgICBvbmVzICs9IHJlcHMuZ2V0KGNnKS5pbnNbaV07XG4gICAgfSk7XG4gICAgY29uc3Qgd2FudCA9IGxpc3QubGVuZ3RoICYmIG9uZXMgKiAyID4gbGlzdC5sZW5ndGggPyAxIDogMDtcbiAgICBpZiAoci5vdXQgIT09IHdhbnQpIGZsaXBSZXAocik7XG4gIH1cbiAgaWYgKGZsaXBzKSBmbGlwcy5mb3JFYWNoKChnKSA9PiB7XG4gICAgY29uc3QgciA9IHJlcHMuZ2V0KGcpO1xuICAgIGlmIChyICYmICFyLmZpeGVkKSBmbGlwUmVwKHIpO1xuICB9KTtcbiAgcmV0dXJuIHJlcHM7XG59XG5leHBvcnQgZnVuY3Rpb24gbWF0Y2hlZEJ1YmJsZU5ldHMoYywgcmVwcykge1xuICBjb25zdCBtYXRjaGVkID0gLyogQF9fUFVSRV9fICovIG5ldyBTZXQoKTtcbiAgYy5nYXRlcy5mb3JFYWNoKChkKSA9PiB7XG4gICAgaWYgKCFyZXBzLmdldChkKS5vdXQpIHJldHVybjtcbiAgICBsZXQgbiA9IDAsIG9rID0gdHJ1ZTtcbiAgICBjLmdhdGVzLmZvckVhY2goKGcpID0+IGcuaW5zLmZvckVhY2goKHgsIGkpID0+IHtcbiAgICAgIGlmICh4ICE9PSBkLm91dCkgcmV0dXJuO1xuICAgICAgbisrO1xuICAgICAgaWYgKCFyZXBzLmdldChnKS5pbnNbaV0pIG9rID0gZmFsc2U7XG4gICAgfSkpO1xuICAgIGlmIChuICYmIG9rKSBtYXRjaGVkLmFkZChkLm91dCk7XG4gIH0pO1xuICByZXR1cm4gbWF0Y2hlZDtcbn1cblxuIiwgIi8vIHBhY2thZ2VzL2xvZ2ljLWdyYXBoL3NyYy91aS9sYXlvdXQuanNcbmltcG9ydCB7IGNsYW1wIH0gZnJvbSBcIi4uL2NvcmUvY29uc3RhbnRzLmpzXCI7XG5cbmV4cG9ydCBjb25zdCBMRUZUID0gOTA7XG5leHBvcnQgY29uc3QgR0FURV9XID0gNjQ7XG5leHBvcnQgY29uc3QgVE9QID0gMzQ7XG5leHBvcnQgY29uc3QgQlVCQkxFX1IgPSA1LjU7XG5leHBvcnQgY29uc3QgQU5JTV9NUyA9IDQ1MDtcblxuZXhwb3J0IGZ1bmN0aW9uIGdhdGVQYXRoKHNoYXBlLCBIKSB7XG4gIGNvbnN0IHIgPSBIIC8gMjtcbiAgc3dpdGNoIChzaGFwZSkge1xuICAgIGNhc2UgXCJBTkRcIjogcmV0dXJuIGBNMCwwIEgkezUyIC0gcn0gQSR7cn0sJHtyfSAwIDAgMSAkezUyIC0gcn0sJHtIfSBIMCBaYDtcbiAgICBjYXNlIFwiT1JcIjpcbiAgICBjYXNlIFwiWE9SXCI6IHJldHVybiBgTTAsMCBRMzIsMCA1Miwke3J9IFEzMiwke0h9IDAsJHtIfSBRMTQsJHtyfSAwLDAgWmA7XG4gICAgZGVmYXVsdDogcmV0dXJuIGBNMCwwIEw1Miwke3J9IEwwLCR7SH0gWmA7XG4gIH1cbn1cblxuZXhwb3J0IGNvbnN0IENIX0ZJUlNUID0gMTg7XG5leHBvcnQgY29uc3QgQ0hfU1RFUCA9IDY7XG5leHBvcnQgY29uc3QgQ0hfTUFSR0lOID0gMTQ7XG5leHBvcnQgY29uc3QgbGFuZVkgPSAobGFuZSkgPT4gNiArIDYgKiBsYW5lO1xuZXhwb3J0IGNvbnN0IGNoYW5uZWxOZWVkID0gKHRyYWNrcykgPT4gQ0hfRklSU1QgKyBDSF9TVEVQICogTWF0aC5tYXgoMCwgdHJhY2tzIC0gMSkgKyBDSF9NQVJHSU47XG5cbmV4cG9ydCBmdW5jdGlvbiBsYXlvdXQoYywgZ2VvKSB7XG4gIC8vIC4uLiAoTGVhdmUgdGhpcyBleGFjdCBzYW1lLCBubyBjaGFuZ2VzIG5lZWRlZCBoZXJlKVxuICBjb25zdCBTUCA9IDQwICsgZ2VvLnZnYXAsIEdBUCA9IGdlby52Z2FwLCBUMCA9IFRPUCArIChnZW8udG9wUGFkIHx8IDApO1xuICBjb25zdCBsZXZlbCA9IHt9LCBjeSA9IHt9O1xuICBjLmlucHV0cy5mb3JFYWNoKChuLCBpKSA9PiB7XG4gICAgbGV2ZWxbbl0gPSAwO1xuICAgIGN5W25dID0gVDAgKyBpICogU1A7XG4gIH0pO1xuICBjLm9yZGVyLmZvckVhY2goKGcpID0+IHtcbiAgICBnLmxldmVsID0gMSArIE1hdGgubWF4KC4uLmcuaW5zLm1hcCgoeCkgPT4gbGV2ZWxbeF0pKTtcbiAgICBsZXZlbFtnLm91dF0gPSBnLmxldmVsO1xuICAgIGcuSCA9IE1hdGgubWF4KDQ0LCAxNCAqIChnLmlucy5sZW5ndGggKyAxKSk7XG4gIH0pO1xuICBjb25zdCBtYXhMID0gYy5vcmRlci5sZW5ndGggPyBNYXRoLm1heCguLi5jLm9yZGVyLm1hcCgoZykgPT4gZy5sZXZlbCkpIDogMDtcbiAgY29uc3QgY29sWCA9IHt9O1xuICBmb3IgKGxldCBMID0gMTsgTCA8PSBtYXhMOyBMKyspIHtcbiAgICBjb25zdCBuZWVkID0gZ2VvLmdhcEJlZm9yZSAmJiBnZW8uZ2FwQmVmb3JlW0xdIHx8IDA7XG4gICAgY29sWFtMXSA9IEwgPT09IDEgPyBMRUZUICsgTWF0aC5tYXgoNzAsIG5lZWQpIDogY29sWFtMIC0gMV0gKyBHQVRFX1cgKyBNYXRoLm1heChnZW8uaGdhcCwgbmVlZCk7XG4gIH1cbiAgYy5vcmRlci5mb3JFYWNoKChnKSA9PiB7IGcueDAgPSBjb2xYW2cubGV2ZWxdOyB9KTtcbiAgbGV0IGJvdHRvbSA9IFQwICsgTWF0aC5tYXgoMCwgYy5pbnB1dHMubGVuZ3RoIC0gMSkgKiBTUCArIDEyO1xuICBmb3IgKGxldCBMID0gMTsgTCA8PSBtYXhMOyBMKyspIHtcbiAgICBjb25zdCBncyA9IGMub3JkZXIuZmlsdGVyKChnKSA9PiBnLmxldmVsID09PSBMKTtcbiAgICBncy5mb3JFYWNoKChnKSA9PiB7XG4gICAgICBnLndhbnQgPSBnLmlucy5yZWR1Y2UoKGEsIHgpID0+IGEgKyBjeVt4XSwgMCkgLyBnLmlucy5sZW5ndGg7XG4gICAgfSk7XG4gICAgZ3Muc29ydCgoYSwgYikgPT4gYS53YW50IC0gYi53YW50KTtcbiAgICBsZXQgcHJldkJvdHRvbSA9IC1JbmZpbml0eTtcbiAgICBncy5mb3JFYWNoKChnKSA9PiB7XG4gICAgICBjb25zdCB0b3AgPSBNYXRoLm1heChnLndhbnQgLSBnLkggLyAyLCBwcmV2Qm90dG9tICsgR0FQICsgMTQpO1xuICAgICAgZy5jeSA9IHRvcCArIGcuSCAvIDI7XG4gICAgICBwcmV2Qm90dG9tID0gdG9wICsgZy5IO1xuICAgICAgY3lbZy5vdXRdID0gZy5jeTtcbiAgICAgIGJvdHRvbSA9IE1hdGgubWF4KGJvdHRvbSwgcHJldkJvdHRvbSk7XG4gICAgfSk7XG4gIH1cbiAgbGV0IHJpZ2h0ID0gTEVGVCArIDQwO1xuICBjLm9yZGVyLmZvckVhY2goKGcpID0+IHsgcmlnaHQgPSBNYXRoLm1heChyaWdodCwgZy54MCArIEdBVEVfVyArIDE2KTsgfSk7XG4gIGMub3V0cHV0cy5mb3JFYWNoKChuKSA9PiB7XG4gICAgcmlnaHQgPSBNYXRoLm1heChyaWdodCwgYy5kcml2ZXJbbl0ueDAgKyBHQVRFX1cgKyA1MiArIG4ubGVuZ3RoICogOCArIDEyKTtcbiAgfSk7XG4gIHJldHVybiB7IGN5LCBtYXhMLCB3aWR0aDogcmlnaHQsIGhlaWdodDogYm90dG9tICsgVE9QIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB3aXJlQ2hhbm5lbChnLCBpLCBoZ2FwKSB7XG4gIGNvbnN0IG4gPSBnLmlucy5sZW5ndGgsIGF2YWlsID0gTWF0aC5tYXgoMTAsIGhnYXAgLSA2KSwgZmlyc3QgPSBNYXRoLm1pbigyMCwgYXZhaWwgLyAyKTtcbiAgY29uc3Qgc3RlcCA9IG4gPiAxID8gTWF0aC5taW4oNywgKGF2YWlsIC0gZmlyc3QpIC8gKG4gLSAxKSkgOiAwO1xuICByZXR1cm4gZy54MCAtIGZpcnN0IC0gc3RlcCAqIGk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwbGFuUm91dGVzKGMsIEwsIGhnYXApIHtcbiAgY29uc3QgYm94ZXMgPSBjLm9yZGVyLm1hcCgoZykgPT4gKHsgZywgeDA6IGcueDAgLSAyLCB4MTogZy54MCArIEdBVEVfVyArIDIsIHkwOiBnLmN5IC0gZy5IIC8gMiAtIDE0LCB5MTogZy5jeSArIGcuSCAvIDIgKyAxNiB9KSk7XG4gIGNvbnN0IHJvdXRlcyA9IG5ldyBNYXAoKTtcbiAgbGV0IGxhbmVzID0gMDtcbiAgYy5vcmRlci5mb3JFYWNoKChnKSA9PiBnLmlucy5mb3JFYWNoKChzaWcsIGkpID0+IHtcbiAgICBjb25zdCBkID0gYy5kcml2ZXJbc2lnXTtcbiAgICBjb25zdCBheCA9IGQgPyBkLngwICsgR0FURV9XIDogTEVGVCwgYXkgPSBkID8gZC5jeSA6IEwuY3lbc2lnXSwgbXggPSB3aXJlQ2hhbm5lbChnLCBpLCBoZ2FwKTtcbiAgICBpZiAoYm94ZXMuc29tZSgoYikgPT4gYi5nICE9PSBnICYmIGIuZyAhPT0gZCAmJiBiLngxID4gYXggKyAyICYmIGIueDAgPCBteCAmJiBheSA+IGIueTAgJiYgYXkgPCBiLnkxKSkge1xuICAgICAgcm91dGVzLnNldChnLm91dCArIFwiOlwiICsgaSwgeyBsYW5lOiBsYW5lcyAlIDUgfSk7XG4gICAgICBsYW5lcysrO1xuICAgIH1cbiAgfSkpO1xuICByZXR1cm4geyByb3V0ZXMsIGxhbmVzOiBNYXRoLm1pbihsYW5lcywgNSkgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHBsYW5DaGFubmVscyhjLCBMLCBwbGFuKSB7XG4gIC8vIC4uLiAoTGVhdmUgdGhpcyBleGFjdCBzYW1lLCBubyBjaGFuZ2VzIG5lZWRlZCBoZXJlKVxuICBjb25zdCBieUxldmVsID0gbmV3IE1hcCgpO1xuICBjLm9yZGVyLmZvckVhY2goKGcpID0+IHtcbiAgICBpZiAoIWJ5TGV2ZWwuaGFzKGcubGV2ZWwpKSBieUxldmVsLnNldChnLmxldmVsLCBbXSk7XG4gICAgYnlMZXZlbC5nZXQoZy5sZXZlbCkucHVzaChnKTtcbiAgfSk7XG4gIGNvbnN0IHRyYWNrT2YgPSBuZXcgTWFwKCksIHRyYWNrcyA9IHt9LCBuZXRzID0ge307XG4gIGZvciAoY29uc3QgW2x2bCwgZ2F0ZXNdIG9mIGJ5TGV2ZWwpIHtcbiAgICBjb25zdCBwZXJOZXQgPSBuZXcgTWFwKCk7XG4gICAgZ2F0ZXMuZm9yRWFjaCgoZykgPT4gZy5pbnMuZm9yRWFjaCgoc2lnLCBpKSA9PiB7XG4gICAgICBjb25zdCBrZXkgPSBnLm91dCArIFwiOlwiICsgaSwgZCA9IGMuZHJpdmVyW3NpZ10sIHJvdXRlID0gcGxhbi5yb3V0ZXMuZ2V0KGtleSk7XG4gICAgICBjb25zdCBheSA9IHJvdXRlID8gbGFuZVkocm91dGUubGFuZSkgOiBkID8gZC5jeSA6IEwuY3lbc2lnXTtcbiAgICAgIGNvbnN0IHB5ID0gZy5jeSAtIGcuSCAvIDIgKyBnLkggKiAoaSArIDEpIC8gKGcuaW5zLmxlbmd0aCArIDEpO1xuICAgICAgaWYgKCFwZXJOZXQuaGFzKHNpZykpIHBlck5ldC5zZXQoc2lnLCB7IHNpZywgbG86IEluZmluaXR5LCBoaTogLUluZmluaXR5LCBrZXlzOiBbXSwgdHJhY2s6IDAgfSk7XG4gICAgICBjb25zdCBuID0gcGVyTmV0LmdldChzaWcpO1xuICAgICAgbi5sbyA9IE1hdGgubWluKG4ubG8sIGF5LCBweSk7XG4gICAgICBuLmhpID0gTWF0aC5tYXgobi5oaSwgYXksIHB5KTtcbiAgICAgIG4ua2V5cy5wdXNoKGtleSk7XG4gICAgfSkpO1xuICAgIGNvbnN0IGxpc3QgPSBbLi4ucGVyTmV0LnZhbHVlcygpXS5zb3J0KChhLCBiKSA9PiBhLmxvIC0gYi5sbyB8fCBhLmhpIC0gYi5oaSk7XG4gICAgY29uc3QgZW5kcyA9IFtdO1xuICAgIGxpc3QuZm9yRWFjaCgobikgPT4ge1xuICAgICAgaWYgKG4uaGkgLSBuLmxvID49IDEpIHtcbiAgICAgICAgbGV0IHQgPSBlbmRzLmZpbmRJbmRleCgoZW5kKSA9PiBlbmQgPCBuLmxvIC0gNSk7XG4gICAgICAgIGlmICh0IDwgMCkge1xuICAgICAgICAgIHQgPSBlbmRzLmxlbmd0aDtcbiAgICAgICAgICBlbmRzLnB1c2goLUluZmluaXR5KTtcbiAgICAgICAgfVxuICAgICAgICBlbmRzW3RdID0gbi5oaTtcbiAgICAgICAgbi50cmFjayA9IHQ7XG4gICAgICB9XG4gICAgICBuLmtleXMuZm9yRWFjaCgoaykgPT4gdHJhY2tPZi5zZXQoaywgbi50cmFjaykpO1xuICAgIH0pO1xuICAgIHRyYWNrc1tsdmxdID0gTWF0aC5tYXgoMSwgZW5kcy5sZW5ndGgpO1xuICAgIG5ldHNbbHZsXSA9IGxpc3Q7XG4gIH1cbiAgcmV0dXJuIHsgdHJhY2tPZiwgdHJhY2tzLCBuZXRzIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzb2x2ZUdhcChjLCB2Z2FwLCB0YXJnZXRXKSB7XG4gIGNvbnN0IEwwID0gbGF5b3V0KGMsIHsgaGdhcDogOTAsIHZnYXAgfSk7XG4gIGlmIChMMC5tYXhMIDwgMikgcmV0dXJuIDkwO1xuICByZXR1cm4gY2xhbXAoOTAgKyAodGFyZ2V0VyAtIEwwLndpZHRoKSAvIChMMC5tYXhMIC0gMSksIDQwLCAxZTMpO1xufSIsICIvLyBwYWNrYWdlcy9sb2dpYy1ncmFwaC9zcmMvdWkvZXhwb3J0LWltYWdlLmpzXG5pbXBvcnQgeyBNZW51LCBOb3RpY2UgfSBmcm9tIFwib2JzaWRpYW5cIjtcbmltcG9ydCB7IGgsIFNWR05TIH0gZnJvbSBcIi4vZG9tLmpzXCI7XG5pbXBvcnQgKiBhcyBpbXBvcnRfb2JzaWRpYW41IGZyb20gXCJvYnNpZGlhblwiO1xudmFyIFNUWUxFX1BST1BTID0gW1xuICBcImZpbGxcIixcbiAgXCJmaWxsLW9wYWNpdHlcIixcbiAgXCJzdHJva2VcIixcbiAgXCJzdHJva2Utd2lkdGhcIixcbiAgXCJzdHJva2Utb3BhY2l0eVwiLFxuICBcInN0cm9rZS1saW5lam9pblwiLFxuICBcInN0cm9rZS1saW5lY2FwXCIsXG4gIFwic3Ryb2tlLWRhc2hhcnJheVwiLFxuICBcIm9wYWNpdHlcIixcbiAgXCJmb250LXNpemVcIixcbiAgXCJmb250LWZhbWlseVwiLFxuICBcImZvbnQtd2VpZ2h0XCIsXG4gIFwidGV4dC1hbmNob3JcIlxuXTtcbmV4cG9ydCBmdW5jdGlvbiBzdmdTbmFwc2hvdChzdmcpIHtcbiAgY29uc3QgY2xvbmUgPSBzdmcuY2xvbmVOb2RlKHRydWUpO1xuICBjb25zdCBzcmMgPSBbc3ZnLCAuLi5zdmcucXVlcnlTZWxlY3RvckFsbChcIipcIildLCBkc3QgPSBbY2xvbmUsIC4uLmNsb25lLnF1ZXJ5U2VsZWN0b3JBbGwoXCIqXCIpXTtcbiAgc3JjLmZvckVhY2goKGVsLCBpKSA9PiB7XG4gICAgY29uc3QgY3MgPSBnZXRDb21wdXRlZFN0eWxlKGVsKTtcbiAgICBTVFlMRV9QUk9QUy5mb3JFYWNoKChwKSA9PiB7XG4gICAgICBjb25zdCB2ID0gY3MuZ2V0UHJvcGVydHlWYWx1ZShwKTtcbiAgICAgIGlmICh2KSBkc3RbaV0uc3R5bGUuc2V0UHJvcGVydHkocCwgdik7XG4gICAgfSk7XG4gICAgZHN0W2ldLnJlbW92ZUF0dHJpYnV0ZShcImNsYXNzXCIpO1xuICB9KTtcbiAgY2xvbmUuc3R5bGUucmVtb3ZlUHJvcGVydHkoXCJtYXgtd2lkdGhcIik7XG4gIGNvbnN0IHZiID0gY2xvbmUuZ2V0QXR0cmlidXRlKFwidmlld0JveFwiKS5zcGxpdCgvXFxzKy8pLm1hcChOdW1iZXIpO1xuICBjb25zdCBiZyA9IChnZXRDb21wdXRlZFN0eWxlKGRvY3VtZW50LmJvZHkpLmdldFByb3BlcnR5VmFsdWUoXCItLWJhY2tncm91bmQtcHJpbWFyeVwiKSB8fCBcIlwiKS50cmltKCkgfHwgXCIjZmZmZmZmXCI7XG4gIGNvbnN0IHJlY3QgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50TlMoU1ZHTlMsIFwicmVjdFwiKTtcbiAgcmVjdC5zZXRBdHRyaWJ1dGUoXCJ4XCIsIDApO1xuICByZWN0LnNldEF0dHJpYnV0ZShcInlcIiwgMCk7XG4gIHJlY3Quc2V0QXR0cmlidXRlKFwid2lkdGhcIiwgdmJbMl0pO1xuICByZWN0LnNldEF0dHJpYnV0ZShcImhlaWdodFwiLCB2YlszXSk7XG4gIHJlY3Quc2V0QXR0cmlidXRlKFwiZmlsbFwiLCBiZyk7XG4gIGNsb25lLmluc2VydEJlZm9yZShyZWN0LCBjbG9uZS5maXJzdENoaWxkKTtcbiAgY2xvbmUuc2V0QXR0cmlidXRlKFwieG1sbnNcIiwgU1ZHTlMpO1xuICBjbG9uZS5zZXRBdHRyaWJ1dGUoXCJ3aWR0aFwiLCB2YlsyXSk7XG4gIGNsb25lLnNldEF0dHJpYnV0ZShcImhlaWdodFwiLCB2YlszXSk7XG4gIHJldHVybiB7IHRleHQ6IG5ldyBYTUxTZXJpYWxpemVyKCkuc2VyaWFsaXplVG9TdHJpbmcoY2xvbmUpLCB3aWR0aDogdmJbMl0sIGhlaWdodDogdmJbM10gfTtcbn1cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBzdmdUb1BuZyhzbmFwLCBzY2FsZSkge1xuICBjb25zdCB1cmwgPSBVUkwuY3JlYXRlT2JqZWN0VVJMKG5ldyBCbG9iKFtzbmFwLnRleHRdLCB7IHR5cGU6IFwiaW1hZ2Uvc3ZnK3htbDtjaGFyc2V0PXV0Zi04XCIgfSkpO1xuICB0cnkge1xuICAgIGNvbnN0IGltZyA9IG5ldyBJbWFnZSgpO1xuICAgIGF3YWl0IG5ldyBQcm9taXNlKChyZXMsIHJlaikgPT4ge1xuICAgICAgaW1nLm9ubG9hZCA9IHJlcztcbiAgICAgIGltZy5vbmVycm9yID0gKCkgPT4gcmVqKG5ldyBFcnJvcihcImNvdWxkIG5vdCByZW5kZXIgdGhlIGltYWdlXCIpKTtcbiAgICAgIGltZy5zcmMgPSB1cmw7XG4gICAgfSk7XG4gICAgY29uc3QgY2FudmFzID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImNhbnZhc1wiKTtcbiAgICBjYW52YXMud2lkdGggPSBNYXRoLnJvdW5kKHNuYXAud2lkdGggKiBzY2FsZSk7XG4gICAgY2FudmFzLmhlaWdodCA9IE1hdGgucm91bmQoc25hcC5oZWlnaHQgKiBzY2FsZSk7XG4gICAgY2FudmFzLmdldENvbnRleHQoXCIyZFwiKS5kcmF3SW1hZ2UoaW1nLCAwLCAwLCBjYW52YXMud2lkdGgsIGNhbnZhcy5oZWlnaHQpO1xuICAgIHJldHVybiBhd2FpdCBuZXcgUHJvbWlzZSgocmVzKSA9PiBjYW52YXMudG9CbG9iKHJlcywgXCJpbWFnZS9wbmdcIikpO1xuICB9IGZpbmFsbHkge1xuICAgIFVSTC5yZXZva2VPYmplY3RVUkwodXJsKTtcbiAgfVxufVxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHNhdmVUb1ZhdWx0KGFwcCwgYmFzZU5hbWUsIGV4dCwgYnVmZmVyKSB7XG4gIGNvbnN0IHN0YW1wID0gKC8qIEBfX1BVUkVfXyAqLyBuZXcgRGF0ZSgpKS50b0lTT1N0cmluZygpLnNsaWNlKDAsIDE5KS5yZXBsYWNlKC9bOlRdL2csIFwiLVwiKTtcbiAgY29uc3QgZmlsZW5hbWUgPSBgJHtiYXNlTmFtZX0tJHtzdGFtcH0uJHtleHR9YDtcbiAgbGV0IHBhdGggPSBmaWxlbmFtZTtcbiAgdHJ5IHtcbiAgICBpZiAoYXBwLmZpbGVNYW5hZ2VyICYmIGFwcC5maWxlTWFuYWdlci5nZXRBdmFpbGFibGVQYXRoRm9yQXR0YWNobWVudCkgcGF0aCA9IGF3YWl0IGFwcC5maWxlTWFuYWdlci5nZXRBdmFpbGFibGVQYXRoRm9yQXR0YWNobWVudChmaWxlbmFtZSk7XG4gIH0gY2F0Y2ggKGUpIHtcbiAgICBwYXRoID0gZmlsZW5hbWU7XG4gIH1cbiAgYXdhaXQgYXBwLnZhdWx0LmNyZWF0ZUJpbmFyeShwYXRoLCBidWZmZXIpO1xuICBuZXcgaW1wb3J0X29ic2lkaWFuNS5Ob3RpY2UoYFNhdmVkICR7cGF0aH1gKTtcbn1cbmV4cG9ydCBmdW5jdGlvbiBhZGRFeHBvcnRCdXR0b24oaGVhZCwgYXBwLCBnZXRTdmcsIGJhc2VOYW1lKSB7XG4gIGlmICghYXBwIHx8IHR5cGVvZiBpbXBvcnRfb2JzaWRpYW41Lk1lbnUgPT09IFwidW5kZWZpbmVkXCIpIHJldHVybjtcbiAgY29uc3QgYnRuID0gaChcImJ1dHRvblwiLCBcImxnLXNtYWxsXCIsIGhlYWQsIFwiZXhwb3J0XCIpO1xuICBidG4uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIChldnQpID0+IHtcbiAgICBjb25zdCBzdmcgPSBnZXRTdmcoKTtcbiAgICBpZiAoIXN2ZykgcmV0dXJuO1xuICAgIGNvbnN0IHJ1biA9IChmbikgPT4gYXN5bmMgKCkgPT4ge1xuICAgICAgdHJ5IHtcbiAgICAgICAgYXdhaXQgZm4oc3ZnU25hcHNob3Qoc3ZnKSk7XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIG5ldyBpbXBvcnRfb2JzaWRpYW41Lk5vdGljZShcIkV4cG9ydCBmYWlsZWQ6IFwiICsgZS5tZXNzYWdlKTtcbiAgICAgIH1cbiAgICB9O1xuICAgIGNvbnN0IG1lbnUgPSBuZXcgaW1wb3J0X29ic2lkaWFuNS5NZW51KCk7XG4gICAgbWVudS5hZGRJdGVtKChpKSA9PiBpLnNldFRpdGxlKFwiU2F2ZSBhcyBQTkdcIikuc2V0SWNvbihcImltYWdlXCIpLm9uQ2xpY2socnVuKGFzeW5jIChzbmFwKSA9PiB7XG4gICAgICBjb25zdCBibG9iID0gYXdhaXQgc3ZnVG9Qbmcoc25hcCwgMik7XG4gICAgICBhd2FpdCBzYXZlVG9WYXVsdChhcHAsIGJhc2VOYW1lLCBcInBuZ1wiLCBhd2FpdCBibG9iLmFycmF5QnVmZmVyKCkpO1xuICAgIH0pKSk7XG4gICAgbWVudS5hZGRJdGVtKChpKSA9PiBpLnNldFRpdGxlKFwiU2F2ZSBhcyBTVkdcIikuc2V0SWNvbihcImZpbGUtY29kZVwiKS5vbkNsaWNrKHJ1bihhc3luYyAoc25hcCkgPT4ge1xuICAgICAgYXdhaXQgc2F2ZVRvVmF1bHQoYXBwLCBiYXNlTmFtZSwgXCJzdmdcIiwgbmV3IFRleHRFbmNvZGVyKCkuZW5jb2RlKHNuYXAudGV4dCkuYnVmZmVyKTtcbiAgICB9KSkpO1xuICAgIG1lbnUuYWRkSXRlbSgoaSkgPT4gaS5zZXRUaXRsZShcIkNvcHkgUE5HIHRvIGNsaXBib2FyZFwiKS5zZXRJY29uKFwiY29weVwiKS5vbkNsaWNrKHJ1bihhc3luYyAoc25hcCkgPT4ge1xuICAgICAgY29uc3QgYmxvYiA9IGF3YWl0IHN2Z1RvUG5nKHNuYXAsIDIpO1xuICAgICAgaWYgKHR5cGVvZiBDbGlwYm9hcmRJdGVtID09PSBcInVuZGVmaW5lZFwiIHx8ICFuYXZpZ2F0b3IuY2xpcGJvYXJkIHx8ICFuYXZpZ2F0b3IuY2xpcGJvYXJkLndyaXRlKSB7XG4gICAgICAgIG5ldyBpbXBvcnRfb2JzaWRpYW41Lk5vdGljZShcIkNvcHlpbmcgaW1hZ2VzIHRvIHRoZSBjbGlwYm9hcmQgaXMgbm90IHN1cHBvcnRlZCBvbiB0aGlzIGRldmljZS5cIik7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIGF3YWl0IG5hdmlnYXRvci5jbGlwYm9hcmQud3JpdGUoW25ldyBDbGlwYm9hcmRJdGVtKHsgXCJpbWFnZS9wbmdcIjogYmxvYiB9KV0pO1xuICAgICAgbmV3IGltcG9ydF9vYnNpZGlhbjUuTm90aWNlKFwiSW1hZ2UgY29waWVkXCIpO1xuICAgIH0pKSk7XG4gICAgbWVudS5zaG93QXRNb3VzZUV2ZW50KGV2dCk7XG4gIH0pO1xufVxuXG4iLCAiLy8gcGFja2FnZXMvbG9naWMtZ3JhcGgvc3JjL3VpL2RpYWdyYW0uanNcbmltcG9ydCB7IGNyZWF0ZVNpbSB9IGZyb20gXCIuLi9jb3JlL3NpbS5qc1wiO1xuaW1wb3J0IHsgYnViYmxlRm9ybXMsIG1hdGNoZWRCdWJibGVOZXRzLCBiYXNlUmVwIH0gZnJvbSBcIi4uL2NvcmUvYnViYmxlcy5qc1wiO1xuaW1wb3J0IHsgbGF5b3V0LCBwbGFuUm91dGVzLCBwbGFuQ2hhbm5lbHMsIGNoYW5uZWxOZWVkLCBHQVRFX1csIExFRlQsIEJVQkJMRV9SLCBDSF9GSVJTVCwgQ0hfU1RFUCwgZ2F0ZVBhdGgsIHNvbHZlR2FwLCBBTklNX01TIH0gZnJvbSBcIi4vbGF5b3V0LmpzXCI7XG5pbXBvcnQgeyBoLCBzLCBjbGlja2FibGUsIGxhdGVyIH0gZnJvbSBcIi4vZG9tLmpzXCI7XG5pbXBvcnQgeyBhZGRFeHBvcnRCdXR0b24gfSBmcm9tIFwiLi9leHBvcnQtaW1hZ2UuanNcIjtcblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZURpYWdyYW0oYywgcGFyZW50LCBjdHgpIHtcbiAgY29uc3QgZmxpcHMgPSBuZXcgU2V0KCk7XG4gIGxldCByZXBzID0gbnVsbCwgbWF0Y2hlZCA9IG5ldyBTZXQoKTtcbiAgY29uc3QgY29tcHV0ZVJlcHMgPSAoKSA9PiB7XG4gICAgaWYgKGN0eC5idWJibGVzKSB7XG4gICAgICByZXBzID0gYnViYmxlRm9ybXMoYywgZmxpcHMpO1xuICAgICAgbWF0Y2hlZCA9IG1hdGNoZWRCdWJibGVOZXRzKGMsIHJlcHMpO1xuICAgIH1cbiAgfTtcbiAgY29tcHV0ZVJlcHMoKTtcbiAgY29uc3QgcmVwT2YgPSAoZykgPT4gcmVwcyA/IHJlcHMuZ2V0KGcpIDogYmFzZVJlcChnKTtcbiAgY29uc3QgZmFuID0ge307XG4gIGMuZ2F0ZXMuZm9yRWFjaCgoZykgPT4gZy5pbnMuZm9yRWFjaCgobikgPT4ge1xuICAgIGZhbltuXSA9IChmYW5bbl0gfHwgMCkgKyAxO1xuICB9KSk7XG4gIFxuICBjb25zdCBzaW0gPSBjcmVhdGVTaW0oXG4gICAgYyxcbiAgICBjdHguZ2V0RGVsYXksXG4gICAgKHNpZywgdikgPT4ge1xuICAgICAgcGFpbnQoKTtcbiAgICAgIHNwYXduKHNpZywgdik7XG4gICAgICBpZiAoY3R4Lm9uQ2hhbmdlKSBjdHgub25DaGFuZ2Uoc2lnLCB2KTtcbiAgICB9LFxuICAgICgpID0+IHBhaW50KClcbiAgKTtcbiAgXG4gIGNvbnN0IGJveCA9IGgoXCJkaXZcIiwgXCJsZy1kaWFncmFtXCIsIHBhcmVudCk7XG4gIGNvbnN0IGhlYWQgPSBoKFwiZGl2XCIsIFwibGctdGl0bGVcIiwgYm94KTtcbiAgaChcInNwYW5cIiwgXCJcIiwgaGVhZCwgY3R4LnRpdGxlIHx8IFwiQ2lyY3VpdFwiKTtcbiAgbGV0IHN2Z0VsID0gbnVsbDtcbiAgXG4gIGlmIChjdHguYnViYmxlcykge1xuICAgIGgoXCJzcGFuXCIsIFwibGctbXV0ZWQtdGV4dFwiLCBoZWFkLCBcIiAgY2xpY2sgYSBnYXRlIHRvIGZsaXAgaXRzIHN5bWJvbCBcIik7XG4gICAgaChcImJ1dHRvblwiLCBcImxnLXNtYWxsXCIsIGhlYWQsIFwicmVzZXRcIikuYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHtcbiAgICAgIGZsaXBzLmNsZWFyKCk7XG4gICAgICBjb21wdXRlUmVwcygpO1xuICAgICAgZHJhdygpO1xuICAgICAgcGFpbnQoKTtcbiAgICB9KTtcbiAgfVxuICBcbiAgYWRkRXhwb3J0QnV0dG9uKGhlYWQsIGN0eC5hcHAsICgpID0+IHN2Z0VsLCBjdHguZXhwb3J0TmFtZSB8fCBcImNpcmN1aXRcIik7XG4gIGNvbnN0IHNjcm9sbCA9IGgoXCJkaXZcIiwgXCJsZy1zY3JvbGxcIiwgYm94KTtcbiAgbGV0IGhnYXAgPSBjdHguaHNwYWNpbmcucHggfHwgOTA7XG4gIGxldCB3aXJlcyA9IFtdLCBkb3RzID0gW10sIGluQm94ZXMgPSB7fSwgb3V0Qm94ZXMgPSB7fSwgbGFtcHMgPSBbXSwgc3ByaXRlcyA9IFtdLCBzcHJpdGVMYXllciA9IG51bGwsIHJhZiA9IDA7XG4gIGxldCBkaXNwb3NlZCA9IGZhbHNlO1xuICBcbiAgZnVuY3Rpb24gZHJhdygpIHtcbiAgICBzY3JvbGwudGV4dENvbnRlbnQgPSBcIlwiO1xuICAgIHdpcmVzID0gW107XG4gICAgZG90cyA9IFtdO1xuICAgIGluQm94ZXMgPSB7fTtcbiAgICBvdXRCb3hlcyA9IHt9O1xuICAgIGxhbXBzID0gW107XG4gICAgc3ByaXRlcyA9IFtdO1xuICAgIFxuICAgIGxldCBMID0gbGF5b3V0KGMsIHsgaGdhcCwgdmdhcDogY3R4LnZnYXAgfSk7XG4gICAgY29uc3QgcGxhbiA9IHBsYW5Sb3V0ZXMoYywgTCwgaGdhcCk7XG4gICAgY29uc3QgdG9wUGFkID0gcGxhbi5sYW5lcyA/IDggKyA2ICogcGxhbi5sYW5lcyA6IDA7XG4gICAgTCA9IGxheW91dChjLCB7IGhnYXAsIHZnYXA6IGN0eC52Z2FwLCB0b3BQYWQgfSk7XG4gICAgY29uc3QgY2hhbiA9IHBsYW5DaGFubmVscyhjLCBMLCBwbGFuKTtcbiAgICBjb25zdCBnYXBCZWZvcmUgPSB7fTtcbiAgICBPYmplY3Qua2V5cyhjaGFuLnRyYWNrcykuZm9yRWFjaCgobCkgPT4ge1xuICAgICAgZ2FwQmVmb3JlW2xdID0gY2hhbm5lbE5lZWQoY2hhbi50cmFja3NbbF0pO1xuICAgIH0pO1xuICAgIEwgPSBsYXlvdXQoYywgeyBoZ2FwLCB2Z2FwOiBjdHgudmdhcCwgdG9wUGFkLCBnYXBCZWZvcmUgfSk7XG4gICAgXG4gICAgY29uc3Qgc3ZnID0gcyhcInN2Z1wiLCB7IGNsYXNzOiBcImxnLXN2Z1wiLCB2aWV3Qm94OiBgMCAwICR7TC53aWR0aH0gJHtMLmhlaWdodH1gLCB3aWR0aDogTC53aWR0aCwgaGVpZ2h0OiBMLmhlaWdodCB9LCBzY3JvbGwpO1xuICAgIHN2Z0VsID0gc3ZnO1xuICAgIGlmIChjdHguaHNwYWNpbmcucGN0ID4gMTAwKSBzdmcuc3R5bGUubWF4V2lkdGggPSBcIm5vbmVcIjtcbiAgICBjb25zdCB3aXJlTGF5ZXIgPSBzKFwiZ1wiLCB7fSwgc3ZnKTtcbiAgICBjb25zdCBnYXRlTGF5ZXIgPSBzKFwiZ1wiLCB7fSwgc3ZnKTtcbiAgICBzcHJpdGVMYXllciA9IHMoXCJnXCIsIHt9LCBzdmcpO1xuICAgIFxuICAgIGNvbnN0IHNyY1BvaW50ID0gKG4pID0+IGMuZHJpdmVyW25dID8geyB4OiBjLmRyaXZlcltuXS54MCArIEdBVEVfVywgeTogYy5kcml2ZXJbbl0uY3kgfSA6IHsgeDogTEVGVCwgeTogTC5jeVtuXSB9O1xuICAgIGNvbnN0IGFkZFdpcmUgPSAoc2lnLCBkKSA9PiB3aXJlcy5wdXNoKHsgc2lnLCBlbDogcyhcInBhdGhcIiwgeyBjbGFzczogXCJsZy13aXJlXCIsIGQgfSwgd2lyZUxheWVyKSB9KTtcbiAgICBcbiAgICBjLm9yZGVyLmZvckVhY2goKGcpID0+IHtcbiAgICAgIGNvbnN0IHIgPSByZXBPZihnKSwgbiA9IGcuaW5zLmxlbmd0aDtcbiAgICAgIGcuaW5zLmZvckVhY2goKHNpZywgaSkgPT4ge1xuICAgICAgICBjb25zdCBhID0gc3JjUG9pbnQoc2lnKTtcbiAgICAgICAgY29uc3QgcHkgPSBnLmN5IC0gZy5IIC8gMiArIGcuSCAqIChpICsgMSkgLyAobiArIDEpO1xuICAgICAgICBjb25zdCBteCA9IGcueDAgLSBDSF9GSVJTVCAtIENIX1NURVAgKiAoY2hhbi50cmFja09mLmdldChnLm91dCArIFwiOlwiICsgaSkgfHwgMCk7XG4gICAgICAgIGNvbnN0IGVuZHggPSByLmluc1tpXSA/IGcueDAgLSAyICogQlVCQkxFX1IgOiBnLngwO1xuICAgICAgICBjb25zdCByb3V0ZSA9IHBsYW4ucm91dGVzLmdldChnLm91dCArIFwiOlwiICsgaSk7XG4gICAgICAgIGlmIChyb3V0ZSkge1xuICAgICAgICAgIGNvbnN0IGx5ID0gTWF0aC5taW4oYS55LCBweSkgLSAxMCAtIHJvdXRlLmxhbmUgKiA2OyBcbiAgICAgICAgICBjb25zdCBjMSA9IGEueCArIDIwICsgNCAqIChyb3V0ZS5sYW5lICUgMyk7XG4gICAgICAgICAgYWRkV2lyZShzaWcsIGBNJHthLnh9LCR7YS55fSBIJHtjMX0gViR7bHl9IEgke214fSBWJHtweX0gSCR7ZW5keH1gKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBhZGRXaXJlKHNpZywgYE0ke2EueH0sJHthLnl9IEgke214fSBWJHtweX0gSCR7ZW5keH1gKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoci5pbnNbaV0pIHtcbiAgICAgICAgICBzKFwiY2lyY2xlXCIsIHsgY2xhc3M6IFwibGctYnViYmxlXCIgKyAobWF0Y2hlZC5oYXMoc2lnKSA/IFwiIG1hdGNoXCIgOiBcIlwiKSwgY3g6IGcueDAgLSBCVUJCTEVfUiwgY3k6IHB5LCByOiBCVUJCTEVfUiB9LCBnYXRlTGF5ZXIpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9KTtcbiAgICBcbiAgICBPYmplY3Qua2V5cyhmYW4pLmZvckVhY2goKG4pID0+IHtcbiAgICAgIGlmIChmYW5bbl0gPiAxKSB7XG4gICAgICAgIGNvbnN0IGEgPSBzcmNQb2ludChuKTtcbiAgICAgICAgZG90cy5wdXNoKHsgc2lnOiBuLCBlbDogcyhcImNpcmNsZVwiLCB7IGNsYXNzOiBcImxnLWRvdFwiLCBjeDogYS54ICsgMTAsIGN5OiBhLnksIHI6IDMuNSB9LCB3aXJlTGF5ZXIpIH0pO1xuICAgICAgfVxuICAgIH0pO1xuICAgIFxuICAgIGMuaW5wdXRzLmZvckVhY2goKG4pID0+IHtcbiAgICAgIGNvbnN0IHkgPSBMLmN5W25dO1xuICAgICAgcyhcInRleHRcIiwgeyBjbGFzczogXCJsZy1sYWJlbFwiLCB4OiBMRUZUIC0gMzAsIHk6IHkgKyA0LCBcInRleHQtYW5jaG9yXCI6IFwiZW5kXCIgfSwgZ2F0ZUxheWVyLCBuKTtcbiAgICAgIGNvbnN0IHJlY3QgPSBzKFwicmVjdFwiLCB7IGNsYXNzOiBcImxnLWJveCBpblwiLCB4OiBMRUZUIC0gMjQsIHk6IHkgLSAxMCwgd2lkdGg6IDI0LCBoZWlnaHQ6IDIwLCByeDogNCB9LCBnYXRlTGF5ZXIpO1xuICAgICAgY29uc3QgdGV4dCA9IHMoXCJ0ZXh0XCIsIHsgY2xhc3M6IFwibGctYm94dGV4dFwiLCB4OiBMRUZUIC0gMTIsIHk6IHkgKyA0LCBcInRleHQtYW5jaG9yXCI6IFwibWlkZGxlXCIgfSwgZ2F0ZUxheWVyLCBcIjBcIik7XG4gICAgICBjbGlja2FibGUocmVjdCwgKCkgPT4gY3R4Lm9uVG9nZ2xlKG4pKTtcbiAgICAgIGluQm94ZXNbbl0gPSB7IHJlY3QsIHRleHQgfTtcbiAgICB9KTtcbiAgICBcbiAgICBjLm9yZGVyLmZvckVhY2goKGcpID0+IHtcbiAgICAgIGNvbnN0IHIgPSByZXBPZihnKTtcbiAgICAgIGNvbnN0IGdycCA9IHMoXCJnXCIsIHsgdHJhbnNmb3JtOiBgdHJhbnNsYXRlKCR7Zy54MH0sJHtnLmN5IC0gZy5IIC8gMn0pYCB9LCBnYXRlTGF5ZXIpO1xuICAgICAgY29uc3QgZmxpcHBhYmxlID0gY3R4LmJ1YmJsZXMgJiYgIXIuZml4ZWQ7XG4gICAgICBjb25zdCBib2R5ID0gcyhcInBhdGhcIiwgeyBjbGFzczogXCJsZy1nYXRlXCIgKyAoZmxpcHBhYmxlID8gXCIgZmxpcFwiIDogXCJcIiksIGQ6IGdhdGVQYXRoKHIuc2hhcGUsIGcuSCkgfSwgZ3JwKTtcbiAgICAgIGlmIChmbGlwcGFibGUpIGNsaWNrYWJsZShib2R5LCAoKSA9PiB7XG4gICAgICAgIGlmIChmbGlwcy5oYXMoZykpIGZsaXBzLmRlbGV0ZShnKTtcbiAgICAgICAgZWxzZSBmbGlwcy5hZGQoZyk7XG4gICAgICAgIGNvbXB1dGVSZXBzKCk7XG4gICAgICAgIGRyYXcoKTtcbiAgICAgICAgcGFpbnQoKTtcbiAgICAgIH0pO1xuICAgICAgaWYgKHIuc2hhcGUgPT09IFwiWE9SXCIpIHMoXCJwYXRoXCIsIHsgY2xhc3M6IFwibGctZ2F0ZS1leHRyYVwiLCBkOiBgTS03LDAgUTcsJHtnLkggLyAyfSAtNywke2cuSH1gIH0sIGdycCk7XG4gICAgICBpZiAoci5vdXQpIHtcbiAgICAgICAgcyhcImNpcmNsZVwiLCB7IGNsYXNzOiBcImxnLWJ1YmJsZVwiICsgKG1hdGNoZWQuaGFzKGcub3V0KSA/IFwiIG1hdGNoXCIgOiBcIlwiKSwgY3g6IDUyICsgQlVCQkxFX1IsIGN5OiBnLkggLyAyLCByOiBCVUJCTEVfUiB9LCBncnApO1xuICAgICAgICBhZGRXaXJlKGcub3V0LCBgTSR7Zy54MCArIDUyICsgMiAqIEJVQkJMRV9SfSwke2cuY3l9IEgke2cueDAgKyBHQVRFX1d9YCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBhZGRXaXJlKGcub3V0LCBgTSR7Zy54MCArIDUyfSwke2cuY3l9IEgke2cueDAgKyBHQVRFX1d9YCk7XG4gICAgICB9XG4gICAgICBzKFwidGV4dFwiLCB7IGNsYXNzOiBcImxnLW11dGVkXCIsIHg6IDI2LCB5OiBnLkggKyAxMiwgXCJ0ZXh0LWFuY2hvclwiOiBcIm1pZGRsZVwiIH0sIGdycCwgZy50eXBlKTtcbiAgICAgIGlmIChjLnVzZWQuaGFzKGcub3V0KSkgcyhcInRleHRcIiwgeyBjbGFzczogXCJsZy1tdXRlZFwiLCB4OiBHQVRFX1cgKyA0LCB5OiBnLkggLyAyIC0gNyB9LCBncnAsIGcub3V0KTtcbiAgICAgIGlmIChjdHguYW5pbSkgbGFtcHMucHVzaCh7IGcsIGJvZHksIGVsOiBzKFwiY2lyY2xlXCIsIHsgY2xhc3M6IFwibGctbGFtcCB2MFwiLCBjeDogMjYsIGN5OiAtOSwgcjogNC41IH0sIGdycCkgfSk7XG4gICAgfSk7XG4gICAgXG4gICAgYy5vdXRwdXRzLmZvckVhY2goKG4pID0+IHtcbiAgICAgIGNvbnN0IGcgPSBjLmRyaXZlcltuXSwgeCA9IGcueDAgKyBHQVRFX1c7XG4gICAgICBhZGRXaXJlKG4sIGBNJHt4fSwke2cuY3l9IEgke3ggKyAyMH1gKTtcbiAgICAgIGNvbnN0IHJlY3QgPSBzKFwicmVjdFwiLCB7IGNsYXNzOiBcImxnLWJveFwiLCB4OiB4ICsgMjAsIHk6IGcuY3kgLSAxMCwgd2lkdGg6IDI0LCBoZWlnaHQ6IDIwLCByeDogNCB9LCBnYXRlTGF5ZXIpO1xuICAgICAgY29uc3QgdGV4dCA9IHMoXCJ0ZXh0XCIsIHsgY2xhc3M6IFwibGctYm94dGV4dFwiLCB4OiB4ICsgMzIsIHk6IGcuY3kgKyA0LCBcInRleHQtYW5jaG9yXCI6IFwibWlkZGxlXCIgfSwgZ2F0ZUxheWVyLCBcIjBcIik7XG4gICAgICBzKFwidGV4dFwiLCB7IGNsYXNzOiBcImxnLWxhYmVsXCIsIHg6IHggKyA1MiwgeTogZy5jeSArIDQgfSwgZ2F0ZUxheWVyLCBuKTtcbiAgICAgIG91dEJveGVzW25dID0geyByZWN0LCB0ZXh0IH07XG4gICAgfSk7XG4gIH1cbiAgXG4gIGZ1bmN0aW9uIHBhaW50KCkge1xuICAgIGlmIChkaXNwb3NlZCkgcmV0dXJuO1xuICAgIGNvbnN0IHYgPSBzaW0udmFscztcbiAgICB3aXJlcy5mb3JFYWNoKCh3KSA9PiB3LmVsLmNsYXNzTGlzdC50b2dnbGUoXCJvblwiLCAhIXZbdy5zaWddKSk7XG4gICAgZG90cy5mb3JFYWNoKChkKSA9PiBkLmVsLmNsYXNzTGlzdC50b2dnbGUoXCJvblwiLCAhIXZbZC5zaWddKSk7XG4gICAgY29uc3Qgc2V0Qm94ID0gKGIsIHZhbCkgPT4ge1xuICAgICAgYi5yZWN0LmNsYXNzTGlzdC50b2dnbGUoXCJvblwiLCAhIXZhbCk7XG4gICAgICBiLnRleHQuY2xhc3NMaXN0LnRvZ2dsZShcIm9uXCIsICEhdmFsKTtcbiAgICAgIGIudGV4dC50ZXh0Q29udGVudCA9IFN0cmluZyh2YWwpO1xuICAgIH07XG4gICAgYy5pbnB1dHMuZm9yRWFjaCgobikgPT4geyBpZiAoaW5Cb3hlc1tuXSkgc2V0Qm94KGluQm94ZXNbbl0sIHZbbl0pOyB9KTtcbiAgICBjLm91dHB1dHMuZm9yRWFjaCgobikgPT4geyBpZiAob3V0Qm94ZXNbbl0pIHNldEJveChvdXRCb3hlc1tuXSwgdltuXSk7IH0pO1xuICAgIGxhbXBzLmZvckVhY2goKGwpID0+IHtcbiAgICAgIGNvbnN0IHcgPSBzaW0ud29ya2luZyhsLmcpO1xuICAgICAgY29uc3QgdmFsID0gdyAhPT0gbnVsbCA/IHcgOiB2W2wuZy5vdXRdO1xuICAgICAgbC5lbC5zZXRBdHRyaWJ1dGUoXCJjbGFzc1wiLCBgbGctbGFtcCAke3ZhbCA/IFwidjFcIiA6IFwidjBcIn0ke3cgIT09IG51bGwgPyBcIiB3b3JrXCIgOiBcIlwifWApO1xuICAgICAgY29uc3QgZmxpcHBhYmxlID0gY3R4LmJ1YmJsZXMgJiYgIXJlcE9mKGwuZykuZml4ZWQ7XG4gICAgICBsLmJvZHkuc2V0QXR0cmlidXRlKFwiY2xhc3NcIiwgXCJsZy1nYXRlXCIgKyAoZmxpcHBhYmxlID8gXCIgZmxpcFwiIDogXCJcIikgKyAodyAhPT0gbnVsbCA/IHcgPyBcIiB3MVwiIDogXCIgdzBcIiA6IFwiXCIpKTtcbiAgICB9KTtcbiAgfVxuICBcbiAgZnVuY3Rpb24gc3Bhd24oc2lnLCB2KSB7XG4gICAgaWYgKCFjdHguYW5pbSB8fCAhc3ByaXRlTGF5ZXIgfHwgdHlwZW9mIHJlcXVlc3RBbmltYXRpb25GcmFtZSAhPT0gXCJmdW5jdGlvblwiIHx8IGRpc3Bvc2VkKSByZXR1cm47XG4gICAgaWYgKHNwcml0ZXMuc29tZSgoc3ApID0+IHNwLnNpZyA9PT0gc2lnKSkgcmV0dXJuO1xuICAgIHdpcmVzLmZvckVhY2goKHcpID0+IHtcbiAgICAgIGlmICh3LnNpZyAhPT0gc2lnIHx8IHNwcml0ZXMubGVuZ3RoID4gMjQwKSByZXR1cm47XG4gICAgICBsZXQgbGVuO1xuICAgICAgdHJ5IHsgbGVuID0gdy5lbC5nZXRUb3RhbExlbmd0aCgpOyB9IGNhdGNoIChlKSB7IHJldHVybjsgfVxuICAgICAgaWYgKCEobGVuID4gMCkpIHJldHVybjtcbiAgICAgIGNvbnN0IGcgPSBzKFwiZ1wiLCB7IGNsYXNzOiBcImxnLXNwcml0ZSB2XCIgKyB2IH0sIHNwcml0ZUxheWVyKTtcbiAgICAgIHMoXCJjaXJjbGVcIiwgeyByOiA2LjUgfSwgZyk7XG4gICAgICBzKFwidGV4dFwiLCB7IHk6IDMuNSwgXCJ0ZXh0LWFuY2hvclwiOiBcIm1pZGRsZVwiIH0sIGcsIFN0cmluZyh2KSk7XG4gICAgICBzcHJpdGVzLnB1c2goeyBzaWcsIGVsOiBnLCBwYXRoOiB3LmVsLCBsZW4sIHQwOiBwZXJmb3JtYW5jZS5ub3coKSB9KTtcbiAgICB9KTtcbiAgICBpZiAoIXJhZiAmJiBzcHJpdGVzLmxlbmd0aCkgcmFmID0gcmVxdWVzdEFuaW1hdGlvbkZyYW1lKHN0ZXApO1xuICB9XG4gIFxuICBmdW5jdGlvbiBzdGVwKG5vdykge1xuICAgIHJhZiA9IDA7XG4gICAgaWYgKGRpc3Bvc2VkKSByZXR1cm47XG4gICAgZm9yIChsZXQgaSA9IHNwcml0ZXMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICAgIGNvbnN0IHNwID0gc3ByaXRlc1tpXTtcbiAgICAgIGNvbnN0IGsgPSBNYXRoLm1pbigxLCBNYXRoLm1heCgwLCAobm93IC0gc3AudDApIC8gQU5JTV9NUykpO1xuICAgICAgY29uc3QgcHQgPSBzcC5wYXRoLmdldFBvaW50QXRMZW5ndGgoayAqIHNwLmxlbik7XG4gICAgICBzcC5lbC5zZXRBdHRyaWJ1dGUoXCJ0cmFuc2Zvcm1cIiwgYHRyYW5zbGF0ZSgke3B0Lnh9LCR7cHQueX0pYCk7XG4gICAgICBpZiAoayA+PSAxKSB7XG4gICAgICAgIHNwLmVsLnJlbW92ZSgpO1xuICAgICAgICBzcHJpdGVzLnNwbGljZShpLCAxKTtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKHNwcml0ZXMubGVuZ3RoKSByYWYgPSByZXF1ZXN0QW5pbWF0aW9uRnJhbWUoc3RlcCk7XG4gIH1cbiAgXG4gIGRyYXcoKTtcbiAgcGFpbnQoKTtcbiAgXG4gIGlmIChjdHguaHNwYWNpbmcucGN0KSB7XG4gICAgY29uc3QgdGFyZ2V0ID0gc2Nyb2xsLmNsaWVudFdpZHRoICogY3R4LmhzcGFjaW5nLnBjdCAvIDEwMDtcbiAgICBpZiAodGFyZ2V0ID4gMCkge1xuICAgICAgaGdhcCA9IHNvbHZlR2FwKGMsIGN0eC52Z2FwLCB0YXJnZXQpO1xuICAgICAgZHJhdygpO1xuICAgICAgcGFpbnQoKTtcbiAgICB9XG4gIH1cbiAgXG4gIGxldCBybyA9IG51bGw7XG4gIGlmIChjdHguaHNwYWNpbmcucGN0ICYmIHR5cGVvZiBSZXNpemVPYnNlcnZlciAhPT0gXCJ1bmRlZmluZWRcIikge1xuICAgIGxldCBsYXN0VyA9IDAsIHBlbmRpbmcgPSBmYWxzZTtcbiAgICBybyA9IG5ldyBSZXNpemVPYnNlcnZlcigoZW50cmllcykgPT4ge1xuICAgICAgaWYgKGRpc3Bvc2VkKSByZXR1cm47XG4gICAgICBjb25zdCB3ID0gZW50cmllc1swXS5jb250ZW50UmVjdC53aWR0aDtcbiAgICAgIGlmICghdyB8fCBNYXRoLmFicyh3IC0gbGFzdFcpIDwgMiB8fCBwZW5kaW5nKSByZXR1cm47XG4gICAgICBsYXN0VyA9IHc7XG4gICAgICBwZW5kaW5nID0gdHJ1ZTtcbiAgICAgIGxhdGVyKCgpID0+IHtcbiAgICAgICAgcGVuZGluZyA9IGZhbHNlO1xuICAgICAgICBpZiAoZGlzcG9zZWQpIHJldHVybjtcbiAgICAgICAgaGdhcCA9IHNvbHZlR2FwKGMsIGN0eC52Z2FwLCB3ICogY3R4LmhzcGFjaW5nLnBjdCAvIDEwMCk7XG4gICAgICAgIGRyYXcoKTtcbiAgICAgICAgcGFpbnQoKTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICAgIHJvLm9ic2VydmUoc2Nyb2xsKTtcbiAgfVxuICBcbiAgcmV0dXJuIHtcbiAgICBzaW0sXG4gICAgcGFpbnQsXG4gICAgZ2V0U3ZnOiAoKSA9PiBzdmdFbCxcbiAgICBkaXNwb3NlKCkge1xuICAgICAgZGlzcG9zZWQgPSB0cnVlO1xuICAgICAgc2ltLmRpc3Bvc2UoKTtcbiAgICAgIGlmIChyYWYpIGNhbmNlbEFuaW1hdGlvbkZyYW1lKHJhZik7XG4gICAgICBpZiAocm8pIHJvLmRpc2Nvbm5lY3QoKTtcbiAgICB9XG4gIH07XG59IiwgIi8vIHBhY2thZ2VzL2xvZ2ljLWdyYXBoL3NyYy91aS90aW1pbmcuanNcbmltcG9ydCB7IGgsIHMsIGxhdGVyIH0gZnJvbSBcIi4vZG9tLmpzXCI7XG5pbXBvcnQgeyBhZGRFeHBvcnRCdXR0b24gfSBmcm9tIFwiLi9leHBvcnQtaW1hZ2UuanNcIjtcbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVUaW1pbmcocGFyZW50LCBzaWduYWxzLCBraW5kcywgYXBwKSB7XG4gIGNvbnN0IGJveCA9IGgoXCJkaXZcIiwgXCJsZy10aW1pbmdcIiwgcGFyZW50KTtcbiAgY29uc3QgaGVhZCA9IGgoXCJkaXZcIiwgXCJsZy10aXRsZVwiLCBib3gpO1xuICBoKFwic3BhblwiLCBcIlwiLCBoZWFkLCBcIlRpbWluZyBncmFwaFwiKTtcbiAgY29uc3QgY2xlYXJCdG4gPSBoKFwiYnV0dG9uXCIsIFwibGctc21hbGxcIiwgaGVhZCwgXCJjbGVhclwiKTtcbiAgY29uc3QgaG9zdCA9IGgoXCJkaXZcIiwgXCJsZy1zY3JvbGxcIiwgYm94KTtcbiAgbGV0IHQwID0gcGVyZm9ybWFuY2Uubm93KCksIGxhc3QgPSAwLCBoaXN0ID0ge30sIHF1ZXVlZCA9IGZhbHNlLCBzdmdFbCA9IG51bGwsIGRpc3Bvc2VkID0gZmFsc2U7XG4gIGxldCBsYXN0VmFscyA9ICgpID0+ICh7fSk7XG4gIGFkZEV4cG9ydEJ1dHRvbihoZWFkLCBhcHAsICgpID0+IHN2Z0VsLCBcInRpbWluZy1ncmFwaFwiKTtcbiAgY29uc3Qgc2NoZWR1bGUgPSAoKSA9PiB7XG4gICAgaWYgKCFxdWV1ZWQpIHtcbiAgICAgIHF1ZXVlZCA9IHRydWU7XG4gICAgICBsYXRlcigoKSA9PiB7XG4gICAgICAgIHF1ZXVlZCA9IGZhbHNlO1xuICAgICAgICBpZiAoIWRpc3Bvc2VkKSBkcmF3KCk7XG4gICAgICB9KTtcbiAgICB9XG4gIH07XG4gIGZ1bmN0aW9uIGJlZ2luKHZhbHMpIHtcbiAgICBpZiAoZGlzcG9zZWQpIHJldHVybjtcbiAgICB0MCA9IHBlcmZvcm1hbmNlLm5vdygpO1xuICAgIGxhc3QgPSAwO1xuICAgIGhpc3QgPSB7fTtcbiAgICBzaWduYWxzLmZvckVhY2goKG4pID0+IHtcbiAgICAgIGhpc3Rbbl0gPSBbWzAsIHZhbHNbbl1dXTtcbiAgICB9KTtcbiAgICBzY2hlZHVsZSgpO1xuICB9XG4gIGZ1bmN0aW9uIHJlY29yZChzaWcsIHYpIHtcbiAgICBpZiAoZGlzcG9zZWQgfHwgIWhpc3Rbc2lnXSkgcmV0dXJuO1xuICAgIGNvbnN0IGgyID0gaGlzdFtzaWddO1xuICAgIGlmIChoMi5sZW5ndGggJiYgaDJbaDIubGVuZ3RoIC0gMV1bMV0gPT09IHYpIHJldHVybjtcbiAgICBjb25zdCB0ID0gKHBlcmZvcm1hbmNlLm5vdygpIC0gdDApIC8gMWUzO1xuICAgIGgyLnB1c2goW3QsIHZdKTtcbiAgICBsYXN0ID0gTWF0aC5tYXgobGFzdCwgdCk7XG4gICAgc2NoZWR1bGUoKTtcbiAgfVxuICBmdW5jdGlvbiBkcmF3KCkge1xuICAgIGlmIChkaXNwb3NlZCkgcmV0dXJuO1xuICAgIGhvc3QudGV4dENvbnRlbnQgPSBcIlwiO1xuICAgIGNvbnN0IFcgPSA2NDAsIExCTCA9IDg0LCBSSCA9IDIyLCBQQUQgPSAxMDtcbiAgICBjb25zdCBUID0gTWF0aC5tYXgoMSwgbGFzdCAqIDEuMSArIDAuMik7XG4gICAgY29uc3QgSCA9IHNpZ25hbHMubGVuZ3RoICogUkggKyAyODtcbiAgICBjb25zdCB4ID0gKHQpID0+IExCTCArIHQgLyBUICogKFcgLSBMQkwgLSBQQUQpO1xuICAgIGNvbnN0IHN2ZyA9IHMoXCJzdmdcIiwgeyBjbGFzczogXCJsZy1zdmdcIiwgdmlld0JveDogYDAgMCAke1d9ICR7SH1gLCB3aWR0aDogVywgaGVpZ2h0OiBIIH0sIGhvc3QpO1xuICAgIHN2Z0VsID0gc3ZnO1xuICAgIGNvbnN0IHN0ZXAgPSBbMC4xLCAwLjIsIDAuNSwgMSwgMiwgNSwgMTAsIDIwXS5maW5kKChzdCkgPT4gVCAvIHN0IDw9IDEwKSB8fCAyMDtcbiAgICBmb3IgKGxldCB0ID0gMDsgdCA8PSBUICsgMWUtOTsgdCArPSBzdGVwKSB7XG4gICAgICBzKFwibGluZVwiLCB7IGNsYXNzOiBcImxnLWdyaWRcIiwgeDE6IHgodCksIHgyOiB4KHQpLCB5MTogNCwgeTI6IEggLSAxOCB9LCBzdmcpO1xuICAgICAgcyhcInRleHRcIiwgeyBjbGFzczogXCJsZy1tdXRlZFwiLCB4OiB4KHQpLCB5OiBIIC0gNiwgXCJ0ZXh0LWFuY2hvclwiOiBcIm1pZGRsZVwiIH0sIHN2ZywgTWF0aC5yb3VuZCh0ICogMTAwKSAvIDEwMCArIFwic1wiKTtcbiAgICB9XG4gICAgc2lnbmFscy5mb3JFYWNoKChuLCBpKSA9PiB7XG4gICAgICBjb25zdCB0b3AgPSA2ICsgaSAqIFJIICsgMywgYm90ID0gNiArIGkgKiBSSCArIFJIIC0gNTtcbiAgICAgIGNvbnN0IHkgPSAodikgPT4gdiA/IHRvcCA6IGJvdDtcbiAgICAgIHMoXCJ0ZXh0XCIsIHsgY2xhc3M6IFwibGctbGFiZWxcIiwgeDogTEJMIC0gOCwgeTogYm90LCBcInRleHQtYW5jaG9yXCI6IFwiZW5kXCIgfSwgc3ZnLCBuKTtcbiAgICAgIGNvbnN0IHB0cyA9IFtdO1xuICAgICAgZm9yIChjb25zdCBbdCwgdl0gb2YgaGlzdFtuXSB8fCBbXSkge1xuICAgICAgICBjb25zdCBwcmV2ID0gcHRzW3B0cy5sZW5ndGggLSAxXTtcbiAgICAgICAgaWYgKHByZXYgJiYgcHJldlswXSA9PT0gdCAmJiBwcmV2WzFdID09PSB2KSBjb250aW51ZTtcbiAgICAgICAgaWYgKHByZXYgJiYgcHJldlswXSA9PT0gdCkgcHJldlsxXSA9IHY7XG4gICAgICAgIGVsc2UgcHRzLnB1c2goW3QsIHZdKTtcbiAgICAgIH1cbiAgICAgIGlmICghcHRzLmxlbmd0aCkgcmV0dXJuO1xuICAgICAgbGV0IGQgPSBgTSR7eChwdHNbMF1bMF0pfSwke3kocHRzWzBdWzFdKX1gO1xuICAgICAgZm9yIChsZXQgayA9IDE7IGsgPCBwdHMubGVuZ3RoOyBrKyspIGQgKz0gYCBIJHt4KHB0c1trXVswXSl9IFYke3kocHRzW2tdWzFdKX1gO1xuICAgICAgZCArPSBgIEgke3goVCl9YDtcbiAgICAgIHMoXCJwYXRoXCIsIHsgY2xhc3M6IFwibGctd2F2ZSBcIiArIChraW5kc1tuXSB8fCBcIlwiKSwgZCB9LCBzdmcpO1xuICAgIH0pO1xuICB9XG4gIGNsZWFyQnRuLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKSA9PiBiZWdpbihsYXN0VmFscygpKSk7XG4gIHJldHVybiB7XG4gICAgYmVnaW4sXG4gICAgcmVjb3JkLFxuICAgIHNldExhc3RWYWxzKGZuKSB7XG4gICAgICBsYXN0VmFscyA9IGZuO1xuICAgIH0sXG4gICAgZGlzcG9zZSgpIHtcbiAgICAgIGRpc3Bvc2VkID0gdHJ1ZTtcbiAgICB9XG4gIH07XG59XG5cbiIsICIvLyBwYWNrYWdlcy9sb2dpYy1ncmFwaC9zcmMvY29yZS9jb21wYWN0LmpzXG5leHBvcnQgZnVuY3Rpb24gY29tcGFjdFJvd3MoYywgYWxsKSB7XG4gIGNvbnN0IG4gPSBjLmlucHV0cy5sZW5ndGg7XG4gIGxldCBjdXIgPSBhbGwubWFwKChyLCBpKSA9PiAoeyB2OiBpLCBtYXNrOiAwLCBrZXk6IGMub3V0cHV0cy5tYXAoKG8pID0+IHJbb10pLmpvaW4oXCJcIikgfSkpO1xuICBsZXQgY2hhbmdlZCA9IHRydWU7XG4gIHdoaWxlIChjaGFuZ2VkKSB7XG4gICAgY2hhbmdlZCA9IGZhbHNlO1xuICAgIGNvbnN0IGdyb3VwcyA9IC8qIEBfX1BVUkVfXyAqLyBuZXcgTWFwKCk7XG4gICAgY3VyLmZvckVhY2goKHQpID0+IHtcbiAgICAgIGNvbnN0IGsgPSB0Lm1hc2sgKyBcInxcIiArIHQua2V5O1xuICAgICAgaWYgKCFncm91cHMuaGFzKGspKSBncm91cHMuc2V0KGssIC8qIEBfX1BVUkVfXyAqLyBuZXcgTWFwKCkpO1xuICAgICAgZ3JvdXBzLmdldChrKS5zZXQodC52LCB0KTtcbiAgICB9KTtcbiAgICBjb25zdCBuZXh0ID0gW10sIHVzZWQgPSAvKiBAX19QVVJFX18gKi8gbmV3IFNldCgpO1xuICAgIGZvciAoY29uc3QgZ3JwIG9mIGdyb3Vwcy52YWx1ZXMoKSkge1xuICAgICAgZm9yIChjb25zdCB0IG9mIGdycC52YWx1ZXMoKSkge1xuICAgICAgICBpZiAodXNlZC5oYXModCkpIGNvbnRpbnVlO1xuICAgICAgICBsZXQgbWVyZ2VkID0gZmFsc2U7XG4gICAgICAgIGZvciAobGV0IGIgPSAwOyBiIDwgbiAmJiAhbWVyZ2VkOyBiKyspIHtcbiAgICAgICAgICBjb25zdCBiaXQgPSAxIDw8IGI7XG4gICAgICAgICAgaWYgKHQubWFzayAmIGJpdCkgY29udGludWU7XG4gICAgICAgICAgY29uc3QgcCA9IGdycC5nZXQodC52IF4gYml0KTtcbiAgICAgICAgICBpZiAocCAmJiAhdXNlZC5oYXMocCkpIHtcbiAgICAgICAgICAgIHVzZWQuYWRkKHQpO1xuICAgICAgICAgICAgdXNlZC5hZGQocCk7XG4gICAgICAgICAgICBuZXh0LnB1c2goeyB2OiB0LnYgJiB+Yml0LCBtYXNrOiB0Lm1hc2sgfCBiaXQsIGtleTogdC5rZXkgfSk7XG4gICAgICAgICAgICBtZXJnZWQgPSBjaGFuZ2VkID0gdHJ1ZTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCFtZXJnZWQpIHtcbiAgICAgICAgICB1c2VkLmFkZCh0KTtcbiAgICAgICAgICBuZXh0LnB1c2godCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgY3VyID0gbmV4dDtcbiAgfVxuICByZXR1cm4gY3VyLnNvcnQoKGEsIGIpID0+IGEudiAtIGIudiB8fCBhLm1hc2sgLSBiLm1hc2spO1xufVxuXG4iLCAiLy8gcGFja2FnZXMvbG9naWMtZ3JhcGgvc3JjL3VpL3RhYmxlLmpzXG5pbXBvcnQgeyBoIH0gZnJvbSBcIi4vZG9tLmpzXCI7XG5pbXBvcnQgeyBjb21wYWN0Um93cyB9IGZyb20gXCIuLi9jb3JlL2NvbXBhY3QuanNcIjtcbmV4cG9ydCBmdW5jdGlvbiByZW5kZXJUYWJsZShwYXJlbnQsIGMsIGFsbCwgY29tcGFjdCkge1xuICBjb25zdCBuID0gYy5pbnB1dHMubGVuZ3RoO1xuICBjb25zdCB0YWJsZSA9IGgoXCJ0YWJsZVwiLCBcImxnLXRhYmxlXCIsIHBhcmVudCk7XG4gIGNvbnN0IGhlYWQgPSBoKFwidHJcIiwgXCJcIiwgaChcInRoZWFkXCIsIFwiXCIsIHRhYmxlKSk7XG4gIGxldCBjb2xzLCByb3dzO1xuICBpZiAoY29tcGFjdCkge1xuICAgIGNvbHMgPSBbLi4uYy5pbnB1dHMubWFwKCh4KSA9PiAoeyBuOiB4LCBjbHM6IFwiXCIgfSkpLCAuLi5jLm91dHB1dHMubWFwKCh4LCBpKSA9PiAoeyBuOiB4LCBjbHM6IGkgPT09IDAgPyBcImxnLXNlcFwiIDogXCJcIiB9KSldO1xuICAgIHJvd3MgPSBjb21wYWN0Um93cyhjLCBhbGwpLm1hcCgodCkgPT4ge1xuICAgICAgY29uc3QgcGF0dGVybiA9IHt9O1xuICAgICAgYy5pbnB1dHMuZm9yRWFjaCgoeCwgaykgPT4ge1xuICAgICAgICBjb25zdCBiaXQgPSAxIDw8IG4gLSAxIC0gaztcbiAgICAgICAgcGF0dGVyblt4XSA9IHQubWFzayAmIGJpdCA/IFwiWFwiIDogdC52ICYgYml0ID8gMSA6IDA7XG4gICAgICB9KTtcbiAgICAgIGNvbnN0IHIgPSBhbGxbdC52XTtcbiAgICAgIHJldHVybiB7IHY6IHQudiwgbWFzazogdC5tYXNrLCBwYXR0ZXJuLCBjZWxsczogWy4uLmMuaW5wdXRzLm1hcCgoeCkgPT4gU3RyaW5nKHBhdHRlcm5beF0pKSwgLi4uYy5vdXRwdXRzLm1hcCgobykgPT4gU3RyaW5nKHJbb10pKV0gfTtcbiAgICB9KTtcbiAgfSBlbHNlIHtcbiAgICBjb2xzID0gW1xuICAgICAgLi4uYy5pbnB1dHMubWFwKCh4KSA9PiAoeyBuOiB4LCBjbHM6IFwiXCIgfSkpLFxuICAgICAgLi4uYy5taWRkbGVzLm1hcCgoeCwgaSkgPT4gKHsgbjogeCwgY2xzOiBcImxnLW1pZFwiICsgKGkgPT09IDAgPyBcIiBsZy1zZXBcIiA6IFwiXCIpIH0pKSxcbiAgICAgIC4uLmMub3V0cHV0cy5tYXAoKHgsIGkpID0+ICh7IG46IHgsIGNsczogaSA9PT0gMCA/IFwibGctc2VwXCIgOiBcIlwiIH0pKVxuICAgIF07XG4gICAgcm93cyA9IGFsbC5tYXAoKHIsIGkpID0+IHtcbiAgICAgIGNvbnN0IHBhdHRlcm4gPSB7fTtcbiAgICAgIGMuaW5wdXRzLmZvckVhY2goKHgpID0+IHtcbiAgICAgICAgcGF0dGVyblt4XSA9IHJbeF07XG4gICAgICB9KTtcbiAgICAgIHJldHVybiB7IHY6IGksIG1hc2s6IDAsIHBhdHRlcm4sIGNlbGxzOiBjb2xzLm1hcCgoY29sKSA9PiBTdHJpbmcocltjb2wubl0pKSB9O1xuICAgIH0pO1xuICB9XG4gIGNvbHMuZm9yRWFjaCgoY29sKSA9PiBoKFwidGhcIiwgY29sLmNscywgaGVhZCwgY29sLm4pKTtcbiAgY29uc3QgdGJvZHkgPSBoKFwidGJvZHlcIiwgXCJcIiwgdGFibGUpO1xuICBjb25zdCB0cnMgPSByb3dzLm1hcCgocm93KSA9PiB7XG4gICAgY29uc3QgdHIgPSBoKFwidHJcIiwgXCJcIiwgdGJvZHkpO1xuICAgIHJvdy5jZWxscy5mb3JFYWNoKCh0eHQsIGspID0+IGgoXCJ0ZFwiLCBjb2xzW2tdLmNscywgdHIsIHR4dCkpO1xuICAgIHJldHVybiB0cjtcbiAgfSk7XG4gIHJldHVybiB7XG4gICAgdGFibGUsXG4gICAgcm93cyxcbiAgICB0cnMsXG4gICAgY29sTmFtZXM6IGNvbHMubWFwKCh4KSA9PiB4Lm4pLFxuICAgIG1hcmtBY3RpdmUoaWR4KSB7XG4gICAgICByb3dzLmZvckVhY2goKHIsIGkpID0+IHRyc1tpXS5jbGFzc0xpc3QudG9nZ2xlKFwibGctYWN0aXZlXCIsIChpZHggJiB+ci5tYXNrKSA9PT0gci52KSk7XG4gICAgfVxuICB9O1xufVxuZXhwb3J0IGZ1bmN0aW9uIHRhYmxlVG9NYXJrZG93bihjb2xOYW1lcywgY2VsbFJvd3MpIHtcbiAgY29uc3QgZXNjID0gKHMyKSA9PiBTdHJpbmcoczIpLnJlcGxhY2UoL1xcfC9nLCBcIlxcXFx8XCIpO1xuICBjb25zdCByb3cgPSAoY2VsbHMpID0+IFwifCBcIiArIGNlbGxzLm1hcChlc2MpLmpvaW4oXCIgfCBcIikgKyBcIiB8XCI7XG4gIGNvbnN0IHNlcCA9IFwifCBcIiArIGNvbE5hbWVzLm1hcCgoKSA9PiBcIjotOlwiKS5qb2luKFwiIHwgXCIpICsgXCIgfFwiO1xuICByZXR1cm4gW3Jvdyhjb2xOYW1lcyksIHNlcCwgLi4uY2VsbFJvd3MubWFwKHJvdyldLmpvaW4oXCJcXG5cIik7XG59XG5cbiIsICIvLyBwYWNrYWdlcy9sb2dpYy1ncmFwaC9zcmMvdWkva21hcC5qc1xuaW1wb3J0IHsgbWF0aCwgcywgaCwgY2xpY2thYmxlIH0gZnJvbSBcIi4vZG9tLmpzXCI7XG5pbXBvcnQgeyBhZGRFeHBvcnRCdXR0b24gfSBmcm9tIFwiLi9leHBvcnQtaW1hZ2UuanNcIjtcbmltcG9ydCB7IGN1YmVMaXRlcmFscywgY3ViZUxhdGV4IH0gZnJvbSBcIi4uL2NvcmUvbWluaW1pemUuanNcIjtcblxuZXhwb3J0IGNvbnN0IEtHUkFZID0gKGspID0+IGsgPT09IDAgPyBbMF0gOiBrID09PSAxID8gWzAsIDFdIDogWzAsIDEsIDMsIDJdO1xuZXhwb3J0IGNvbnN0IEtDT0xPUlMgPSBbXCIjZTU0ODRkXCIsIFwiIzNiODJmNlwiLCBcIiMzMGE0NmNcIiwgXCIjZjVhNTI0XCIsIFwiIzhlNGVjNlwiLCBcIiMxMmE1OTRcIl07XG5cbmV4cG9ydCBmdW5jdGlvbiBrbWFwQXJjcyhjdWJlLCBuLCBzdGFydFZhciwgY291bnQpIHtcbiAgY29uc3Qgc2l6ZSA9IDEgPDwgY291bnQsIGcgPSBLR1JBWShjb3VudCksIHBvcyA9IFtdO1xuICBmb3IgKGxldCBwID0gMDsgcCA8IHNpemU7IHArKykge1xuICAgIGxldCBvayA9IHRydWU7XG4gICAgZm9yIChsZXQgaiA9IDA7IGogPCBjb3VudCAmJiBvazsgaisrKSB7XG4gICAgICBjb25zdCBiaXQgPSAxIDw8IG4gLSAxIC0gKHN0YXJ0VmFyICsgaik7XG4gICAgICBpZiAoY3ViZS5tYXNrICYgYml0KSBjb250aW51ZTtcbiAgICAgIGlmICgoY3ViZS52ICYgYml0ID8gMSA6IDApICE9PSAoZ1twXSA+PiBjb3VudCAtIDEgLSBqICYgMSkpIG9rID0gZmFsc2U7XG4gICAgfVxuICAgIGlmIChvaykgcG9zLnB1c2gocCk7XG4gIH1cbiAgaWYgKCFwb3MubGVuZ3RoKSByZXR1cm4gW107XG4gIGlmIChwb3MubGVuZ3RoID09PSBzaXplKSByZXR1cm4gW3sgYTogMCwgYjogc2l6ZSAtIDEsIG9wZW5BOiBmYWxzZSwgb3BlbkI6IGZhbHNlIH1dO1xuICBjb25zdCBydW5zID0gW107XG4gIGxldCBzdCA9IHBvc1swXSwgcHJldiA9IHBvc1swXTtcbiAgZm9yIChsZXQgaSA9IDE7IGkgPCBwb3MubGVuZ3RoOyBpKyspIHtcbiAgICBpZiAocG9zW2ldID09PSBwcmV2ICsgMSkgcHJldiA9IHBvc1tpXTtcbiAgICBlbHNlIHtcbiAgICAgIHJ1bnMucHVzaChbc3QsIHByZXZdKTtcbiAgICAgIHN0ID0gcG9zW2ldO1xuICAgICAgcHJldiA9IHBvc1tpXTtcbiAgICB9XG4gIH1cbiAgcnVucy5wdXNoKFtzdCwgcHJldl0pO1xuICBpZiAocnVucy5sZW5ndGggPiAxICYmIHJ1bnNbMF1bMF0gPT09IDAgJiYgcnVuc1tydW5zLmxlbmd0aCAtIDFdWzFdID09PSBzaXplIC0gMSkge1xuICAgIHJldHVybiBydW5zLm1hcCgociwgaSkgPT4gKHsgYTogclswXSwgYjogclsxXSwgb3BlbkE6IGkgPT09IDAsIG9wZW5COiBpID09PSBydW5zLmxlbmd0aCAtIDEgfSkpO1xuICB9XG4gIHJldHVybiBydW5zLm1hcCgocikgPT4gKHsgYTogclswXSwgYjogclsxXSwgb3BlbkE6IGZhbHNlLCBvcGVuQjogZmFsc2UgfSkpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gb3V0bGluZVBhdGgoeCwgeSwgdywgaGgsIHIsIG9MLCBvUiwgb1QsIG9CKSB7XG4gIGNvbnN0IHJUTCA9ICFvVCAmJiAhb0wgPyByIDogMCwgclRSID0gIW9UICYmICFvUiA/IHIgOiAwLCByQlIgPSAhb0IgJiYgIW9SID8gciA6IDAsIHJCTCA9ICFvQiAmJiAhb0wgPyByIDogMDtcbiAgY29uc3QgZCA9IFtdO1xuICBpZiAoIW9UKSBkLnB1c2goYE0ke3ggKyByVEx9LCR7eX0gTCR7eCArIHcgLSByVFJ9LCR7eX1gKTtcbiAgaWYgKHJUUikgZC5wdXNoKGBNJHt4ICsgdyAtIHJUUn0sJHt5fSBBJHtyVFJ9LCR7clRSfSAwIDAgMSAke3ggKyB3fSwke3kgKyByVFJ9YCk7XG4gIGlmICghb1IpIGQucHVzaChgTSR7eCArIHd9LCR7eSArIHJUUn0gTCR7eCArIHd9LCR7eSArIGhoIC0gckJSfWApO1xuICBpZiAockJSKSBkLnB1c2goYE0ke3ggKyB3fSwke3kgKyBoaCAtIHJCUn0gQSR7ckJSfSwke3JCUn0gMCAwIDEgJHt4ICsgdyAtIHJCUn0sJHt5ICsgaGh9YCk7XG4gIGlmICghb0IpIGQucHVzaChgTSR7eCArIHcgLSByQlJ9LCR7eSArIGhofSBMJHt4ICsgckJMfSwke3kgKyBoaH1gKTtcbiAgaWYgKHJCTCkgZC5wdXNoKGBNJHt4ICsgckJMfSwke3kgKyBoaH0gQSR7ckJMfSwke3JCTH0gMCAwIDEgJHt4fSwke3kgKyBoaCAtIHJCTH1gKTtcbiAgaWYgKCFvTCkgZC5wdXNoKGBNJHt4fSwke3kgKyBoaCAtIHJCTH0gTCR7eH0sJHt5ICsgclRMfWApO1xuICBpZiAoclRMKSBkLnB1c2goYE0ke3h9LCR7eSArIHJUTH0gQSR7clRMfSwke3JUTH0gMCAwIDEgJHt4ICsgclRMfSwke3l9YCk7XG4gIHJldHVybiBkLmpvaW4oXCIgXCIpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24ga21hcFBpZWNlcyhjdWJlLCBuLCBncmlkVmFycywgcm93VmFycywgY29sVmFycywgZXh0cmEsIHNsaWNlKSB7XG4gIGZvciAobGV0IGogPSAwOyBqIDwgZXh0cmE7IGorKykge1xuICAgIGNvbnN0IGJpdCA9IDEgPDwgbiAtIDEgLSAoZ3JpZFZhcnMgKyBqKTtcbiAgICBpZiAoY3ViZS5tYXNrICYgYml0KSBjb250aW51ZTtcbiAgICBpZiAoKGN1YmUudiAmIGJpdCA/IDEgOiAwKSAhPT0gKHNsaWNlID4+IGV4dHJhIC0gMSAtIGogJiAxKSkgcmV0dXJuIFtdO1xuICB9XG4gIGNvbnN0IHJvd3MgPSBrbWFwQXJjcyhjdWJlLCBuLCAwLCByb3dWYXJzKSwgY29scyA9IGttYXBBcmNzKGN1YmUsIG4sIHJvd1ZhcnMsIGNvbFZhcnMpO1xuICBjb25zdCBvdXQgPSBbXTtcbiAgcm93cy5mb3JFYWNoKChyYSkgPT4gY29scy5mb3JFYWNoKChjYSkgPT4gb3V0LnB1c2goe1xuICAgIHIwOiByYS5hLFxuICAgIHIxOiByYS5iLFxuICAgIGMwOiBjYS5hLFxuICAgIGMxOiBjYS5iLFxuICAgIG9UOiByYS5vcGVuQSxcbiAgICBvQjogcmEub3BlbkIsXG4gICAgb0w6IGNhLm9wZW5BLFxuICAgIG9SOiBjYS5vcGVuQlxuICB9KSkpO1xuICByZXR1cm4gb3V0O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcmVuZGVyS21hcHMocGFyZW50LCBjLCBhbGwsIGV4cHJzLCBjdHgpIHtcbiAgY29uc3QgbiA9IGMuaW5wdXRzLmxlbmd0aDtcbiAgaWYgKG4gPCAyIHx8IG4gPiA2KSB7XG4gICAgaChcImRpdlwiLCBcImxnLW5vdGVcIiwgcGFyZW50LCBcIkthcm5hdWdoIG1hcHMgYXJlIGRyYXduIGZvciAyIHRvIDYgaW5wdXRzLlwiKTtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICBjb25zdCBncmlkVmFycyA9IE1hdGgubWluKG4sIDQpLCByb3dWYXJzID0gTWF0aC5mbG9vcihncmlkVmFycyAvIDIpLCBjb2xWYXJzID0gZ3JpZFZhcnMgLSByb3dWYXJzLCBleHRyYSA9IG4gLSBncmlkVmFycztcbiAgY29uc3QgblIgPSAxIDw8IHJvd1ZhcnMsIG5DID0gMSA8PCBjb2xWYXJzO1xuICBjb25zdCBDVyA9IDQ2LCBDSCA9IDM4LCBMQkxXID0gNjQsIEhEUkggPSA0NDtcbiAgY29uc3QgYml0cyA9ICh2LCBrKSA9PiBrID8gdi50b1N0cmluZygyKS5wYWRTdGFydChrLCBcIjBcIikgOiBcIlwiO1xuICBjb25zdCBjZWxsSW5kZXggPSAocmcsIGNnLCBzbGljZSkgPT4ge1xuICAgIGxldCBtID0gMDtcbiAgICBjb25zdCBwdXQgPSAodmFsLCBzdGFydEssIGNvdW50KSA9PiB7XG4gICAgICBmb3IgKGxldCBqID0gMDsgaiA8IGNvdW50OyBqKyspIG0gfD0gKHZhbCA+PiBjb3VudCAtIDEgLSBqICYgMSkgPDwgbiAtIDEgLSAoc3RhcnRLICsgaik7XG4gICAgfTtcbiAgICBwdXQocmcsIDAsIHJvd1ZhcnMpO1xuICAgIHB1dChjZywgcm93VmFycywgY29sVmFycyk7XG4gICAgcHV0KHNsaWNlLCBncmlkVmFycywgZXh0cmEpO1xuICAgIHJldHVybiBtO1xuICB9O1xuICBjb25zdCBhY3RpdmVzID0gW107XG4gIGV4cHJzLmZvckVhY2goKGUpID0+IHtcbiAgICBjb25zdCBibGsgPSBoKFwiZGl2XCIsIFwibGcta21hcC1ibG9ja1wiLCBwYXJlbnQpO1xuICAgIGNvbnN0IGhlYWQgPSBoKFwiZGl2XCIsIFwibGctdGl0bGVcIiwgYmxrKTtcbiAgICBoKFwic3BhblwiLCBcIlwiLCBoZWFkLCBgS2FybmF1Z2ggbWFwOiAke2UubmFtZX1gKTtcbiAgICBpZiAoZS5jb3YuY29uc3QgIT09IHZvaWQgMCkge1xuICAgICAgaChcImRpdlwiLCBcImxnLW5vdGVcIiwgYmxrLCBgJHtlLm5hbWV9IGlzIGNvbnN0YW50ICR7ZS5jb3YuY29uc3R9YCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGgoXCJzcGFuXCIsIFwibGctbXV0ZWQtdGV4dFwiLCBoZWFkLCBlLmNvdi5leGFjdCA/IFwiICBtaW5pbWFsIGNvdmVyIFwiIDogXCIgIG5lYXItbWluaW1hbCBjb3ZlciBcIik7XG4gICAgY29uc3Qgc3ZncyA9IFtdO1xuICAgIGFkZEV4cG9ydEJ1dHRvbihoZWFkLCBjdHguYXBwLCAoKSA9PiBzdmdzWzBdLCBcImthcm5hdWdoLVwiICsgZS5uYW1lKTtcbiAgICBjb25zdCBtYXBzID0gaChcImRpdlwiLCBcImxnLWttYXBzXCIsIGJsayk7XG4gICAgZm9yIChsZXQgc2xpY2UgPSAwOyBzbGljZSA8IDEgPDwgZXh0cmE7IHNsaWNlKyspIHtcbiAgICAgIGNvbnN0IGhvbGRlciA9IGgoXCJkaXZcIiwgXCJsZy1rbWFwLWhvbGRlclwiLCBtYXBzKTtcbiAgICAgIGNvbnN0IFcgPSBMQkxXICsgbkMgKiBDVyArIDgsIEggPSBIRFJIICsgblIgKiBDSCArIDg7XG4gICAgICBjb25zdCBzdmcgPSBzKFwic3ZnXCIsIHsgY2xhc3M6IFwibGctc3ZnIGxnLWttYXBcIiwgdmlld0JveDogYDAgMCAke1d9ICR7SH1gLCB3aWR0aDogVywgaGVpZ2h0OiBIIH0sIGhvbGRlcik7XG4gICAgICBzdmdzLnB1c2goc3ZnKTtcbiAgICAgIHMoXCJsaW5lXCIsIHsgY2xhc3M6IFwibGcta2xpbmVcIiwgeDE6IDAsIHkxOiAwLCB4MjogTEJMVywgeTI6IEhEUkggfSwgc3ZnKTtcbiAgICAgIHMoXCJ0ZXh0XCIsIHsgY2xhc3M6IFwibGcta2xhYmVsXCIsIHg6IExCTFcgLSA2LCB5OiAxNSwgXCJ0ZXh0LWFuY2hvclwiOiBcImVuZFwiIH0sIHN2ZywgYy5pbnB1dHMuc2xpY2Uocm93VmFycywgZ3JpZFZhcnMpLmpvaW4oXCJcIikpO1xuICAgICAgcyhcInRleHRcIiwgeyBjbGFzczogXCJsZy1rbGFiZWxcIiwgeDogNiwgeTogSERSSCAtIDcgfSwgc3ZnLCBjLmlucHV0cy5zbGljZSgwLCByb3dWYXJzKS5qb2luKFwiXCIpKTtcbiAgICAgIEtHUkFZKGNvbFZhcnMpLmZvckVhY2goKGNnLCBqKSA9PiBzKFwidGV4dFwiLCB7IGNsYXNzOiBcImxnLWtjb2RlXCIsIHg6IExCTFcgKyAoaiArIDAuNSkgKiBDVywgeTogSERSSCAtIDgsIFwidGV4dC1hbmNob3JcIjogXCJtaWRkbGVcIiB9LCBzdmcsIGJpdHMoY2csIGNvbFZhcnMpKSk7XG4gICAgICBLR1JBWShyb3dWYXJzKS5mb3JFYWNoKChyZywgaSkgPT4gcyhcInRleHRcIiwgeyBjbGFzczogXCJsZy1rY29kZVwiLCB4OiBMQkxXIC0gOCwgeTogSERSSCArIChpICsgMC41KSAqIENIICsgNCwgXCJ0ZXh0LWFuY2hvclwiOiBcImVuZFwiIH0sIHN2ZywgYml0cyhyZywgcm93VmFycykpKTtcbiAgICAgIFxuICAgICAgS0dSQVkocm93VmFycykuZm9yRWFjaCgocmcsIGkpID0+IEtHUkFZKGNvbFZhcnMpLmZvckVhY2goKGNnLCBqKSA9PiB7XG4gICAgICAgIGNvbnN0IG0gPSBjZWxsSW5kZXgocmcsIGNnLCBzbGljZSksIHZhbCA9IGFsbFttXVtlLm5hbWVdO1xuICAgICAgICBjb25zdCByZWN0ID0gcyhcInJlY3RcIiwgeyBjbGFzczogXCJsZy1rY2VsbFwiLCB4OiBMQkxXICsgaiAqIENXLCB5OiBIRFJIICsgaSAqIENILCB3aWR0aDogQ1csIGhlaWdodDogQ0ggfSwgc3ZnKTtcbiAgICAgICAgXG4gICAgICAgIGNvbnN0IGlzRG9udENhcmUgPSB2YWwgPT09IC0xO1xuICAgICAgICAvLyBVc2UgU1ZHLXNwZWNpZmljIGNsYXNzIGZvciBEb24ndCBDYXJlIChYKVxuICAgICAgICBjb25zdCB0ZXh0Q2xhc3MgPSBcImxnLWt2YWxcIiArICh2YWwgPT09IDEgPyBcIiBvbmVcIiA6IFwiXCIpICsgKGlzRG9udENhcmUgPyBcIiBsZy1rdmFsLXhcIiA6IFwiXCIpO1xuICAgICAgICBzKFwidGV4dFwiLCB7IGNsYXNzOiB0ZXh0Q2xhc3MsIHg6IExCTFcgKyAoaiArIDAuNSkgKiBDVywgeTogSERSSCArIChpICsgMC41KSAqIENIICsgNSwgXCJ0ZXh0LWFuY2hvclwiOiBcIm1pZGRsZVwiIH0sIHN2ZywgaXNEb250Q2FyZSA/IFwiWFwiIDogU3RyaW5nKHZhbCkpO1xuICAgICAgICBcbiAgICAgICAgLy8gQWRkIGNlbGwgbnVtYmVyIGluIHRoZSBib3R0b20gcmlnaHQgY29ybmVyIHdpdGggdGhlIG5ldyBpbnZlcnRlZCBjbGFzc1xuICAgICAgICBzKFwidGV4dFwiLCB7IGNsYXNzOiBcImxnLWtudW1cIiwgeDogTEJMVyArIChqICsgMSkgKiBDVyAtIDQsIHk6IEhEUkggKyAoaSArIDEpICogQ0ggLSA0LCBcInRleHQtYW5jaG9yXCI6IFwiZW5kXCIgfSwgc3ZnLCBTdHJpbmcobSkpO1xuXG4gICAgICAgIGNsaWNrYWJsZShyZWN0LCAoKSA9PiBjdHgub25QaWNrKG0pKTtcbiAgICAgICAgYWN0aXZlcy5wdXNoKHsgcmVjdCwgbSB9KTtcbiAgICAgIH0pKTtcbiAgICAgIFxuICAgICAgZS5jb3YuY292ZXIuZm9yRWFjaCgoY2IsIGdpKSA9PiB7XG4gICAgICAgIGNvbnN0IGNvbG9yID0gS0NPTE9SU1tnaSAlIEtDT0xPUlMubGVuZ3RoXSwgaW5zZXQgPSAzICsgZ2kgJSAzICogMztcbiAgICAgICAga21hcFBpZWNlcyhjYiwgbiwgZ3JpZFZhcnMsIHJvd1ZhcnMsIGNvbFZhcnMsIGV4dHJhLCBzbGljZSkuZm9yRWFjaCgocCkgPT4ge1xuICAgICAgICAgIGNvbnN0IHgwID0gTEJMVyArIHAuYzAgKiBDVyArIChwLm9MID8gMCA6IGluc2V0KSwgeDEgPSBMQkxXICsgKHAuYzEgKyAxKSAqIENXIC0gKHAub1IgPyAwIDogaW5zZXQpO1xuICAgICAgICAgIGNvbnN0IHkwID0gSERSSCArIHAucjAgKiBDSCArIChwLm9UID8gMCA6IGluc2V0KSwgeTEgPSBIRFJIICsgKHAucjEgKyAxKSAqIENIIC0gKHAub0IgPyAwIDogaW5zZXQpO1xuICAgICAgICAgIHMoXCJyZWN0XCIsIHsgY2xhc3M6IFwibGcta2ZpbGxcIiwgeDogeDAsIHk6IHkwLCB3aWR0aDogeDEgLSB4MCwgaGVpZ2h0OiB5MSAtIHkwLCByeDogOCwgZmlsbDogY29sb3IgfSwgc3ZnKTtcbiAgICAgICAgICBzKFwicGF0aFwiLCB7IGNsYXNzOiBcImxnLWtncm91cFwiLCBkOiBvdXRsaW5lUGF0aCh4MCwgeTAsIHgxIC0geDAsIHkxIC0geTAsIDgsIHAub0wsIHAub1IsIHAub1QsIHAub0IpLCBzdHJva2U6IGNvbG9yIH0sIHN2Zyk7XG4gICAgICAgIH0pO1xuICAgICAgfSk7XG4gICAgICBpZiAoZXh0cmEpIHMoXCJ0ZXh0XCIsIHsgY2xhc3M6IFwibGcta2NvZGVcIiwgeDogVyAtIDYsIHk6IDE0LCBcInRleHQtYW5jaG9yXCI6IFwiZW5kXCIgfSwgc3ZnLCBjLmlucHV0cy5zbGljZShncmlkVmFycykuam9pbihcIlwiKSArIFwiPVwiICsgYml0cyhzbGljZSwgZXh0cmEpKTtcbiAgICB9XG4gICAgY29uc3QgbGVnZW5kID0gaChcImRpdlwiLCBcImxnLWxlZ2VuZFwiLCBibGspO1xuICAgIGUuY292LmNvdmVyLmZvckVhY2goKGNiLCBnaSkgPT4ge1xuICAgICAgY29uc3QgaXRlbSA9IGgoXCJzcGFuXCIsIFwibGctbGVnZW5kLWl0ZW1cIiwgbGVnZW5kKTtcbiAgICAgIGgoXCJzcGFuXCIsIFwibGctc3dhdGNoXCIsIGl0ZW0pLnN0eWxlLmJhY2tncm91bmQgPSBLQ09MT1JTW2dpICUgS0NPTE9SUy5sZW5ndGhdO1xuICAgICAgbWF0aChjdWJlTGF0ZXgoYywgY2IpLCBpdGVtKTtcbiAgICB9KTtcbiAgfSk7XG4gIHJldHVybiB7IG1hcmtBY3RpdmUoaWR4KSB7XG4gICAgYWN0aXZlcy5mb3JFYWNoKChhKSA9PiBhLnJlY3QuY2xhc3NMaXN0LnRvZ2dsZShcImxnLWthY3RpdmVcIiwgYS5tID09PSBpZHgpKTtcbiAgfSB9O1xufSJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7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LEVBQUUsUUFBUSxDQUFDLFNBQVM7QUFDL0QsWUFBTSxPQUFPLEtBQUs7QUFDbEIsVUFBSSxDQUFDO0FBQU07QUFDWCxVQUFJLEtBQUssZUFBZSxPQUFPLEtBQUssWUFBWSxhQUFhLFlBQVk7QUFDdkUsYUFBSyxZQUFZLFNBQVMsSUFBSTtBQUFBLE1BQ2hDO0FBQUEsSUFDRixDQUFDO0FBQUEsRUFDSDtBQUFBLEVBRUEsTUFBTSxlQUFlO0FBQ25CLFNBQUssV0FBVyxpQkFBaUIsTUFBTSxLQUFLLFNBQVMsQ0FBQztBQUFBLEVBQ3hEO0FBQUEsRUFFQSxNQUFNLGVBQWU7QUFDbkIsU0FBSyxXQUFXLE9BQU8sT0FBTyxLQUFLLFVBQVUsaUJBQWlCLEtBQUssUUFBUSxDQUFDO0FBQzVFLFVBQU0sS0FBSyxTQUFTLEtBQUssUUFBUTtBQUFBLEVBQ25DO0FBQ0Y7IiwKICAibmFtZXMiOiBbImltcG9ydF9vYnNpZGlhbiIsICJzIiwgImltcG9ydF9vYnNpZGlhbiIsICJpbXBvcnRfb2JzaWRpYW4iLCAiaW1wb3J0X29ic2lkaWFuMyIsICJpbXBvcnRfb2JzaWRpYW4iLCAiaW1wb3J0X29ic2lkaWFuNSJdCn0K
