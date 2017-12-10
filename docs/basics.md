---
layout: default
title: Basics
---

This guide is an introduction to Leoric. After reading this guide, you will know:

- What Object Relational Mapping (roughly) and Leoric are, and how they are used.
- How to use Leoric models to manipulate data stored in a relational database.
- Leoric schema naming conventions.

## What is Leoric

Leoric is a thin Object Relational Mapping layer between Node.js and database. It can be used as the M in [MVC](https://en.wikipedia.org/wiki/Model%E2%80%93view%E2%80%93controller) - which is the layer of the system responsible for representing business data and logic.

Object Relational Mapping, or ORM, is a way of connecting rich objects of an application to tables in a relational database management system. The idea of ORM is quite popular in a lot of the programming languages, such as Active Record for Ruby, SQLAlchemy for Python, or Hibernate for Java. Leoric is heavily influenced by [Active Record](http://guides.rubyonrails.org/active_record_basics.html) which you probably can tell already by the similar documentation structure.

As one of the many ORM libraries for JavaScript, the most promising features of Leoric shall be the abilities to:

- Represent models and their data.
- Represent associations between models.
- Map existing tables without repeating column definitions in model.
- CRUD (create, read, update, delete) in asynchronous fashion.
- Create and consume models in morden JavaScript.

## Convention over Configuration

Generally speaking, configuration is preferred over convention because of its explicitness. However, if you follow the conventions introduced by Leoric, you'll need to write few configuration when authoring models.

### Naming Conventions

By default, Leoric uses some naming conventions to find out how the mapping between models and database tables should be created. Here're the rules:

- model names shall be in `CamelCase`, the table names will be the pluralized model name in `snake_case`,
- model attributes shall be in `camelCase`. The attribute names are fetched and transformed from the schema information, which would be in `snake_case` mostly.

Here's a few transform examples.

| Model/Class | Table/Schema |
|-------------|--------------|
| Shop        | shops        |
| TagMap      | tagMaps      |
| Mouse       | mice         |
| Person      | people       |

Under the hood, Leoric uses [pluralize](https://www.npmjs.com/package/pluralize) to transform table names from model names. If you find the transform rules counter intuitive (which is very common for non-native speakers), you can explicitly configure the table name or rename the attribute. We'll cover that in the *Overrding the Naming Conventions* section.

### Schema Conventions

Leoric provides three static methods for relationship authoring, `.hasMany()`, `.hasOne()`, and `.belongsTo()`. The conventional primary keys and foreign keys are as below,

- **Foreign keys** should be named following the pattern `modelNameId` (e.g. `shopId`). The corresponding columns are the keys in snake case `model_name_id` (e.g. `shop_id`).
- **Primary keys** should be an unsigned integer `id`.

There're some optional column names that will add additional features to Leoric:

| column       | attribute   | description                                   |
|--------------|-------------|-----------------------------------------------|
| `created_at` | `createdAt` | updated when the record is first created.     |
| `updated_at` | `updatedAt` | updated whenever the record is updated.       |
| `deleted_at` | `deletedAt` | updated whenever the record is softly deleted |

> For TDDL users, the conventional `gmt_create` is mapped to `createdAt`, `gmt_modified` is mapped to `updatedAt`, and `gmt_deleted` (if present) is mapped to `deletedAt`.

When `Bone.remove({...})` is called on a Model with `deletedAt` present, Leoric will perform a soft delete by updating the value of `deletedAt` column instead of delete it from the database permanently. Call `Bone.remove({...}, true)` to force delete.

## Authoring Models

It's very easy to create Leoric models. Simply extend from the `Bone` class exported by Leoric:

```js
const { Bone } = require('leoric')

class Shop extends Bone {}
```

Suppose the `shops` table structure looks like below:

```sql
CREATE TABLE shops (
  id int(11) NOT NULL auto_increment,
  name varchar(255),
  PRIMARY KEY (id)
);
```

Following the table schema above, you would be able to write code like this:

```js
const shop = new Shop({ name: 'Horadric Cube' })
await shop.save()
// or simply
await Shop.create({ name: 'Horadric Cube' })
```

## Overriding the Naming Conventions

Most of the conventional names and keys can be overridden by corresponding methods. You can specify `static get table()` to override the default table name:

```js
class Shop extends Bone {
  static get table() { return 'stores' }
}
```

It's also possible to override the the name of the primary key by specifying `static get primaryKey()`:

```js
class Shop extends Bone {
  static get primaryKey() { return 'shopId' }
}
```

You can rename the attribute names too. By default, these names are transformed from column names by calling `static renameAttribute(oldName, newName)` in the `static describe()` method.

```js
class Shop extends Bone {
  static describe() {
    this.renameAttribute('removedAt', 'deletedAt')
  }
}
```

A lot of schema settings can be done within the `static describe()` method. We'll get to that later.

## Connecting Models to Database

Models need to be connected to database before use. When you `connect()` models to database, Leoric will try to load table schema information and update model metadata accordingly, namely the `Model.schema`, `Model.attributes`, and `Model.columns` properties (the latter two are just getter properties which rely on `Model.schema`).

```js
const { connect } = require('leoric')

async function() {
  // connect models to the database
  await connect({
    host: 'example.com',
    port: 3306,
    user: 'john',
    password: 'doe',
    db: 'tmall',
    models: [Shop]
  })

  // connect models by passing the path of the containing directory
  await connect({ ...opts, path: '/path/to/models' })
})
```

## Reading and Writing Data

With the models defined and connected, developers can,

- query the model with static methods such as `Model.find()` and `Model.findOne()`,
- writing data with `Model.create()` and `Model.update()`,
- removing data with `Model.remove()`, and
- persisting instance changes with `model.save()` of course.

```js
async function() {
  // create shop
  await Shop.create({ name: 'Barracks' })

  // find one and update it
  const shop = await Shop.findOne({ name: 'Barracks' })
  shop.name = 'Horadric Cube'
  await shop.save()

  // remove the shop
  await Shop.remove({ name: 'Horadric Cube' })
})
```

### Create

There are two ways in Leoric to INSERT records into database. We can do this either by calling `Model.create()` with one blow:

```js
const shop = await Shop.create({ name: 'Barracks', credit: 10000, type: 'taobao' })
```

or by instantiating a model from scratch, settings the attributes, the `model.save()` it at last:

```js
const shop = new Shop({ name: 'Barracks' })
shop.credit = 10000
shop.type = 'taobao'
await shop.save()
```

The SQL equivalent of both is:

```sql
INSERT INTO shops (name, credit, type) VALUES ('Barracks', 10000, 'taobao');
```

### Read

Although Leoric provides a rich API for starting a query, `Model.find()` and `Model.findOne()` are the most used methods.

```js
// find all of the shops
Shop.find()
// => SELECT * FROM shops;

// find the first one
Shop.findOne()
// => SELECT * FROM shops LIMIT 1;

// find the shop of Deckard Cain
Shop.findOne({ name: 'Deckard Cain' })
// => SELECT * FROM shops WHERE name = 'Deckard Cain' LIMIT 1;

// find a collection of shops with their credit above 1000
Shop.where('credit > 1000')
// => SELECT * FROM shops WHERE credit > 1000;
```

For detailed introductions about reading data from the database, please read [Query Interface]({{ '/querying' | relative_url }})

### Update

Like the way records are created, records can be updated in two manners too. If the objects are already at hand, we can fiddle their attributes and persist the updates by calling `model.save()`:

```js
const shop = await Shop.findOne({ name: 'Barracks' })
// => Shop { id: 1, name: 'Barracks' }
shop.credit = 10000
await shop.save()
```

The SQL equivalent of the above is:

```sql
UPDATE shops SET credit = 10000 WHERE id = 1;
```

If the back and forth traffic needs to be skipped, we can also update the records with one blow using `Model.update()`:

```js
await Shop.update({ name: 'Barracks' }, { credit: 10000 })
```

The SQL equivalent of the above is:

```sql
UPDATE shops SET credit = 10000 WHERE name = 'Barracks';
```

### Delete

Likewise, both `model.remove()` and `Model.remove()` are available to delete records from database. For example:

```js
const shop = await Shop.find({ name: 'Barracks' })
// => Shop { id: 1, name: 'Barracks' }
await shop.remove(true)
// DELETE FROM shops WHERE id = 1

await Shop.remove({ name: 'Barracks' }, true)
// DELETE FROM shops WHERE name = 'Barracks'
```

What's with the parameter `true` you might ask. That is because by default Leoric performs a soft delete instead of truly DELETE FROM the database. To make soft delete possible, the model must have a attribute called `deletedAt` to be used as a mark of deletion.

Therefore, if `deletedAt` were present in `Shop` model:

```js
const shop = await Shop.find({ name: 'Barracks' })
// => Shop { id: 1, name: 'Barracks' }
await shop.remove(true)
// UPDATE shops SET deleted_at = NOW() WHERE id = 1;

await Shop.remove({ name: 'Barracks' })
// UPDATE shops SET deleted_at = NOW() WHERE name = 'Barracks';
```

If `deletedAt` were absent in `Shop` model, calling either `model.remove()` or `Model.remove()` without passing `true` will throw an Error.
