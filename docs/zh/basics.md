---
layout: zh
title: 基础
---

本文主要向大家介绍 Leoric 基础概念。读完本文后，你将了解如下内容：

- 对象关系映射（Object Relational Mapping）和 Leoric 是什么, 以及怎么用；
- 如何使用 Leoric 的数据模型来操作关系数据库中存储的数据.
- Leoric 的表结构命名约定。

## 目录
{:.no_toc}

1. 目录
{:toc}

## Leoric 是什么

Leoric 是 Node.js 与关系型数据库之间的一层对象关系映射模型。它可以被用作 [MVC](https://en.wikipedia.org/wiki/Model%E2%80%93view%E2%80%93controller) 中的 M - 即 MVC 体系中负责表现业务数据与逻辑的那一层。

对象关系映射（简称 ORM）是应用程序中的对象与关系型数据管理系统中的表相互联系的一种方式。在许多编程语言中都有流行 ORM 的概念，例如 Ruby 的 Active Record、Python 的 SQLAlchemy、以及 Java 的 Hibernate。Leoric 受 [Active Record](http://guides.rubyonrails.org/active_record_basics.html) 影响颇多，或许你从 Leoric 的文档组织方式已经看出一二。

Leoric 应当具备的能力是：

- 表现数据模型及其背后的数据；
- 表现数据模型之前的关联；
- 无需在模型中重复字段定义即可映射存量表；
- 基于 async/await 的插入、读取、更新、删除（CRUD）;
- 使用现代化的 JavaScript 编写、使用数据模型。

## 约定大于配置

一般而言，配置比约定要更加一目了然，也更经常被使用。但约定风格也有它的优势，如果你的表结构风格遵循 Leoric 的约定，几乎不需要写多少配置就可以编写数据模型。

### 命名约定

默认情况下，Leoric 会按一定规则寻找数据模型与数据库表的对应关系。详细规则如下：

- 数据模型的类名遵从 `CamelCase` 格式，首字母大写，对应的表名则是类名变为复数、继而转为 `snake_case`；
- 数据模型的属性遵从 `camelCase` 格式，首字母小写。这些属性名称是从表结构信息中读取并自动转换的，通常在表中使用的字段名规范为 `snake_case`。

以下为一些转换示例：

| 数据模型 | 表 |
|---------|---------|
| Shop    | shops   |
| TagMap  | tagMaps |
| Mouse   | mice    |
| Person  | people  |

Leoric 使用 [pluralize](https://www.npmjs.com/package/pluralize) 转换单复数。如果你觉得这些转换规则不直观（对非英语母语的人来说很正常），也可以明确配置数据模型对应的表名称、或者重命名数据模型的属性。我们将在“覆盖命名约定”一文深入讨论。

### 表结构约定

Leoric 提供三个配置关联关系的静态方法 `.hasMany()`、`.hasOne()`、以及 `.belongsTo()`。用于关联的主键、外键约定如下：

- **外键**命名应当遵循 `modelNameId` 格式（例如 `shopId`)。对应的字段名则为属性名转为下划线分隔 `model_name_id`（例如 `shop_id`）。
- **主键**应为无符号整型 `id`。

还有一些可选的字段名，可为数据模型增加额外特性：

| 字段名       | 属性名   | 描述 |
|--------------|-------------|---------------------------|
| `created_at` | `createdAt` | 在数据记录被创建时自动更新 |
| `updated_at` | `updatedAt` | 在数据记录被更新时自动更新 |
| `deleted_at` | `deletedAt` | 在数据记录被伪删除时自动更新 |

> TDDL 使用的时间戳字段会被自动映射。`gmt_create` 映射为 `createdAt`、`gmt_modified` 映射为 `updatedAt`、以及 `gmt_deleted`（如果存在）会被映射为 `deletedAt`。

调用数据模型的 `Model.remove({...})` 方法时，如果存在`deletedAt` 属性，Leoric 将更新待删除记录的 `deletedAt` 属性，而不是将这些记录从数据库中永久删除。可以改为调用 `Model.remove({...}, true)` 方法来执行永久删除。

## 编写数据模型

假设 `shops` 表结构如下：

```sql
CREATE TABLE shops (
  id int(11) NOT NULL auto_increment,
  name varchar(255),
  PRIMARY KEY (id)
);
```

`Shop` 数据模型需要继承 Leoric 输出的 `Bone` 基类：

```js
const { Bone } = require('leoric')
class Shop extends Bone {}
```

如果不希望使用第三方工具专门管理表结构，也可以直接让 Leoric 来完成这部分工作。在数据模型中声明模型的属性名，使用数据模型前同步到数据库即可：

```js
const { Bone, Realm } = require('leoric');
const { BIGINT, STRING } = Bone.DataTypes;

// define Shop
class Shop extends Bone {
  static attributes = {
    id: { type: BIGINT, primaryKey: true },
    name: { type: STRING },
  }
}

// connecting Shop to shops table in database
const realm = new Realm({ host: 'localhost', models: [ Shop ] });
// synchronize model attributes to table
await realm.sync();
```

然后就可以用 `Shop` 数据模型操作数据了：

```js
const shop = new Shop({ name: 'Horadric Cube' })
await shop.save()
// 或者
await Shop.create({ name: 'Horadric Cube' })
```

## 覆盖命名约定

绝大部分命名约定都有对应的覆盖方法，我们可以使用 `static table` 覆盖表名：

```js
class Shop extends Bone {
  static table = 'stores'
}
```

还可以使用 `static get primaryKey()` 指定主键名：

```js
class Shop extends Bone {
  static primaryKey = 'shopId' }
}
```

以及使用 `static attributes` 自定义数据模型属性对应的字段名：

```js
class Shop extends Bone {
  static attributes = {
    deletedAt: { type: DATE, columnName: 'removed_at' },
  }
}
```

如果数据模型的属性信息不在模型中直接维护，也可以等数据模型信息从数据库加载后，在 `static initialize()` 方法中重命名属性名：

```js
class Shop extends Bone {
  static initialize() {
    this.renameAttribute('removedAt', 'deletedAt')
  }
}
```

`static initialize()` 方法中可配置的项目有很多。我们之后再详细讨论。

## 连接数据模型和数据库

数据模型需要和数据库连接方可使用，推荐使用如下方式：

```js
const Realm = require('leoric');
const realm = new Realm({
  dialect: 'mysql',
  host: 'localhost',
  models: '/path/to/models',
});
await realm.sync();
```

`realm.sync()` 会根据数据模型中定义的字段信息 `Model.attributes` 自动执行表结构变更，确保数据库中的表结构和数据模型中的一致。在应用数据比较大或者应用表结构变更比较频繁且剧烈的情况下，一般不推荐使用。

后者这种情况比较适合仅连接数据库，使用 Leoric 的表结构变更功能来手动维护数据库中的表结构：

```js
const Realm = require('leoric');
const realm = new Realm(...);
await realm.connect();
```

v0.x 版本过来的用户，仍然可以选择使用 `connect()` 直接连接数据库：


```js
const { connect } = require('leoric');

// 连接数据模型到数据库
await connect({
  host: 'example.com',
  port: 3306,
  user: 'john',
  password: 'inputYourCodeHere',
  db: 'tmall',
  models: [Shop]
});

// 直接传入数据模型所在的路径
await connect({ ...opts, path: '/path/to/models' });
```

当然，如果是使用 Egg 开发 Web 应用，更加推荐直接用 egg-orm 插件。

## 读取与写入数据

数据模型声明、连接后，我们可以：

- 使用 `Model.find()`、`Model.findOne()` 等方法查询数据；
- 使用 `Model.create()`、`Model.update()` 等方法更新数据；
- 使用 `Model.remove()` 删除数据；
- 以及使用 `model.save()` 方法持久化当前实例上的改动。

```js
// 插入一条店铺记录
await Shop.create({ name: 'Barracks' });

// 查找店铺记录并更新
const shop = await Shop.findOne({ name: 'Barracks' });
shop.name = 'Horadric Cube';
await shop.save();

// 移除记录
await Shop.remove({ name: 'Horadric Cube' });
```

### 创建

有两种插入数据库的方式。我们可以使用 `Model.create()`：

```js
const shop = await Shop.create({ name: 'Barracks', credit: 10000 })
```

或者先创建一个实例，更新属性，最后再使用 `model.save()`：

```js
const shop = new Shop({ name: 'Barracks' })
shop.credit = 10000
await shop.save()
```

两者对应的 SQL 都是：

```sql
INSERT INTO shops (name, credit, type) VALUES ('Barracks', 1000);
```

### 读取

尽管 Leoric 提供的查询方法花样繁多，最常用的还是 `Model.find()` and `Model.findOne()`：

```js
// 读取所有店铺
Shop.find()
// 或者
Shop.all
// => SELECT * FROM shops;

// 读取一家店铺
Shop.findOne()
// => SELECT * FROM shops LIMIT 1;

// 查找一家名为 Deckard Cain 的店铺
Shop.findOne({ name: 'Deckard Cain' })
// => SELECT * FROM shops WHERE name = 'Deckard Cain' LIMIT 1;

// 找到所有信用分高于 1000 的店铺
Shop.where('credit > 1000')
// => SELECT * FROM shops WHERE credit > 1000;
```

有关读取数据库的详细说明，参考[查询接口]({{ '/zh/querying' | relative_url }})一文。

### 更新

和插入数据一样，有两种更新数据的方式。如果数据模型对象已经读取在手，我们可以更新它们的属性值，再使用`model.save()` 持久化数据：

```js
const shop = await Shop.findOne({ name: 'Barracks' })
// => Shop { id: 1, name: 'Barracks' }
shop.credit = 10000
await shop.save()
```

上例对应的 SQL 如下：

```sql
UPDATE shops SET credit = 10000 WHERE id = 1;
```

如果想要节省反复读取、更新带来的数据库开销，我们也可以使用 `Model.update()` 一步到位：

```js
await Shop.update({ name: 'Barracks' }, { credit: 10000 })
```

上例对应的 SQL 如下：

```sql
UPDATE shops SET credit = 10000 WHERE name = 'Barracks';
```

### 删除

同样的，实例方法 `model.remove()` 和静态方法 `Model.remove()` 均可用来从数据库删除数据。例如：

```js
const shop = await Shop.find({ name: 'Barracks' })
// => Shop { id: 1, name: 'Barracks' }
await shop.remove(true)
// DELETE FROM shops WHERE id = 1

await Shop.remove({ name: 'Barracks' }, true)
// DELETE FROM shops WHERE name = 'Barracks'
```

你可能会奇怪这里额外传递的 `true` 参数是做什么用的。这是因为默认情况下 Leoric 会执行伪删除，仅更新 `deleteAt` 属性，而不是真的把数据从数据库删除。数据模型必须包含 `deleteAt` 属性，用来记录删除时间。

所以如果 `Shop` 数据模型有 `deletedAt` 属性：

```js
const shop = await Shop.find({ name: 'Barracks' })
// => Shop { id: 1, name: 'Barracks' }
await shop.remove()
// UPDATE shops SET deleted_at = NOW() WHERE id = 1

await Shop.remove({ name: 'Barracks' })
// UPDATE shops SET deleted_at = NOW() WHERE name = 'Barracks'
```

如果 `Shop` 数据模型没有 `deletedAt` 属性，而 `model.remove()`、`Model.remove()` 方法并没有传递 `true`，Leoric 将抛出异常。

## 属性方法

### attribute()

### getter / setter


## 脏检查

### changed()

对于已经存到数据库的记录来说，只有重新设置过属性，才会认为属性有改动：

```js
const user = await User.first;  // => { name: 'James', login: 'james' }
user.name = 'Jimmy';
user.changed();  // => [ 'name' ]
user.login = 'jimmy';
user.changed();  // => [ 'name', 'login' ]
```

对于新初始化的模型实例，会认为所有的属性都被改了（从 null 设置成当前值）

```js
const user = new User({ name: 'Jimmy', login: 'Jimmy' });
user.changed();  // => [ 'name', 'login' ]
```

实例保存之后，会重置属性改动判断

```js
const user = new User({ name: 'Jimmy', login: 'Jimmy' });
user.changed();  // => [ 'name', 'login' ]
await user.save();
user.changed();  // => false
```

这里需要注意的是，如果没有属性改动，将返回 false 而不是空数组 `[]` 。这是有意为之，目的是和现有其他库的 API 保持一致。如果需要返回值类型固定，可以考虑使用 `changes()` ，后者的返回类型始终为对象。

### changes()

`changes()` 是 `changed()` 的孪生版本，两者判断属性是否有改动的逻辑是一致的。最主要的区别是， `changes()` 返回的是对象而不是数组，对象中包含有改动的属性在改动之前的值和当前的值。

```js
const user = new User({ name: 'Jimmy', login: 'Jimmy' });
user.changes();  // => { name: [ null, 'Jimmy' ], login: [ null, 'login' ] }
```

此外，即便没有属性改动， `changes()` 也会返回 `{}` ，它的返回类型始终为对象。

### previousChanged()

我们可以使用 `previousChanged()` 来检查模型是否之前有过改动，即使刚刚保存过。

```js
const user = new User({ name: 'Jimmy' });
user.changed();          // => [ 'name' ]
user.previousChanged();  // => false
await user.save();
user.changed();          // => false
user.previousChanged();  // => [ 'name' ]
```

一般情况下不太会需要使用 `previousChanged()` ，但是在一些需要事后判断变更的场景，比如 `afterCreate` 或者 `afterUpdate` 回调，会特别方便：

```js
User.init(attributes, {
  hooks: {
    afterUpdate(obj) {
      this.previousChanged();  // => check if changed previously or not
    },
  },
});
```

和 `changes()` 类似，可以用 `previousChanges()` 读取前一个变更版本的具体值。

### previousChanges()

```js
const user = new User({ name: 'Jimmy' });
user.changes();          // => { name: [ null, 'Jimmy' ] }
user.previousChanges();  // => {}
await user.save();
user.changes();          // => {}
user.previousChanged();  // => { name: [ null, 'Jimmy' ] }
```

可以使用 `preivousChanges(name)` 读取单个属性的变更记录：

```js
const user = new User({ name: 'Jimmy', login: 'jimmy' });
user.changes('login');          // => { name: [ null, 'jimmy' ] }
user.previousChanges('login');  // => {}
await user.save();
user.changes('login');          // => {}
user.previousChanged('login');  // => { name: [ null, 'jimmy' ] }
```

`previousChanges()` 和 `changes()` 的逻辑基本一样，只是对比是前一个版本而非属性当前值。


## 数据校验

## 钩子

## 迁移任务
