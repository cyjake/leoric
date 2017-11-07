---
layout: default
title: Query Interface
---

This guide covers different ways to retrieve data from the database using Leoric. After reading this guide, you will know:

- How to filter records using a variety of methods and conditions.
- How to specify the order, retrieved attributes, grouping, and other properties of the found records.
- How to use `.find().with()` to reduce the number of database queries needed for data retrieval.

## Retrieving Objects from the Database

## Conditions

Both `.find()` and `.findOne()` allow you to specify conditions to filter records stored in database. Conditions can either be specified as:

- pure string,
- template string with arguments, or
- object.

For brevity and security concerns, we'd recommend using template string conditions.

### Pure String Conditions

Pure string conditions is quite handy if you need to query with literal values:

```js
Post.find('title != "King Leoric"')
// => select * from posts where title != 'King Leoric';
```

But it can be dangerous too, if it is in clumsy hands:

```js
Post.find(`title != ${title}`)
// let title be "'' or 1 = 1"
// => select * from posts where title != '' or 1 = 1;
```

To prevent this SQL injection prone usage, Leoric will throw an error if complex values were found while parsing string conditions. The allowed values are:

- numbers
- strings with single/double quotations (e.g. `'foo'`, `"bar"`)
- `true`/`false`
- `null`/`undefined`

For other type of values, consider object conditions or templated string conditions.

### Object Conditions

Object conditions may sound familiar because it's a common approach of condition mapping in JavaScript, let alone in NoSQL databases like MongoDB. With object conditions, most of the simple conditions can be carried out by listing fields as key and values as, well, values. The values can be extended as objects with `$operator`s as key, hence make comparison conditions possible as well. Here are a few examples of object conditions with primitive values:

```js
Post.find({ id: 1 })
// => select * from posts where id = 1;

Post.find({ title: 'King Leoric' })
// => select * from posts where title = 'King Leoric';

Post.find({ title: undefined })
Post.find({ title: null })
// => select * from posts where title is null;
```

and with values of array or other non-primitive types:

```js
Post.find({ title: ['King Leoric', 'Skeleton King'] })
// => select * from posts where title in ('King Leoric', 'Skeleton King');

Post.find({
  title: { toSqlString: () => "'King Leoric'" }
})
// toSqlString() will be called when it comes to objects with toSqlString() method.
// => select * from posts where title = 'King Leoric';
```

### Object Conditions with Operators

As you may have noticed in the previous example, the values in object conditions can be objects as well. If the object has got only one key and the key is one of `($eq, $gt, $gte, $lt, $lte, $ne, $in, $nin, $notIn, $like, $notLike, $between, $notBetween)`, it will be mapped to SQL operators accordingly:

```js
Post.find({ title: { $ne: 'King Leoric' } })
// => select * from posts where title != 'King Leoric';

Post.find({ title: { $like: '%King%' } })
// => select * from posts where title like '%King%';

Post.find({ createdAt: { $lt: new Date(2017, 10, 11) } })
// => select * from posts where gmt_create < '2017-11-11 00:00:00';

Post.find({ createdAt: { $notBetween: [new Date(2017, 10, 11), new Date(2017, 11, 12)] } })
// => select * from posts where gmt_create not between '2017-11-11 00:00:00' and '2017-12-12 00:00:00';
```

### Templated String Conditions

Templated string conditions usually are the better option against object conditions when it comes to multiple conditions or comparison conditions for its brevity. The example of object conditions above can be written in templated string conditions as this:

```js
Post.find('title != ?', 'King Leoric')
// => select * from posts where title != 'King Leoric';

Post.find('title like ?', '%King%')
// => select * from posts where title like '%King%';

Post.find('createdAt < ?', new Date(2017, 10, 11))
// => select * from posts where gmt_create < '2017-11-11 00:00:00'

Post.find('createdAt < ? or createdAt > ?', new Date(2017, 10, 11), new Date(2017, 11, 12))
// => select * from posts where gmt_create < '2017-11-11 00:00:00'
```

Templated string conditions works with special primitive values or non-primitive values too:

```js
Post.find('title = ?', null)
Post.find('title = ?', undefined)
// => select * from posts where title is null;

Post.find('title = ?', ['King Leoric', 'Skeleton King'])
// => select * from posts where title in ('King Leoric', 'Skeleton King');
```

When it comes to combining multiple conditions, templated string conditions is at its best advantage:

```js
Post.find('title != ? and createdAt > ?', 'King Leoric', new Date(2017, 10, 11))
// => select * from posts where title != 'King Leoric' and gmt_create > '2017-10-11';
```

## Ordering

## Selecting Specific Fields

By default, `Model.find()` selects all the fields from the result set using `*`. To select a subset of fields from the result set, you can specify the subset with the `.select()` method:

```js
Post.find({}).select('id', 'title', 'createdAt')
// or
Post.find({}).select('id title createdAt')
```

## Limit and Offset

## Group

## Having

## Overriding Conditions

## Understanding Method Chaining

## Find or Build a New Object

## Calculations
