# Logic Graph for Obsidian

Draw logic circuits, truth tables, Karnaugh maps and timing from a plain-text code block.

````
```logic
(a,b) AND (c)
(c,b) XOR (d)
(d) NOT (y)
```
````

This repository holds two Obsidian plugins:

| Package | Plugin id | What it is |
|---|---|---|
| [`packages/logic-graph`](packages/logic-graph) | `logic-graph` | The main plugin: parser, analysis, drawing, settings. |
| [`packages/logic-graph-import`](packages/logic-graph-import) | `logic-graph-import` | Optional companion: turns a picture of a circuit into a block, offline. |

Obsidian only loads a single `main.js` per plugin, so the source is split into small modules under `src/` and **bundled** into `dist/<id>/main.js` by `npm run build`. Never edit anything in `dist/`.

## Getting started

```bash
npm install
npm run build          # -> dist/logic-graph/ and dist/logic-graph-import/
npm test               # unit tests for both packages
npm run lint           # eslint (also guards the architecture, see CONTRIBUTING.md)
npm run check          # lint + test + build: run this before you push
```

### Developing against a real vault

```bash
VAULT=/path/to/your/vault npm run dev
```

Rebuilds on every save and copies `main.js`, `manifest.json` and `styles.css` into `<vault>/.obsidian/plugins/<id>/`. In Obsidian use the "Reload app without saving" command (or the Hot-Reload community plugin) to pick up changes.

### Installing a build by hand

Copy the three files of `dist/<id>/` into `<vault>/.obsidian/plugins/<id>/` and enable the plugin. Install both folders to use image import.

## Repository layout

```
packages/
  logic-graph/
    manifest.json          plugin id and version (the single source of the version)
    src/
      main.js              plugin entry: settings, code-block processor, commands, api
      templates.js         circuit templates + picker
      core/                pure logic, no DOM, no Obsidian (see CONTRIBUTING.md)
      ui/                  everything that draws
      settings/            defaults, validation, settings page
      styles/              CSS pieces, concatenated in file-name order into styles.css
    tests/                 node:test suites (+ entry.js that re-exports every module)
  logic-graph-import/
    src/
      main.js              the "Import circuit from image" command
      import.js            decode image, pick local/cloud, validate
      providers.js         cloud providers (under construction): token checks, error texts
      vision/              the local recognizer (pure pixel logic)
    tests/                 recognizer tests on PNG fixtures
scripts/                   build.mjs, test.mjs
tests/helpers/             fake "obsidian" module, jsdom setup, random circuits
```

## More

- [CONTRIBUTING.md](CONTRIBUTING.md): architecture, conventions and recipes ("how do I add a gate / directive / setting / provider").
- Users: add `@help` to a logic block for the in-app reference.

## Known limits

- Truth tables, Karnaugh maps and minimisation work up to 12 inputs (2^n rows); the diagram and simulation work up to 32 inputs and 256 gates.
- The local image recognizer reads clean, high-contrast schematics with standard gate shapes. It does not read signal names, and it fails on 2 of 36 fixtures (complex circuits in dark theme; marked `todo` in the tests).
- PNG export and the browser animation are exercised only with stubs in the tests, so check them in a real Obsidian after UI changes.
