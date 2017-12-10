---
layout: default
title: Query Interface
---

This guide covers different ways to retrieve data from the database using Leoric. After reading this guide, you will know:

- How to filter records using a variety of methods and conditions.
- How to specify the order, retrieved attributes, grouping, and other properties of the found records.
- How to use `.find().with()` to reduce the number of database queries needed for data retrieval.

## Retrieving Objects from the Database

Leoric provides two major ways to start a query, `.find()` and `.findOne()`. `.findOne()` is basically the same as `.find()`, except that it returns only one record or null if no record were found.

### Retrieving a Single Object

To retrieve just a single object, `.findOne()` is the method of choice. For example:

```js
const post = await Post.findOne({ id: 1 })
// => Post { id: 1, ... }
```

The SQL equivalent of the above is:

```sql
SELECT * FROM posts WHERE id = 1 LIMIT 1;
```

If no record is found, `.findOne()` will return `null`.

### Retrieving Multiple Objects

To retrieve multiple objects, just change from `.findOne()` to `.find()`. It takes the same parameters as `.findOne` but will always return a collection. If no records were found, the collection will be empty. For example:

```js
const posts = await Post.find({ id: [1, 10] })
// => Collection [ Post { id: 1, ... },
//                 Post { id: 10, ... } ]
```

The SQL equivalent of the above is:

```sql
SELECT * FROM posts WHERE id in (1, 10);
```

### Retrieving Multiple Objects in Batches

When we need to iterate over a large collection, the solution might seems straightforward:

```js
const posts = await Post.find()
for (const post of posts) // code
```

But if the posts table is at large size, or if the posts contains large columns, this approach becomes slow and memory consuming, hence impractical. There are many ways to circumvent situations like this, such as refactor the implementation into smaller operations without querying the full table and so on. Switch to find in batch is the most convenient one:

```js
for (const post of Post.batch()) // code
```

`Post.batch()` takes the same parameters as `Post.findOne()` and `Post.find()`, but with an extra option:

```js
const batch = Post.batch({}).size(1000)
```

You can append a `.size()` call to set the batch size. Under the hood, Leoric will query the table with the limit of 1000, until no more records were found.

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
// => SELECT * FROM posts WHERE title != 'King Leoric';
```

But it can be dangerous too, if it is in clumsy hands:

```js
Post.find(`title != ${title}`)
// let title be "'' or 1 = 1"
// => SELECT * FROM posts WHERE title != '' OR 1 = 1;
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
// => SELECT * FROM posts WHERE id = 1;

Post.find({ title: 'King Leoric' })
// => SELECT * FROM posts WHERE title = 'King Leoric';

Post.find({ title: undefined })
Post.find({ title: null })
// => SELECT * FROM posts WHERE title IS NULL;
```

and with values of array or other non-primitive types:

```js
Post.find({ title: ['King Leoric', 'Skeleton King'] })
// => SELECT * FROM posts WHERE title IN ('King Leoric', 'Skeleton King');

Post.find({
  title: { toSqlString: () => "'King Leoric'" }
})
// toSqlString() will be called when it comes to objects with toSqlString() method.
// => SELECT * FROM posts WHERE title = 'King Leoric';
```

### Object Conditions with Operators

As you may have noticed in the previous example, the values in object conditions can be objects as well. If the object has got only one key and the key is one of `($eq, $gt, $gte, $lt, $lte, $ne, $in, $nin, $notIn, $like, $notLike, $between, $notBetween)`, it will be mapped to SQL operators accordingly:

```js
Post.find({ title: { $ne: 'King Leoric' } })
// => SELECT * FROM posts WHERE title != 'King Leoric';

Post.find({ title: { $like: '%King%' } })
// => SELECT * FROM posts WHERE title LIKE '%King%';

Post.find({ createdAt: { $lt: new Date(2017, 10, 11) } })
// => SELECT * FROM posts WHERE gmt_create < '2017-11-11 00:00:00';

Post.find({ createdAt: { $notBetween: [new Date(2017, 10, 11), new Date(2017, 11, 12)] } })
// => SELECT * FROM posts WHERE gmt_create NOT BETWEEN '2017-11-11 00:00:00' AND '2017-12-12 00:00:00';
```

### Templated String Conditions

Templated string conditions usually are the better option against object conditions when it comes to multiple conditions or comparison conditions for its brevity. The example of object conditions above can be written in templated string conditions as this:

```js
Post.find('title != ?', 'King Leoric')
// => SELECT * FROM posts WHERE title != 'King Leoric';

Post.find('title like ?', '%King%')
// => SELECT * FROM posts WHERE title LIKE '%King%';

