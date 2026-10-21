# Contributing

## The one rule that keeps this maintainable

**`core/` (and `vision/`) are pure.** They take plain data and return plain data. No `document`, no `obsidian`, no imports from `ui/` or `settings/`. ESLint enforces it (`no-restricted-imports`), so a violation fails `npm run lint`. Everything that touches the DOM or the Obsidian API lives in `ui/`, `settings/`, `templates.js` or `main.js`.

Why it matters: pure code is testable with a few lines and can be reused (for example by the import extension or a future CLI).

## Data flow

```
 text of a ```logic block
        │  core/parser.js           parse()
        ▼
   circuit object ───────────────────────────────┐
        │                                        │
        │ core/sim.js     truthTable(), createSim() (delays)
        │ core/minimize.js  Quine-McCluskey, exact minimum cover, buildExpressions()
        │ core/reduce.js    reduceCircuit(): structural rewrite / two-level, always verified
        │ core/bubbles.js   bubbleForms(): De Morgan symbol choice
        ▼                                        ▼
   ui/block.js  renderBlock()  ──────►  ui/diagram.js, table.js, kmap.js, timing.js, help.js
```

### The circuit object (what `parse()` returns)

```js
{
  gates:   [{ type: 'AND', ins: ['a','b'], out: 'c', line: 1 }, ...],   // as written
  order:   [...],            // the same gate objects, topologically sorted
  inputs:  ['a','b'],        // signals no gate drives (order of first appearance)
  outputs: ['y'],            // signals nothing uses
  middles: ['c','d'],        // driven and used
  driver:  { c: <gate>, ... },   // signal -> the gate that drives it
  used:    Set,              // signals used as an input somewhere
  opts:    { hide, show, simplify, bubbles, delay, compact, timing, help },  // @directives
}
```

`ui/layout.js` adds `level`, `x0`, `cy`, `H` to the gate objects while laying out. Treat those as scratch values owned by the layout.

## Module map

| Module | Purpose |
|---|---|
| `core/constants.js` | Limits (`HARD_MAX_*`, `ANALYSIS_MAX_INPUTS`, `MAX_GATE_FANIN`), option lists, `clamp` |
| `core/gates.js` | `GATES` table (truth function, drawing shape, inverting?), `SHAPE_FN`, gate-family lookups |
| `core/parser.js` | `parse()`, `@directive` handling, `assemble()` (topological order, loop detection) |
| `core/sim.js` | `evaluate()`, `truthTable()`, `createSim()` event-driven delay simulation |
| `core/latex.js` | Structural expression of a signal as LaTeX |
| `core/minimize.js` | Quine-McCluskey, exact minimum cover (branch and bound), minimal expressions |
| `core/compact.js` | Merging truth-table rows into rows with X |
| `core/synthesize.js` | Two-level circuits from the minimal cover (SOP, POS, NAND-NAND, NOR-NOR) |
| `core/bubbles.js` | Bubble pushing (textbook method) |
| `core/reduce.js` | Structural reduction, equivalence check, `reduceCircuit()` |
| `ui/dom.js` | `h()` (HTML) and `s()` (SVG) element helpers, `math()` |
| `ui/layout.js` | Placement of inputs/gates, detour lanes for wires that would cross a gate |
| `ui/diagram.js` | The interactive diagram: wires, gates, bubbles, lamps, travelling bits |
| `ui/timing.js` | Timing graph |
| `ui/table.js`, `ui/kmap.js` | Truth table, Karnaugh maps |
| `ui/export-image.js` | PNG/SVG export (inlines the theme's CSS into a copy of the SVG) |
| `ui/copy.js` | Markdown / LaTeX / Mermaid exports |
| `ui/help.js` | The `@help` reference (data-driven: edit the `HELP` array) |
| `ui/block.js` | `renderBlock()`: decides which parts to show and wires them together |
| `settings/*` | Defaults + validation, provider list, settings page |

## Conventions

- Plain ES modules, no TypeScript (yet). Add JSDoc where a signature is not obvious.
- Keep modules small. If a file passes ~250 lines, look for a natural seam.
- Every behaviour change comes with a test. Property tests (random circuits checked against brute force) are the most valuable ones here; see `tests/helpers/rand.cjs`.
- One version number: `packages/<pkg>/manifest.json`. The bundle banner and `api.version` read from it.
- Do not minify the bundles. Readable output makes bug reports and plugin review easier.

## Recipes

### Add a gate type
1. `core/gates.js`: add an entry to `GATES` (`min`/`max` inputs, `shape`, `inv`, `fn`). If it is a new family, update `BASE`/`INVERSE`.
2. `ui/layout.js` (`gatePath`) and `ui/diagram.js` only if it needs a new symbol shape.
3. `core/reduce.js` and `core/bubbles.js` if the rewrite rules or De Morgan duals should know about it.
4. Add it to `HELP` in `ui/help.js` (the test suite parses every help example) and to the random generator in `tests/helpers/rand.cjs` so property tests cover it.

### Add a `@directive`
1. `core/parser.js`: add a `case` in `applyDirective()` and a field in `opts`.
2. `ui/block.js`: read it from `c.opts` (it overrides the matching setting).
3. `ui/help.js`: document it with an example. Add a test in `tests/core.test.js`.

### Add a setting
1. `settings/settings.js`: default + validation in `sanitizeSettings()`.
2. `settings/tab.js`: the control.
3. Use it in `ui/block.js` (`renderBlock` receives the plugin, so `plugin.settings`).

### Add a reduction rule
Add a numbered step inside the loop of `reduceStructural()` in `core/reduce.js`. Rules must never add gates and must keep output signal names. `tests/reduce.test.js` checks equivalence on random circuits, so a wrong rule is caught quickly.

### Add an image-import provider
1. `packages/logic-graph-import/src/providers.js`: add it to `PROVIDERS` (name and token format), write the adapter, and map HTTP errors with `explainHttp()`.
2. Flip `CLOUD_ENABLED` only when the adapters are ready. Token errors come first, by design.
3. Add the provider to `PROVIDERS` in the main plugin's `settings/providers.js` so it shows up in the settings dropdown.

### Improve the recognizer
Add a failing fixture first: render the circuit with `packages/logic-graph-import/tests/make-fixtures.cjs` (needs python3 + cairosvg), commit the PNG, then fix `vision/`. `recognizer.test.js` lists known gaps as `todo`.

## Before you open a pull request

```bash
npm run check
```

and, for anything visual, try it in a real vault with `VAULT=… npm run dev`.
