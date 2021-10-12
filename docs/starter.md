---
layout: en
title: Starter
---

## Table of Contents
{:.no_toc}

1. Table of Contents
{:toc}

## Getting Started

This guide try to illustrate the config and usage about Leoric with an abstract project about photography which is called **Portra**. Let's assume this project uses MySQL database, is based on the Egg framework, which features photo management, backup, and sharing.

### Configuring Database

Leoric supports MySQL, SQLite, and PostgreSQL. It is able to run in both Node.js and Electron, which makes it perfectly suitable for Portra. In following configuration, we decide to put the models in `app/models` directory, with the database set to `portra`:

```js
const Realm = require('leoric');
const realm = new Realm({
  host: 'localhost',
  user: 'portra',
  database: 'portra',
  models: 'app/models',
  migrations: 'database/migrations',
});
await realm.connect();
```

For detailed configuration options about different databases, please take a look about the [Setup]({{ '/zh/setup' | relative_url }}) documentation.

### Model Basics

If the table schemas aren't managed with Leoric, we can omit the attributes definition in models and let Leoric load them from `information_schema.columns` automatically. Take `app/model/user.js` for example, it can be defined as:

```js
const { Bone } = require('leoric');

module.exports = class User extends Bone {
  static initialize() {
    this.hasMany('books');
    this.hasMany('comments');
  }
}
```

After database is connected with `await realm.connect()`, `User` model will be loaded with `User.attributes`. Then we can create, find, update, or delete records in `users` table:

```js
// create user
await User.create({ name: 'Stranger' });

// find the user just created
const user = await User.first;
assert.equal(user.name, 'Stranger');

// change the name of the user
await user.update({ name: 'Tyrael' });

// remove user
await user.remove();
```

For more information about model attributes and `information_schema.columns`, or the methods that deal with record manipulation, it is recommend to start with the [Basics]({{ '/zh/basics' | relative_url }}) introduction.

### Creating Models with Migrations

## Migrating from Sequelize

Projects that consider migrating from Sequelize to Leoric, may try the Sequelize adapter to mitigate the migration work. With the Sequelize adapter activated, Leoric will inject an extra layer above Bone to provide compatible APIs. Please take a look about [Sequelize Adapter]({{ '/zh/sequelize' | relative_url }}) for detail.
