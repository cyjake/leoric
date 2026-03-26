---
layout: zh
title: 原始查询
---

## 目录
{:.no_toc}

1. 目录
{:toc}

## 概述

虽然 Leoric 的查询接口覆盖了大部分场景，但有时你需要直接执行原始 SQL。Leoric 提供了几种使用原始 SQL 的方式：`realm.query()`、`Model.query()`、`raw()` 函数以及 `heresql` 模板辅助函数。

## `realm.query(sql, values, options)`

通过 `Realm` 实例执行原始 SQL 查询：

```js
const result = await realm.query('SELECT * FROM posts WHERE id = ?', [1]);
console.log(result.rows);
// => [{ id: 1, title: 'Hello', content: '...' }]
```

### 返回值

返回对象包含：

| 属性            | 类型     | 说明                                          |
|---------------|----------|----------------------------------------------|
| `rows`        | `Array`  | 查询结果行                                     |
| `fields`      | `Array`  | 列元数据（table, name）                        |
| `affectedRows`| `number` | 受影响的行数（INSERT/UPDATE/DELETE）             |
| `insertId`    | `number` | 自动生成的 ID（INSERT）                         |

### 参数化查询

始终使用参数化查询来防止 SQL 注入：

```js
// 正确 - 参数化
const result = await realm.query(
  'SELECT * FROM posts WHERE title = ? AND author_id = ?',
  ['Hello', 42]
);

// 错误 - SQL 注入风险！
const result = await realm.query(
  `SELECT * FROM posts WHERE title = '${title}'`
);
```

### 命名替换

可以使用 `:name` 语法进行命名替换：

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

### 返回模型实例

传入 `model` 选项可以将结果作为模型实例返回，而非普通对象：

```js
const result = await realm.query(
  'SELECT * FROM posts WHERE id = ?',
  { model: Post, replacements: {} }
);

// result.rows 现在是 Post 实例
const post = result.rows[0];
console.log(post instanceof Post); // true
console.log(post.title);
```

### 在事务中使用

```js
await realm.transaction(async ({ connection }) => {
  await realm.query(
    'UPDATE posts SET title = ? WHERE id = ?',
    ['新标题', 1],
    { connection }
  );
});
```

## `Model.query(sql, values)`（v2.14+）

从 v2.14 开始，可以直接从模型类执行原始查询：

```js
const result = await Post.query('SELECT * FROM posts WHERE id = ?', [1]);
```

## `raw()` 函数

`raw()` 函数创建一个不会被转义的 `Raw` SQL 表达式。适用于在查询中使用 SQL 函数或表达式：

```js
import { raw } from 'leoric';

// 使用 SQL 函数
await Post.update({ id: 1 }, { updatedAt: raw('NOW()') });
// UPDATE posts SET updated_at = NOW() WHERE id = 1

// 在 where 子句中使用
const posts = await Post.find({
  createdAt: raw('NOW() - INTERVAL 7 DAY'),
});
```

也可以通过 `Realm` 实例访问 `raw()`：

```js
await Post.update({ id: 1 }, { updatedAt: realm.raw('NOW()') });
```

> **警告**：`raw()` 会绕过转义。永远不要将用户输入直接传给 `raw()`，否则会导致 SQL 注入漏洞。

## `Raw` 类

`Raw` 是底层实现类。可以直接使用或通过 `Raw.build()` 创建：

```js
import { Raw } from 'leoric';

const expr = new Raw('COUNT(*)');
const expr2 = Raw.build('COUNT(*)');
```

## `heresql` 辅助函数

`heresql` 函数将多行 SQL 字符串格式化为单行查询，便于日志输出和提高源码可读性：

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

它会修剪每行的空白并用单个空格连接，使多行 SQL 在源码中更易读，同时生成干净的单行 SQL 用于执行。

## 安全注意事项

1. **始终使用参数化查询**处理用户提供的值。永远不要将用户输入拼接到 SQL 字符串中。

2. **谨慎使用 `raw()`**。仅用于 SQL 函数和表达式，绝不用于用户输入。

3. 在确实需要插值时**使用 `realm.escape()`**，但参数化查询始终是首选。

```js
// 推荐：参数化
await realm.query('SELECT * FROM posts WHERE title = ?', [userInput]);

// 如果必须手动转义
const escaped = realm.escape(userInput);
```
