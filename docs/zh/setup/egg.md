---
layout: zh
title: 在 Egg 应用中使用 Leoric
---

我们为 Egg 准备了专门的插件 [egg-orm](https://github.com/eggjs/egg-orm)，使用 egg-orm 即可快速搞定 Egg 应用中的数据模型定义以及消费。

## 目录
{:.no_toc}

1. 目录
{:toc}

## 安装

```bash
$ npm i --save egg-orm
$ npm install --save mysql2   # MySQL 或者其他兼容 MySQL 的数据库

# 其他数据库类型
$ npm install --save pg       # PostgreSQL
$ npm install --save sqlite3  # SQLite
```

## 使用

开启 egg-orm 插件即可在 `app/model` 中定义数据模型：

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

在 Controller 调用：

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

## 配置

首先开启（并安装） egg-orm 插件

```js
// config/plugin.js
exports.orm = {
  enable: true,
  package: 'egg-orm',
};
```

然后按需配置数据库：

```js
// config/config.default.js
exports.orm = {
  client: 'mysql',
  database: 'temp',
  host: 'localhost',
  baseDir: 'app/model',
};
```

在上面这个例子中，我们将数据模型定义文件放在 `app/model` 目录，通过 `localhost` 访问 MySQL 中的 `temp` 数据库。

### opts.baseDir

egg-orm 默认会加载 `app/model` 目录下的 js 文件并将对应的数据模型定义挂载应用中，可以使用 `opts.baseDir` 自定义加载目录：

```js
// config/config.default.js
exports.orm = {
  bsaeDir: 'app/bone',
};
```

### opts.delegate

egg-orm 默认会挂载到 `app.model` 和 `ctx.model` 上，如果已经有插件使用同名挂载属性名，可以使用 `opts.delegate` 自定义挂载属性名：

```js
// config/config.default.js
exports.orm = {
  delegate: 'bone',
};
```

如此配置，egg-orm 就会挂载到 `app.bone` 而不是默认的 `app.model` 了。

### opts.sequelize

如果应用原先已经使用 Sequelize 实现数据模型层，可以通过 `opts.sequelize` 配置项开启 egg-orm 的 Sequelize 模式来减少迁移工作：

```js
// config/config.default.js
exports.orm = {
  client: 'mysql',
  sequelize: true,
};
```

可以参考 [Sequelize 适配器]({{ '/zh/sequelize' | relative_url }})一文了解更多有关内容。
