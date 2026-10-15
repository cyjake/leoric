---
layout: en
title: Transactions
---

## Table of Contents
{:.no_toc}

1. Table of Contents
{:toc}

## Overview

Transactions ensure that a set of database operations either all succeed or all fail together. Leoric supports transactions through both `Bone.transaction()` and `realm.transaction()`, with support for both async functions and generator functions.

## Basic Usage

### Using Async Functions

The most common way to use transactions is with an async function. The transaction will be automatically committed if the function completes successfully, or rolled back if an error is thrown.

```js
import { Bone } from 'leoric';

await Bone.transaction(async ({ connection }) => {
  const post = await Post.create({ title: 'New Post' }, { connection });
  await Comment.create({ postId: post.id, content: 'First!' }, { connection });
});
```

> **Important**: You must pass `{ connection }` to every query inside the transaction to ensure they all use the same database connection. Otherwise, the queries will run outside the transaction.

### Using Generator Functions

Generator functions provide a convenient alternative where the connection is automatically passed to yielded Spell queries:

```js
await Bone.transaction(function* () {
  const post = yield Post.create({ title: 'New Post' });
  yield Comment.create({ postId: post.id, content: 'First!' });
});
```

With generator functions, Leoric automatically intercepts yielded `Spell` instances and assigns the transaction connection to them. This eliminates the need to manually pass `{ connection }` to every query.

## Using `realm.transaction()`

If you have a `Realm` instance, you can also start transactions from it:

```js
const realm = new Realm({ /* options */ });
await realm.connect();

await realm.transaction(async ({ connection }) => {
  await Post.create({ title: 'Hello' }, { connection });
  await User.update({ id: 1 }, { lastPostAt: new Date() }, { connection });
});
```

## Error Handling and Rollback

If any error is thrown inside the transaction callback, the entire transaction will be automatically rolled back:

```js
try {
  await Bone.transaction(async ({ connection }) => {
    await Post.create({ title: 'New Post' }, { connection });

    // This will cause the entire transaction to rollback
    throw new Error('Something went wrong');
  });
} catch (err) {
  console.error('Transaction failed:', err.message);
  // Neither the Post nor anything else was created
}
```

## Aborting a Transaction

Throw from the callback to abort a transaction. Returning normally always triggers an automatic commit, even if a callback manually calls the supplied `commit` or `rollback` helper. Prefer automatic finalization rather than mixing the two.

```js
await Bone.transaction(async ({ connection }) => {
  await Post.create({ title: 'New Post' }, { connection });

  const result = await someExternalService();
  if (!result.ok) {
    throw new Error('External operation failed');
  }
});
```

## Transactions with Hooks

Hooks do not automatically propagate the transaction connection to additional queries. Queries started by a hook must also receive `{ connection }` explicitly. In particular, `afterCreate(post, result)` does not receive the original query options. Put related writes in the transaction callback when they need that connection:

```js
await Bone.transaction(async ({ connection }) => {
  const post = await Post.create({ title: 'New Post' }, { connection });
  await AuditLog.create({
    action: 'create',
    modelName: 'Post',
    modelId: post.id,
  }, { connection });
});
```

## Best Practices

1. **Always pass `connection`** when using async functions. Without it, queries run outside the transaction.

2. **Prefer generator functions** for simpler transaction code where all operations are Leoric queries.

3. **Keep transactions short**. Long-running transactions can cause lock contention and performance issues.

4. **Handle errors appropriately**. Wrap transactions in try-catch blocks when you need to handle failures gracefully.

5. **Avoid nested transactions**. Leoric does not currently support savepoints. If you need nested transactional behavior, restructure your code to use a single transaction.
