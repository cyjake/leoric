#!/usr/bin/env node

'use strict';

// tsc's declaration emitter widens some generics to `/*elided*/ any` when
// declaring the anonymous class returned by the `sequelize()` mixin factory
// (types/adapters/sequelize.ts). The hand-written declaration below models
// the same public shape without hitting that emitter limitation, so it is
// applied on top of the compiler's own output for the main (non-ts4.9)
// declaration files as well.
//
// This runs before `build:types:ts4.9`, which copies from lib/ into
// types/ts4.9/ and then applies its own overrides (see
// scripts/build-ts49-types.js) — so the ts4.9 output picks up this fix too.

const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const libDir = path.join(rootDir, 'lib');
const overridesDir = path.join(rootDir, 'types', 'ts4.9-overrides');

const overrides = [
  'adapters/sequelize.d.ts',
];

if (!fs.existsSync(libDir)) {
  throw new Error(`missing ${libDir}; run "tsc" first`);
}

for (const relPath of overrides) {
  const src = path.join(overridesDir, relPath);
  const dest = path.join(libDir, relPath);
  fs.copyFileSync(src, dest);
  console.log(`applied override: ${relPath}`);
}
