import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

// Some ESM module runners expose a CommonJS-like module object whose exports are read-only.
// Importing Leoric's ESM condition must not attempt to mutate that object.
Object.defineProperty(globalThis, 'module', {
  configurable: true,
  value: Object.freeze({ exports: {} }),
});

const leoric = await import('leoric');

assert.equal(typeof leoric.default, 'function');
assert.equal(leoric.default, leoric.default.default);

const require = createRequire(import.meta.url);
const commonjs = require('leoric');

assert.equal(typeof commonjs, 'function');
assert.equal(commonjs, commonjs.default);

const models = fileURLToPath(new URL('./fixtures/esm/models', import.meta.url));
const migrations = fileURLToPath(new URL('./fixtures/esm/migrations', import.meta.url));
const { default: Item } = await import('./fixtures/esm/models/item.mjs');

const realm = await leoric.connect({
  dialect: 'sqlite',
  client: 'sqlite3',
  database: ':memory:',
  models,
  migrations,
});

try {
  await realm.sync();
  await Item.create({ id: 1 });
  assert.equal(await Item.count(), 1);

  await realm.migrate();
  const { rows } = await realm.driver.query(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'esm_migration_items'",
  );
  assert.equal(rows[0].name, 'esm_migration_items');
  await realm.rollback();
} finally {
  await leoric.disconnect(realm);
}

const browserBuild = await build({
  stdin: {
    contents: 'import Realm from "leoric"; console.log(Realm);',
    resolveDir: process.cwd(),
    sourcefile: 'browser-consumer.js',
  },
  bundle: true,
  platform: 'browser',
  format: 'esm',
  write: false,
  metafile: true,
  logLevel: 'silent',
  // The existing browser entry expects consumers to provide these shims.
  external: ['util', 'perf_hooks'],
});

const browserInputs = Object.keys(browserBuild.metafile.inputs)
  .map(file => file.replaceAll('\\', '/'));

assert.ok(browserInputs.some(file => file.endsWith('/dist/browser.js') || file === 'dist/browser.js'));
assert.ok(!browserInputs.some(file => file.endsWith('/dist/index.js') || file === 'dist/index.js'));
