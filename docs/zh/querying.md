---
layout: zh
title: 查询接口
---

本文涵盖使用 Leoric 从数据库读取数据的各种方式。读完本文后你将知晓：

- 如何使用一系列方法和条件过滤数据记录；
- 如何指定查询结果的排序方式、所需获取的字段、分组、以及其他。
- 如何使用 `.include()` 来一次性读取当前数据模型以及模型的关联关系。

## 目录
{:.no_toc}

1. 目录
{:toc}

## 从数据库读取数据

Leoric 提供两种主要的查询方式，`.find()` 和 `.findOne()`。`.findOne()` 除了仅返回一条记录或者返回 `null`，其他方面跟 `.find()` 没有差别。

### 读取一条数据

#### `.findOne()`

```js
const post = await Post.findOne(1)
// => Post { id: 1, ... }
```

上例对应的 SQL 如下：

```sql
SELECT * FROM posts WHERE id = 1 LIMIT 1;
```

`.findOne()` 被称作 `.find()` 的孪生兄弟，是因为它和 `.find()` API 完全一样，只是它会追加一个 `.limit(1)` 到当前查询。所以我们也可以使用 `.findOne()` 执行相对复杂的条件查询：

```js
const post = await Post.findOne({
  title: ['New Post', 'Untitled'],
  createdAt: new Date(2012, 4, 15)
})
// => Post { id: 1, title: 'New Post', ... }
```

上例对应的 SQL 如下：

```sql
SELECT * FROM posts WHERE title IN ('New Post', 'Untitled') AND created_at = '2012-04-15 00:00:00' LIMIT 1;
```

如果查无记录，`.findOne()` 会返回 `null` 而不是像 `.find()` 一样返回空集合。

#### `.first`

可以通过 `.first` 属性获取 id 最小的记录。例如：

```js
const post = await Post.first
// => Post { id: 1, ... }
```

上例对应的 SQL 如下：

```sql
SELECT * FROM posts ORDER BY id LIMIT 1;
```

#### `.last`

可以通过 `.last` 属性获取 id 最大的记录。例如：

```js
const post = await Post.last
// => Post { id: 42, ... }
```

上例对应的 SQL 如下：

```sql
SELECT * FROM posts ORDER BY id DESC LIMIT 1;
```

### 读取多条数据

要读取多条数据，把 `.findOne()` 改为 `.find()` 即可。它接收的参数与 `.findOne()` 一样，但会返回集合。如果查无记录，集合会是空的。例如：

```js
const posts = await Post.find({ id: [1, 10] })
// => Collection [ Post { id: 1, ... },
//                 Post { id: 10, ... } ]
```

上例对应的 SQL 如下：

```sql
SELECT * FROM posts WHERE id in (1, 10);
```

### 批量读取多条数据

要遍历较大的数据集时，我们的第一反应可能是：

```js
const posts = await Post.find()
for (const post of posts) // code
```

但假如 `Post` 表所包含的数据条数过多，这种遍历方式会变得耗时，因此不切实际。有很多种避免这种情况的方法，而转 `.find()` 为批量查询是其中最方便的一个：

```js
async function consume() {
  const batch = Post.find().batch() // 此时不需要 await
  while (true) {
    const { done, value } = await batch.next()
    if (value) handle(value)
    if (done) break
  }
}
```

