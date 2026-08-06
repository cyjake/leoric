# 代理指南（Agent Guidelines）

本文件用于指导在 leoric 仓库中工作的 AI 编码代理。动手改代码前请先阅读：
这里记录了无法仅从代码推断出的约定。英文原版见 [AGENTS.md](./AGENTS.md)。

## 项目概览

Leoric 是一个受 Ruby on Rails Active Record 启发的 Node.js ORM 库。模型以继承
`Bone` 的类声明，通过 `Realm` 连接 MySQL/PostgreSQL/SQLite，并以链式 API 查询。
源码为 TypeScript（`src/`）；`tsc` 产出 JavaScript（`lib/` 为 CJS、`dist/` 为 ESM）
与声明文件（`lib/*.d.ts`），随 npm 包发布。

## 常用命令

| 命令 | 用途 |
|---|---|
| `npm run prepack` | 构建 `lib/`（CJS）与声明文件；同时经 `scripts/build-ts49-types.js` 生成 ts4.9 兼容类型 |
| `npm run prepack:browser` | 构建 `dist/` ESM 产物 |
| `npm run test:sqlite` | 最快的测试方式（单方言，经 `test/start.sh` 运行） |
| `npm run test:unit` | 仅单元测试 |
| `npm run test` | 全量测试：先单元，后各方言集成 |
| `npm run test:dts` | 类型级测试（`test/types/*.test.ts`；消费方 fixture 由 `test:dts:ts5`、`test:dts:ts4.9` 驱动） |
| `npm run lint` | 全仓库 ESLint |
| `npm run jsdoc` | 由 JSDoc 重新生成 `docs/api` |

注意：

- 测试经 mocha + ts-node 通过 `test/start.sh` 运行，测试前无需构建。
- 集成测试需要本机数据库，参见 `test/prepare.sh` 与 `test/start.sh` 的初始化方式。
- `lib/` 与 `dist/` 是构建产物——不要直接编辑，用 `npm run prepack` 重新生成。

## 架构

- `src/bone.ts` — 用户继承的 `Bone` 基类；类型化查询入口（`find`、`findOne`、`sum`、`restore`、`update`...）
- `src/abstract_bone.ts` — 模型核心实现：属性、关联、生命周期、`init()`/`sync()`、实例方法（`save`、`remove`、`reload`、`toObject`...）
- `src/model.ts` — 模型类编译（`compileModel`）与 `LeoricModelCompilationError`
- `src/realm/base.ts` — `Realm`：连接管理、`define()`、模型注册、`connect()`/`sync()`/`query()`/`transaction()`
- `src/drivers/` — SQL 方言（`mysql`、`postgres`、`sqlite`、`sqljs`），基于 `drivers/abstract`
- `src/spell.ts` — 链式查询构建器（`where`、`order`、`limit`、`with`...），经 `src/expr.ts` / `src/expr_formatter.ts` 生成 SQL
- `src/query_object.ts` — 条件解析（`$gt`、`$in` 等操作符），供 spell 使用
- `src/data_types.ts` — `DataTypes` 定义
- `src/adapters/sequelize.ts` — Sequelize 兼容层
- `src/index.ts` — 公共入口；统一导出用户从 `leoric` 导入的一切

依赖方向：`bone → abstract_bone → drivers`、`spell → expr`、`realm → drivers`。

## 核心约定

- 模型属性通过 `static attributes = {...}` 或 `realm.define(Model, attributes)` 声明；关联在 `static initialize()` 内声明（`belongsTo` / `hasMany` / `hasOne`）。
- `realm.connect()` 之前不能查询模型；如需由模型定义建表/迁移，调用 `realm.sync()`。
- 新增公共 API 必须带 JSDoc（`@param` / `@returns` / `@example`），并从 `src/index.ts` 导出，保证生成的 `.d.ts` 自文档化。
- 类型兼容性由 `test/fixtures/ts5-consumer` 与 `test/fixtures/ts49-consumer` 验证（见 `package.json` 的 `typesVersions` 映射）；改动公共类型后运行 `npm run test:dts`。
- 提交遵循 Conventional Commits；版本发布由 release-please 管理（`release-please-config.json`）——不要手动改版本号。
- `docs/` 是部署到 leoric.js.org 的 Jekyll 站点；新增或修改面向用户的文档时，同步更新 `docs/zh/`。
- `docs/llms.txt` / `llms-full*.txt` 由 `scripts/build-llms.mjs` 生成并随 npm 包发布——修改指南后运行 `npm run docs:llms`，新指南需加入该脚本的 `GUIDE_ORDER`。

## 常见坑

- 查询改动至少要在两个方言上验证（如 `test:sqlite` + `test:postgres`）：MySQL/PostgreSQL/SQLite 在引号、LIMIT 语法、upsert 支持上均有差异。
- 浏览器构建有独立入口（`src/browser.ts`）；浏览器专属代码不要放进共享模块。
- `src/index.ts` 通过 `Object.assign(Realm.prototype, migrations)` 把迁移辅助函数挂到 Realm——新增 realm 方法时保持该接线同步。
- 软删除与 paranoid 作用域会影响 `find`/`count`；改动查询行为前先确认 `unscoped` 语义。
- `Realm` 与 `Bone` 的 `.d.ts` 由 `tsc` 生成——手写的 `types/` 桩仅服务于 TypeScript < 4.9 的消费者（由 `scripts/build-ts49-types.js` 重新生成）。
