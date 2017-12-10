---
layout: default
---

Leoric 是一个 Node.js 的关系对象映射库（ORM），在 API 设计上比较接近 Ruby on Rails 的 Active Record。使用 Leoric 操作数据库的方式大致如下：

```js
const { Bone, connect } = require('leoric')

// 基于 Bone 定义模型，映射关系表
class Post extends Bone {
  static describe() {
    this.belongsTo('author', { Model: 'User' })
    this.hasMany('comments')
  }
}

async function() {
  // 连接模型到数据库，获取对应表结构信息
  await connect({ host: 'example.com', models: [Post], /* among other options */ })

  // CRUD
  await Post.create({ title: 'King Leoric' })
  const post = await Post.findOne({ title: 'King Leoric' })
  post.title = 'Skeleton King'
  await post.save()

  // 也可以批量更新
  await Post.update({ title: 'Skeleton King' }, { title: 'King Leoric' })

  // 获取模型中定义的关联数据
  const postWithComments = await Post.findOne({ title: 'King Leoric' }).with('comments')
  console.log(post.comments) // => [ Comment { id, content }, ... ]
}
```

也可以把 Leoric 当成一个纯粹的 SQL 构建工具。仍然以上面的 `Post` 模型为例：

```js
Post.find({ id: [1, 2, 3] })
// SELECT * FROM articles WHERE id IN (1, 2, 3);

Post.select('id, title').where('title like ?', '%Leoric%')
// SELECT id, title FROM articles WHERE title LIKE '%Leoric%';

Post.select('count(id) as count').group('authorId').having('count > 0').order('count', 'desc')
// SELECT count(id) AS count FROM articles GROUP BY author_id HAVING count > 0 ORDER BY count DESC;

Post.find({ id: TagMap.select('targetId').where({ tagId: 1 }) })
// SELECT * FROM articles WHERE id IN (SELECT target_id FROM tag_maps WHERE tag_id = 1);
```

Leoric 同时支持预定义 join 和在查询时任意 join：

```js
Post.find({}).with('author', 'comments')
// SELECT * FROM articles AS posts
//   LEFT JOIN users ON users.id = posts.author_id LEFT JOIN comments ON comments.post_id = articles.id;

Post.find({}).join(Attachment, 'attachments.postId = posts.id')
// SELECT * FROM articles AS posts LEFT JOIN attachments ON attachments.post_id = posts.id;

Post.find({})
  .join(TagMap, 'tagMaps.targetId = posts.id and tagMaps.targetType = ?', 0)
  .join(Tag, 'targetMaps.tagId = tags.id')
// SELECT * FROM articles AS posts
//   LEFT JOIN tag_maps AS tagMaps ON tagMaps.target_id = posts.id AND tag_maps.target_type = 0
//   LEFT JOIN tags ON tagMaps.tag_id = tags.id;
```

有关 Leoric 的详细信息，请依次阅读如下文档：

1. [基础]({{ '/zh/basics' | relative_url }})
2. [关联关系]({{ '/zh/associations' | relative_url }})
3. [查询接口]({{ '/zh/querying' | relative_url }})
