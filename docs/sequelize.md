---
layout: en
title: Sequelize Adapter
---

To ease the transition work from sequelize to leoric, a sequelize adapter is available once the `sequelize` switch is on:

```js
const Realm = require('leoric');
const realm = new Realm({
  sequelize: true,  // turn on sequelize adapter
  host: 'localhost',
});
await realm.connect();
```

When sequelize adapter is active, the model API will behave similarly with the actual [Sequelize Model](https://sequelize.org/master/class/lib/model.js~Model.html). See the content below for detail.

## 目录
{:.no_toc}

1. 目录
{:toc}

## CRUD: Reading and Writing Data

### Create

The sequelize adapter supports three most common ways of inserting data:

```js
await Shop.create({ name: 'MILL' });
await Shop.bulkCreate([
  { name: 'wagas' },
  { name: 'family mart' },
]);
await (new Shop({ name: "McDonald's" })).save();
```

All of the statments above yield SQL like below:

```sql
INSERT INTO shops (name) VALUES ('MILL');
INSERT INTO shops (name) VALUES ('wagas'), ('family mart');
INSERT INTO shops (name) VALUES ('McDonalds');
```

Compound queries like trying to find record before creating are supported as well:

```js
// a bit like upsert but this does not deal with udpating existing records
await Shop.findOrCreate({
  where: { name: 'Shanghai Brewhouse' },
});

// try to find record first, if not found try to create, if create fails, find again
await Shop.findCreateFind({
  where: { name: 'Shanghai Brewhouse' },
});
```

### Read

In sequelize both `Model.find()` and `Model.findOne()` returns single result. The former one is just an alias of the latter, following content sticks with `Model.findOne()`:

```js
const shop = await Shop.findOne({
  where: { name: 'Free Mori' },
});
```

The return type of `Model.findOne()` is `Model|null`, which means an instance of the module will be returned if record exists, and `null` is what you get if there is nothing.

To find multiple records, `Model.findAll()` should be used. This method accepts basically the same arguments of `Model.findOne()`, like below:

```js
const shops = await Shop.findAll({
  attributes: [ 'id', 'name', 'created_at', 'updated_at' ],
  where: {
    name: { $like: '%Mori%' },
  },
  order: [[ 'id', 'desc' ]],
});
```

Leoric provides a bit more methods about reading data from database. If there is not an sequelize version, then the one defined at the base class of Leoric will be called as default.

```js
const shops = await Shop.all;
const shop = await Shop.first;
const top10 = await Shop.order('credit', 'desc').limit(10);
```

### Update

### Delete

### Dirty Check

## Migrations

## Validations

## Hooks

## Associations

## Querying

### Overriding Conditions
