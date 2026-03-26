---
layout: en
title: Soft Delete
---

## Table of Contents
{:.no_toc}

1. Table of Contents
{:toc}

## Overview

Soft delete (also known as "paranoid" mode) allows you to mark records as deleted without actually removing them from the database. Instead of a `DELETE` statement, the record's `deletedAt` column is set to the current timestamp.

This is useful when you need to:
- Preserve data for auditing or compliance
- Allow users to recover accidentally deleted records
- Maintain referential integrity while hiding records from normal queries

## Enabling Soft Delete

To enable soft delete on a model, simply add a `deletedAt` attribute:

### JavaScript

```js
import { Bone, DataTypes } from 'leoric';

class Post extends Bone {
  static attributes = {
    id: { type: DataTypes.BIGINT, primaryKey: true },
    title: DataTypes.STRING,
    deletedAt: DataTypes.DATE,  // This enables soft delete
  }
}
```

### TypeScript

```ts
import { Bone, Column } from 'leoric';

class Post extends Bone {
  @Column({ primaryKey: true })
  id: bigint;

  @Column()
  title: string;

  @Column()
  deletedAt: Date;  // This enables soft delete
}
```

### Schema-based (without explicit attributes)

If you don't define attributes explicitly and let Leoric infer them from the database schema, soft delete is automatically enabled when the table has a `deleted_at` column.

## How It Works

### Deleting Records

When soft delete is enabled, calling `.remove()` on a model instance or `Model.remove()` will update the `deletedAt` column instead of deleting the row:

```js
const post = await Post.findOne({ id: 1 });
await post.remove();
// SQL: UPDATE posts SET deleted_at = '2026-03-26 00:00:00' WHERE id = 1
```

Static method:

```js
await Post.remove({ id: 1 });
// SQL: UPDATE posts SET deleted_at = '2026-03-26 00:00:00' WHERE id = 1
```

### Querying

By default, soft-deleted records are automatically excluded from all queries:

```js
const posts = await Post.find();
// SQL: SELECT * FROM posts WHERE deleted_at IS NULL

const post = await Post.findOne({ id: 1 });
// SQL: SELECT * FROM posts WHERE id = 1 AND deleted_at IS NULL LIMIT 1
```

### Force Delete (Hard Delete)

To permanently delete a record from the database, pass `true` to `.remove()`:

```js
// Instance method
const post = await Post.findOne({ id: 1 });
await post.remove(true);
// SQL: DELETE FROM posts WHERE id = 1

// Static method
await Post.remove({ id: 1 }, true);
// SQL: DELETE FROM posts WHERE id = 1
```

## Querying Soft-Deleted Records

### `unscoped`

To include soft-deleted records in your query, use `.unscoped`:

```js
const allPosts = await Post.unscoped.find();
// SQL: SELECT * FROM posts (no WHERE deleted_at IS NULL filter)
```

### `paranoid: false`

You can also pass `paranoid: false` to specific queries:

```js
await Post.update({ title: 'Updated' }, { where: { id: 1 }, paranoid: false });
```

## Restoring Soft-Deleted Records

### Instance Method

```js
// First, find the soft-deleted record using unscoped
const post = await Post.findOne({ id: 1 }).unparanoid;
// Or find via direct query
await post.restore();
// SQL: UPDATE posts SET deleted_at = NULL WHERE id = 1 AND deleted_at IS NOT NULL
```

### Static Method

```js
await Post.restore({ id: 1 });
// SQL: UPDATE posts SET deleted_at = NULL WHERE id = 1 AND deleted_at IS NOT NULL
```

> **Note**: `restore()` will throw an error if the model does not have soft delete enabled (i.e., no `deletedAt` attribute).

## Soft Delete with Associations

When soft delete is enabled on a model, its associations will also respect the `deletedAt` scope. When loading associated records through `include()` or `with()`, soft-deleted associated records are automatically filtered out.

```js
class Post extends Bone {
  static initialize() {
    this.hasMany('comments');
  }
}

class Comment extends Bone {
  static attributes = {
    deletedAt: DataTypes.DATE,
  }
}

const post = await Post.findOne({ id: 1 }).with('comments');
// Comments with non-null deletedAt will be excluded
```

## Timestamps

Soft delete works with Leoric's automatic timestamp management. When a record is soft-deleted:

- `deletedAt` is set to the current date/time
- `updatedAt` is **not** automatically updated during soft-delete operations

When a record is restored:

- `deletedAt` is set to `null`
