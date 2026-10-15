---
layout: zh
title: 事务
---

## 目录
{:.no_toc}

1. 目录
{:toc}

## 概述

事务确保一组数据库操作要么全部成功，要么全部失败回滚。Leoric 通过 `Bone.transaction()` 和 `realm.transaction()` 支持事务，同时兼容异步函数和生成器函数。

## 基本用法

### 使用异步函数

最常见的事务用法是传入异步函数。如果函数正常完成，事务会自动提交；如果抛出异常，事务会自动回滚。

```js
import { Bone } from 'leoric';

await Bone.transaction(async ({ connection }) => {
  const post = await Post.create({ title: '新文章' }, { connection });
  await Comment.create({ postId: post.id, content: '沙发！' }, { connection });
});
```

> **重要**：在事务内的每个查询都必须传入 `{ connection }`，以确保它们使用同一个数据库连接。否则查询会在事务之外执行。

### 使用生成器函数

生成器函数提供了一种更便捷的方式，连接会自动传递给 yield 的 Spell 查询：

```js
await Bone.transaction(function* () {
  const post = yield Post.create({ title: '新文章' });
  yield Comment.create({ postId: post.id, content: '沙发！' });
});
```

使用生成器函数时，Leoric 会自动拦截 yield 的 `Spell` 实例，并将事务连接赋给它们。这样就无需手动给每个查询传递 `{ connection }`。

## 使用 `realm.transaction()`

如果你有 `Realm` 实例，也可以通过它来开启事务：

```js
const realm = new Realm({ /* 配置项 */ });
await realm.connect();

await realm.transaction(async ({ connection }) => {
  await Post.create({ title: '你好' }, { connection });
  await User.update({ id: 1 }, { lastPostAt: new Date() }, { connection });
});
```

## 错误处理与回滚

如果事务回调内抛出任何异常，整个事务将自动回滚：

```js
try {
  await Bone.transaction(async ({ connection }) => {
    await Post.create({ title: '新文章' }, { connection });

    // 这将导致整个事务回滚
    throw new Error('出了点问题');
  });
} catch (err) {
  console.error('事务失败:', err.message);
  // Post 和其他操作都不会被创建
}
```

## 中止事务

在回调中抛出异常来中止事务。正常返回总会触发自动提交，即使回调已手动调用提供的 `commit` 或 `rollback` 辅助函数。建议使用自动结束事务的方式，不要将两种方式混用。

```js
await Bone.transaction(async ({ connection }) => {
  await Post.create({ title: '新文章' }, { connection });

  const result = await someExternalService();
  if (!result.ok) {
    throw new Error('外部操作失败');
  }
});
```

## 事务与钩子

钩子不会自动将事务连接传给额外的查询。钩子发起的查询也必须显式传入 `{ connection }`。尤其是 `afterCreate(post, result)` 不会收到原查询选项。需要使用该连接的关联写入可以放在事务回调内：

```js
await Bone.transaction(async ({ connection }) => {
  const post = await Post.create({ title: '新文章' }, { connection });
  await AuditLog.create({
    action: 'create',
    modelName: 'Post',
    modelId: post.id,
  }, { connection });
});
```

## 最佳实践

1. **使用异步函数时务必传递 `connection`**。不传的话查询会在事务之外运行。

2. **优先使用生成器函数**——当所有操作都是 Leoric 查询时，代码更简洁。

3. **保持事务简短**。长时间运行的事务可能导致锁竞争和性能问题。

4. **妥善处理错误**。需要优雅处理失败时，用 try-catch 包裹事务。

5. **避免嵌套事务**。Leoric 目前不支持 savepoint。如果需要嵌套事务行为，请重构代码使用单个事务。
