---
layout: default
---

Leoric is an object-relational mapping library for Node.js, with which you can manipulate database like this:

```js
const { Bone, connect } = require('@ali/leoric')

// define model
class Post extends Bone {
  static describe() {
    this.belongsTo('author', { Model: 'User' })
    this.hasMany('comments')
  }
}

async function() {
  // connect models to database
  await connect({ host: 'example.com', models: [Post], /* among other options */ })

  // CRUD
  await Post.create({ title: 'King Leoric' })
  const post = await Post.findOne({ title: 'King Leoric' })
  post.title = 'Skeleton King'
  await post.save()

  // or UPDATE directly
  await Post.update({ title: 'Skeleton King' }, { title: 'King Leoric' })

  // find with associations
  const postWithComments = await Post.findOne({ title: 'King Leoric' }).with('comments')
  console.log(post.comments) // => [ Comment { id, content }, ... ]
}
```

Leoric can be used as pure query builder too. Take the `Post` model above for another example:

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

Both predefined joins and arbitrary joins are supported:

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

For detailed informations, please check out following guides accordingly:

1. [Basics]({{ '/basics' | relative_url }})
2. [Associations]({{ '/associations' | relative_url }})
3. [Query Interfaces]({{ '/querying' | relative_url }})
