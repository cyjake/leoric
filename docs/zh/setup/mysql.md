---
layout: zh
title: MySQL 配置说明
---

## 目录
{:.no_toc}

1. 目录
{:toc}

## 快速上手

Leoric 默认支持 MySQL，可以通过如下方式快速配置：

```js
const Realm = require('leoric');
const realm = new Realm({
  host: 'localhost',
  user: 'test',
  database: 'test',
  models: 'app/models',
});
await realm.connect();
```

默认使用 [mysqljs/mysql](https://github.com/mysqljs/mysql) 作为访问 MySQL 数据库的客户端，需要将 `mysql` 和 `leoric` 一起添加到依赖列表中：

```diff
diff --git a/package.json b/package.json
index cf91c34..7ae144d 100644
--- a/package.json
+++ b/package.json
@@ -45,6 +45,8 @@
   "dependencies": {
+    "leoric": "^1.10.0",
+    "mysql": "^2.18.1",
```

## 配置项

### `host`

需要连接的数据库服务主机名，默认为 `localhost`。

### `port`

需要链接的数据库服务端口，默认为 `3306`。

### `user`

有权限访问对应数据库的用户名。

### `password`

有权限访问对应数据库的用户密码。

### `database`

应用对应的数据库名称。

### `appName`

PolarDB 是一款与 MySQL 协议兼容的云端关系型数据库，前身是 TDDL。在 PolarDB 中有两个数据库名，一个是用来指引相关数据表路径的数据库名称，在 PolarDB 中这个名称和 `appName` 相同；另一个是实际表结构设计时所用的数据酷名称，也就是 `information_schema.columns.table_schema`。

举个例子，如果在迁移到 PolarDB 之前，你的数据库名称是 `foo`，迁移到 PolarDB 之后 `information_schema.columns.table_schema` 仍然会是 `foo`，但是需要提供对应的 `appName` 来告诉 PolarDB 你的表都在哪个数据库下面，大致配置如下：

```js
const realm = new Realm({
  host: 'polardb.host',
  user: 'FOO_APP',
  appName: 'FOO_APP',
  database: 'foo',
});
```

如果不熟悉 PolarDB，也不打算使用，就不需要用到这个配置。

### `charset`



### `connectionLimit`

Leoric 使用客户端提供的连接池功能，更多连接池配置项可以参考 [mysqljs/mysql#pool-options](https://github.com/mysqljs/mysql#pool-options)。

可以通过 `connectionLimit` 配置连接池大小，默认为 `10`。

### `idleTimeout`

理论上这项功能应该由客户端模块提供，在客户端已经实现的连接池中加上即可，但目前并没有，可以通过 [#148](https://github.com/cyjake/leoric/issues/148) 了解相关进展。

### `stringifyObjects`

如果不小心给查询语句传了对象字面量，例如：

```js
await Post.where({ name: { id: 1, name: 'Untitled' } });
```

将会生成如下结构的 SQL（语法上并不通）：

```sql
SELECT * FROM `articles` WHERE `name` = `id` = 1 AND `name` = `Untitled`;
```

为了缓解这个问题，可以将 `stringifyObjects` 设置为 `true` 来告诉客户端遇到对象字面量一律直接按 JSON 序列化，避免产生结构诡异的 SQL 查询。
