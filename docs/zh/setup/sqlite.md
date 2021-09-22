---
layout: zh
title: SQLite 配置说明
---

## 目录
{:.no_toc}

1. 目录
{:toc}

## 快速上手

可以按如下方式快速配置使用 SQLite 数据库：

```js
const Realm = require('leoric');
const realm = new Realm({
  dialect: 'sqlite',
  database: 'database/development.sqlite3',
  models: 'app/models',
});
await realm.connect();
```

Leoric 默认使用 [mapbox/node-sqlite3](https://github.com/mapbox/node-sqlite3) 操作 SQLite 数据库，需要将 `leoric` 和 `sqlite3` 两个包都添加到依赖列表中：

```diff
diff --git a/package.json b/package.json
index cf91c34..7ae144d 100644
--- a/package.json
+++ b/package.json
@@ -45,6 +45,8 @@
   "dependencies": {
+    "leoric": "^1.10.0",
+    "sqlite3": "^5.0.2",
```

## 配置项

### `client`

可以通过 `client` 配置访问 SQLite 数据的客户端。例如，如果需要使用 sqlcipher 加密数据库文件，可以选择将客户端修改为 `@journeyapps/sqlcipher`：

```js
const realm = new Realm({
  client: '@journeyapps/sqlcipher',
  dialect: 'sqlite',
  database: 'database/development.sqlite3',
  models: 'app/models',
});
```

记得添加 `@journeyapps/sqlcipher` 到依赖列表。目前 `sqlite3` 和 `@journeyapps/sqlcipher` 都是默认支持的，两者也都在 Leoric 的持续集成测试中。

### `trace`

Leoric 默认会尝试调用 `client.verbose()` 开启调用栈跟踪，从而在查询出现异常时更加清晰地反应到原始调用位置。这个辅助方法是 `sqlite3` 默认提供的，会对每次查询有一点点性能损耗，因为每次查询的时候都需要调用 `new Error()` 来记录异步调用发生前的调用栈。

```
  1) => SQLite driver.query()
       should support async stack trace:
     Error: SQLITE_ERROR: no such table: missing
  --> in Database#all('SELECT * FROM missing', undefined, [Function: Leoric_all])
      at /Users/nil/Projects/cyjake/leoric/src/drivers/sqlite/connection.js:48:21
      at new Promise (<anonymous>)
      at Connection.all (src/drivers/sqlite/connection.js:47:12)
      at Connection.query (src/drivers/sqlite/connection.js:39:33)
      at SqliteDriver.query (src/drivers/sqlite/index.js:46:33)
      at async Context.<anonymous> (test/unit/drivers/sqlite/index.test.js:181:7)
```

如果想要了解更多有关这个优化项的信息，可以访问 [!175](https://github.com/cyjake/leoric/pull/175).

也可以通过将 `trace` 设置为 `false` 来关闭这一行为。

### `connectionLimit`

SQLite 本身是单文件的数据库，也没有服务端架构，因此没有提供连接池。为了优化数据读写，Leoric 在外层包装了连接池，可以通过 `connectionLimit` 设置连接数，默认连接数为 `10`。

通过多个具有读写能力的数据库连接来操作数据容易出现 `SQLITE_BUSY`，因为没有服务端来解决并发。有两种避免这种情况的办法，一种是将 `connectionLimit` 设置 `1` 来关闭多个数据库连接访问，另一种是配置 `busyTimeout` 让 `sqlite3` 客户端继续重试，直到等候时间超过 `busyTimeout`。

```js
const realm = new Realm({
  dialect: 'sqlite',
  database: 'database/development.sqlite3',
  models: 'app/models',
  connectionLimit: 1,
});
```

### `busyTimeout`

`busyTimeout` 的单位是毫秒，默认设置为 `30000`。

```js
const realm = new Realm({
  dialect: 'sqlite',
  database: 'database/development.sqlite3',
  models: 'app/models',
  busyTimeout: 30000,
});
```

可以访问如下链接了解更多有关 `SQLITE_BUSY` 异常：

- <https://www.sqlite.org/rescode.html#busy>
- <https://www.sqlite.org/c3ref/busy_timeout.html>


## 使用 SQLCipher

SQLCipher 和 SQLite 最主要的区别是，前者可以使用一个密钥来加密整个数据库文件。对前者来说，需要在所有数据库操作之前先设置密钥，不然会打不开数据库文件，报 `SQLITE_ERROR: file is not a database` 异常。

为了确保密钥会在第一时间设置，尤其是考虑到可能有多个数据库连接的情况，我们可以监听数据库连接池的 `connection` 事件：

```js
realm.driver.pool.on('connection', function(connection) {
  connection.query('PRAGMA key = "Riddikulus!"');
});
```
