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
await realm.sync();
```

When sequelize adapter is active, the model API will behave similarly with the actual [Sequelize Model](https://sequelize.org/master/class/lib/model.js~Model.html). See the content below for detail.

## CRUD: Reading and Writing Data

### Dirty Check

## Migrations

## Validations

## Hooks

## Associations

## Querying

### Overriding Conditions
