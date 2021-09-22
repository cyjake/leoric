---
layout: en
title: Setup with MySQL
---

## Table of Contents
{:.no_toc}

1. Table of Contents
{:toc}

## Quick Start

MySQL, or any of its incarnations, is the default dialect Leoric supports, which can be setup easily as follows:

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

Leoric uses [mysqljs/mysql](https://github.com/mysqljs/mysql) as the default client to access MySQL database, which should be added as dependency along with `leoric` itself:

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

## Options

### `host`

The hostname of the database you are connecting to. (Default: `localhost`)

### `port`

The port number to connect to. (Default: `3306`)

### `user`

The MySQL user to authenticate as.

### `password`

The password of the MySQL user to authenticate.

### `database`

### `appName`

In PolarDB, which is a MySQL compliant cloud based database formerly known as TDDL, there is a bit of confusion in database names. The name used to route the tables in database is called `appName`, which is also the one we use to config `database` of the MySQL client.

But the `table_schema` stored in `information_schema.columns` is another value. For example, if your database name is called `foo` in your local MySQL instance, when migrated to PolarDB it could be `foo` in `information_schema.columns.table_schema` and `FOO_APP` as the `database`:

```js
const realm = new Realm({
  host: 'polardb.host',
  user: 'FOO_APP',
  appName: 'FOO_APP',
  database: 'foo',
});
```

This option won't be necessary unless PolarDB is used.

### `charset`

The charset for the connection. This is called "collation" in the SQL-level of MySQL (like `utf8_general_ci`). If a SQL-level charset is specified (like `utf8mb4`) then the default collation for that charset is used. (Default: `'UTF8_GENERAL_CI'`)
### `connectionLimit`

The default pool provided by the client is used, which means all [pool options](https://github.com/mysqljs/mysql#pool-options) should be available. `connectionLimit` is the one whitelisted for now, more would be allowed in the future.

The option name explains itself, the pool size can be customized with this option, which is default to `10`.

### `idleTimeout`

IMHO, this option should be available through the pool options we mentioned above but it actually doesn't, which is a pity.

Please subscribe [#148](https://github.com/cyjake/leoric/issues/148) for future updates.

### `stringifyObjects`

When object is accidentally passed as the query value to MySQL client, the value will be formatted into expressions by default. Take following query for example:

```js
await Post.where({ name: { id: 1, name: 'Untitled' } });
```

which generates following SQL (and makes no sense):

```sql
SELECT * FROM `articles` WHERE `name` = `id` = 1 AND `name` = `Untitled`;
```

To mitigate this problem, we can turn on `stringifyObjects` to make sure object will be stringified if accidentally passed to query.
