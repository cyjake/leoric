---
layout: zh
title: Realm
---

## 目录
{:.no_toc}

1. 目录
{:toc}

## 概述

`Realm` 是 Leoric 的核心入口类，负责管理数据库连接、模型注册、表结构同步，并提供原始查询和事务等方法。

```js
import Realm from 'leoric';

const realm = new Realm({
  dialect: 'mysql',
  host: 'localhost',
  user: 'root',
  database: 'my_app',
  models: 'app/models',
});

await realm.connect();
```

## 构造函数选项

`Realm` 构造函数接受以下配置项：

| 选项                | 类型                          | 默认值      | 说明                                                                        |
|--------------------|-------------------------------|------------|-----------------------------------------------------------------------------|
| `dialect`          | `string`                      | `'mysql'`  | 数据库方言：`'mysql'`、`'postgres'` 或 `'sqlite'`                            |
| `client`           | `string`                      | —          | 客户端模块名：`'mysql'`、`'mysql2'`、`'pg'`、`'sqlite3'`、`'@journeyapps/sqlcipher'` |
| `dialectModulePath`| `string`                      | —          | `client` 的别名                                                             |
| `host`             | `string`                      | —          | 数据库主机地址                                                               |
| `port`             | `number \| string`            | —          | 数据库端口                                                                   |
| `user`             | `string`                      | —          | 数据库用户名                                                                 |
| `password`         | `string`                      | —          | 数据库密码                                                                   |
| `database`         | `string`                      | —          | 数据库名（别名：`db`、`storage`）                                            |
| `models`           | `Array \| string`             | —          | 模型类数组，或模型文件目录路径                                                |
| `subclass`         | `boolean`                     | `false`    | 是否创建 `Bone` 的子类来隔离模型                                              |
| `driver`           | `AbstractDriver`              | —          | 自定义驱动类                                                                 |
| `define`           | `object`                      | —          | 默认模型定义选项，如 `{ underscored: true }`                                 |
| `logger`           | `object`                      | —          | 自定义日志，详见[日志]({{ '/zh/logging' | relative_url }})                    |
| `charset`          | `string`                      | —          | 数据库字符集                                                                 |
| `idleTimeout`      | `number`                      | —          | 连接空闲超时时间（毫秒）                                                     |
| `sequelize`        | `boolean`                     | `false`    | 启用 Sequelize 兼容适配器                                                    |
| `skipCloneValue`   | `boolean`                     | `false`    | 跳过属性值克隆以提升性能（v2.14+）                                           |

### models 为目录路径

当 `models` 为字符串时，Leoric 会扫描该目录下所有 `.js`、`.mjs` 和 `.ts` 文件，自动加载导出了 `Bone` 子类的模型：

```js
const realm = new Realm({
  dialect: 'mysql',
  host: 'localhost',
  database: 'my_app',
  models: 'app/models', // 扫描此目录
});
```

### models 为数组

也可以直接传入模型类数组：

```js
import Post from './models/post';
import User from './models/user';

const realm = new Realm({
  dialect: 'mysql',
  host: 'localhost',
  database: 'my_app',
  models: [Post, User],
});
```

## 连接数据库

### `realm.connect()`

连接数据库并初始化所有模型。此方法会从数据库获取表结构信息，映射到已注册的模型上。

```js
await realm.connect();
// 模型已就绪
const posts = await Post.find();
```

### `realm.disconnect()`

断开数据库连接并释放连接池。

```js
await realm.disconnect();
```

也可以传入一个回调函数，在释放连接前执行：

```js
await realm.disconnect(async () => {
  console.log('正在清理...');
});
```

## 使用 `connect()` 快捷方式

对于简单场景，可以直接使用 `leoric` 导出的 `connect()` 函数，无需显式创建 `Realm` 实例：

```js
import { Bone, connect } from 'leoric';

class Post extends Bone {}

await connect({
  host: 'localhost',
  database: 'my_app',
  models: [Post],
});

// Post 已就绪
const posts = await Post.find();
```

