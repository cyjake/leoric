---
layout: en
title: Setup with Egg / Chair / Midway
---

To reduce the effort to setup Leoric in Egg applications, a specific Egg plugin called [egg-orm](https://github.com/eggjs/egg-orm) is provided. Those frameworks that are built on top of Egg, such as Chair and [Midway](https://midwayjs.org/), can all be supported with [egg-orm](https://github.com/eggjs/egg-orm) as well.

## Table of Contents
{:.no_toc}

1. Table of Contents
{:toc}

## Install

```bash
$ npm i --save egg-orm
$ npm install --save mysql2   # MySQL or other compatible databases

# other databases
$ npm install --save pg       # PostgreSQL
$ npm install --save sqlite3  # SQLite
```

## Usage

With egg-orm, we can define models in `app/model` like below:

```js
// app/model/user.js
module.exports = function(app) {
  const { STRING } = app.model.DataTypes;

  return app.model.define('User', {
    name: STRING,
    password: STRING,
    avatar: STRING(2048),
  }, {
    tableName: 'users',
  });
}
```

Or even better, define models in `app/model` with `class` syntax like below:

```js
// app/model/user.js
module.exports = function(app) {
  const { Bone } = app.model;
  const { STRING } = app.model.DataTypes;

  return class User extends Bone {
    static table = 'users'
    static attributes = {
      name: STRING,
      password: STRING,
      avatar: STRING(2048),
    }
  };
}
```

then consume them in controllers (or services) in following fashion:

```js
// app/controller/home.js
const { Controller } = require('egg');
module.exports = class HomeController extends Controller {
  async index() {
    const users = await ctx.model.User.find({
      corpId: ctx.model.Corp.findOne({ name: 'tyrael' }),
    });
    ctx.body = users;
  }
};
```

## Configuration

Firstly, we need to install and enable egg-orm plugin:

```js
// config/plugin.js
exports.orm = {
  enable: true,
  package: 'egg-orm',
};
```

Secondly, we need to tell egg-orm how to connect with our database:

```js
// config/config.default.js
exports.orm = {
  client: 'mysql',
  database: 'temp',
  host: 'localhost',
  baseDir: 'app/model',
};
```

In the example configuration above, we have told egg-orm the models are at `app/model` directory, and the tables are at `temp` database which is accessible via `localhost`.

### opts.baseDir

If our models reside in directory other than `app/model`, we can change the default with `opts.baseDir`:

```js
// config/config.default.js
exports.orm = {
  baseDir: 'app/bone',
};
```

### opts.delegate

If the mount point `app.model` or `ctx.model` is taken, we can change the delegated property name with `opts.delegate`:

```js
// config/config.default.js
exports.orm = {
  delegate: 'bone',
};
```

Now we can access egg-orm from `app.bone` and `ctx.bone`.

### opts.sequelize

If there already are models defined in Sequelize way, we can switch on the sequelize adapter in egg-orm to minimize the migration work.

```js
// config/config.default.js
exports.orm = {
  client: 'mysql',
  sequelize: true,
};
```

Please refer to the [sequelize adapter]({{ '/zh/sequelize' | relative_url }}) documentation about more information.
