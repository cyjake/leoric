#!/usr/bin/env node
/**
 * Generate AI-friendly documentation files for the docs site:
 *
 * - docs/llms.txt          — index of guides for LLM crawlers/agents (llmstxt.org style)
 * - docs/llms-full.txt     — all English guides concatenated into a single markdown file
 * - docs/llms-full-zh.txt  — all Chinese guides concatenated into a single markdown file
 *
 * Run via `npm run docs:llms` or directly: node scripts/build-llms.mjs
 * The GitHub Pages workflow regenerates these files before building the site.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DOCS = join(ROOT, 'docs');
const BASE_URL = 'https://leoric.js.org';

const EXCLUDED = new Set([
  'index.md',
  'playground.html',
  'search.html',
  'CNAME',
  'favicon.ico',
  'Gemfile',
  'Gemfile.lock',
  '_config.yml',
  'build-playground.mjs',
  'playground-entry.mjs',
]);

const DIRECTORIES_TO_SKIP = new Set([
  '_layouts',
  '_sass',
  'api',
  'assets',
  'updates',
  'vendor',
  '.bundle',
  '_site',
]);

// Guide order mirrors the site navigation in docs/_layouts/en.html
const GUIDE_ORDER = [
  'starter.md',
  'basics.md',
  'migrations.md',
  'validations.md',
  'associations.md',
  'querying.md',
  'json.md',
  'hooks.md',
  'logging.md',
  'types.md',
  'sequelize.md',
  'setup/index.md',
  'setup/egg.md',
  'setup/express.md',
  'setup/midway.md',
  'setup/mysql.md',
  'setup/sqlite.md',
  'setup/postgres.md',
  'data-types.md',
  'transactions.md',
  'raw-query.md',
  'soft-delete.md',
  'index-hints.md',
  'realm.md',
  'best-practices.md',
  'troubleshooting.md',
  'contributing/guides.md',
  'ai-cookbook.md',
];

const GUIDE_TITLES = {
  'starter.md': 'Starter',
  'basics.md': 'Basics',
  'migrations.md': 'Migrations',
  'validations.md': 'Validations',
  'associations.md': 'Associations',
  'querying.md': 'Query Interface',
  'json.md': 'JSON Fields',
  'hooks.md': 'Hooks',
  'logging.md': 'Logging',
  'types.md': 'TypeScript Support',
  'sequelize.md': 'Sequelize Adapter',
  'setup/index.md': 'Setup Summary',
  'setup/egg.md': 'Setup with Egg / Chair',
  'setup/express.md': 'Setup with Express',
  'setup/midway.md': 'Setup with Midway',
  'setup/mysql.md': 'Setup with MySQL',
  'setup/sqlite.md': 'Setup with SQLite',
  'setup/postgres.md': 'Setup with PostgreSQL',
  'data-types.md': 'Data Types',
  'transactions.md': 'Transactions',
  'raw-query.md': 'Raw Query',
  'soft-delete.md': 'Soft Delete',
  'index-hints.md': 'Index Hints',
  'realm.md': 'Realm',
  'best-practices.md': 'Best Practices',
  'troubleshooting.md': 'Troubleshooting',
  'contributing/guides.md': 'Contributing Guides',
  'ai-cookbook.md': 'AI Cookbook',
};

const ZH_GUIDE_TITLES = {
  'starter.md': '快速开始',
  'basics.md': '基础',
  'migrations.md': '数据迁移',
  'validations.md': '数据校验',
  'associations.md': '关联',
  'querying.md': '查询',
  'json.md': 'JSON 字段',
  'hooks.md': '钩子',
  'logging.md': '日志',
  'types.md': 'TypeScript 支持',
  'sequelize.md': 'Sequelize 适配',
  'setup/index.md': '环境配置',
  'setup/egg.md': '在 Egg / Chair 中使用',
  'setup/express.md': '在 Express 中使用',
  'setup/midway.md': '在 Midway 中使用',
  'setup/mysql.md': '在 MySQL 中使用',
  'setup/sqlite.md': '在 SQLite 中使用',
  'setup/postgres.md': '在 PostgreSQL 中使用',
  'data-types.md': '数据类型',
  'transactions.md': '事务',
  'raw-query.md': '原始查询',
  'soft-delete.md': '软删除',
  'index-hints.md': '索引提示',
  'realm.md': 'Realm',
  'best-practices.md': '最佳实践',
  'troubleshooting.md': '常见问题',
  'contributing/guides.md': '贡献指南',
  'ai-cookbook.md': 'AI 代码手册',
};

function parseFrontMatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) return { title: '', body: content };
  const meta = {};
  for (const line of match[1].split('\n')) {
    const [key, ...rest] = line.split(':');
    if (key && rest.length) meta[key.trim()] = rest.join(':').trim();
  }
  return { title: meta.title || '', body: content.slice(match[0].length) };
}

function stripTableOfContents(body) {
  return body
    .replace(/^## (Table of Contents|目录)\r?\n\{:.no_toc\}\r?\n\r?\n1\. (Table of Contents|目录)\r?\n\{:toc\}\r?\n?/m, '')
    .replace(/^## (Table of Contents|目录)\r?\n/m, '')
    .replace(/\{:(\.no_toc|toc)\}/g, '');
}

function readGuide(relativePath, dir) {
  const file = join(dir, relativePath);
  let content;
  try {
    content = readFileSync(file, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
  const { title, body } = parseFrontMatter(content);
  return { title, body: stripTableOfContents(body).trim() };
}

function collectGuides(dir, titles) {
  const guides = [];
  for (const relativePath of GUIDE_ORDER) {
    const guide = readGuide(relativePath, dir);
    if (!guide) continue;
    // lift headings one level so the document title can sit at ##
    const body = guide.body
      .split('\n')
      .map(line => {
        const match = line.match(/^(#{1,5})\s/);
        return match ? `#${match[1]}${line.slice(match[1].length)}` : line;
      })
      .join('\n');
    guides.push({ relativePath, title: guide.title || titles[relativePath] || relativePath, body });
  }
  return guides;
}

function buildIndex(guides, zhGuides) {
  const lines = [
    '# Leoric',
    '',
    '> An object-relational mapping library for Node.js, heavily influenced by Active Record of Ruby on Rails.',
    '> Declare models as classes extending Bone, connect to MySQL/PostgreSQL/SQLite through Realm,',
    '> and query with a chainable API.',
    '',
    '## Guides (English)',
    '',
  ];
  for (const guide of guides) {
    lines.push(`- [${guide.title}](https://leoric.js.org/${guide.relativePath.replace(/\.md$/, '.html')}): ${guide.title}`);
  }
  lines.push('', '## 指南（中文）', '');
  for (const guide of zhGuides) {
    lines.push(`- [${guide.title}](https://leoric.js.org/zh/${guide.relativePath.replace(/\.md$/, '.html')}): ${guide.title}`);
  }
  lines.push('', '## References', '');
  lines.push('- [API Documentation](https://leoric.js.org/api/)');
  lines.push('- [llms-full.txt](https://leoric.js.org/llms-full.txt): all English guides concatenated, suitable for single-shot context injection');
  lines.push('- [llms-full-zh.txt](https://leoric.js.org/llms-full-zh.txt): all Chinese guides concatenated');
  lines.push('');
  return lines.join('\n');
}

function buildFull(guides, language) {
  const intro = language === 'zh'
    ? '# Leoric 中文文档全集\n\n> 由 docs/zh 下的指南拼接而成，供 AI 代理一次性获取完整上下文。\n'
    : '# Leoric Documentation (Full)\n\n> Concatenated from the guides under docs/, for AI agents to load the full context in one shot.\n';
  const parts = [intro];
  for (const guide of guides) {
    parts.push(`\n## ${guide.title}\n\n${guide.body}\n`);
  }
  return parts.join('\n');
}

const guides = collectGuides(DOCS, GUIDE_TITLES);
const zhGuides = collectGuides(join(DOCS, 'zh'), ZH_GUIDE_TITLES);

// BOM makes browsers treat the files as UTF-8 even when the server serves
// text/plain without a charset; only needed for files containing Chinese text
writeFileSync(join(DOCS, 'llms.txt'), `\ufeff${buildIndex(guides, zhGuides)}`);
writeFileSync(join(DOCS, 'llms-full.txt'), buildFull(guides, 'en'));
writeFileSync(join(DOCS, 'llms-full-zh.txt'), `\ufeff${buildFull(zhGuides, 'zh')}`);

console.log(`Generated llms.txt with ${guides.length} English and ${zhGuides.length} Chinese guides`);
console.log(`- ${join(DOCS, 'llms.txt')}`);
console.log(`- ${join(DOCS, 'llms-full.txt')}`);
console.log(`- ${join(DOCS, 'llms-full-zh.txt')}`);
