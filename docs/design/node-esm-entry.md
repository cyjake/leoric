# Node ESM Entry via Conditional Exports

## Status

Implemented in #465 and #485, with package-resolution and cross-platform
hardening added afterward.

## Context

Leoric historically shipped two JavaScript builds:

- CommonJS in `lib/`, used as the Node entry through `main`.
- ESM in `dist/`, originally exposed only through the legacy `browser` field.

Dynamic `require(options.client)` calls in database drivers fail when Leoric is
consumed from ESM output, including server bundles produced by esbuild and
Turbopack-based tools. The existing `dist/` build also lacked the file
extensions and package boundary needed by the Node ESM loader.

## Decision

Leoric ships first-class CommonJS and Node ESM entries through conditional
exports:

```json
{
  "exports": {
    ".": {
      "types": "./lib/index.d.ts",
      "browser": "./dist/browser.js",
      "import": "./dist/index.js",
      "require": "./lib/index.js"
    }
  }
}
```

The `browser` condition keeps browser-aware bundlers on the restricted browser
entry. The top-level `browser` field remains for legacy bundlers.

Optional database clients are loaded lazily with `import()`. MySQL and
PostgreSQL create their pools on first use, while SQLite loads its configured
client when the first connection is requested. This avoids adding a new public
driver lifecycle method and preserves lazy optional dependencies.

Model and migration files are also loaded with `import()`. Native ESM converts
filesystem paths to `file:` URLs so Windows drive-letter paths are valid module
specifiers. The CommonJS build retains filesystem paths because TypeScript
lowers its dynamic imports to `require()`.

## Build

`tsconfig.esm.json` emits ES2020 modules into `dist/`. The
`scripts/fix-esm-imports.js` post-build step currently:

1. Adds `.js` or `/index.js` to relative module specifiers.
2. Removes the CommonJS compatibility assignment from the ESM entry.
3. Writes `dist/package.json` with `{ "type": "module" }`.

The post-build rewriting is an implementation compromise. A future cleanup can
move source imports to explicit `.js` specifiers and use a NodeNext-compatible
build, eliminating regex-based source rewriting.

## Compatibility

- `require('leoric')` resolves to `lib/index.js` and remains the Realm class.
- `import 'leoric'` resolves to `dist/index.js` with default and named exports.
- Browser-aware bundlers resolve to `dist/browser.js`.
- The minimum supported runtime remains Node 18.

Loading both conditions in the same process creates separate CommonJS and ESM
module instances. Consumers should use one module system consistently when
identity or `instanceof` checks cross package boundaries.

## Verification

`npm run test:esm` builds both formats and verifies:

1. Bare package import selects the ESM condition.
2. Bare package require selects the CommonJS condition.
3. The ESM entry loads model and migration directories and completes a SQLite
   connect, sync, migration, insert, and query cycle.
4. A browser-targeted esbuild bundle selects `dist/browser.js`, not the Node
   ESM entry.

The regular unit and integration suites continue to exercise the CommonJS
build and all supported database dialects.
