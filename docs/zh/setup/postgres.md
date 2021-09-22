---
layout: zh
title: PostgreSQL 配置说明
---

## 目录
{:.no_toc}

1. 目录
{:toc}

## 快速上手

Leoric 支持 PostgreSQL，可以通过如下方式快速配置：

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

默认使用 [pg](https://node-postgres.com/) 访问 PostgreSQL 数据库，需要将 `pg` 和 `leoric` 一起添加到依赖列表中：

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

## 配置项

### `host`

需要连接的数据库服务主机名，默认为 `localhost`。

### `port`

需要链接的数据库服务端口，默认为 `5432`。

### `user`

有权限访问对应数据库的用户名。

### `password`

有权限访问对应数据库的用户密码。

### `database`

应用对应的数据库名称。