如果你熟悉 JavaScript 的 [`Iterator`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols)，你可能会觉得上面这个实例有些熟悉，`.batch()` 的结果能否使用 `for...of` 遍历？答案是，是也不是。因为 JavaScript 一贯以来的异步特质，`.batch()` 结果并非寻常的 Iterator，这也意味着 `for...of` 不能用来正常遍历。幸运的是，`Iterator` 的异步版本已经有[提案](https://github.com/tc39/proposal-async-iteration)（并且 [V8 有实现](https://jakearchibald.com/2017/async-iterators-and-generators/))。在这个提案中，我们可以使用 `for await...of` 来遍历异步 Iterator：

```js
for await (const post of Post.find().batch()) {
  handle(post)
}
```

不过眼下这个特性还藏在一个开关后面，更别提 Node.js LTS 了。

言归正传，要设置批量查询时每批查询的个数，可以给 `.batch()` 传个数字：

```js
// 将以每批 1000 个逐批查询 Post
for await (const post of Post.find().batch(1000)) {
  handle(post)
}
```

## 查询条件

`.find()` 和 `.findOne()` 都支持传入查询条件来过滤数据库中的记录。查询条件可以是：

- 纯字符串；
- 带占位符的字符串；
- 或者对象。

出于简洁以及安全考虑，我们最为推荐使用带占位符的字符串，并将外部输入作为参数传入。

### 纯字符串的查询条件

需要查询确定值的时候，纯字符串的查询条件会很合适：

```js
Post.find('title != "New Post"')
// => SELECT * FROM posts WHERE title != 'New Post';
```

但如果使用时不加注意，这种使用方式也很危险：

```js
Post.find(`title != ${title}`)
// 假设 title 值为 "'' or 1 = 1"
// => SELECT * FROM posts WHERE title != '' OR 1 = 1;
```

为避免这种极易被 SQL 注入的查询方式，当条件判断的左操作数并非 identifier 时，Leoric 将抛出异常。但这并不能完全避免被注入的情况，所以在查询条件中需要包含外部输入时，请使用对象查询条件或者带占位符的字符串查询条件。

### 对象查询条件

由于对象查询条件在 JavaScript 世界里（不管是关系型数据库还是 MongoDB 这种 NoSQL）是比较常用的查询方式，你可能会觉得它有些眼熟。使用对象查询条件，以属性名为键，查询条件为值，绝大多数简单的查询条件都可以实现。对象中的值可以是简单值，也可以是一个键为操作符（`$operator`）的对象，用来传入对比条件。以下是一些使用简单值的对象查询条件示例：

```js
Post.find({ id: 1 })
// => SELECT * FROM posts WHERE id = 1;

Post.find({ title: 'New Post' })
// => SELECT * FROM posts WHERE title = 'New Post';

Post.find({ title: undefined })
Post.find({ title: null })
// => SELECT * FROM posts WHERE title IS NULL;
```

以下是一些使用数组或者其他非简单值的对象查询条件示例：

```js
Post.find({ title: ['New Post', 'Untitled'] })
// => SELECT * FROM posts WHERE title IN ('New Post', 'Untitled');

Post.find({
  title: { toSqlString: () => "'New Post'" }
})
// 如果传入的是个包含 toSqlString() 方法的对象，将会使用 toSqlString() 的返回值。
// => SELECT * FROM posts WHERE title = 'New Post';
```

### 包含操作符的对象查询条件

可能在之前的示例中你已经注意到了，对象查询条件中的值也可以是一个对象。如果这个对象的所有属性都是 `($eq, $gt, $gte, $lt, $lte, $ne, $in, $nin, $notIn, $like, $notLike, $between, $notBetween)` 的其中一个，这个对象将被映射为 SQL 查询条件：

```js
Post.find({ title: { $ne: 'New Post' } })
// => SELECT * FROM posts WHERE title != 'New Post';

Post.find({ title: { $like: '%King%' } })
// => SELECT * FROM posts WHERE title LIKE '%King%';

Post.find({ createdAt: { $lt: new Date(2017, 10, 11) } })
// => SELECT * FROM posts WHERE gmt_create < '2017-11-11 00:00:00';

Post.find({ createdAt: { $notBetween: [new Date(2017, 10, 11), new Date(2017, 11, 12)] } })
// => SELECT * FROM posts WHERE gmt_create NOT BETWEEN '2017-11-11 00:00:00' AND '2017-12-12 00:00:00';
```

如果对象包含多个操作符，相关查询条件将以 `AND` 逻辑合并：

```js
Post.find({ id: { $gt: 0, $lt: 999999 }})
// => SELECT * FROM posts WHERE id >= 0 AND id <= 999999
```

目前对象查询条件所支持的操作符还不包含逻辑操作符（比如 `AND`、`OR`、或者 `!`），可以改用纯字符串的查询条件实现。

### 字符串查询条件

需要组合查询条件的时候，带占位符的字符串查询条件通常是比对象查询条件更合适的选择。上文中有关对象查询条件的示例使用带占位符的字符串查询条件可以写成：

```js
Post.find('title != ?', 'New Post')
// => SELECT * FROM posts WHERE title != 'New Post';

Post.find('title like ?', '%King%')
// => SELECT * FROM posts WHERE title LIKE '%King%';

Post.find('createdAt < ?', new Date(2017, 10, 11))
// => SELECT * FROM posts WHERE gmt_create < '2017-11-11 00:00:00'

Post.find('createdAt < ? or createdAt > ?', new Date(2017, 10, 11), new Date(2017, 11, 12))
// => SELECT * FROM posts WHERE gmt_create < '2017-11-11 00:00:00'
```

带占位符的字符串查询会自动处理各种类型的 JavaScript 变量：

```js
Post.find('title = ?', null)
Post.find('title = ?', undefined)
// => SELECT * FROM posts WHERE title IS NULL;

Post.find('title = ?', ['New Post', 'Untitled'])
// => SELECT * FROM posts WHERE title in ('New Post', 'Untitled');
```

需要组合多个查询条件时，使用带占位符的字符串查询条件是最方便的：

```js
Post.find('title != ? and createdAt > ?', 'New Post', new Date(2017, 10, 11))
// => SELECT * FROM posts WHERE title != 'New Post' AND gmt_create > '2017-10-11';
```

## 排序

我们可以使用 `.order()` 方法让从数据库获取的数据按一定顺序排序。例如，要获取最近更新的文章列表，我们可以将文章按 `updatedAt` 降序排序：

```js
Post.order('updatedAt', 'desc')
```

`.order()` 还接收如下几种参数形式：

```js
Post.order('updatedAt desc')
Post.order({ updatedAt: 'desc' })
```

上例对应的 SQL 如下：

```sql
SELECT * FROM posts ORDER BY updated_at DESC;
```

默认的排序方式是 `asc` 升序。因此 `Post.order('updatedAt')` 和 `Post.order('updatedAt asc')` 的效果是一样的。

要按多个字段排序时，我们可以：

```js
Post.order({ updatedAt: 'desc', title: 'asc' })
// 或者
Post.order('updatedAt desc').order('title')
```

上例中的两个查询对应的 SQL 都是：

```sql
SELECT * FROM posts ORDER BY updated_at DESC, title ASC;
```

## 选取特定字段

默认情况下，`.find()` 会使用 `*` 选择表中所有字段。如果需要仅选择某些字段，可以使用 `.select()` 方法：

```js
Post.select('id', 'title', 'createdAt')
// or
Post.select('id, title, createdAt')
```

上例对应的 SQL 如下：

```sql
SELECT id, title, created_at FROM posts;
```

## Limit 与 Offset

我们推荐保持给查询条件加 LIMIT 的习惯，除非能确保查询结果不会很膨胀。LIMIT 与 OFFSET 最为常用的场景之一，就是分页。例如，获取 20 篇最近更新的文章：

```js
const posts = await Post.order('updatedAt desc').limit(20)
```

要获取第二批 20 篇最近更新的文章，也就是说用户翻到了第二页，每页文章篇数为 20:

```js
const posts = await Post.order('updatedAt desc').limit(20).offset(20)
```

上例对应的 SQL 如下：

```sql
SELECT * FROM posts ORDER BY updated_at DESC LIMIT 20 OFFSET 20;
```

## 分组

`GROUP BY` 是关系型数据中最为重要的特性之一。将分组与 `COUNT()` 和 `SUM()` 之类的计算函数相结合，是一个非常方便的从数据库中获取有效信息的方式。

例如，假设你想知道哪一天发表的文章最多：

```js
Post.group('DATE(createdAt)').count().order('count desc')
```

上例对应的 SQL 如下：

```sql
SELECT COUNT(*) as count, DATE(created_at) FROM posts GROUP BY DATE(created_at) ORDER BY count DESC;
```

分组查询的返回值和普通的查询有所区别，因为没办法将查询结果交给某个数据模型实例化。上例返回的查询结果类似：

```js
[ { count: 1, 'DATE(created_at)': '2017-12-12' },
  { count: 5, 'DATE(created_at)': '2017-11-11' },
  ... ]
```

不过分组查询仍然是可以 join 其他数据模型的，我们将在 join 章节深入讨论。

## Having

只有在需要按计算字段过滤结果的时候才需要使用 `HAVING`。尽可能将过滤条件放到 `WHERE` 中，只将计算字段放到 `HAVING` 中过滤，是比较推荐的做法。因为数据库会用 `WHERE` 过滤的结果建立临时结果集，继而给 `HAVING` 过滤，这样可以让临时结果集维持在一个较小的体量。

再以上文中的例子为例，我们可以把发布文章数少于 5 的日期过滤出来：

```js
Post.group('DATE(createdAt)').count().order('count desc').having('count < 5')
```

上例对应的 SQL 如下：

```sql
SELECT COUNT(*) as count, DATE(created_at) FROM posts GROUP BY DATE(created_at) HAVING count < 5 ORDER BY count DESC;
```

查询结果类似：

```js
[ { count: 4, 'DATE(created_at)': '2017-11-11' },
  ... ]
```

## Transactions

> 由于缺乏 `LOCK` 支持，当前的事务实现还比较初级。希望我们可以尽快解决这个问题。

可以使用 `Model.transaction()` 从数据库连接池（`Model.pool`）获取连接，再通过所获取的连接执行 `BEGIN` 和 `COMMIT`/`ROLLBACK` 实现事务。以下面这段代码为例：

```js
Post.transaction(function* () {
  yield Comment.create({ content: 'tl;dr', articleId: 1 })
  yield Post.findOne({ id: 1 }).increment('commentCount')
})
```

对应的 SQL 如下：

```sql
BEGIN
INSERT INTO comments (content, article_id) VALUES ('tl;dr', 1);
UPDATE posts SET comment_count = comment_count + 1 WHERE id = 1;
COMMIT
```

乍一看会觉得这里的 `function* () {}` 很扎眼。选择使用 Generator 作为事务的回调函数格式是因为 Generator 能提供非常细粒度的控制。上面这段 js 代码背后的逻辑如下：

1. 从数据库连接池获取连接；
2. `BEGIN`
3. 执行回调函数，获取 Generator；
4. 使用 `generator.next()` 推动执行进度；
5. 如果 `generator.next()` 的返回值是个 Spell 实例，设置 `spell.connection` 为当前连接；
6. 如此迭代直到异步流程结束；
7. `COMMIT`

通过这种方式，我们实现了自动传递事务当前连接，省去人肉传参的麻烦。

如果 Generator 迭代过程中出现异常，`Model.transaction()` 将执行 `ROLLBACK` 并抛出异常。

## Joining Tables

Leoric 提供两种构建 JOIN 查询的方式：

- 使用 `.with(relationName)` 或者 `.include(relationName)` JOIN 预定义的关联关系，
- 使用 `.join(Model, onConditions)` JOIN 其他任意数据模型。

### 预定义的关联关系

可以通过 `Model.relations` 查看当前数据模型预定义的关联关系，这些关系都是在 Leoric 内部调用 `Model.describe()` 方法时生成的。我们可以在这个方法里调用 `.hasMany()`、`.hasOne()`、以及 `.belongsTo()` 来定义关联关系，例如：

```js
class Post extends Bone {
  static describe() {
    this.hasMany('comments')
    this.belongsTo('author', { foreignKey: 'authorId', Model: 'User' })
  }
}
```

在查询时可以使用 `.include(name)` JOIN 预定义的关联关系：

```js
Post.include('comments')
// or
Post.find().with('comments')
```

上例对应的 SQL 如下：

```sql
SELECT * FROM posts LEFT JOIN comments ON posts.id = comments.post_id;
```

为保证主表的值不会被关联条件过滤，默认采用 LEFT JOIN。关联条件表达式 ON 是根据关联关系的配置信息自动生成的。我们在 [关联关系]({{ '/associations' | relative_url }}) 一文中有详细讨论。

要 JOIN 多个关联关系时，可以给 `.include()` 传入多个参数，或者重复调用 `.with()` 方法：

```js
Post.include('comments', 'author')
// or
Post.find().with('comments').with('author')
```

### 任意 JOIN

如果需要 JOIN 未在 `Model.describe()` 预先定义的关联关系，可以使用 `.join()` 方法：

```js
Post
  .join(Comment, 'posts.id = comments.postId')
  .join(User, 'posts.authorId = users.id')
```

上例对应的 SQL 如下：

```sql
SELECT * FROM posts LEFT JOIN comments ON posts.id = comments.post_id LEFT JOIN users ON posts.author_id = users.id;
```

和预定义的 JOIN 类似，为保留主表结果，默认采用 LEFT JOIN。

查询中所有表的别名都是按 `pluralize(camelCase(Model.name))` 规则计算。在上例中涉及转换的数据模型名称、别名如下：

| 数据模型 | 表别名 |
|------------|-------------|
| Post       | posts       |
| Comment    | comments    |
| User       | users       |

我们可以在 `.join()` 之后使用这些别名，在 `.where()` 或者 `.order()` 等查询方法中引用字段：

```js
Post.join(Comment, 'posts.id = comments.postId').where('comments.id = 1')
```

## 查询限定

如果数据模型有 `deletedAt` 属性，`Model.remove()` 并不会实际删除对应的记录，而是更新 `deleteAt` 的值为最新时间。这一特性被称作伪删除（soft delete）。

伪删除逻辑对数据模型的用户来说是透明的，Leoric 默认会在每次查询生成 SQL 之前补上一个默认的查询条件。例如，如果 `Post` 数据模型有 `deletedAt` 属性，那么 `Post.find()` 对应的 SQL 实际上是：

```sql
SELECT * FROM posts WHERE deleted_at IS NULL;
```

但假如查询条件中已经涉及 `deletedAt` 属性，那么默认的 `.where({ deletedAt: null })` 就不会被添加。例如，`Post.find('deletedAt != null')` 对应的 SQL 是：

```sql
SELECT * FROM posts WHERE deleted_at IS NOT NULL;
```

Leoric 将这一行为按查询限定形式实现，后者其实是 Leoric 从 Active Record 抄袭过来的诸多概念之一。目前仅有 `.where({ deletedAt: null })` 这一个默认的查询限定。

### unscoped

要移除所有默认的限定条件，可以访问 `unscoped` 属性：

```js
Post.find({ id: [1, 10] }).unscoped
```

无论 `Post` 是否有 `deletedAt` 属性，上例对应的 SQL 如下：

```sql
SELECT * FROM posts WHERE id IN (1, 10)
```

## 理解链式调用

Leoric 支持[链式调用](http://en.wikipedia.org/wiki/Method_chaining)，允许在编写查询条件时连续各种方法。实现这一特性的原理是，每个查询方法，例如 `.find()` 或者 `.order()`，被调用时都会返回一个 `Spell` 实例。

```js
Post.find()   // => Spell { Model: Post }
```

`Spell` 类提供 `.where()`、`.order()`、`.group()`、`.having()`、`limit()`、以及 `.join()` 等方法。绝大多数会返回一个 `Spell` 实例，因此可以往后追加方法。在这些方法被调用的时候，SQL 不是马上生成的。我们可以在结尾手动调用 `.toSqlString()` 方法来生成 SQL。要获取查询结果，把 `Spell` 实例当作 `Promise` 来用就可以了。例如：

```js
// ES5 风格
const spell = Post.find()
spell
  .then(posts => { ... })
  .catch(err => console.error(err.stacak))

// ES6 使用 co 和 generator function
co(function* () {
  const posts = yield Post.find()
})

// ES2016 使用 async await
async function() {
  const posts = await Post.find()
}
```

因为 Leoric 采用 ES2016 编写，其中大多数标准已经在最新的 Node.js LTS 版本中实现，所以我们推荐使用 async/await。

书归正传，我们可以往查询对象后面追加任意方法，直到完成查询构建为止：

```js
const query = Post.where('title LIKE ?', '%King%')
const posts = await query.order('updatedAt desc').limit(10)
const [{ count }] = await query.count() // 没有排序、LIMIT
this.body = { posts, count }
```

## 查询或者创建一条记录

查找记录，如果找不到就创建一条，是个很常见的需求。我们所借鉴的 Active Record 还专门提供 `find_or_create_by` 方法。虽然实现起来很简单，但这个方法实在是太容易和 `upsert` 行为混淆了。

> MongoDB 里有 [`db.collection.update({ upsert: true })`](https://docs.mongodb.com/manual/reference/method/db.collection.update/#mongodb30-upsert-id)，PostgreSQL 里则有 [`INSERT ... ON CONFLICT ... DO UPDATE`](https://www.postgresql.org/docs/9.5/static/sql-insert.html#SQL-ON-CONFLICT), 而 MySQL（以及 MariaDB 等衍生数据库）里则有 [`INSERT ... ON DUPLICATE KEY UPDATE`](https://dev.mysql.com/doc/refman/5.7/en/insert-on-duplicate.html)。大致来说，都是寻找重复主键，如果存在就更新对应记录。如果不存在重复主键，则插入这条数据。

Leoric 使用 `upsert` 来创建或者更新记录，例如：

```js
const post = new Post({ id: 1, title: 'New Post' })
await post.save()
```

如果 `Post { id: 1 }` 已经存在，就把它的标题更新为 `New Post`。

不过 `upsert` 的特性跟“查询或者创建对象”的逻辑是有区别的。例如，如果用户是以 `email` 区分的，我们可以先按 `email` 查找用户，如果找不到，就创建一个新用户：

```js
const user = (await User.findOne({ email: 'john@example.com' })) ||
  await User.create({ email: 'john@example.com' })
```

简而言之，如果需要判断的主键是已知的，用 `model.save()` 就够了，因为它底层会走 `upsert` 逻辑。如果主键不明确，就需要自己手动查找或者创建一条记录了。

## 计算函数

计算函数可以在数据模型上直接调用：

```js
const results = await Post.count()
```

也可以在查询条件后：

```js
const results = await Post.where('name like ?', '%King%').count()
```

### Count 计数

可以使用  `Model.count()` 统计数据模型对应表中存储的数据条数。如果要统计特定数据的条数，比如寻找店铺中所销售的商品数量，你也可以执行：

```js
Shop.find(1).with('items').count('items.*')
```

上例对应的 SQL 如下：

```sql
SELECT COUNT(items.*) AS count FROM (SELECT * FROM shops WHERE id = 1) AS shops LEFT JOIN items ON items.shop_id = shops.id;
```

### Average

可以使用 `Model.average()` 计算数据模型对应表中某个数字字段的平均数，比如查找网站订阅用户的平均年龄：

```js
User.where({ subscribed: true }).average('age')
```

上例对应的 SQL 如下：

```sql
SELECT AVG(age) FROM users WHERE subscribed = 1;
```

### Minimum

可以使用 `Model.minimum()` 计算数据模型对应表中某个字段的最小值，比如寻找用户的最小年龄：

```js
User.minimum('age')
```

上例对应的 SQL 如下：

```sql
SELECT MIN(age) AS minimum FROM users;
```

### Maximum

可以使用 `Model.maximum()` 计算数据模型对应表中某个字段的最大值，比如寻找用户的最大年龄：

```js
User.maximum('age')
```

上例对应的 SQL 如下：

```sql
SELECT MAX(age) AS maximum FROM users;
```

### Sum

可以使用 `Model.sum()` 计算数据模型对应表中某个字段的和，比如计算某个店铺所销售的商品总价格：

```js
Shop.find(42).with('items').sum('items.price')
```

上例对应的 SQL 如下：

```sql
SELECT SUM(items.price) FROM (SELECT * FROM shops WHERE id = 42) AS shops LEFT JOIN items ON items.shop_id = shops.id;
```
