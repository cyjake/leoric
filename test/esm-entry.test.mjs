import assert from 'node:assert/strict';

// Some ESM module runners expose a CommonJS-like module object whose exports are read-only.
// Importing Leoric's ESM condition must not attempt to mutate that object.
Object.defineProperty(globalThis, 'module', {
  configurable: true,
  value: Object.freeze({ exports: {} }),
});

const leoric = await import('../dist/index.js');

assert.equal(typeof leoric.default, 'function');
assert.equal(leoric.default, leoric.default.default);
