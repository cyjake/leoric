---
layout: zh
title: Sequelize 适配器
---

为了降低 Sequelize 用户的迁移成本，Leoric 也提供兼容 Sequelize API 的适配器，打开 `sequelize` 开关即可：

```js
const Realm = require('leoric');
const realm = new Realm({
  sequelize: true,  // 开启 sequelize 适配器
  host: 'localhost',
});
await realm.connect();
```

开启 Sequelize 适配器之后，数据模型的 API 将和 [Sequelize Model](https://sequelize.org/master/class/lib/model.js~Model.html) 基本保持一致，具体异同见下文。

## 目录
{:.no_toc}

1. 目录
{:toc}

## 读取与写入数据

### 创建

Sequelize 适配器支持三种常见的数据插入方式：

```js
await Shop.create({ name: 'MILL' });
await Shop.bulkCreate([
  { name: 'wagas' },
  { name: 'family mart' },
]);
await (new Shop({ name: "McDonald's" })).save();
```

同时也支持一些相对复杂的数据插入方式：

```js
// 有点类似 upsert 的查找或者插入
await Shop.findOrCreate({
  where: { name: 'Shanghai Brewhouse' },
});

// 查找，插入，如果插入失败就再次查找
await Shop.findCreateFind({
  where: { name: 'Shanghai Brewhouse' },
});
```

### 读取

Sequelize 中 `Model.find()` 和 `Model.findOne()` 均返回一条记录，前者只是后者的别名，下文使用后者展示开启 Sequelize 适配器时，如何从数据库获取一条数据：

```js
const shop = await Shop.findOne({
  where: { name: 'Free Mori' },
});
```

返回类型为 `Shop|null`，如果有对应记录就返回 `Shop` 实例，如果没有就返回 `null`。

如果需要返回多条数据，则需要使用 `Model.findAll()` 方法，参数格式与 `Model.findOne()` 一致，支持如下几种：

```js
const shops = await Shop.findAll({
  attributes: [ 'id', 'name', 'created_at', 'updated_at' ],
  where: {
    name: { $like: '%Mori%' },
  },
  order: [[ 'id', 'desc' ]],
});
```

Leoric 默认提供的查询相关辅助方法比较多，如果 Sequelize 没有对应版本，就会切换到 Leoric 默认实现，包括但不限于：

```js
const shops = await Shop.all;
const shop = await Shop.first;
const top10 = await Shop.order('credit', 'desc').limit(10);
```

### 更新

可以在数据模型实例上发起更新，持久化相关改动到数据库，比如：

```js
const shop = await Shop.findOne({ name: '85℃' });
shop.name = 'Bread Talk';
await shop.save();

// 也可以简化成
await shop.update({ name: 'Nayuki' });
```

也可以调用数据模型上的静态方法来批量更新：

```js
await Shop.update({ status: STATUS.open }, {
  where: { category_id: CATEGORY.food },
});
```

一些便于对数据做增量更新的辅助方法也有支持，比如：

```js
const shop = await Shop.findOne({ name: 'Nayuki' });
await shop.increment('price');
await shop.increment({ price: 0.5 });

// 或者批量更新
await Shop.increment({ price: 1.5 });
```

### 删除

Sequelize 适配器支持批量删除：

```js
// TRUNCATE TABLE `shops`
await Shop.truncate({});

// 不需要处理 hook 时可以直接批量删除
await Shop.bulkDestroy();

// 兼容 destroy hook 的批量删除，如果需要处理 hook，会先查找相关记录再逐一删除
await Shop.destroy();
```

也支持单条记录的删除：

```js
const shop = await Post.first;
// 如果有 deletedAt，默认软删除
await shop.destroy();
// 忽略 deletedAt 字段，强制删除
await shop.destory({ force: true });
```

## 表结构变更与数据迁移

Leoric 用来处理表结构变更和数据迁移的迁移任务与 Sequelize 基本一致，并没有做额外兼容，参考《[迁移任务]({{ '/zh/migrations' | relative_url }})》一文即可。下文是对迁移任务的配置及使用方式的简单说明，首选需要在初始化数据库时配置迁移任务文件的存储目录：

```js
const realm = new Realm({
  migrations: 'path/to/migrations',  // 一般推荐 database/migrations
});
```

创建迁移任务：

```js
await realm.createMigrationFile('create-shops');
```

迁移任务的写法也基本一致：

```js
// 20210718140000-create-shops.js
'use strict';

module.exports = {
  async up(driver, { STRING, NUMBER }) {
    await driver.createTable('shops', {
      name: { type: STRING, allowNull: false },
      price: { type: NUMBER },
    });
  },

  async down(driver) {
    await driver.dropTable('shops');
  },
};
```

调用对应方法执行或者回滚迁移任务：

```js
await realm.migrate();   // 执行
await realm.rollback();  // 回滚
```

## 属性方法

### 读取与更新属性

支持通过 `instance.get(name)` 和 `instance.set(name, value)` 读取或者更新实例上的属性值，这两个的方法的作用和直接用 `instance[name]` 和 `instance[name] = value` 是一样的，支持这对方法主要目的是为了和 Sequelize 原有使用习惯兼容，推荐使用后者，更加直观。

`instance.get(name)` 和 `instance.set(name, value)` 会受数据模型上自定义的 getter 和 setter 影响，返回的可能是加工过的数据。如果需要读取数据库中存储的原始数据，或者绕开 setter 设置数据，可以使用下文中的这对方法。

### 读取与更新字段

支持通过 `instance.getDataValue(name)` 和 `instance.setDataValue(name, value)` 来操作原始数据，此方法为底层方法，会绕开数据模型上自定义的 getter 和 setter，例如：

```js
class Shop extends Bone {
  static attributes = {
    name: STRING,
  }

  get name() {
    return this.getDataValue('name').replace(/^([a-z])/, function(m, chr) {
      return chr.toUpperCase();
    });
  }

  set name(value) {
    this.setDataValue('name', value == null ? '' : value);
  }
}
const shop = new Shop({ name: 'yakitori' });
assert.equal(shop.name, 'Yakitori');
assert.equal(shop.getDataValue('name'), 'yakitori');
```

如果传入的属性名并非对应表中实际存在的字段，则会走默认的 `instance[name]` 和 `instance[name] = value` 逻辑，确保相互兼容。

## 数据校验

Leoric 的数据校验方案与 Sequelize 的没有太大出入，因此没有额外的兼容层，详见《[数据校验]({{ '/zh/validations' }})》一文。

## 关联关系

没有对 Sequelize 的关联关系 API 做深度兼容，Leoric 原有实现已经足够强大，大致对应关系：

| Sequelize       | Leoric               |
|-----------------|----------------------|
| belongsTo()     | belongsTo()          |
| hasMany()       | hasMany()            |
| hasOne()        | hasOne()             |
| belongsToMany() | hasMany({ through }) |

由于存在数据模型之间相互引用的关系，推荐将关联关系声明放到专门的数据模型初始化环节：

```js
class Shop extends Bone {
  static initialize() {
    this.hasMany('items');
    this.belongsTo('owner');
    this.hasMany('memberships');
    this.hasMany('members', { through: 'memberships' });
  }
}
```

支持一对一、一对多、以及多对多的关联关系声明，具体参数用法会有出入，详见《[关联关系]({{ '/zh/associations' | relative_url }})》一文。

## 高级查询

### 覆盖查询条件
