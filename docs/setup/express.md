---
layout: en
title: Setup with Express
---

## Table of Contents
{:.no_toc}

1. Table of Contents
{:toc}

## Install

```bash
$ npm i --save leoric
$ npm i --save mysql2    # MySQL or compatible databases

# Other databases
$ npm i --save pg        # PostgreSQL
$ npm i --save better-sqlite3  # SQLite
```

## Quick Start

### Project Structure

A typical Express + Leoric project structure:

```text
my-app/
├── app.js              # Express app entry
├── models/
│   ├── user.js
│   ├── post.js
│   └── comment.js
├── routes/
│   ├── users.js
│   └── posts.js
├── database/
│   └── migrations/     # Migration files
└── package.json
```

### Defining Models

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

### Connecting to Database

Create a Realm instance and connect before starting the Express server:

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

// Mount realm on app for easy access in routes
app.set('realm', realm);

// Routes
app.use('/users', require('./routes/users'));
app.use('/posts', require('./routes/posts'));

// Connect to database, then start server
realm.connect().then(() => {
  app.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
  });
}).catch(err => {
  console.error('Failed to connect to database:', err);
  process.exit(1);
});
```

Alternatively, if models are defined with `class` syntax and no explicit `static attributes`, Leoric will load the schema from `information_schema.columns` automatically at `connect()` time:

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

### Using Models in Routes

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
  if (!user) return res.status(404).json({ error: 'User not found' });
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
  if (!user) return res.status(404).json({ error: 'User not found' });
  await user.update(req.body);
  res.json(user);
});

// DELETE /users/:id
router.delete('/:id', async (req, res) => {
  const user = await User.findOne(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  await user.remove();
  res.status(204).end();
});

module.exports = router;
```

## Configuration

### Database Options

All database connection options are passed to the Realm constructor:

```js
const realm = new Realm({
  dialect: 'mysql',       // 'mysql', 'postgres', or 'sqlite'
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: 'secret',
  database: 'my_app',
  models: 'models',       // path to models directory
  migrations: 'database/migrations',
  connectionLimit: 10,    // connection pool size
});
```

For SQLite, use the `database` option (or `storage`) to specify the file path:

```js
const realm = new Realm({
  dialect: 'sqlite',
  database: './database.sqlite3',
  models: 'models',
});
```

For PostgreSQL:

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

### Passing Models as Array

Instead of providing a directory path, you can pass model classes directly:

```js
const User = require('./models/user');
const Post = require('./models/post');

const realm = new Realm({
  dialect: 'mysql',
  database: 'my_app',
  models: [User, Post],
});
```

## Middleware Pattern

For larger applications, you may want to create a middleware that ensures database connectivity:

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

## Transactions

Use `Bone.transaction()` to wrap multiple operations in a transaction:

```js
router.post('/transfer', async (req, res) => {
  const { fromId, toId, amount } = req.body;

  await User.transaction(async () => {
    const from = await User.findOne(fromId);
    const to = await User.findOne(toId);
    await from.update({ balance: from.balance - amount });
    await to.update({ balance: to.balance + amount });
  });

  res.json({ success: true });
});
```

## Migrations

Create and run migrations with the Realm instance:

```js
// scripts/migrate.js
const { realm } = require('../middleware/database');

(async () => {
  await realm.connect();
  await realm.migrate();
  await realm.disconnect();
  console.log('Migrations complete');
})();
```

```js
// scripts/create-migration.js
const { realm } = require('../middleware/database');

const name = process.argv[2];
if (!name) {
  console.error('Usage: node scripts/create-migration.js <name>');
  process.exit(1);
}

(async () => {
  await realm.createMigrationFile(name);
  console.log(`Migration file created: ${name}`);
})();
```

Add scripts to `package.json`:

```json
{
  "scripts": {
    "migrate": "node scripts/migrate.js",
    "migrate:create": "node scripts/create-migration.js"
  }
}
```

## Error Handling

Add an error handler middleware to catch database errors:

```js
// app.js
app.use((err, req, res, next) => {
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ error: 'Duplicate entry' });
  }
  if (err.name === 'LeoricValidateError') {
    return res.status(400).json({ error: err.message });
  }
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});
```

## Graceful Shutdown

Disconnect from the database when the process exits:

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

## TypeScript

Leoric works with TypeScript in Express applications. Define models using decorators or static attributes:

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
