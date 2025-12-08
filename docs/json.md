---
layout: en
title: JSON Fields
---

## Table of Contents
{:.no_toc}

1. Table of Contents
{:toc}

## Field Declaration

```typescript
import { Bone, DataTypes } from 'leoric';

class Post extends Bone {
  @Column(DataTypes.JSONB)
  extra: Record<string, unknown>;
}
```

## Querying

You can use JSON functions to customize filter conditions:

```typescript
const post = await Post.find('JSON_EXTRACT(extra, "$.foo") = ?', 1);
```

The `column->path` shorthand syntax in MySQL (such as `extra->"$.foo"`) is not currently supported.

## Updating

The following update approach is prone to concurrency issues that can cause data to be overwritten:

```typescript
const post = await Post.first;
// If another process updates post.extra during this time interval, the updated data will be overwritten
await post.update('extra', { ...post.extra, foo: 1 });
```

MySQL provides two functions to address this situation:

- [JSON_MERGE_PATCH()](https://dev.mysql.com/doc/refman/8.4/en/json-modification-functions.html#function_json-merge-patch) // Overwrite merge
- [JSON_MERGE_PRESERVE()](https://dev.mysql.com/doc/refman/8.4/en/json-modification-functions.html#function_json-merge-preserve) // Preserves both values when duplicate properties are encountered

### JSON_MERGE_PATCH()

Leoric provides a corresponding wrapper:

```typescript
const post = await Post.first;
await post.jsonMerge('extra', { foo: 1 });
```

The SQL executed by the second statement looks something like this:

```sql
UPDATE posts SET extra = JSON_MERGE_PATCH('extra', '{"foo":1}')
```

Note that the JSON_MERGE_PATCH() function only merges properties for objects. For arrays, strings, or boolean types, it will directly overwrite them.

> Since JSON_MERGE_PATCH() is closer to the merge behavior in JavaScript (`Object.assign()`, lodash/merge), the default bone.jsonMerge() method does not correspond to MySQL's deprecated JSON_MERGE() function, which is equivalent to JSON_MERGE_PRESERVE().

### JSON_MERGE_PRESERVE()

JSON_MERGE_PRESERVE() has different logic. For arrays, strings, and other types, it returns a merged result:

```sql
JSON_MERGE_PRESERVE('[1, 2]', '[true, false]')   // -> [1, 2, true, false]
JSON_MERGE_PRESERVE('1', 'true');                // -> [1, true]
JSON_MERGE_PRESERVE('{ "a": 1 }', '{ "a": 2 }'); // -> { "a": [1, 2] }
```

Leoric also provides a corresponding wrapper:

```typescript
const post = await Post.first;
await post.jsonMergePreserve('extra', { foo: 1 });
```

Since JSON_MERGE_PRESERVE() can change the value type, you need to be cautious when updating if the original property value is not an array.

## Change Tracking

By default, Leoric makes a copy of the model's attribute values when query results are returned, enabling the following feature:

```typescript
const post = await Post.first;
post.extra.foo = 2;
post.changes();
// -> { extra: [ { foo: 1 }, { foo: 2 } ] }
await post.save();
// -> UPDATE posts SET extra = JSON_MERGE_PATCH('extra', '{"foo":1}');
```

Deep copying objects in JavaScript is expensive. The native `structuredClone(value)` is even slower than `JSON.parse(JSON.stringify(value))`. When using mysql2, the query results are already objects, which further limits the optimization possibilities.

If the database contains large or numerous JSON data, and you don't rely on the automatic update marking feature above, you can consider skipping deep cloning of objects:

```typescript
new Realm({
  skipCloneValue: true,
});
```

Then manually handle where you need to save objects:

```typescript
const post = await Post.first;
post.extra.foo = 2;
post.changes();
// -> {}
post.extra = { ...post.extra, foo, 2 };
post.changes();
// -> { extra: [ { foo: 1 }, { foo: 2 } ] }
await post.save();
// -> UPDATE posts SET extra = JSON_MERGE_PATCH('extra', '{"foo":1}');
```
