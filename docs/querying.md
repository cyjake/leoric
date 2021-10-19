---
layout: en
title: Query Interface
---

This guide covers different ways to retrieve data from the database using Leoric. After reading this guide, you will know:

- How to filter records using a variety of methods and conditions.
- How to specify the order, retrieved attributes, grouping, and other properties of the found records.
- How to use `.include()` to reduce the number of database queries needed for data retrieval.

## Table of Contents
{:.no_toc}

1. Table of Contents
{:toc}

## Retrieving Objects from the Database

Leoric provides two major ways to start a query, `.find()` and `.findOne()`. `.findOne()` is basically the same as `.find()`, except that it returns only one record or null if no record were found.

### Retrieving a Single Object

#### `.findOne()`

```js
const post = await Post.findOne(1)
// => Post { id: 1, ... }
```

The SQL equivalent of the above is:

```sql
SELECT * FROM posts WHERE id = 1 LIMIT 1;
```

`.findOne()` is like a stingy twin of `.find()` because it works exactly like `.find()` except that it will always append a `.limit(1)` to it.  Hence complex query is possible with `.findOne()` too:

```js
const post = await Post.findOne({
  title: ['New Post', 'Untitled'],
  createdAt: new Date(2012, 4, 15)
})
// => Post { id: 1, title: 'New Post', ... }
```

The SQL equivalent of the above is:

```sql
SELECT * FROM posts WHERE title IN ('New Post', 'Untitled') AND created_at = '2012-04-15 00:00:00' LIMIT 1;
```

If no record is found, `.findOne()` will return `null` whereas `.find()` will return an empty collection.

#### `.first`

The `.first` getter finds the first record ordered by primary key. For example:

```js
const post = await Post.first
// => Post { id: 1, ... }
```

The SQL equivalent of the above is:

```sql
SELECT * FROM posts ORDER BY id LIMIT 1;
```

#### `.last`

The `.last` getter finds the last record ordered by primary key. For example:

```js
const post = await Post.last
// => Post { id: 42, ... }
```

The SQL equivalent of the above is:

```sql
SELECT * FROM posts ORDER BY id DESC LIMIT 1;
```

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
const posts = await Post.all
for (const post of posts) {
  // handle post
}
```

But if the posts table is at large size, this approach becomes slow and memory consuming, hence impractical. There are many ways to circumvent situations like this, such as refactor the implementation into smaller operations without loading all rows at once and so on. Switch to find in batch is the most convenient one:

```js
for await (const post of Post.all.batch()) {
  // handle post
}
```

The SQL equivalent of the above is:

```sql
-- assume posts contains 2000 rows, the default LIMIT is 1000
SELECT * FROM posts LIMIT 1000;
SELECT * FROM posts LIMIT 1000 OFFSET 1000;
SELECT * FROM posts LIMIT 1000 OFFSET 2000;
```

To set batch size, we can pass a number to `.batch()`:

```js
// This queries database with LIMIT 100
for await (const post of Post.all.batch(100)) {
  // handle post
}
```

## Conditions

Both `.find()` and `.findOne()` allow you to specify conditions to filter records stored in database. Conditions can either be specified as:

- pure string,
- template string with arguments, or
- object.

For brevity and security concerns, we'd recommend using template string conditions.

### Pure String Conditions

Pure string conditions is quite handy if you need to query with literal values:

```js
Post.find('title != "New Post"')
// => SELECT * FROM posts WHERE title != 'New Post';
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

Object conditions may sound familiar because it's a common approach of condition mapping in JavaScript, let alone in NoSQL databases like MongoDB. With object conditions, most of the simple conditions can be carried out by listing fields as keys and values as, well, values. The values can be extended as objects with `$operator`s as key, hence make comparison conditions possible as well. Here are a few examples of object conditions with primitive values:

```js
Post.find({ id: 1 })
// => SELECT * FROM posts WHERE id = 1;

Post.find({ title: 'New Post' })
// => SELECT * FROM posts WHERE title = 'New Post';

Post.find({ title: undefined })
Post.find({ title: null })
// => SELECT * FROM posts WHERE title IS NULL;
```

and with values of array or other non-primitive types:

```js
Post.find({ title: ['New Post', 'Untitled'] })
// => SELECT * FROM posts WHERE title IN ('New Post', 'Untitled');

Post.find({
  title: { toSqlString: () => "'New Post'" }
})
// toSqlString() will be called when it comes to objects with toSqlString() method.
// => SELECT * FROM posts WHERE title = 'New Post';
```

### Object Conditions with Operators

As you may have noticed in the previous example, the values in object conditions can be objects as well. If every property of the object is one of `($eq, $gt, $gte, $lt, $lte, $ne, $in, $nin, $notIn, $like, $notLike, $between, $notBetween)`, the object is considered operator object condition:

