---
layout: zh
title: 错误排查
---

## 目录
{:.no_toc}

1. 目录
{:toc}

## 连接问题

### `Error: connect ECONNREFUSED ::1:3306`

这是 macOS 上的常见问题，`localhost` 解析为 IPv6 的 `::1`，但 MySQL 只监听 `127.0.0.1`。

**解决方案**：更新 MySQL 配置，同时绑定 IPv6：

```diff
# /usr/local/etc/my.cnf (Homebrew MySQL)
[mysqld]
-bind-address = 127.0.0.1
+bind-address = 127.0.0.1,::1
```

然后重启 MySQL：

```bash
brew services mysql restart
```

或者在连接配置中使用 `127.0.0.1` 代替 `localhost`：

```js
const realm = new Realm({
  host: '127.0.0.1',  // 使用 IP 而非 'localhost'
  database: 'my_app',
});
```

### `Error: connected already`

在默认 `Bone` 类上多次调用 `connect()` 时会出现此错误。

**解决方案**：
- 在应用生命周期中只调用一次 `connect()`
- 使用独立的 `Realm` 实例并设置 `subclass: true` 来管理多个连接

```js
// 错误：两次调用 connect
await connect({ models: [Post], database: 'db1' });
await connect({ models: [User], database: 'db2' }); // 报错！

// 正确：使用独立 Realm 实例
const realm1 = new Realm({ models: [Post], database: 'db1', subclass: true });
const realm2 = new Realm({ models: [User], database: 'db2', subclass: true });
await realm1.connect();
await realm2.connect();
```

### `Error: DriverClass must be a subclass of AbstractDriver`

这通常发生在直接使用 `BaseRealm` 而非完整的 `Realm` 类时，或者 `dialect` 选项没有匹配到可用的驱动。

**解决方案**：确保从 `leoric` 导入 `Realm`（而非 `BaseRealm`），并安装了正确的数据库客户端：

```bash
# MySQL
npm install mysql2

# PostgreSQL
npm install pg

# SQLite
npm install sqlite3
```

## 模型问题

### `Error: Model is not paranoid`

在未启用软删除的模型上调用 `restore()` 时出现此错误。

**解决方案**：为模型添加 `deletedAt` 属性。详见[软删除]({{ '/zh/soft-delete' | relative_url }})。

### 列名未映射到属性

默认情况下，Leoric 将 `snake_case` 列名映射为 `camelCase` 属性。如果你的列名不遵循此约定，使用 `name` 选项：

```ts
@Column({ name: 'gmt_create' })
createdAt: Date;
```

### `createdAt` / `updatedAt` 未自动更新

如果表中存在 `created_at` 和 `updated_at` 列，Leoric 会自动管理这些时间戳。确保你的表有这些列。

要在特定操作中禁止自动更新时间戳，传入 `{ silent: true }`：

```js
await post.update({ title: '已更新' }, { silent: true });
```

## 查询问题

### 软删除导致的意外结果

如果你看不到预期的记录，它们可能已被软删除。使用 `.unscoped` 包含所有记录：

```js
// 排除已软删除的记录
const posts = await Post.find();

// 包含所有记录
const allPosts = await Post.unscoped.find();
```

### N+1 查询问题

如果你在循环中加载关联，很可能遇到了 N+1 问题：

```js
// 差：N+1 查询
const posts = await Post.find();
for (const post of posts) {
  const comments = await Comment.find({ postId: post.id }); // N 次查询！
}

// 好：预加载
const posts = await Post.find().with('comments'); // 1 次 JOIN 查询
```

详见[最佳实践]({{ '/zh/best-practices' | relative_url }})。

## 调试

### 开启调试日志

Leoric 使用 `debug` 模块。通过以下方式开启 SQL 日志：

```bash
DEBUG=leoric node app.js
```

### 自定义日志

可以提供自定义日志器来查看所有查询：

```js
const realm = new Realm({
  logger: {
    logQuery(sql, duration) {
      console.log(`[${duration}ms] ${sql}`);
    },
    logQueryError(err, sql, duration) {
      console.error(`[${duration}ms] ${sql}\n  Error: ${err.message}`);
    },
    logMigration(name) {
      console.log(`Migration: ${name}`);
    },
  },
});
```

详见[日志]({{ '/zh/logging' | relative_url }})。

## TypeScript 问题

### `emitDecoratorMetadata` 错误

如果装饰器类型推断不工作，确保 `tsconfig.json` 中有：

```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

### `bigint` 类型错误

JavaScript 的 `bigint` 类型需要特殊处理：

```ts
// 正确：使用 bigint 类型
@Column({ primaryKey: true })
id: bigint;

// 创建时，bigint 字面量使用 'n' 后缀
const post = await Post.create({ title: '你好' });
console.log(typeof post.id); // 'bigint' 或 'number'，取决于值
```

## 迁移问题

### 表已存在

运行 `realm.sync()` 时，如果表已存在且需要更新：

```js
// 修改已有表（添加新列等）
await realm.sync({ alter: true });

// 警告：删除并重建（数据丢失！）
await realm.sync({ force: true });
```

### 迁移回滚

如果迁移中途失败，可能需要手动回滚：

```js
module.exports = {
  async up(driver, DataTypes) {
    // 前进迁移
  },
  async down(driver, DataTypes) {
    // 回滚迁移 - 确保完整
  },
};
```
