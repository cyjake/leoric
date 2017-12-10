---
layout: default
title: Associations
---

With associations well defined, developers can pull structured data with a single query such as:

```js
const shop = yield Shop.findOne({ id }).with('items', 'owner', 'license')
assert(shop.items[0] instanceof Item)  // => true
assert(shop.owner instanceof User)     // => true
```

This guide covers the association features of Leoric. After reading this guide, you will know:

- How to declare assocations between Leoric models.
- How to understand the various types of Leoric associations.

## Types of Associations

Leoric supports four types of associations:

- `static belongsTo()`
- `static hasMany()`
- `static hasMany({ through })`
- `static hasOne()`

Associations can be declared in the `static describe()` method. For example, by declaring one model `belongsTo` another, you're telling Leoric that when `Model.find({}).with('anotherModel')`, Leoric should join `another_models`, load the data, and instantiate anotherModel on the found models.

> Associations are far more powerful in Active Record for Ruby's flexibility. For example, assocation fetching can be seamless when accessing `model.anotherModel` no matter it is already included in the first query or not. If `model.anotherModel` isn't ready, Ruby will block at accessing, wait for Active Record to perform another query, then return the result. However, This kind of luxury isn't available in the asynchronous world of Node.js.

### `static belongsTo()`

A `static belongsTo()` assocation sets up a one-to-one relationship with another model. For example, a shop can have many items as it finds fit. On the other hand, an item can `belongsTo` to exactly one shop. We can declare the `Item` this way:

```js
class Item extends Bone {
  static describe() {
    this.belongsTo('shop')
  }
}
```

Conventionally, Leoric will try to relate `Item` with `Shop` which is found by capitalizing `shop` as the model name. If that's not the case, you can specify the model name explicitly by passing `Model`:

```js
class Item extends Bone {
  static describe() {
    this.belongsTo('shop', { Model: 'Store' })
  }
}
```

// TODO: relational diagram

// TODO: foreignKey

### `static hasMany()`

### `static hasMany({ through })`

### `static hasOne()`

### Choosing Between `static belongsTo()` and `static hasOne()`

## A (not so) Quick Walkthrough

Let's say we need to develop an online shopping mall. Here's a drastically simplified relational diagram.

<img width="720" src="https://img.alicdn.com/tfscom/TB1BcxiXaSmXuNjy1XdXXa3opXa.png">

```js
const { Bone } = require('leoric')

// app/models/shop.js
class Shop extends Bone {
  static describe() {
    this.hasMany('items')
    this.hasMany('tagMaps', {
      foreignKey: 'targetId',
      where: { targetType: 1 }
    })
    this.hasMany('tags', { through: 'tagMaps' })
    this.hasOne('license')
    this.belongsTo('owner')
  }
}

// app/models/item.js
class Item extends Bone {
  static describe() {
    this.belongsTo('shop')
  }
}

// app/models/tagMap.js
class TagMap extends Bone {
  static describe() {
    this.belongsTo('tag')
    this.belongsTo('shop', {
      foreignKey: 'targetId',
      where: { targetType: 1 }
    })
  }
}

// app/models/tag.js
class Tag extends Bone {
  static describe() {
    this.hasMany('shopTagMaps', {
      ClassName: 'TagMap',
      where: { targetType: 1 }
    })
    this.hasMany('shops', { through: 'shopTagMaps' })
  }
}

// app/models/license.js
class License extends Bone {
  static describe() {
    this.belongsTo('shop')
  }
}
```
