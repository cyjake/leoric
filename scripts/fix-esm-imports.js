'use strict';

const fs = require('fs');
const path = require('path');

const distDir = path.resolve(__dirname, '..', 'dist');

function walkDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkDir(fullPath));
    } else if (entry.name.endsWith('.js')) {
      files.push(fullPath);
    }
  }
  return files;
}

function resolveSpecifier(filePath, specifier) {
  const dir = path.dirname(filePath);
  const target = path.resolve(dir, specifier);

  // Already has .js extension
  if (specifier.endsWith('.js')) return specifier;

  // Check if it resolves as a file with .js
  if (fs.existsSync(target + '.js')) {
    return specifier + '.js';
  }

  // Check if it resolves as a directory with index.js
  if (fs.existsSync(path.join(target, 'index.js'))) {
    return specifier + '/index.js';
  }

  return specifier;
}

const importExportRe = /(?<=(from\s+|import\s*)\s*)(['"])(\.\.?\/[^'"]*)\2/g;
const dynamicImportRe = /(?<=import\s*\(\s*)(['"])(\.\.?\/[^'"]*)\1/g;

function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  content = content.replace(importExportRe, (match, _kw, quote, specifier) => {
    const resolved = resolveSpecifier(filePath, specifier);
    if (resolved !== specifier) {
      changed = true;
      return `${quote}${resolved}${quote}`;
    }
    return match;
  });

  content = content.replace(dynamicImportRe, (match, quote, specifier) => {
    const resolved = resolveSpecifier(filePath, specifier);
    if (resolved !== specifier) {
      changed = true;
      return `${quote}${resolved}${quote}`;
    }
    return match;
  });

  if (changed) {
    fs.writeFileSync(filePath, content);
  }
}

const files = walkDir(distDir);
for (const file of files) {
  fixFile(file);
}

// Write dist/package.json to mark the directory as ESM
fs.writeFileSync(path.join(distDir, 'package.json'), JSON.stringify({ type: 'module' }, null, 2) + '\n');

console.log(`Fixed imports in ${files.length} files, wrote dist/package.json`);