```js
Post.find({ title: { $ne: 'New Post' } })
// => SELECT * FROM posts WHERE title != 'New Post';

Post.find({ title: { $like: '%Post%' } })
// => SELECT * FROM posts WHERE title LIKE '%Post%';

Post.find({ createdAt: { $lt: new Date(2017, 10, 11) } })
// => SELECT * FROM posts WHERE gmt_create < '2017-11-11 00:00:00';

Post.find({ createdAt: { $notBetween: [new Date(2017, 10, 11), new Date(2017, 11, 12)] } })
// => SELECT * FROM posts WHERE gmt_create NOT BETWEEN '2017-11-11 00:00:00' AND '2017-12-12 00:00:00';
```

If the object has multiple operators, the condition is combined with `AND`:

```js
Post.find({ id: { $gt: 0, $lt: 999999 }})
// => SELECT * FROM posts WHERE id >= 0 AND id <= 999999
```

Currently no logical operators (such as `AND`, `OR`, and `!`) is supported via operator object condition. Consider using string conditions instead.

### Templated String Conditions

Templated string conditions usually are the better option against object conditions when it comes to multiple conditions or comparison conditions for its brevity. The example of object conditions above can be written in templated string conditions as this:

```js
Post.find('title != ?', 'New Post')
// => SELECT * FROM posts WHERE title != 'New Post';

Post.find('title like ?', '%Post%')
// => SELECT * FROM posts WHERE title LIKE '%Post%';

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

Post.find('title = ?', ['New Post', 'Untitled'])
// => SELECT * FROM posts WHERE title in ('New Post', 'Untitled');
```

When it comes to combining multiple conditions, templated string conditions is at its best advantage:

```js
Post.find('title != ? and createdAt > ?', 'New Post', new Date(2017, 10, 11))
// => SELECT * FROM posts WHERE title != 'New Post' AND gmt_create > '2017-10-11';
```

## Ordering

To retrieve the records from the database in specific order, you can use the order method.

For example, to retrieve posts updated most recently, we can order the posts by `updatedAt` in descending order:

```js
Post.order('updatedAt', 'desc')
```

`.order()` also accepts parameters in following types:

```js
Post.order('updatedAt desc')
Post.order({ updatedAt: 'desc' })
```

The SQL equivalent of the above is:

```sql
SELECT * FROM posts ORDER BY updated_at DESC;
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
Post.select('id', 'title', 'createdAt')
// or
Post.select('id, title, createdAt')
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
[ { count: 4, 'DATE(created_at)': '2017-11-11' },
  ... ]
```

## Transactions

> The transaction ability is a bit premature currently due to the lack of `LOCK`. Hopefully we'll see to it soon.

We can use `Model.transaction()` to obtain a connection from the connection pool, which is available at `Model.pool`, and wrap the queries between `BEGIN` and `COMMIT`/`ROLLBACK` through the obtained connection. Take following transaction for example:

```js
Post.transaction(function* () {
  yield Comment.create({ content: 'tl;dr', articleId: 1 })
  yield Post.findOne({ id: 1 }).increment('commentCount')
})
// => Promise
```

The SQL equivalent of the above is:

```sql
BEGIN
INSERT INTO comments (content, article_id) VALUES ('tl;dr', 1);
UPDATE posts SET comment_count = comment_count + 1 WHERE id = 1;
COMMIT
```

The use of `function* () {}` might be a bit absurd at first glance. It is chosen as the function type for transaction factory because of its ability to create fine grained asynchronous procedure. Behind the curtain,

1. A connection is obtained from the pool before the generator function is called.
2. `BEGIN`
3. Call `generator.next()` to push the iterator forward.
4. If `generator.next()` returns an instance of `Spell`, the obtained connection is set to `spell.connection`.
5. Spell performs the query through given connection.
6. Continue the iteration until the very end.
7. `COMMIT`

In this way we make sure all the related SQLs are queried through the same connection.

If there were any exceptions thrown during iteration, `Model.transaction()` forwards the exception after executing `ROLLBACK`.

## Joining Tables

Leoric provides two ways of constructing JOIN querys:

- Join predefined associations using `.with(relationName)`,
- Join arbitrary models using `.join(Model, onConditions)`.

### Predefined Joins

Predefined associations can be found by examining `Model.relations`, which is generated by calling `Model.describe()` implicitly. We can define associations by arranging `.hasMany()`, `.hasOne()`, and `.belongsTo()` in `Model.describe()` such as:

```js
class Post extends Bone {
  static initialize() {
    this.hasMany('comments')
    this.belongsTo('author', { foreignKey: 'authorId', Model: 'User' })
  }
}
```

To find with predefined joins, we call `.include(name)`:

```js
Post.include('comments')
// or
Post.find().with('comments')
```

The SQL equivalent of the above is:

```sql
SELECT * FROM posts LEFT JOIN comments ON posts.id = comments.post_id;
```

A LEFT JOIN is performed to preserve posts that have got no comments. The ON conditional expression is generated according to the type and the settings of the association. See [Associations]({{ '/associations' | relative_url }}) for detailed informations.

To find multiple predefined joins, we can either pass multiple association names to `.include()` or chain them one by one using `.with()`:

```js
Post.include('comments', 'author')
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
Post.join(Comment, 'posts.id = comments.postId').where('comments.id = 1')
```

## Scopes

If the model has `deletedAt` attribute, it won't be actually deleted when calling `Model.remove()` but will be updated by setting `deletedAt` to the time when `Model.remove()` is called. This behavior is called soft delete.

