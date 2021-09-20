---
layout: zh
title: 帮助手册
---

## 目录
{:.no_toc}

1. 目录
{:toc}

## 快速上手

本文通过一个相册应用（姑且将它命名为 Portra）来讲解 Leoric 的配置使用方式。我们假定这个应用使用 MySQL 数据库，基于 Egg 框架开发，提供照片整理、备份、以及分享等功能。

### 初始配置

Leoric 支持 MySQL、SQLite、以及 PostgreSQL 数据库，能够在 Node.js、Electron 等环境中运行，因此完全满足 Portra 应用的开发需求。我们将数据模型文件放在 `app/models` 目录，开发环境使用本地的 MySQL 服务，配置如下：

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

有关数据库或者运行环境的详细配置说明可以参考《[快速配置]({{ '/zh/setup' | relative_url }})》一文。

### 声明与使用模型

如果不需要通过 Leoric 维护表结构，我们可以省略掉在数据模型中声明属性信息，根据数据库中的相关信息自动转换，这样在 `app/models` 目录中只需要声明对应的数据模型名称，以及必要的表结构关系即可。

以 `app/model/user.js` 为例，内容大致如下：

```js
const { Bone } = require('leoric');

module.exports = class User extends Bone {
  static initialize() {
    this.hasMany('books');
    this.hasMany('comments');
  }
}
```

在执行 `await realm.connect()` 之后，`User` 数据模型将被初始化，可以通过 `User.attributes` 访问属性信息，使用 `User.create()` 等方法新增、查询、更新、以及删除用户数据：

```js
// 创建用户
await User.create({ name: 'Stranger' });

// 查找第一条用户记录，也就是刚才创建的这条
const user = await User.first;
assert.equal(user.name, 'Stranger');

// 修改用户，更正用户名为泰瑞尔
await user.update({ name: 'Tyrael' });

// 删除用户记录
await user.remove();
```

有关表结构与数据模型属性名的约定关系，创建、读取、更新、以及删除数据记录的操作方法，推荐阅读《[基础]({{ '/zh/basics' | relative_url }})》一文详细了解。

### 使用迁移任务管理表结构变更

不过我们的 Portra 应用预算比较拮据，没有专门的 DMS 系统来管理表结构变更，幸好 Leoric 也提供迁移任务管理，通过编写表结构变更相关的迁移任务，我们通用可以将表结构变更纳入变更评审和版本管理。

例如，想要使用迁移任务创建用户表，大概有如下几个步骤：

1. 调用 `await realm.createMigrationFile('create-users')` 在目录创建迁移任务；
2. 编辑迁移任务，填写变更相关的执行与回滚逻辑，也就是 `driver.createTable('users', {...})` 和 `driver.dropTable('users')`；
3. 调用 `await realm.migrate()` 执行迁移任务，创建 `users` 表；
4. 创建 app/models/user.js 文件，声明用户数据模型

完成上述步骤之后，`User` 就可以用了。有关创建、修改、以及删除表的操作说明都可以参考《[迁移任务]({{ '/zh/migrations' | relative_url }})》一文。

另外，Leoric 也提供 `realm.sync({ force: true })` 的快捷方式，在 `User.attributes` 中声明属性信息，然后执行这个方法将属性信息同步到数据库即刻，将自动检查模型生命和实际表结构信息的差异，然后执行相应的创建、修改表的操作。

## 从 Sequelize 迁移

使用 Sequelize 的项目如果考虑迁移到 Leoric，可以通过开启 Sequelize 适配器来简化迁移工作。开启 Sequelize 适配器之后，Leoric 将在数据模型的基类上层提供足够接近的 API 兼容，转换相关调用到 Bone，详细兼容程度可以参考《[Sequelize 适配器]({{ '/zh/sequelize' | relative_url }})》一文。
