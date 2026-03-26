---
layout: zh
title: 在 Express 应用中使用
---

## 目录
{:.no_toc}

1. 目录
{:toc}

## 安装

```bash
$ npm i --save leoric
$ npm i --save mysql2    # MySQL 或兼容数据库

# 其他数据库
$ npm i --save pg        # PostgreSQL
$ npm i --save better-sqlite3  # SQLite
```

## 快速开始

### 项目结构

典型的 Express + Leoric 项目结构：

```text
my-app/
├── app.js              # Express 应用入口
├── models/
│   ├── user.js
│   ├── post.js
│   └── comment.js
├── routes/
│   ├── users.js
│   └── posts.js
├── database/
│   └── migrations/     # 迁移任务文件
└── package.json
```

### 定义数据模型

```js
// models/user.js
const { Bone, DataTypes } = require('leoric');
const { STRING, BIGINT, INTEGER } = DataTypes;

class User extends Bone {
  static attributes = {
    id: { type: BIGINT, primaryKey: true, autoIncrement: true },
    name: STRING,
    email: STRING,
    age: INTEGER,
  }
}

module.exports = User;
```

```js
// models/post.js
const { Bone, DataTypes } = require('leoric');
const { STRING, TEXT, BIGINT } = DataTypes;

class Post extends Bone {
  static attributes = {
    id: { type: BIGINT, primaryKey: true, autoIncrement: true },
    title: STRING,
    content: TEXT,
    userId: BIGINT,
  }

  static initialize() {
    this.belongsTo('user');
  }
}

module.exports = Post;
```

### 连接数据库

创建 Realm 实例并在启动 Express 服务之前完成连接：

```js
// app.js
const express = require('express');
const { Realm } = require('leoric');

const app = express();
app.use(express.json());

const realm = new Realm({
  dialect: 'mysql',
  host: 'localhost',
  user: 'root',
  database: 'my_app',
  models: 'models',
});

// 将 realm 挂载到 app 上，便于在路由中访问
app.set('realm', realm);

// 路由
app.use('/users', require('./routes/users'));
app.use('/posts', require('./routes/posts'));

// 先连接数据库，再启动服务
realm.connect().then(() => {
  app.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
  });
}).catch(err => {
  console.error('数据库连接失败:', err);
  process.exit(1);
});
```

如果数据模型中没有显式声明 `static attributes`，Leoric 会在 `connect()` 时自动从 `information_schema.columns` 加载表结构信息：

```js
// models/user.js
const { Bone } = require('leoric');

class User extends Bone {
  static initialize() {
    this.hasMany('posts');
  }
}

module.exports = User;
```

### 在路由中使用模型

```js
// routes/users.js
const express = require('express');
const User = require('../models/user');
const router = express.Router();

// GET /users
router.get('/', async (req, res) => {
  const users = await User.find().order('id', 'desc').limit(20);
  res.json(users);
});

// GET /users/:id
router.get('/:id', async (req, res) => {
  const user = await User.findOne(req.params.id);
  if (!user) return res.status(404).json({ error: '用户不存在' });
  res.json(user);
});

// POST /users
router.post('/', async (req, res) => {
  const user = await User.create(req.body);
  res.status(201).json(user);
});

// PUT /users/:id
router.put('/:id', async (req, res) => {
  const user = await User.findOne(req.params.id);
  if (!user) return res.status(404).json({ error: '用户不存在' });
  await user.update(req.body);
  res.json(user);
});

// DELETE /users/:id
router.delete('/:id', async (req, res) => {
  const user = await User.findOne(req.params.id);
  if (!user) return res.status(404).json({ error: '用户不存在' });
  await user.remove();
  res.status(204).end();
});

module.exports = router;
```

## 配置选项

### 数据库连接选项

所有数据库连接选项均通过 Realm 构造函数传入：

```js
const realm = new Realm({
  dialect: 'mysql',       // 'mysql'、'postgres' 或 'sqlite'
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: 'secret',
  database: 'my_app',
  models: 'models',       // 模型文件目录路径
  migrations: 'database/migrations',
  connectionLimit: 10,    // 连接池大小
});
```

