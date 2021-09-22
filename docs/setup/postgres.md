---
layout: en
title: Setup with PostgreSQL
---

## Table of Contents
{:.no_toc}

1. Table of Contents
{:toc}

## Quick Start

Leoric supprts PostgreSQL as well, which can be easily configured as follow:

```js
const Realm = require('leoric');
const realm = new Realm({
  dialect: 'postgres',
  host: 'localhost',
  user: 'test',
  database: 'test',
  models: 'app/models',
});
await realm.connect();
```

[pg](https://node-postgres.com/) is the default client to access PostgreSQL database, hence we need to add both `pg` and `leoric` to package dependencies:

```diff
diff --git a/package.json b/package.json
index cf91c34..7ae144d 100644
--- a/package.json
+++ b/package.json
@@ -45,6 +45,8 @@
   "dependencies": {
+    "leoric": "^1.10.0",
+    "pg": "^8.5.1",
```
## Options

### `host`

The host of the database to connect. (Default: `localhost`)

### `port`

The port of the database to connect. (Default: `5432`)

### `user`

The user with enough privilege to access the database.

### `password`

The password of the user to authenticate.

### `database`

The name of the database to access.
