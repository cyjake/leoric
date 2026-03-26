---
layout: en
title: Index Hints
---

## Table of Contents
{:.no_toc}

1. Table of Contents
{:toc}

## Overview

Index hints allow you to suggest or enforce which indexes the database engine should use when executing a query. Leoric supports MySQL index hints (`USE INDEX`, `FORCE INDEX`, `IGNORE INDEX`) and optimizer hints.

> **Note**: Index hints are primarily a MySQL feature. PostgreSQL and SQLite have different mechanisms for query optimization.

## Use Index

Suggest the database to use a specific index. The optimizer may choose to ignore the suggestion.

```js
Post.find().useIndex('idx_title')
// SELECT * FROM posts USE INDEX (idx_title)

// Multiple indexes
Post.find().useIndex('idx_title', 'idx_created_at')
// SELECT * FROM posts USE INDEX (idx_title,idx_created_at)
```

## Force Index

Force the database to use a specific index. The optimizer will not consider a full table scan unless no rows match.

```js
Post.find().forceIndex('idx_title')
// SELECT * FROM posts FORCE INDEX (idx_title)
```

## Ignore Index

Tell the database to not use a specific index.

```js
Post.find().ignoreIndex('idx_title')
// SELECT * FROM posts IGNORE INDEX (idx_title)
```

## Scoped Index Hints

You can limit index hints to specific query phases using scope objects:

### For JOIN

```js
Post.find().useIndex({ join: 'idx_user_id' })
// SELECT * FROM posts USE INDEX FOR JOIN (idx_user_id)
```

### For ORDER BY

```js
Post.find().useIndex({ orderBy: 'idx_created_at' })
// SELECT * FROM posts USE INDEX FOR ORDER BY (idx_created_at)
```

### For GROUP BY

```js
Post.find().useIndex({ groupBy: 'idx_author_id' })
// SELECT * FROM posts USE INDEX FOR GROUP BY (idx_author_id)
```

### Multiple scoped hints

```js
Post.find().useIndex(
  'idx_id',
  { orderBy: ['idx_title', 'idx_org_id'] },
  { groupBy: 'idx_type' }
)
```

## Object Syntax

For more control, pass an object with explicit `index`, `type`, and `scope` properties:

```js
import { INDEX_HINT_TYPE, INDEX_HINT_SCOPE } from 'leoric';

Post.find().useIndex({
  index: 'idx_title',
  type: INDEX_HINT_TYPE.force,
  scope: INDEX_HINT_SCOPE.orderBy,
})
// SELECT * FROM posts FORCE INDEX FOR ORDER BY (idx_title)
```

## Optimizer Hints

MySQL optimizer hints are embedded in `/*+ ... */` comments:

```js
Post.find().optimizerHints('SET_VAR(foreign_key_checks=OFF)')
// SELECT /*+ SET_VAR(foreign_key_checks=OFF) */ * FROM posts

Post.find().optimizerHints(
  'SET_VAR(foreign_key_checks=OFF)',
  'MAX_EXECUTION_TIME(1000)'
)
// SELECT /*+ SET_VAR(foreign_key_checks=OFF) MAX_EXECUTION_TIME(1000) */ * FROM posts
```

## Chaining with Other Query Methods

Index hints can be chained with all other query methods:

```js
Post
  .find({ authorId: 1 })
  .forceIndex('idx_author_id')
  .order('createdAt', 'desc')
  .limit(10)
```
