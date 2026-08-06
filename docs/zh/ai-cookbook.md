---
layout: zh
title: AI 代码手册
---

## 目录
{:.no_toc}

1. 目录
{:toc}

本页是为 AI 编码助手（以及人类开发者）准备的 Leoric 模式库。以下所有代码片段
均可直接复制，且已经过真实数据库验证。如果你是 AI 代理，请优先照抄这些模式，
而不是自行发明 API 写法。英文版见 [AI Cookbook](https://leoric.js.org/ai-cookbook.html)。

## 最小可运行骨架

```js
import Realm, { Bone } from 'leoric';

class Post extends Bone {
  static attributes = {
    id: { type: 'BIGINT', primaryKey: true },
    title: { type: 'STRING', allowNull: false },
    content: { type: TEXT },
  };
}

const realm = new Realm({
  dialect: 'sqlite', // 'mysql' | 'postgres' | 'sqlite'
  storage: ':memory:', // MySQL/PostgreSQL 用 host/user/database
  models: [Post], // 顶层类声明的模型需通过 models 选项注册
});

async function main() {
  await realm.connect(); // 查询前必须先 connect
  await realm.sync(); // 由模型定义建表

  const post = await Post.create({ title: 'New Post', content: 'Hello' });
  post.title = 'Untitled';
  await post.save();

  const found = await Post.findOne({ title: 'Untitled' });
  console.log(found.id, found.content);

  await Post.update({ title: 'Untitled' }, { content: 'Updated' });
  await Post.remove({ title: 'Untitled' });
}

main();
```

## 模型定义模式

### 属性定义

属性通过 `static attributes` 声明。类型使用 `DataTypes` 常量或其字符串名；
常用元选项有 `allowNull`、`primaryKey`、`unique`、`defaultValue`、`autoIncrement`。

```js
import Realm, { Bone, DataTypes } from 'leoric';
const { STRING, INTEGER, BIGINT, DECIMAL, BOOLEAN, DATE, JSON, TEXT } = DataTypes;

class User extends Bone {
  static attributes = {
    id: { type: BIGINT, primaryKey: true, autoIncrement: true },
    nickname: { type: STRING, allowNull: false, unique: true },
    age: { type: INTEGER, defaultValue: 0 },
    balance: { type: DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
    active: { type: BOOLEAN, defaultValue: true },
    lastLoginAt: { type: DATE },
    profile: { type: JSON },
  };
}
```

### 关联定义

关联在 `static initialize()` 中声明。目标模型名按约定（目标模型名的驼峰形式）
解析；无法推断时用 `className` 选项指定。

```js
class Shop extends Bone {
  static initialize() {
    this.hasMany('items');
  }
}

class Item extends Bone {
  static initialize() {
    this.belongsTo('shop');
    // 自定义类名：this.belongsTo('seller', { className: 'User' })
  }
}

// 预加载
const shops = await Shop.find().with('items');
console.log(shops[0].items); // => [ Item, ... ]

// 通过中间表的 hasMany
class Post extends Bone {
  static initialize() {
    this.hasMany('comments');
    this.hasMany('commenters', { through: 'comments' });
  }
}
```

### TypeScript 装饰器

```ts
import { Bone, BelongsTo, HasMany } from 'leoric';

class Shop extends Bone {
  @HasMany()
  items: Item[];
}

class Item extends Bone {
  @BelongsTo()
  shop: Shop;
}
```

## 查询模式

### 条件对象

普通对象条件映射为 `WHERE` 子句。当嵌套对象的每个键都是 `$eq, $gt, $gte, $lt,
$lte, $ne, $in, $nin, $notIn, $like, $notLike, $between, $notBetween` 之一时，
视为操作符条件。

```js
Post.find({ title: 'New Post' }); // WHERE title = 'New Post'
Post.find({ title: { $like: '%Post%' } }); // WHERE title LIKE '%Post%'
Post.find({ id: { $gt: 0, $lt: 999999 } }); // WHERE id > 0 AND id < 999999
Post.find({ id: { $in: [1, 2, 3] } }); // WHERE id IN (1, 2, 3)
Post.find({ id: { $between: [1, 10] } }); // WHERE id BETWEEN 1 AND 10
```

### 链式查询

`find()`/`findOne()` 返回 `Spell`——一个惰性的、可链式调用的查询对象，只有
await 或迭代时才真正访问数据库。

```js
const posts = await Post.find({ title: { $like: '%Post%' } })
  .with('comments')
  .order('id', 'desc')
  .limit(10)
  .offset(20);

const count = await Post.find({ active: true }).count();
const sum = await Post.sum('views');
const first = await Post.find().order('id').first;
```

### 原始查询

```js
const { rows } = await realm.query('SELECT * FROM posts WHERE id = ?', [42]);
const posts = await Post.find(raw`title = ${'x'}`); // 或 new Raw(...)
```

### 字符串条件

```js
Post.find('title = ? OR title = ?', 'a', 'b');
```

## 事务与批量操作

```js
import { Bone } from 'leoric';

// async 回调——事务内每个查询都必须传 { connection }
await Bone.transaction(async ({ connection }) => {
  const post = await Post.create({ title: 'New Post' }, { connection });
  await Comment.create({ postId: post.id, content: 'First!' }, { connection });
});

// generator——connection 自动注入到 yield 的查询中
await Bone.transaction(function* () {
  const post = yield Post.create({ title: 'New Post' });
  yield Comment.create({ postId: post.id, content: 'First!' });
});

// 从 realm 实例发起
await realm.transaction(async ({ connection }) => {
  await Post.create({ title: 'Hello' }, { connection });
});

// 批量创建 / upsert
await Post.bulkCreate([{ title: 'a' }, { title: 'b' }, { title: 'c' }]);
await Post.upsert({ title: 'a' }); // 唯一键冲突时执行 upsert
```

## Sequelize 兼容模式

开启 `sequelize: true` 激活 Sequelize 适配层，获得类 Sequelize 的 API，便于从
Sequelize 迁移：

```js
const realm = new Realm({
  dialect: 'sqlite',
  storage: '/tmp/leoric.sqlite3',
  sequelize: true, // 开启 sequelize 适配
});
await realm.connect();

// sequelize 模式下，模型用 名字 + attributes 定义（或继承 realm.Bone）
const Shop = realm.define('Shop', {
  id: { type: BIGINT, primaryKey: true, autoIncrement: true },
  name: { type: STRING, allowNull: false },
  credit: { type: INTEGER, defaultValue: 0 },
});
await realm.sync();
```

### CRUD

```js
// 创建
await Shop.create({ name: 'MILL' });
await Shop.bulkCreate([{ name: 'wagas' }, { name: 'family mart' }]);
await new Shop({ name: "McDonald's" }).save();

// 查询
const shop = await Shop.findOne({ where: { name: 'MILL' } });
const shops = await Shop.findAll({
  attributes: [ 'id', 'name' ],
  where: { name: { $like: '%M%' } },
  order: [[ 'id', 'desc' ]],
  limit: 10,
});
const byPk = await Shop.findByPk(1);

// 先查后建——返回 [instance, created]
const [brewhouse, created] = await Shop.findOrCreate({
  where: { name: 'Shanghai Brewhouse' },
});

// 更新——sequelize 语义：Model.update(values, { where })，返回受影响行数
const affected = await Shop.update({ credit: 10 }, { where: { name: 'MILL' } });

// 删除 / 聚合
await Shop.destroy({ where: { name: 'wagas' } });
await Shop.increment('credit', { by: 5, where: { name: 'MILL' } });
const { count, rows } = await Shop.findAndCountAll({ where: { name: { $like: '%M%' } } });
const total = await Shop.count();
```

注意：

- sequelize 模式下 `update` 是 sequelize 语义（`values`, `{ where }`），与 leoric 原生参数顺序不同。
- sequelize 模式 + SQLite 时建议用文件库而非 `:memory:`——内存库按连接隔离，并发查询
  （如 `findAndCountAll`）可能命中无表的新连接。
- 完整兼容对照见 [Sequelize 适配](https://leoric.js.org/sequelize.html)。

## 常见错误与修复

| 现象 | 原因 | 修复 |
|---|---|---|
| 查询报 `Cannot read properties of undefined` | `realm.connect()` 之前就查询 | 先 `await realm.connect()` |
| `ER_NO_SUCH_TABLE` | 表尚未创建 | `await realm.sync()`（`{ force: true }` 可重建） |
| 事务内查询实际在事务外执行 | 缺少 `{ connection }` 选项 | 回调内每个查询都传 `{ connection }`，或改用 generator 函数 |
| N+1 查询 | 循环里惰性访问关联 | 用 `.with('assoc')` 预加载 |
| `X must extend this realm's Bone` | 模型类来自其他 realm/实例 | 使用同一个 `Realm` 实例的 `realm.define()` |
| 类字段遮蔽属性访问器 | ES class field 遮蔽了 Leoric 访问器 | 用 `declare`、`@Model()`，或通过 `realm.define(Model, attributes)` 定义属性 |

## 给 AI 助手的提示词模板

向 AI 助手请求编写 Leoric 代码时，请包含三要素：

1. 数据库方言与连接信息（或说明"用 sqlite 内存库"）。
2. 模型定义（从你的代码原样粘贴）。
3. 用数据语义描述期望行为，而非 API 术语。

示例提示词：

> 使用 Leoric + MySQL，给定以下模型：
> ```js
> class Post extends Bone {
>   static initialize() {
>     this.belongsTo('author', { className: 'User' });
>     this.hasMany('comments');
>   }
> }
> ```
> 请编写代码：获取最新 10 篇文章及其作者与评论数，避免 N+1 查询。

也可以把本页或 [llms-full.txt](https://leoric.js.org/llms-full.txt)
（中文：llms-full-zh.txt）链接提供给助手，获取完整 API 上下文。