> **注意**：默认 `Bone` 只能调用一次 `connect()`。如需连接多个数据库，请使用独立的 `Realm` 实例。

## 动态定义模型

### `realm.define(name, attributes, options, descriptors)`

在运行时动态定义模型，无需创建单独的类文件。

```js
const { BIGINT, STRING, TEXT } = realm.DataTypes;

const Post = realm.define('Post', {
  id: { type: BIGINT, primaryKey: true },
  title: STRING,
  content: TEXT,
});

await realm.sync();

// 现在可以使用模型了
await Post.create({ title: '你好', content: '世界' });
```

**参数说明：**

| 参数           | 类型     | 说明                                |
|---------------|----------|------------------------------------|
| `name`        | `string` | 模型名称（将用于推断表名）            |
| `attributes`  | `object` | 列定义                              |
| `options`     | `object` | 可选的模型初始化选项                   |
| `descriptors` | `object` | 可选的属性描述符                      |

## 表结构同步

### `realm.sync(options)`

将模型定义同步到数据库。会创建不存在的表，并可选地修改已有表以匹配模型定义。

```js
await realm.sync();
```

**选项：**

| 选项     | 类型      | 默认值  | 说明                                              |
|---------|-----------|---------|--------------------------------------------------|
| `force` | `boolean` | `false` | 先删除已有表再创建（破坏性操作！）                    |
| `alter` | `boolean` | `false` | 修改已有表以匹配模型定义                             |

```js
// 创建不存在的表
await realm.sync();

// 删除并重建所有表（警告：会丢失数据！）
await realm.sync({ force: true });

// 修改已有表以匹配模型
await realm.sync({ alter: true });
```

> **警告**：`realm.sync({ force: true })` 会删除所有已有表，请谨慎使用，切勿在生产环境中使用！

## 原始查询

### `realm.query(sql, values, options)`

执行原始 SQL 查询。

```js
const result = await realm.query('SELECT * FROM posts WHERE id = ?', [1]);
console.log(result.rows); // => [{ id: 1, title: '...', ... }]
```

详见[原始查询]({{ '/zh/raw-query' | relative_url }})。

### `realm.raw(sql)`

创建一个不会被转义的 `Raw` SQL 表达式。

```js
await Post.update({ title: '新标题' }, {
  updatedAt: realm.raw('NOW()'),
});
```

### `realm.escape(value)`

转义一个值以安全地用于 SQL 查询。

```js
const safe = realm.escape("O'Reilly");
// => "'O\\'Reilly'"
```

## 事务

### `realm.transaction(callback)`

开启一个事务。回调函数会接收一个 `{ connection }` 对象，确保事务内所有查询使用同一个连接。

```js
await realm.transaction(async ({ connection }) => {
  await Post.create({ title: '你好' }, { connection });
  await Comment.create({ postId: 1, content: '世界' }, { connection });
});
```

详见[事务]({{ '/zh/transactions' | relative_url }})。

## 多数据库实例

可以创建多个 `Realm` 实例来连接不同的数据库：

```js
const realmA = new Realm({
  dialect: 'mysql',
  database: 'app_primary',
  models: [User, Post],
  subclass: true, // 隔离模型
});

const realmB = new Realm({
  dialect: 'postgres',
  database: 'app_analytics',
  models: [Event, Metric],
  subclass: true, // 隔离模型
});

await realmA.connect();
await realmB.connect();
```

> **重要**：使用多个 `Realm` 实例时，请设置 `subclass: true`，以确保不同 realm 的模型不共享同一个 `Bone` 基类内部状态。

## 属性

| 属性              | 类型       | 说明                          |
|------------------|-----------|-------------------------------|
| `realm.Bone`     | `class`   | 此 realm 的基础模型类           |
| `realm.models`   | `object`  | 已注册模型名到类的映射           |
| `realm.driver`   | `object`  | 数据库驱动实例                  |
| `realm.connected`| `boolean` | 是否已连接                      |
| `realm.DataTypes`| `object`  | 数据类型构造器                  |