Post.find('createdAt < ?', new Date(2017, 10, 11))
// => SELECT * FROM posts WHERE gmt_create < '2017-11-11 00:00:00'

Post.find('createdAt < ? or createdAt > ?', new Date(2017, 10, 11), new Date(2017, 11, 12))
// => SELECT * FROM posts WHERE gmt_create < '2017-11-11 00:00:00'
```

Templated string conditions works with special primitive values or non-primitive values too:

```js
Post.find('title = ?', null)
Post.find('title = ?', undefined)
// => SELECT * FROM posts WHERE title IS NULL;

Post.find('title = ?', ['King Leoric', 'Skeleton King'])
// => SELECT * FROM posts WHERE title in ('King Leoric', 'Skeleton King');
```

When it comes to combining multiple conditions, templated string conditions is at its best advantage:

```js
Post.find('title != ? and createdAt > ?', 'King Leoric', new Date(2017, 10, 11))
// => SELECT * FROM posts WHERE title != 'King Leoric' AND gmt_create > '2017-10-11';
```

## Ordering

To retrieve the records from the database in specific order, you can use the order method.

For example, to retrieve posts updated most recently, we can order the posts by updatedAt in descending order:

```js
Post.order('updatedAt', 'desc')
```

`.order()` accepts parameters in following types:

```js
Post.order('updatedAt desc')
Post.order({ updatedAt: 'desc' })
```

The order is default to `asc`. Hence `Post.order('updatedAt')` is the same as `Post.order('updatedAt asc')`.

To order by multiple columns:

```js
Post.order({ updatedAt: 'desc', title: 'asc' })
// or
Post.order('updatedAt desc').order('title')
```

Both are equivalent to the following SQL:

```sql
SELECT * FROM posts ORDER BY updated_at DESC, title ASC;
```

## Selecting Specific Fields

By default, `.find()` selects all the fields from the result set using `*`. To select a subset of fields from the result set, you can specify the subset with the `.select()` method:

```js
Post.find({}).select('id', 'title', 'createdAt')
// or
Post.find({}).select('id title createdAt')
```

The SQL equivalent of the above is:

```sql
SELECT id, title, created_at FROM posts;
```

## Limit and Offset

It is always recommended to limit the query, unless the query result is unlikely to be bloated. One of the scenarios where limit and offset are used most often, is pagination. For example, to get the top 20 posts updated most recently:

```js
const posts = await Post.order('updatedAt desc').limit(20)
```

To get the second 20 posts updated most recent, e.g. user turned to page 2 and the page size is 20:

```js
const posts = await Post.order('updatedAt desc').limit(20).offset(20)
```

The SQL equivalent of the above is:

```sql
SELECT * FROM posts ORDER BY updated_at DESC LIMIT 20 OFFSET 20;
```

## Group

`GROUP BY` is one of most important features of relational database. Combined with calculation functions such as `COUNT()` and `SUM()`, it is a convenient way of accumulating meaningful data from records.

For example, if you want to find out at which date most posts where published:

```js
Post.group('DATE(createdAt)').count().order('count desc')
```

The SQL equivalent of the above is:

```sql
SELECT COUNT(*) as count, DATE(created_at) FROM posts GROUP BY DATE(created_at) ORDER BY count DESC;
```

When the query is grouped, it returns vanilla query results of the database instead of dispatching the results to the corresponding models because there's none. The example above might return:

```js
[ { count: 1, 'DATE(created_at)': '2017-12-12' },
  { count: 5, 'DATE(created_at)': '2017-11-11' },
  ... ]
```

It is still possible to join other models to the query though, we'll discuss that in the *Joining Tables* section.

## Having

`HAVING` is only necessary when you need to filter the results by calculated columns. It is recommended to put the conditions into `WHERE` as much as possible and leave only the calculated ones to `HAVING` because in this way the temporary data set would be smaller.

Take the group example above for another example, we can rule out dates that has the count of posts published less than 5.

```js
Post.group('DATE(createdAt)').count().order('count desc').having('count < 5')
```

The SQL equivalent of the above is:

```sql
SELECT COUNT(*) as count, DATE(created_at) FROM posts GROUP BY DATE(created_at) HAVING count < 5 ORDER BY count DESC;
```

And the results might be:

```js
[ { count: 5, 'DATE(created_at)': '2017-11-11' },
  ... ]
