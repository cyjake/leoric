---
layout: zh
title: 最佳实践
---

## 目录
{:.no_toc}

1. 目录
{:toc}

## 避免 N+1 查询问题

当你加载一组记录，然后为每条记录的关联分别发起查询时，就会产生 N+1 查询问题。

### 问题

```js
// 差：1 次查询文章 + N 次查询评论
const posts = await Post.find({ authorId: 1 });
for (const post of posts) {
  post.comments = await Comment.find({ postId: post.id });
}
```

### 解决方案：预加载

使用 `.with()` 或 `.include()` 在单次查询中加载关联：

```js
// 好：1 次 JOIN 查询
const posts = await Post.find({ authorId: 1 }).with('comments');
for (const post of posts) {
  console.log(post.comments); // 已加载
}
```

可以同时加载多个关联：

```js
const posts = await Post.find().with('author', 'comments');
```

## 只查询需要的列

默认情况下，Leoric 会查询所有列（`SELECT *`）。当只需要特定列时，使用 `.select()`：

```js
// 差：加载所有列，包括大文本字段
const posts = await Post.find();

// 好：只加载需要的
const posts = await Post.find().select('id', 'title', 'createdAt');
```

对于有大 `TEXT` 或 `BLOB` 列的表尤其重要。

## 大表的批量处理

处理大表时，避免一次性加载所有记录到内存。使用分页：

```js
// 差：全部加载到内存
const allPosts = await Post.find();

// 好：分批处理
const pageSize = 100;
let offset = 0;
while (true) {
  const posts = await Post.find().limit(pageSize).offset(offset);
  if (posts.length === 0) break;

  for (const post of posts) {
    // 处理每条记录
  }
  offset += pageSize;
}
```

## 连接池管理

### 配置空闲超时

对于长时间运行的应用，配置空闲超时以防止过期连接：

```js
const realm = new Realm({
  host: 'localhost',
  database: 'my_app',
  idleTimeout: 30000, // 30 秒
});
```

### 关闭时断开连接

应用关闭时务必断开连接：

```js
process.on('SIGTERM', async () => {
  await realm.disconnect();
  process.exit(0);
});
```

## 事务最佳实践

### 保持事务简短

```js
// 差：事务内调用外部 API 会长时间占用连接
await Bone.transaction(async ({ connection }) => {
  const user = await User.create({ name: 'Alice' }, { connection });
  const result = await fetch('https://api.example.com/notify'); // 慢！
  await AuditLog.create({ action: 'user_created' }, { connection });
});

// 好：将外部调用移到事务之外
const user = await Bone.transaction(async ({ connection }) => {
  const user = await User.create({ name: 'Alice' }, { connection });
  await AuditLog.create({ action: 'user_created' }, { connection });
  return user;
});
await fetch('https://api.example.com/notify');
```

### 使用生成器函数简化代码

```js
// 生成器函数自动传递 connection
await Bone.transaction(function* () {
  const user = yield User.create({ name: 'Alice' });
  yield AuditLog.create({ action: 'user_created', userId: user.id });
});
```

## 索引策略

### 为常见查询模式使用复合索引

如果你经常使用多条件查询：

```js
// 如果这是常见的查询模式：
Post.find({ authorId: 1, status: 'published' }).order('createdAt', 'desc')
```

考虑添加复合索引：`(author_id, status, created_at)`。

### 需要时使用索引提示

当查询优化器做出次优选择时：

```js
Post.find({ authorId: 1 }).forceIndex('idx_author_created')
```

详见[索引提示]({{ '/zh/index-hints' | relative_url }})。

## 模型组织

### 使用目录方式加载模型

```js
const realm = new Realm({
  models: 'app/models',  // 自动从目录加载所有模型
});
```

### 在 `initialize()` 中定义关联

```js
class Post extends Bone {
  static initialize() {
    this.belongsTo('author', { Model: 'User' });
    this.hasMany('comments');
    this.hasMany('tags', { through: 'tagMaps' });
  }
}
```

### 尽可能使用 TypeScript 装饰器

```ts
class Post extends Bone {
  @Column({ primaryKey: true })
  id: bigint;

  @BelongsTo()
  author: User;

  @HasMany()
  comments: Comment[];
}
```

## 安全

### 永远不要在原始 SQL 中使用用户输入

```js
// 差：SQL 注入漏洞
await realm.query(`SELECT * FROM posts WHERE title = '${userInput}'`);

// 好：参数化查询
await realm.query('SELECT * FROM posts WHERE title = ?', [userInput]);

// 好：使用 ORM 查询接口
await Post.find({ title: userInput });
```

### 谨慎使用 `raw()`

`raw()` 函数绕过转义。只用于 SQL 函数和表达式，绝不用于用户提供的值：

```js
// 好：SQL 函数
await Post.update({ id: 1 }, { viewCount: raw('view_count + 1') });

// 差：在 raw() 中使用用户输入
await Post.find({ title: raw(userInput) }); // SQL 注入！
```
