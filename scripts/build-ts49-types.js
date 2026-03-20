#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const libDir = path.join(rootDir, 'lib');
const outDir = path.join(rootDir, 'types', 'ts4.9');
const overridesDir = path.join(rootDir, 'types', 'ts4.9-overrides');

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyDtsOnly(srcDir, destDir) {
  ensureDir(destDir);
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      copyDtsOnly(srcPath, destPath);
    } else if (entry.isFile() && entry.name.endsWith('.d.ts')) {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function replaceInFile(filePath, from, to) {
  const text = fs.readFileSync(filePath, 'utf8');
  if (!text.includes(from)) {
    throw new Error(`expected pattern not found in ${filePath}: ${from}`);
  }
  fs.writeFileSync(filePath, text.replace(from, to));
}

function copyOverrides(srcDir, destDir) {
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      copyOverrides(srcPath, destPath);
    } else if (entry.isFile() && entry.name.endsWith('.d.ts')) {
      ensureDir(path.dirname(destPath));
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

if (!fs.existsSync(libDir)) {
  throw new Error(`missing ${libDir}; run \"npm run prepack\" first`);
}

fs.rmSync(outDir, { recursive: true, force: true });
copyDtsOnly(libDir, outDir);

replaceInFile(
  path.join(outDir, 'index.d.ts'),
  "export type * from './types/common';",
  "export * from './types/common';"
);

replaceInFile(
  path.join(outDir, 'data_types.d.ts'),
  'cast(value: Buffer | string): Buffer<ArrayBufferLike>;',
  'cast(value: Buffer | string): Buffer;'
);

copyOverrides(overridesDir, outDir);
console.log('generated TS4.9 declaration output at types/ts4.9');