To make soft delete transparent to model consumers, a default WHERE condition is added every time before a query generates the final SQL. For example, if `Post` model has `deletedAt` attribute, the SQL equivalent of `Post.find()` would be:

```sql
SELECT * FROM posts WHERE deleted_at IS NULL;
```

But if any `WHERE` conditional expressions have got `deletedAt` referenced already, the default `.where({ deletedAt: null })` won't be appended. For example, the SQL equivalent of `Post.find('deletedAt != null')` is:

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

The spell provides methods such as `.where()`, `.order()`, `.group()`, `.having()`, `limit()`, and `.join()`. Most of them returns an instance of `Spell`, hence making method chaining possible. When the methods were called, the SQL isn't generated right away. We can get the final SQL manually by calling `.toSqlString()`. To get the query results, we can treat spells as promises. For example:

```js
// ES5 style
const spell = Post.find()
spell
  .then(posts => { ... })
  .catch(err => console.error(err.stacak))

// ES6 with co
co(function* () {
  const posts = yield Post.find()
})

// ES2016 style
async function() {
  const posts = await Post.find()
}
```

Since Leoric is written in ES2016, which is supported by Node.js LTS already, we'd encourage you to start using async/await too.

Anyway, you can always append further query details onto the spell until it's done, even if there's asynchronous jobs in between:

```js
const query = Post.where('title LIKE ?', '%Post%')
const posts = await query.order('updatedAt desc').limit(10)
const [{ count }] = await query.count() // unordered and unlimited count
this.body = { posts, count }
```

## Find or Build a New Object

It's common that you need to find a record or create it if it doesn't exist. Hence our source of inspiration, Active Record, provides a specific `find_or_create_by` method. It's trivial to implement but can get confused with `upsert` behaviour a lot.

> In MongoDB there's [`db.collection.update({ upsert: true })`](https://docs.mongodb.com/manual/reference/method/db.collection.update/#mongodb30-upsert-id), in PostgreSQL there's [`INSERT ... ON CONFLICT ... DO UPDATE`](https://www.postgresql.org/docs/9.5/static/sql-insert.html#SQL-ON-CONFLICT), and in MySQL (and forks such as MariaDB) there's [`INSERT ... ON DUPLICATE KEY UPDATE`](https://dev.mysql.com/doc/refman/5.7/en/insert-on-duplicate.html). In general, if duplicated values of primary key were found, the record gets updated. If not, the record gets inserted.

Leoric takes this `upsert` behavior to update on duplicated keys. For example:

```js
const post = new Post({ id: 1, title: 'New Post' })
await post.save()
```

If `Post { id: 1 }` exists, its `title` gets updated to `New Post`.

But this `upsert` thing is **NOT** exactly the same as the meaning of *Find or Build a New Object*. For example, if our users were distinguished by email, we can find the user by email, or create a new one if not found:

```js
let user = await User.findOne({ email: 'john@example.com' })
if (!user) user = await User.create({ email: 'john@example.com' })
```

To make a long story short, if the value of the primary key is known, feel free to use `model.save()` because it's taken care of with `upsert`. If not, we'll need to find or build a new object by hand.

## Calculations

All calculation methods work directly on a model:

```js
const results = await Post.count()
```

Or on a query:

```js
const results = await Post.where('name like ?', '%Post%').count()
```

### Count

If you want to count the total numbers of records in your model's table you could call `Model.count()`. If you need to be more specific, say to find how many items does the shop have got, you can:

```js
Shop.find(1).with('items').count('items.*')
```

The SQL equivalent of the above is:

```sql
SELECT COUNT(items.*) AS count FROM (SELECT * FROM shops WHERE id = 1) AS shops LEFT JOIN items ON items.shop_id = shops.id;
```

### Average

If you want to see the average of certain number in your model's table, you could call `Model.average()`. Say to find the average age of your website's subscribed users, you can:

```js
User.where({ subscribed: true }).average('age')
```

The SQL equivalent of the above is:

```sql
SELECT AVG(age) FROM users WHERE subscribed = 1;
```

### Minimum

If you want to see the minimum of certain number in your model's table, you could call `Model.minimum()`. Say to find the minimum age of your website's subscribed users, you can:

```js
User.minimum('age')
```

The SQL equivalent of the above is:

```sql
SELECT MIN(age) AS minimum FROM users;
```

### Maximum

If you want to see the maximum of certain number in your model's table, you could call `Model.maximum()`. Say to find the maximum age of your website's subscribed users, you can:

```js
User.maximum('age')
```

The SQL equivalent of the above is:

```sql
SELECT MAX(age) AS maximum FROM users;
```

### Sum

If you want to find the sum of a field for all records in your model's table you could call `Model.sum()`. Say to find the total price of the items of certain shop, you can:

```js
Shop.find(42).with('items').sum('items.price')
```

The SQL equivalent of the above is:

```sql
SELECT SUM(items.price) FROM (SELECT * FROM shops WHERE id = 42) AS shops LEFT JOIN items ON items.shop_id = shops.id;
```
