import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['dist/**', '.test-build/**', 'node_modules/**'] },
  js.configs.recommended,
  {
    files: ['packages/*/src/**/*.js'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'module', globals: { ...globals.browser } },
    rules: {
      'no-undef': 'error',                       // catches a forgotten import
      'no-unused-vars': ['warn', { args: 'none', caughtErrors: 'none' }],
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
  {
    // core/ is pure logic: no DOM helpers, no UI modules, no Obsidian API. This keeps it testable and reusable.
    files: ['packages/*/src/core/**/*.js', 'packages/*/src/vision/**/*.js'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [
        { group: ['**/ui/*', '**/settings/*'], message: 'core/ must not depend on the UI or settings layers.' },
        { group: ['obsidian'], message: 'core/ must not use the Obsidian API (keep it pure and testable).' },
      ] }],
    },
  },
  {
    files: ['tests/**/*.{js,cjs}', 'packages/*/tests/**/*.{js,cjs}', 'scripts/**/*.mjs'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'module', globals: { ...globals.node, ...globals.browser } },
  },
  {
    files: ['tests/**/*.cjs', 'packages/*/tests/**/*.test.js', 'packages/*/tests/**/*.cjs'],
    languageOptions: { sourceType: 'commonjs', globals: { ...globals.node, ...globals.browser } },
  },
];