```

## Joining Tables

Leoric provides two ways of constructing JOIN querys:

- Join predefined relationships using `.with(relationName)`,
- Join arbitrary models using `.join(Model, onConditions)`.

### Predefined Joins

Predefined relationships can be found by examining `Model.relations`, which is generated by calling `Model.describe()` implicitly. We can define relationships by arranging `.hasMany()`, `.hasOne()`, and `.belongsTo()` in `Model.describe()` such as:

```js
class Post extends Bone {
  static describe() {
    this.hasMany('comments')
    this.belongsTo('author', { foreignKey: 'authorId', Model: 'User' })
  }
}
```

To find with predefined joins, we call `.with(name)`:

```js
Post.find().with('comments')
```

The SQL equivalent of the above is:

```sql
SELECT * FROM posts LEFT JOIN comments ON posts.id = comments.post_id;
```

A LEFT JOIN is performed to preserve posts that have got no comments. The ON conditional expression is generated according to the type and the settings of the relationship. See [Associations]({{ '/associations' | relative_url }}) for detailed informations.

To find multiple predefined joins, we can either pass multiple relationship names or chain multiple `.with()`:

```js
Post.find().with('comments', 'author')
// or
Post.find().with('comments').with('author')
```

### Arbitrary Joins

If a join is needed but not predefined in `Model.describe()`, it can still be accomplished with `.join()`:

```js
Post
  .join(Comment, 'posts.id = comments.postId')
  .join(User, 'posts.authorId = users.id')
```

The SQL equivalent of the above is:

```sql
SELECT * FROM posts LEFT JOIN comments ON posts.id = comments.post_id LEFT JOIN users ON posts.author_id = users.id;
```

Like predefined joins, LEFT JOIN is preferred to preserve left table in the final results.

The table aliases were transformed by `pluralize(camelCase(Model.name))`. In the example above, here are the transformed table aliases:

| Model Name | Table Alias |
|------------|-------------|
| Post       | posts       |
| Comment    | comments    |
| User       | users       |

We can reference these table aliases futher after the join, such as `.where()` or `.order()`:

```js
Post.join(comments, 'posts.id = comments.postId').where('comments.id = 1')
```

## Scopes

If the model has `deletedAt` attribute, it won't be actually deleted when calling `Model.remove()` but will be updated by setting `deletedAt` to the time when `Model.remove()` is called. This behavior is called soft delete.

To make soft delete transparent to model consumers, a default WHERE condition is added every time before a query generates the final SQL. For example, if `Post` model has `deletedAt` attribute, the SQL equivalent of `Post.find()` would be:

```sql
SELECT * FROM posts WHERE deleted_at IS NULL;
```

But if any where conditional expressions have got `deletedAt` referenced already, the default `.where({ deletedAt: null })` won't be appended. For example, the SQL equivalent of `Post.find('deletedAt != null')` is:

```sql
SELECT * FROM posts WHERE deleted_at IS NOT NULL;
```

Leoric implemented this behavior as scopes, which is a concept (among many others) stolen from Active Record. Currently this conditional `.where({ deletedAt: null })` is the only default scope.

### unscoped

To truly go scope free, we can get the unscoped version of the query by accessing the `unscoped` attribute:

```js
Post.find({ id: [1, 10] }).unscoped
```

Regardless of whether `Post` has got a `deletedAt` attribute or not, the SQL equivalent of the above is:

```sql
SELECT * FROM posts WHERE id IN (1, 10)
```

## Understanding Method Chaining

Leoric supports [Method Chaining](http://en.wikipedia.org/wiki/Method_chaining), which allows methods be appended consecutively to complete the query. It is implemented by returning an instance of `Spell` when a query method of the model, such as `.find()` and `.order()`, is called.

```js
Post.find()   // => Spell { Model: Post }
```

The spell provides methods such as `.where()`, `.order()`, `.group()`, `.having()`, `limit()`, and `.join()`. Most of them returns this, hence making method chaining possible. When the methods were called, the SQL isn't generated right away. It is postponed to the next iteration of the event loop with `setImmediate`.

The spell also holds a promise. When the event loop ticks, the SQL is generated with `.toSqlString()` and the promise is resolved with the returning SQL.

Anyway, you can always append further query details onto the spell until it's done, as long as there's no asychronous operations in between:

```js
// This works.
const query = Post.where('title LIKE ?', '%King%')
if (top10) {
  query.order('updatedAt desc').limit(10)
}
const posts = await query
```

Due to the nature of event loop, following example WON'T work:

```js
// This WON'T work.
const query = Post.where('title LIKE ?', '%King%')
if (await promptUserInputTopCount) {
  query.order('updatedAt desc').limit(userInputTopCount)
}
const posts = await query   // query might be resolved without order or limit already
```

## Find or Build a New Object

## Calculations

### COUNT

