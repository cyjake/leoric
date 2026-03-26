---
layout: zh
title: 软删除
---

## 目录
{:.no_toc}

1. 目录
{:toc}

## 概述

软删除（也称为"paranoid"模式）允许你标记记录为已删除，而不是真正从数据库中移除。系统不会执行 `DELETE` 语句，而是将记录的 `deletedAt` 列设置为当前时间戳。

适用场景：
- 保留数据用于审计或合规
- 允许用户恢复误删记录
- 在隐藏记录的同时维护引用完整性

## 启用软删除

要在模型上启用软删除，只需添加 `deletedAt` 属性：

### JavaScript

```js
import { Bone, DataTypes } from 'leoric';

class Post extends Bone {
  static attributes = {
    id: { type: DataTypes.BIGINT, primaryKey: true },
    title: DataTypes.STRING,
    deletedAt: DataTypes.DATE,  // 启用软删除
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
  deletedAt: Date;  // 启用软删除
}
```

### 基于表结构（不显式定义属性）

如果你没有显式定义属性，而是让 Leoric 从数据库表结构推断，当表中存在 `deleted_at` 列时会自动启用软删除。

## 工作原理

### 删除记录

启用软删除后，调用 `.remove()` 会更新 `deletedAt` 列而非删除行：

```js
const post = await Post.findOne({ id: 1 });
await post.remove();
// SQL: UPDATE posts SET deleted_at = '2026-03-26 00:00:00' WHERE id = 1
```

静态方法：

```js
await Post.remove({ id: 1 });
// SQL: UPDATE posts SET deleted_at = '2026-03-26 00:00:00' WHERE id = 1
```

### 查询

默认情况下，所有查询会自动排除已软删除的记录：

```js
const posts = await Post.find();
// SQL: SELECT * FROM posts WHERE deleted_at IS NULL

const post = await Post.findOne({ id: 1 });
// SQL: SELECT * FROM posts WHERE id = 1 AND deleted_at IS NULL LIMIT 1
```

### 强制删除（硬删除）

要从数据库中永久删除记录，传入 `true` 给 `.remove()`：

```js
// 实例方法
const post = await Post.findOne({ id: 1 });
await post.remove(true);
// SQL: DELETE FROM posts WHERE id = 1

// 静态方法
await Post.remove({ id: 1 }, true);
// SQL: DELETE FROM posts WHERE id = 1
```

## 查询已软删除的记录

### `unscoped`

使用 `.unscoped` 在查询中包含已软删除的记录：

```js
const allPosts = await Post.unscoped.find();
// SQL: SELECT * FROM posts（不添加 WHERE deleted_at IS NULL 过滤）
```

### `paranoid: false`

也可以在特定查询中传入 `paranoid: false`：

```js
await Post.update({ title: '已更新' }, { where: { id: 1 }, paranoid: false });
```

## 恢复已软删除的记录

### 实例方法

```js
// 先通过 unscoped 找到已软删除的记录
const post = await Post.findOne({ id: 1 }).unparanoid;
await post.restore();
// SQL: UPDATE posts SET deleted_at = NULL WHERE id = 1 AND deleted_at IS NOT NULL
```

### 静态方法

```js
await Post.restore({ id: 1 });
// SQL: UPDATE posts SET deleted_at = NULL WHERE id = 1 AND deleted_at IS NOT NULL
```

> **注意**：如果模型未启用软删除（即没有 `deletedAt` 属性），`restore()` 会抛出错误。

## 软删除与关联

启用软删除的模型，其关联也会遵守 `deletedAt` 作用域。通过 `include()` 或 `with()` 加载关联记录时，已软删除的关联记录会被自动过滤。

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
// deletedAt 非空的评论会被排除
```

## 时间戳

软删除与 Leoric 的自动时间戳管理协同工作。当记录被软删除时：

- `deletedAt` 设置为当前日期/时间
- `updatedAt` 在软删除操作期间**不会**自动更新

当记录被恢复时：

- `deletedAt` 设置为 `null`
