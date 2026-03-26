---
layout: en
title: Best Practices
---

## Table of Contents
{:.no_toc}

1. Table of Contents
{:toc}

## Avoiding the N+1 Query Problem

The N+1 query problem occurs when you load a list of records and then make a separate query for each record's associations.

### The Problem

```js
// BAD: 1 query for posts + N queries for comments
const posts = await Post.find({ authorId: 1 });
for (const post of posts) {
  post.comments = await Comment.find({ postId: post.id });
}
```

### The Solution: Eager Loading

Use `.with()` or `.include()` to load associations in a single query:

```js
// GOOD: 1 query with JOINs
const posts = await Post.find({ authorId: 1 }).with('comments');
for (const post of posts) {
  console.log(post.comments); // Already loaded
}
```

You can load multiple associations at once:

```js
const posts = await Post.find().with('author', 'comments');
```

## Selecting Only Needed Columns

By default, Leoric selects all columns (`SELECT *`). When you only need specific columns, use `.select()`:

```js
// BAD: loads all columns including large text fields
const posts = await Post.find();

// GOOD: only loads what you need
const posts = await Post.find().select('id', 'title', 'createdAt');
```

This is especially important for tables with large `TEXT` or `BLOB` columns.

## Batch Processing for Large Tables

When processing large tables, avoid loading all records into memory at once. Use pagination:

```js
// BAD: loads everything into memory
const allPosts = await Post.find();

// GOOD: process in batches
const pageSize = 100;
let offset = 0;
while (true) {
  const posts = await Post.find().limit(pageSize).offset(offset);
  if (posts.length === 0) break;

  for (const post of posts) {
    // process each post
  }
  offset += pageSize;
}
```

## Connection Pool Management

### Configure Idle Timeout

For long-running applications, configure the idle timeout to prevent stale connections:

```js
const realm = new Realm({
  host: 'localhost',
  database: 'my_app',
  idleTimeout: 30000, // 30 seconds
});
```

### Disconnect on Shutdown

Always disconnect when your application shuts down:

```js
process.on('SIGTERM', async () => {
  await realm.disconnect();
  process.exit(0);
});
```

## Transaction Best Practices

### Keep Transactions Short

```js
// BAD: external API call inside transaction holds connection
await Bone.transaction(async ({ connection }) => {
  const user = await User.create({ name: 'Alice' }, { connection });
  const result = await fetch('https://api.example.com/notify'); // Slow!
  await AuditLog.create({ action: 'user_created' }, { connection });
});

// GOOD: move external calls outside the transaction
const user = await Bone.transaction(async ({ connection }) => {
  const user = await User.create({ name: 'Alice' }, { connection });
  await AuditLog.create({ action: 'user_created' }, { connection });
  return user;
});
await fetch('https://api.example.com/notify');
```

### Use Generator Functions for Cleaner Code

```js
// Generator functions auto-pass the connection
await Bone.transaction(function* () {
  const user = yield User.create({ name: 'Alice' });
  yield AuditLog.create({ action: 'user_created', userId: user.id });
});
```

## Indexing Strategies

### Use Composite Indexes for Common Query Patterns

If you frequently query with multiple conditions:

```js
// If this is a common query pattern:
Post.find({ authorId: 1, status: 'published' }).order('createdAt', 'desc')
```

Consider adding a composite index: `(author_id, status, created_at)`.

### Use Index Hints When Needed

When the query optimizer makes a suboptimal choice:

```js
Post.find({ authorId: 1 }).forceIndex('idx_author_created')
```

See [Index Hints]({{ '/index-hints' | relative_url }}) for more details.

## Model Organization

### Use Directory-Based Model Loading

```js
const realm = new Realm({
  models: 'app/models',  // Auto-loads all models from directory
});
```

### Define Associations in `initialize()`

```js
class Post extends Bone {
  static initialize() {
    this.belongsTo('author', { Model: 'User' });
    this.hasMany('comments');
    this.hasMany('tags', { through: 'tagMaps' });
  }
}
```

### Use TypeScript Decorators When Possible

```ts
class Post extends Bone {
  @Column({ primaryKey: true })
  id: bigint;

  @BelongsTo()
  author: User;

  @HasMany()
  comments: Comment[];
}
```

## Security

### Never Use Raw SQL with User Input

```js
// BAD: SQL injection vulnerability
await realm.query(`SELECT * FROM posts WHERE title = '${userInput}'`);

// GOOD: parameterized query
await realm.query('SELECT * FROM posts WHERE title = ?', [userInput]);

// GOOD: use the ORM query interface
await Post.find({ title: userInput });
```

### Use `raw()` Sparingly

The `raw()` function bypasses escaping. Only use it for SQL functions and expressions, never for user-provided values:

```js
// GOOD: SQL function
await Post.update({ id: 1 }, { viewCount: raw('view_count + 1') });

// BAD: user input in raw()
await Post.find({ title: raw(userInput) }); // SQL injection!
```
