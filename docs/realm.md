---
layout: en
title: Realm
---

## Table of Contents
{:.no_toc}

1. Table of Contents
{:toc}

## Overview

`Realm` is the central entry point of Leoric. It manages the database connection, model registration, schema synchronization, and provides methods for raw queries and transactions.

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

## Constructor Options

The `Realm` constructor accepts a configuration object with the following options:

| Option             | Type                          | Default    | Description                                                                 |
|--------------------|-------------------------------|------------|-----------------------------------------------------------------------------|
| `dialect`          | `string`                      | `'mysql'`  | Database dialect: `'mysql'`, `'postgres'`, or `'sqlite'`                    |
| `client`           | `string`                      | —          | Client module name: `'mysql'`, `'mysql2'`, `'pg'`, `'sqlite3'`, `'@journeyapps/sqlcipher'` |
| `dialectModulePath`| `string`                      | —          | Alias for `client`                                                         |
| `host`             | `string`                      | —          | Database host                                                               |
| `port`             | `number \| string`            | —          | Database port                                                               |
| `user`             | `string`                      | —          | Database user                                                               |
| `password`         | `string`                      | —          | Database password                                                           |
| `database`         | `string`                      | —          | Database name (aliases: `db`, `storage`)                                   |
| `models`           | `Array \| string`             | —          | An array of model classes, or a directory path string                       |
| `subclass`         | `boolean`                     | `false`    | Whether to create a subclass of `Bone` to isolate models                   |
| `driver`           | `AbstractDriver`              | —          | Custom driver class                                                         |
| `define`           | `object`                      | —          | Default model define options, e.g. `{ underscored: true }`                 |
| `logger`           | `object`                      | —          | Custom logger, see [Logging]({{ '/logging' | relative_url }})              |
| `charset`          | `string`                      | —          | Database charset                                                            |
| `idleTimeout`      | `number`                      | —          | Connection idle timeout in milliseconds                                     |
| `sequelize`        | `boolean`                     | `false`    | Enable Sequelize compatibility adapter                                     |
| `skipCloneValue`   | `boolean`                     | `false`    | Skip cloning attribute values for performance (v2.14+)                     |

### Models as Directory Path

When `models` is a string, Leoric will scan the directory and load all `.js`, `.mjs`, and `.ts` files that export a `Bone` subclass:

```js
const realm = new Realm({
  dialect: 'mysql',
  host: 'localhost',
  database: 'my_app',
  models: 'app/models', // scans this directory
});
```

### Models as Array

You can also pass model classes directly:

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

## Connecting

### `realm.connect()`

Connect to the database and initialize all models. This method loads schema information from the database and maps it to the registered models.

```js
await realm.connect();
// Models are now ready to use
const posts = await Post.find();
```

### `realm.disconnect()`

Disconnect from the database and release the connection pool.

```js
await realm.disconnect();
```

You can also pass a callback that will be executed before releasing connections:

```js
await realm.disconnect(async () => {
  console.log('Cleaning up...');
});
```

## Using `connect()` Shortcut

For simple use cases, you can use the `connect()` function exported from `leoric` directly, without creating a `Realm` instance explicitly:

```js
import { Bone, connect } from 'leoric';

class Post extends Bone {}

await connect({
  host: 'localhost',
  database: 'my_app',
  models: [Post],
});

// Post is now ready
const posts = await Post.find();
```

> **Note**: `connect()` can only be called once with the default `Bone`. If you need multiple connections, use separate `Realm` instances.

## Defining Models Dynamically

### `realm.define(name, attributes, options, descriptors)`

Define a model dynamically at runtime without creating a separate class file.

```js
const { BIGINT, STRING, TEXT } = realm.DataTypes;

const Post = realm.define('Post', {
  id: { type: BIGINT, primaryKey: true },
  title: STRING,
  content: TEXT,
});

await realm.sync();

// Now you can use the model
await Post.create({ title: 'Hello', content: 'World' });
```

**Parameters:**

| Parameter     | Type     | Description                                |
|---------------|----------|--------------------------------------------|
| `name`        | `string` | Model name (will be used to infer table name) |
| `attributes`  | `object` | Column definitions                         |
| `options`     | `object` | Optional model init options                |
| `descriptors` | `object` | Optional property descriptors              |

## Schema Synchronization

### `realm.sync(options)`

Synchronize the model definitions to the database. This will create tables that don't exist, and optionally alter existing tables to match the model definitions.

```js
await realm.sync();
```

**Options:**

| Option  | Type      | Default | Description                                           |
|---------|-----------|---------|-------------------------------------------------------|
| `force` | `boolean` | `false` | Drop existing tables before creating (destructive!)   |
| `alter` | `boolean` | `false` | Alter existing tables to match model definitions      |

```js
// Create tables that don't exist
await realm.sync();

// Drop and recreate all tables (WARNING: data loss!)
await realm.sync({ force: true });

// Alter existing tables to match models
await realm.sync({ alter: true });
```

> **Warning**: `realm.sync({ force: true })` will drop all existing tables. Use with extreme caution, and never in production!

## Raw Queries

### `realm.query(sql, values, options)`

Execute a raw SQL query against the database.

```js
const result = await realm.query('SELECT * FROM posts WHERE id = ?', [1]);
console.log(result.rows); // => [{ id: 1, title: '...', ... }]
```

See [Raw Queries]({{ '/raw-query' | relative_url }}) for more details.

### `realm.raw(sql)`

Create a `Raw` SQL expression that won't be escaped.

```js
await Post.update({ title: 'New Title' }, {
  updatedAt: realm.raw('NOW()'),
});
```

### `realm.escape(value)`

Escape a value for safe use in SQL queries.

```js
const safe = realm.escape("O'Reilly");
// => "'O\\'Reilly'"
```

## Transactions

### `realm.transaction(callback)`

Start a transaction. The callback receives a `{ connection }` object that can be used to ensure all queries within the transaction use the same connection.

```js
await realm.transaction(async ({ connection }) => {
  await Post.create({ title: 'Hello' }, { connection });
  await Comment.create({ postId: 1, content: 'World' }, { connection });
});
```

See [Transactions]({{ '/transactions' | relative_url }}) for more details.

## Multiple Database Instances

You can create multiple `Realm` instances to connect to different databases:

```js
const realmA = new Realm({
  dialect: 'mysql',
  database: 'app_primary',
  models: [User, Post],
  subclass: true, // isolate models
});

const realmB = new Realm({
  dialect: 'postgres',
  database: 'app_analytics',
  models: [Event, Metric],
  subclass: true, // isolate models
});

await realmA.connect();
await realmB.connect();
```

> **Important**: When using multiple `Realm` instances, set `subclass: true` to ensure models from different realms don't share the same `Bone` base class internals.

## Properties

| Property      | Type      | Description                          |
|---------------|-----------|--------------------------------------|
| `realm.Bone`  | `class`   | The base model class for this realm  |
| `realm.models`| `object`  | Map of registered model names to classes |
| `realm.driver`| `object`  | The database driver instance         |
| `realm.connected` | `boolean` | Whether the realm is connected   |
| `realm.DataTypes`  | `object` | Data type constructors             |
