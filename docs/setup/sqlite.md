---
layout: en
title: Setup with SQLite
---

## Table of Contents
{:.no_toc}

1. Table of Contents
{:toc}

## Quick Start

Setting up Leoric with SQLite is easy as follows:

```js
const Realm = require('leoric');
const realm = new Realm({
  dialect: 'sqlite',
  database: 'database/development.sqlite3',
  models: 'app/models',
});
await realm.connect();
```

Leoric uses [mapbox/node-sqlite3](https://github.com/mapbox/node-sqlite3) as the default client to access SQLite database, hence both `leoric` and `sqlite3` need to be added as dependencies:

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

## Options

### `options.client`

The client used to access SQLite database can be customized with `options.client`. For example, if the database is encrypted with sqlcipher and `@journeyapps/sqlcipher` is the preferred client:

```js
const Realm = require('leoric');
const realm = new Realm({
  client: '@journeyapps/sqlcipher',
  dialect: 'sqlite',
  database: 'database/development.sqlite3',
  models: 'app/models',
});
await realm.connect();
```

Remember to add the customized client as dependencies. Currently both `sqlite3` and `@journeyapps/sqlcipher` are tested with Leoric in our continuous integration tests.

### `options.trace`

To better generate the stack trace when error occurs while querying database, `client.verbose()` is called by default. This helper method is provided by `sqlite3` and has a slight performance penalty because each time a query is performed, there is a `new Error()` to capture the stack trace before the asynchronous call.

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

For more detail about the result and the related code, see [!175](https://github.com/cyjake/leoric/pull/175).

This behavior can be turned off by setting `options.trace` to `false`.

### `options.connectionLimit`

Connection pool for SQLite is supported as well, which is turned on by default with `options.connectionLimit` set to `10`.

Accessing SQLite database with multiple read/write connections (or should we say, file handles?) might cause random `SQLITE_BUSY` errors because there is no server to resolve database or table lock. To keep from situations like this, we can either turn off multiple connections by setting `options.connectionLimit` to `1`, or try telling the client to wait a little longer with bigger `options.busyTimeout`.

```js
const Realm = require('leoric');
const realm = new Realm({
  dialect: 'sqlite',
  database: 'database/development.sqlite3',
  models: 'app/models',
  connectionLimit: 1,
});
await realm.connect();
```

### `options.busyTimeout`

The default `options.busyTimeout` is set to `30000` in milliseconds.

```js
const Realm = require('leoric');
const realm = new Realm({
  dialect: 'sqlite',
  database: 'database/development.sqlite3',
  models: 'app/models',
  busyTimeout: 30000,
});
await realm.connect();
```

For more information about `SQLITE_BUSY`:

- <https://www.sqlite.org/rescode.html#busy>
- <https://www.sqlite.org/c3ref/busy_timeout.html>


## Using SQLCipher

The major different between SQLCipher and vanilla SQLite is the former one will encrypt the database file with a key. The key needs to be set before any queries are performed, otherwise SQLCipher won't be able to decrypt the database file and an error with message like `SQLITE_ERROR: file is not a database` gets thrown.

To make sure the key is set at the first place, regardless of the connection limit settings, we can listen on the `connection` event emitted from `realm.driver.pool`:

```js
realm.driver.pool.on('connection', function(connection) {
  connection.query('PRAGMA key = "Riddikulus!"');
});
```
