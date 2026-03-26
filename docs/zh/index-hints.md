---
layout: zh
title: 索引提示
---

## 目录
{:.no_toc}

1. 目录
{:toc}

## 概述

索引提示允许你建议或强制数据库引擎在执行查询时使用哪些索引。Leoric 支持 MySQL 索引提示（`USE INDEX`、`FORCE INDEX`、`IGNORE INDEX`）和优化器提示。

> **注意**：索引提示主要是 MySQL 特性。PostgreSQL 和 SQLite 有不同的查询优化机制。

## Use Index

建议数据库使用指定索引。优化器可能会选择忽略此建议。

```js
Post.find().useIndex('idx_title')
// SELECT * FROM posts USE INDEX (idx_title)

// 多个索引
Post.find().useIndex('idx_title', 'idx_created_at')
// SELECT * FROM posts USE INDEX (idx_title,idx_created_at)
```

## Force Index

强制数据库使用指定索引。除非没有匹配的行，否则优化器不会考虑全表扫描。

```js
Post.find().forceIndex('idx_title')
// SELECT * FROM posts FORCE INDEX (idx_title)
```

## Ignore Index

告诉数据库不要使用指定索引。

```js
Post.find().ignoreIndex('idx_title')
// SELECT * FROM posts IGNORE INDEX (idx_title)
```

## 带作用域的索引提示

可以使用作用域对象将索引提示限制在特定查询阶段：

### 用于 JOIN

```js
Post.find().useIndex({ join: 'idx_user_id' })
// SELECT * FROM posts USE INDEX FOR JOIN (idx_user_id)
```

### 用于 ORDER BY

```js
Post.find().useIndex({ orderBy: 'idx_created_at' })
// SELECT * FROM posts USE INDEX FOR ORDER BY (idx_created_at)
```

### 用于 GROUP BY

```js
Post.find().useIndex({ groupBy: 'idx_author_id' })
// SELECT * FROM posts USE INDEX FOR GROUP BY (idx_author_id)
```

### 组合多个作用域提示

```js
Post.find().useIndex(
  'idx_id',
  { orderBy: ['idx_title', 'idx_org_id'] },
  { groupBy: 'idx_type' }
)
```

## 对象语法

如需更精细的控制，可以传入包含 `index`、`type` 和 `scope` 属性的对象：

```js
import { INDEX_HINT_TYPE, INDEX_HINT_SCOPE } from 'leoric';

Post.find().useIndex({
  index: 'idx_title',
  type: INDEX_HINT_TYPE.force,
  scope: INDEX_HINT_SCOPE.orderBy,
})
// SELECT * FROM posts FORCE INDEX FOR ORDER BY (idx_title)
```

## 优化器提示

MySQL 优化器提示嵌入在 `/*+ ... */` 注释中：

```js
Post.find().optimizerHints('SET_VAR(foreign_key_checks=OFF)')
// SELECT /*+ SET_VAR(foreign_key_checks=OFF) */ * FROM posts

Post.find().optimizerHints(
  'SET_VAR(foreign_key_checks=OFF)',
  'MAX_EXECUTION_TIME(1000)'
)
// SELECT /*+ SET_VAR(foreign_key_checks=OFF) MAX_EXECUTION_TIME(1000) */ * FROM posts
```

## 与其他查询方法链式调用

索引提示可以与所有其他查询方法链式调用：

```js
Post
  .find({ authorId: 1 })
  .forceIndex('idx_author_id')
  .order('createdAt', 'desc')
  .limit(10)
```