SQLite 使用 `database` 选项（或 `storage`）指定文件路径：

```js
const realm = new Realm({
  dialect: 'sqlite',
  database: './database.sqlite3',
  models: 'models',
});
```

PostgreSQL 配置：

```js
const realm = new Realm({
  dialect: 'postgres',
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'secret',
  database: 'my_app',
  models: 'models',
});
```

### 直接传入模型类

除了提供目录路径，也可以直接传入模型类数组：

```js
const User = require('./models/user');
const Post = require('./models/post');

const realm = new Realm({
  dialect: 'mysql',
  database: 'my_app',
  models: [User, Post],
});
```

## 中间件模式

对于较大的应用，可以创建一个中间件来管理数据库连接：

```js
// middleware/database.js
const { Realm } = require('leoric');

const realm = new Realm({
  dialect: 'mysql',
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'my_app',
  models: 'models',
});

let connected = false;

async function database(req, res, next) {
  if (!connected) {
    await realm.connect();
    connected = true;
  }
  req.realm = realm;
  next();
}

module.exports = { realm, database };
```

```js
// app.js
const express = require('express');
const { realm, database } = require('./middleware/database');

const app = express();
app.use(express.json());
app.use(database);

app.use('/users', require('./routes/users'));

realm.connect().then(() => {
  app.listen(3000);
});
```

## 事务

使用 `Bone.transaction()` 将多个操作包装在事务中：

```js
router.post('/transfer', async (req, res) => {
  const { fromId, toId, amount } = req.body;

  await User.transaction(async ({ connection }) => {
    const from = await User.findOne(fromId, { connection });
    const to = await User.findOne(toId, { connection });
    await from.update({ balance: from.balance - amount }, { connection });
    await to.update({ balance: to.balance + amount }, { connection });
  });

  res.json({ success: true });
});
```

## 迁移任务

通过 Realm 实例创建和执行迁移任务：

```js
// scripts/migrate.js
const { realm } = require('../middleware/database');

(async () => {
  await realm.connect();
  await realm.migrate();
  await realm.disconnect();
  console.log('迁移完成');
})();
```

```js
// scripts/create-migration.js
const { realm } = require('../middleware/database');

const name = process.argv[2];
if (!name) {
  console.error('用法: node scripts/create-migration.js <name>');
  process.exit(1);
}

(async () => {
  await realm.createMigrationFile(name);
  console.log(`迁移文件已创建: ${name}`);
})();
```

在 `package.json` 中添加脚本：

```json
{
  "scripts": {
    "migrate": "node scripts/migrate.js",
    "migrate:create": "node scripts/create-migration.js"
  }
}
```

## 错误处理

添加错误处理中间件来捕获数据库错误：

```js
// app.js
app.use((err, req, res, next) => {
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ error: '数据重复' });
  }
  if (err.name === 'LeoricValidateError') {
    return res.status(400).json({ error: err.message });
  }
  console.error(err);
  res.status(500).json({ error: '服务器内部错误' });
});
```

## 优雅关闭

在进程退出时断开数据库连接：

```js
process.on('SIGTERM', async () => {
  await realm.disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  await realm.disconnect();
  process.exit(0);
});
```

## TypeScript 支持

Leoric 在 Express 应用中支持 TypeScript。可以使用装饰器或静态属性定义模型：

```typescript
// models/user.ts
import { Bone, Column, DataTypes } from 'leoric';

class User extends Bone {
  @Column({ primaryKey: true, autoIncrement: true })
  id: bigint;

  @Column()
  name: string;

  @Column()
  email: string;
}

export default User;
```

```typescript
// app.ts
import express from 'express';
import { Realm } from 'leoric';
import User from './models/user';
import Post from './models/post';

const app = express();
const realm = new Realm({
  dialect: 'mysql',
  database: 'my_app',
  models: [User, Post],
});

app.get('/users', async (req, res) => {
  const users = await User.find();
  res.json(users);
});

realm.connect().then(() => {
  app.listen(3000);
});
```
