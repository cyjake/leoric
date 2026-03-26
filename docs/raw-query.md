---
layout: en
title: Raw Queries
---

## Table of Contents
{:.no_toc}

1. Table of Contents
{:toc}

## Overview

While Leoric's query interface covers most use cases, sometimes you need to execute raw SQL directly. Leoric provides several ways to work with raw SQL: `realm.query()`, `Model.query()`, the `raw()` function, and the `heresql` template helper.

## `realm.query(sql, values, options)`

Execute a raw SQL query through the `Realm` instance:

```js
const result = await realm.query('SELECT * FROM posts WHERE id = ?', [1]);
console.log(result.rows);
// => [{ id: 1, title: 'Hello', content: '...' }]
```

### Return Value

The returned object contains:

| Property       | Type     | Description                                          |
|---------------|----------|------------------------------------------------------|
| `rows`        | `Array`  | Query result rows                                    |
| `fields`      | `Array`  | Column metadata (table, name)                        |
| `affectedRows`| `number` | Number of affected rows (for INSERT/UPDATE/DELETE)   |
| `insertId`    | `number` | Auto-generated ID (for INSERT)                       |

### Parameterized Queries

Always use parameterized queries to prevent SQL injection:

```js
// Good - parameterized
const result = await realm.query(
  'SELECT * FROM posts WHERE title = ? AND author_id = ?',
  ['Hello', 42]
);

// BAD - SQL injection risk!
const result = await realm.query(
  `SELECT * FROM posts WHERE title = '${title}'`
);
```

### Named Replacements

You can use named replacements with the `:name` syntax:

```js
const result = await realm.query(
  'SELECT * FROM posts WHERE title = :title AND author_id = :authorId',
  {
    replacements: {
      title: 'Hello',
      authorId: 42,
    },
  }
);
```

### Returning Model Instances

Pass a `model` option to have the results returned as model instances instead of plain objects:

```js
const result = await realm.query(
  'SELECT * FROM posts WHERE id = ?',
  { model: Post, replacements: {} }
);

// result.rows are now Post instances
const post = result.rows[0];
console.log(post instanceof Post); // true
console.log(post.title);
```

### Using a Transaction Connection

```js
await realm.transaction(async ({ connection }) => {
  await realm.query(
    'UPDATE posts SET title = ? WHERE id = ?',
    ['New Title', 1],
    { connection }
  );
});
```

## `Model.query(sql, values)` (v2.14+)

Since v2.14, you can execute raw queries directly from a model class:

```js
const result = await Post.query('SELECT * FROM posts WHERE id = ?', [1]);
```

## The `raw()` Function

The `raw()` function creates a `Raw` SQL expression that won't be escaped. This is useful for using SQL functions or expressions in queries:

```js
import { raw } from 'leoric';

// Use SQL functions
await Post.update({ id: 1 }, { updatedAt: raw('NOW()') });
// UPDATE posts SET updated_at = NOW() WHERE id = 1

// Use in where clauses
const posts = await Post.find({
  createdAt: raw('NOW() - INTERVAL 7 DAY'),
});
```

You can also access `raw()` from a `Realm` instance:

```js
await Post.update({ id: 1 }, { updatedAt: realm.raw('NOW()') });
```

> **Warning**: `raw()` bypasses escaping. Never pass user input directly to `raw()` as it can lead to SQL injection vulnerabilities.

## The `Raw` Class

The `Raw` class is the underlying implementation. You can use it directly or via `Raw.build()`:

```js
import { Raw } from 'leoric';

const expr = new Raw('COUNT(*)');
const expr2 = Raw.build('COUNT(*)');
```

## `heresql` Helper

The `heresql` function helps format multiline SQL strings into single-line queries, which is useful for logging and readability:

```js
import { heresql } from 'leoric';

const sql = heresql(`
  SELECT *
    FROM posts
   WHERE author_id = ?
ORDER BY created_at DESC
   LIMIT 10
`);
// => 'SELECT * FROM posts WHERE author_id = ? ORDER BY created_at DESC LIMIT 10'
```

It simply trims each line and joins them with a single space, making multiline SQL more readable in source code while producing clean single-line SQL for execution.

## Security Considerations

1. **Always use parameterized queries** for user-provided values. Never concatenate user input into SQL strings.

2. **Use `raw()` sparingly**. Only use it for SQL functions and expressions, never for user input.

3. **Use `realm.escape()`** when you absolutely must interpolate a value, though parameterized queries are always preferred.

```js
// Preferred: parameterized
await realm.query('SELECT * FROM posts WHERE title = ?', [userInput]);

// If you must escape manually
const escaped = realm.escape(userInput);
```
