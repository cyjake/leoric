---
layout: en
title: Troubleshooting
---

## Table of Contents
{:.no_toc}

1. Table of Contents
{:toc}

## Connection Issues

### `Error: connect ECONNREFUSED ::1:3306`

This is a common issue on macOS where `localhost` resolves to IPv6 `::1`, but MySQL is only listening on `127.0.0.1`.

**Solution**: Update MySQL config to also bind to IPv6:

```diff
# /usr/local/etc/my.cnf (Homebrew MySQL)
[mysqld]
-bind-address = 127.0.0.1
+bind-address = 127.0.0.1,::1
```

Then restart MySQL:

```bash
brew services mysql restart
```

Alternatively, use `127.0.0.1` instead of `localhost` in your connection config:

```js
const realm = new Realm({
  host: '127.0.0.1',  // Use IP instead of 'localhost'
  database: 'my_app',
});
```

### `Error: connected already`

This error occurs when calling `connect()` multiple times with the default `Bone` class.

**Solution**: Either:
- Call `connect()` only once in your application lifecycle
- Use separate `Realm` instances with `subclass: true` for multiple connections

```js
// Wrong: calling connect twice
await connect({ models: [Post], database: 'db1' });
await connect({ models: [User], database: 'db2' }); // Error!

// Correct: use separate Realm instances
const realm1 = new Realm({ models: [Post], database: 'db1', subclass: true });
const realm2 = new Realm({ models: [User], database: 'db2', subclass: true });
await realm1.connect();
await realm2.connect();
```

### `Error: DriverClass must be a subclass of AbstractDriver`

This usually occurs when using `BaseRealm` directly instead of the full `Realm` class, or when the `dialect` option doesn't match an available driver.

**Solution**: Ensure you're importing `Realm` from `leoric` (not `BaseRealm`) and have the correct database client installed:

```bash
# For MySQL
npm install mysql2

# For PostgreSQL
npm install pg

# For SQLite
npm install sqlite3
```

## Model Issues

### `Error: Model is not paranoid`

This error occurs when calling `restore()` on a model that doesn't have soft delete enabled.

**Solution**: Add a `deletedAt` attribute to your model. See [Soft Delete]({{ '/soft-delete' | relative_url }}).

### Columns not mapping to attributes

By default, Leoric maps `snake_case` column names to `camelCase` attributes. If your column names don't follow this convention, use the `name` option:

```ts
@Column({ name: 'gmt_create' })
createdAt: Date;
```

### `createdAt` / `updatedAt` not auto-updating

Leoric automatically manages `createdAt` and `updatedAt` timestamps if the corresponding columns exist. Ensure your table has `created_at` and `updated_at` columns.

To suppress automatic timestamp updates for a specific operation, pass `{ silent: true }`:

```js
await post.update({ title: 'Updated' }, { silent: true });
```

## Query Issues

### Unexpected results with soft delete

If you're not seeing records you expect, they may be soft-deleted. Use `.unscoped` to include all records:

```js
// This excludes soft-deleted records
const posts = await Post.find();

// This includes all records
const allPosts = await Post.unscoped.find();
```

### N+1 query problem

If you're loading associations in a loop, you likely have an N+1 problem:

```js
// Bad: N+1 queries
const posts = await Post.find();
for (const post of posts) {
  const comments = await Comment.find({ postId: post.id }); // N queries!
}

// Good: eager loading
const posts = await Post.find().with('comments'); // 1 query with JOIN
```

See [Best Practices]({{ '/best-practices' | relative_url }}) for more details.

## Debugging

### Enable Debug Logging

Leoric uses the `debug` module. Enable SQL logging with:

```bash
DEBUG=leoric node app.js
```

### Custom Logger

You can provide a custom logger to see all queries:

```js
const realm = new Realm({
  logger: {
    logQuery(sql, duration) {
      console.log(`[${duration}ms] ${sql}`);
    },
    logQueryError(err, sql, duration) {
      console.error(`[${duration}ms] ${sql}\n  Error: ${err.message}`);
    },
    logMigration(name) {
      console.log(`Migration: ${name}`);
    },
  },
});
```

See [Logging]({{ '/logging' | relative_url }}) for more details.

## TypeScript Issues

### `emitDecoratorMetadata` error

If decorator type inference is not working, ensure your `tsconfig.json` has:

```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

### Type errors with `bigint`

JavaScript's `bigint` type requires special handling. If you encounter type errors:

```ts
// Correct: use bigint type
@Column({ primaryKey: true })
id: bigint;

// When creating, bigint literals use 'n' suffix
const post = await Post.create({ title: 'Hello' });
console.log(typeof post.id); // 'bigint' or 'number' depending on value
```

## Migration Issues

### Table already exists

When running `realm.sync()`, if a table already exists and you want to update it:

```js
// Alter existing tables (add new columns, etc.)
await realm.sync({ alter: true });

// WARNING: Drop and recreate (data loss!)
await realm.sync({ force: true });
```

### Migration rollback

If a migration fails partway, you may need to manually rollback:

```js
module.exports = {
  async up(driver, DataTypes) {
    // forward migration
  },
  async down(driver, DataTypes) {
    // rollback migration - make sure this is complete
  },
};
```
