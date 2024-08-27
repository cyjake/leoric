---
layout: zh
title: JSON 字段
---

## 目录
{:.no_toc}

1. 目录
{:toc}

## 字段声明

```typescript
import { Bone, DataTypes } from 'leoric';

class Post extends Bone {
  @Column(DataTypes.JSONB)
  extra: Record<string, unknown>;
}
```

## 查询

可以使用 JSON 函数来自定义过滤条件：

```typescript
const post = await Post.find('JSON_EXTRACT(extra, "$.foo") = ?', 1);
```

MySQL 中的 `column->path`简写方式（比如 `extra->"$.foo"`）暂时不支持。

## 更新

下面这种更新方式容易遇到并发问题，导致数据彼此覆盖：

```typescript
const post = await Post.first;
// 假设在这个时间间隔内，同时有其他进程更新 post.extra，更新的数据就会被覆盖
await post.update('extra', { ...post.extra, foo: 1 });
```

MySQL 里面有两个函数可以用来解决这一情况：

- [JSON_MERGE_PATCH()](https://dev.mysql.com/doc/refman/8.4/en/json-modification-functions.html#function_json-merge-patch) // 覆盖更新
- [JSON_MERGE_PRESERVE()](https://dev.mysql.com/doc/refman/8.4/en/json-modification-functions.html#function_json-merge-preserve) // 遇到重名属性时会保留两者的值

### JSON_MERGE_PATCH()

Leoric 里面提供了相应的封装：

```typescript
const post = await Post.first;
await post.jsonMerge('extra', { foo: 1 });
```

第二行语句实际执行的 SQL 类似这样：

```sql
UPDATE posts SET extra = JSON_MERGE_PATCH('extra', '{"foo":1}')
```

需要注意的是 JSON_MERGE_PATCH() 函数只会对 object 做属性合并，如果是数组、字符串、布尔类型，会直接覆盖。

> 由于 JSON_MERGE_PATCH() 更接近 JavaScript 中的 merge 行为（`Object.assign()`、lodash/merge），因此默认的 bone.jsonMerge() 方法并没有和 MySQL 中已经不被鼓励使用 JSON_MERGE() 函数对应，后者效果等同于 JSON_MERGE_PRESERVE()。

### JSON_MERGE_PRESERVE()

JSON_MERGE_PRESERVE() 的逻辑则有所不同，如果是数组、字符串等类型，会返回合并结果：

```sql
JSON_MERGE_PRESERVE('[1, 2]', '[true, false]')   // -> [1, 2, true, false]
JSON_MERGE_PRESERVE('1', 'true');                // -> [1, true]
JSON_MERGE_PRESERVE('{ "a": 1 }', '{ "a": 2 }'); // -> { "a": [1, 2] }
```

Leoric 里面也有提供相应的封装：

```typescript
const post = await Post.first;
await post.jsonMergePreserve('extra', { foo: 1 });
```

由于 JSON_MERGE_PRESERVE() 会改变值的类型，如果原始属性值并不是数组，更新的时候就需要谨慎。
