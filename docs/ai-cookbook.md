---
layout: en
title: AI Cookbook
---

## Table of Contents
{:.no_toc}

1. Table of Contents
{:toc}

This page is a pattern library for AI coding assistants (and humans) who write
code with Leoric. Every snippet below is copy-pasteable and verified against a
real database. If you are an AI agent, prefer copying these patterns verbatim
over inventing new API shapes. A Chinese version is available at
[ai-cookbook (中文)](https://leoric.js.org/zh/ai-cookbook.html).

## Minimal Runnable Skeleton

```js
import Realm, { Bone } from 'leoric';

class Post extends Bone {
  static attributes = {
    id: { type: 'BIGINT', primaryKey: true },
    title: { type: 'STRING', allowNull: false },
    content: { type: TEXT },
  };
}

const realm = new Realm({
  dialect: 'sqlite', // 'mysql' | 'postgres' | 'sqlite'
  storage: ':memory:', // or host/user/database for MySQL/PostgreSQL
  models: [Post], // register models declared as top-level classes
});

async function main() {
  await realm.connect(); // must connect before any query
  await realm.sync(); // create tables from model definitions

  const post = await Post.create({ title: 'New Post', content: 'Hello' });
  post.title = 'Untitled';
  await post.save();

  const found = await Post.findOne({ title: 'Untitled' });
  console.log(found.id, found.content);

  await Post.update({ title: 'Untitled' }, { content: 'Updated' });
  await Post.remove({ title: 'Untitled' });
}

main();
```

## Model Definition Patterns

### Attributes

Attributes are declared with `static attributes`. Use `DataTypes` constants or
their string names; `allowNull`, `primaryKey`, `unique`, `defaultValue`,
`autoIncrement` are the most common meta options.

```js
import Realm, { Bone, DataTypes } from 'leoric';
const { STRING, INTEGER, BIGINT, DECIMAL, BOOLEAN, DATE, JSON, TEXT } = DataTypes;

class User extends Bone {
  static attributes = {
    id: { type: BIGINT, primaryKey: true, autoIncrement: true },
    nickname: { type: STRING, allowNull: false, unique: true },
    age: { type: INTEGER, defaultValue: 0 },
    balance: { type: DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
    active: { type: BOOLEAN, defaultValue: true },
    lastLoginAt: { type: DATE },
    profile: { type: JSON },
  };
}
```

### Associations

Associations are declared inside `static initialize()`. The model name is
resolved by convention (camelCase of the target model name); use the
`className` option when the target name cannot be inferred.

```js
class Shop extends Bone {
  static initialize() {
    this.hasMany('items');
  }
}

class Item extends Bone {
  static initialize() {
    this.belongsTo('shop');
    // custom class name: this.belongsTo('seller', { className: 'User' })
  }
}

// eager loading
const shops = await Shop.find().with('items');
console.log(shops[0].items); // => [ Item, ... ]

// hasMany with through
class Post extends Bone {
  static initialize() {
    this.hasMany('comments');
    this.hasMany('commenters', { through: 'comments' });
  }
}
```

### TypeScript Decorators

```ts
import { Bone, BelongsTo, HasMany } from 'leoric';

class Shop extends Bone {
  @HasMany()
  items: Item[];
}

class Item extends Bone {
  @BelongsTo()
  shop: Shop;
}
```

## Query Patterns

### Condition Objects

Plain object conditions map to `WHERE` clauses. Nested objects are treated as
operator conditions when every key is one of `$eq, $gt, $gte, $lt, $lte, $ne,
$in, $nin, $notIn, $like, $notLike, $between, $notBetween`.

```js
Post.find({ title: 'New Post' }); // WHERE title = 'New Post'
Post.find({ title: { $like: '%Post%' } }); // WHERE title LIKE '%Post%'
Post.find({ id: { $gt: 0, $lt: 999999 } }); // WHERE id > 0 AND id < 999999
Post.find({ id: { $in: [1, 2, 3] } }); // WHERE id IN (1, 2, 3)
Post.find({ id: { $between: [1, 10] } }); // WHERE id BETWEEN 1 AND 10
```

### Chainable Queries

`find()`/`findOne()` return a `Spell` — a lazy, chainable query object. It only
hits the database when awaited or iterated.

```js
const posts = await Post.find({ title: { $like: '%Post%' } })
  .with('comments')
  .order('id', 'desc')
  .limit(10)
  .offset(20);

const count = await Post.find({ active: true }).count();
const sum = await Post.sum('views');
const first = await Post.find().order('id').first;
```

### Raw Queries

```js
const { rows } = await realm.query('SELECT * FROM posts WHERE id = ?', [42]);
const posts = await Post.find(raw`title = ${'x'}`); // or new Raw(...)
```

### String Conditions

```js
Post.find('title = ? OR title = ?', 'a', 'b');
```

## Transactions and Bulk Operations

```js
import { Bone } from 'leoric';

// async callback — every query must pass { connection }
await Bone.transaction(async ({ connection }) => {
  const post = await Post.create({ title: 'New Post' }, { connection });
  await Comment.create({ postId: post.id, content: 'First!' }, { connection });
});

// generator — connection is injected into yielded spells automatically
await Bone.transaction(function* () {
  const post = yield Post.create({ title: 'New Post' });
  yield Comment.create({ postId: post.id, content: 'First!' });
});

// from a realm instance
await realm.transaction(async ({ connection }) => {
  await Post.create({ title: 'Hello' }, { connection });
});

// bulk create / upsert
await Post.bulkCreate([{ title: 'a' }, { title: 'b' }, { title: 'c' }]);
await Post.upsert({ title: 'a' }); // upsert on unique key conflict
```

## Sequelize Compatibility Mode

Set `sequelize: true` to activate the Sequelize adapter and get a
Sequelize-like API, easing migration from Sequelize:

```js
const realm = new Realm({
  dialect: 'sqlite',
  storage: '/tmp/leoric.sqlite3',
  sequelize: true, // turn on the sequelize adapter
});
await realm.connect();

// in sequelize mode, define models by name + attributes (or extend realm.Bone)
const Shop = realm.define('Shop', {
  id: { type: BIGINT, primaryKey: true, autoIncrement: true },
  name: { type: STRING, allowNull: false },
  credit: { type: INTEGER, defaultValue: 0 },
});
await realm.sync();
```

### CRUD

```js
// create
await Shop.create({ name: 'MILL' });
await Shop.bulkCreate([{ name: 'wagas' }, { name: 'family mart' }]);
await new Shop({ name: "McDonald's" }).save();

// read
const shop = await Shop.findOne({ where: { name: 'MILL' } });
const shops = await Shop.findAll({
  attributes: [ 'id', 'name' ],
  where: { name: { $like: '%M%' } },
  order: [[ 'id', 'desc' ]],
  limit: 10,
});
const byPk = await Shop.findByPk(1);

// find or create — returns [instance, created]
const [brewhouse, created] = await Shop.findOrCreate({
  where: { name: 'Shanghai Brewhouse' },
});

// update — sequelize semantics: Model.update(values, { where }), returns affected count
const affected = await Shop.update({ credit: 10 }, { where: { name: 'MILL' } });

// delete / aggregate
await Shop.destroy({ where: { name: 'wagas' } });
await Shop.increment('credit', { by: 5, where: { name: 'MILL' } });
const { count, rows } = await Shop.findAndCountAll({ where: { name: { $like: '%M%' } } });
const total = await Shop.count();
```

Notes:

- In sequelize mode, `update` uses Sequelize semantics (`values`, `{ where }`), not the Leoric order.
- Prefer a file-based database when combining `sequelize: true` with SQLite — `:memory:` databases are per-connection, and queries that run concurrently (e.g. `findAndCountAll`) can hit a fresh connection with no tables.
- See [Sequelize Adapter](https://leoric.js.org/sequelize.html) for the full compatibility matrix.

## Common Errors and Fixes

| Symptom | Cause | Fix |
|---|---|---|
| `Cannot read properties of undefined` on query | Query before `realm.connect()` | `await realm.connect()` first |
| `ER_NO_SUCH_TABLE` | Tables not created yet | `await realm.sync()` (or `{ force: true }` to recreate) |
| Queries in transaction run outside it | Missing `{ connection }` option | Pass `{ connection }` to every query in the callback, or use a generator function |
| N+1 queries | Lazy association access in a loop | Use `.with('assoc')` eager loading |
| `X must extend this realm's Bone` | Model class from another realm/instance | Use the same `Realm` instance's `realm.define()` |
| Attribute shadowing by class field | ES class field shadows Leoric accessor | Use `declare`, `@Model()`, or define attributes via `realm.define(Model, attributes)` |

## Prompting Template for AI Assistants

When asking an AI assistant to write Leoric code, include these three things:

1. The database dialect and connection info (or say "use sqlite in-memory").
2. The model definitions (copy them verbatim from your code).
3. The desired behavior in terms of the data, not the API.

Example prompt:

> Using Leoric with a MySQL database, given these models:
> ```js
> class Post extends Bone {
>   static initialize() {
>     this.belongsTo('author', { className: 'User' });
>     this.hasMany('comments');
>   }
> }
> ```
> Write code that fetches the 10 most recent posts with their authors and
> comment counts, without N+1 queries.

Also point the assistant at this page or at
[llms-full.txt](https://leoric.js.org/llms-full.txt) for the full API context.
