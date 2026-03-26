import { build } from 'esbuild';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

await build({
  entryPoints: ['docs/playground-entry.mjs'],
  bundle: true,
  format: 'iife',
  globalName: 'Leoric',
  outfile: 'docs/assets/javascript/leoric.bundle.js',
  platform: 'browser',
  target: 'es2020',
  minify: true,
  alias: {
    'util': path.resolve(__dirname, 'shims/util-shim.mjs'),
    'perf_hooks': path.resolve(__dirname, 'shims/perf-hooks-shim.mjs'),
  },
  external: ['fs', 'path', 'crypto', 'net', 'tls', 'dns', 'stream', 'zlib', 'http', 'https', 'events', 'os', 'child_process', 'assert', 'querystring', 'url', 'string_decoder', 'buffer'],
  define: {
    'process.env.NODE_ENV': '"production"',
    'process.env.DEBUG': '""',
    'process.env': '{}',
  },
});

// Prepend eslint-disable to avoid lint errors on generated code
const bundlePath = 'docs/assets/javascript/leoric.bundle.js';
const content = fs.readFileSync(bundlePath, 'utf8');
fs.writeFileSync(bundlePath, '/* eslint-disable */\n' + content);

console.log('Built docs/assets/javascript/leoric.bundle.js');
