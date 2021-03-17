---
layout: zh
---

Leoric 是一个 Node.js 的关系对象映射库（ORM）

## 基本功能

使用 Leoric 操作数据库的方式大致如下：

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
  await Post.create({ title: 'New Post' })
  const post = await Post.findOne({ title: 'New Post' })
  post.title = 'Untitled'
  await post.save()

  // 也可以批量更新
  await Post.update({ title: 'Untitled' }, { title: 'New Post' })

  // 获取模型中定义的关联数据
  await Post.include('comments').where('posts.title = ?', 'New Post')
  // => Post { id: 1, title: 'New Post', ...,
  //           comments: [ Comment { id, content }, ... ] }
}
```

推荐阅读[基本功能](./basics)一文了解更多有关模型声明和数据操作的介绍。除了基础功能，Leoric 还支持[表结构变更](./migrations)、[数据校验](./validations)、[钩子](./hooks)、[关联关系](./associations)、以及[高级查询](querying)。

## 在 Web 开发框架中使用

Leoric 支持在 Koa、Express、Egg 等 Node.js 社区常见的 Web 开发框架中使用，特别推荐 Egg 开发者使用 egg-orm 插件：

```javascript
/* config/plugin.js */
exports.orm = {
  enable: true,
  package: 'egg-orm',
};

/* config/config.default.js */
exports.orm = {
  client: 'mysql',
  database: 'temp',
  host: 'localhost',
};
```

通过 `ctx.orm` 使用 `app/model` 下定义的数据模型，例如 `ctx.orm.User`：

```javascript
// app/controller/home.js
const { Controller } = require('egg');
module.exports = class HomeController extends Controller {
  async index() {
    const users = await ctx.orm.User.find({
      corpId: ctx.orm.Corp.findOne({ name: 'alipay' }),
    });
    ctx.body = users;
  }
};
```

## 语法对照表

<table class="syntax-table">
<thead>
  <tr>
    <th>JavaScript</th>
    <th>SQL</th>
  </tr>
</thead>
<tbody>
  <tr>
    <td>
{% highlight js %}
Post.create({ title: 'New Post' })
{% endhighlight %}
    </td>
    <td>
{% highlight sql %}
INSERT INTO posts (title) VALUES ('New Post');
{% endhighlight %}
    </td>
  </tr>
  <tr>
    <td>
{% highlight js %}
Post.all
{% endhighlight %}
    </td>
    <td>
{% highlight sql %}
SELECT * FROM posts;
{% endhighlight %}
    </td>
  </tr>
  <tr>
    <td>
{% highlight js %}
Post.find({ title: 'New Post' })
{% endhighlight %}
    </td>
    <td>
{% highlight sql %}
SELECT * FROM posts WHERE title = 'New Post';
{% endhighlight %}
    </td>
  </tr>
  <tr>
    <td>
{% highlight js %}
Post.find(42)
{% endhighlight %}
    </td>
    <td>
{% highlight sql %}
SELECT * FROM posts WHERE id = 42;
{% endhighlight %}
    </td>
  </tr>
  <tr>
    <td>
{% highlight js %}
Post.order('title')
{% endhighlight %}
    </td>
    <td>
{% highlight sql %}
SELECT * FROM posts ORDER BY title;
{% endhighlight %}
    </td>
  </tr>
  <tr>
    <td>
{% highlight js %}
Post.order('title', 'desc')
{% endhighlight %}
    </td>
    <td>
{% highlight sql %}
SELECT * FROM posts ORDER BY title DESC;
{% endhighlight %}
    </td>
  </tr>
  <tr>
    <td>
{% highlight js %}
Post.limit(20)
{% endhighlight %}
    </td>
    <td>
{% highlight sql %}
SELECT * FROM posts LIMIT 0, 20;
{% endhighlight %}
    </td>
  </tr>
  <tr>
    <td>
{% highlight js %}
Post.update({ id: 42 }, { title: 'Untitled' })
{% endhighlight %}
    </td>
    <td>
{% highlight sql %}
UPDATE posts SET title = 'Untitled' WHERE id = 42;
{% endhighlight %}
     </td>
    </tr>
  <tr>
    <td>
{% highlight js %}
Post.remove({ id: 42 })
{% endhighlight %}
    </td>
    <td>
{% highlight sql %}
DELETE FROM posts WHERE id = 42;
{% endhighlight %}
    </td>
  </tr>
  <tr>
    <td>
{% highlight js %}
Post.find({ id: [1, 2, 3] })
{% endhighlight %}
    </td>
    <td>
{% highlight sql %}
SELECT * FROM posts WHERE id IN (1, 2, 3);
{% endhighlight %}
    </td>
  </tr>
  <tr>
    <td>
{% highlight js %}
Post.select('id, title').where('title like ?', '%Post%')
{% endhighlight %}
    </td>
    <td>
{% highlight sql %}
SELECT id, title FROM posts WHERE title LIKE '%Post%';
{% endhighlight %}
    </td>
  </tr>
  <tr>
    <td>
{% highlight js %}
Post.where('title like ? || authorId = ?',  '%Post%', 42)
{% endhighlight %}
    </td>
    <td>
{% highlight sql %}
SELECT * FROM posts WHERE title LIKE '%Post%' OR author_id = 42;
{% endhighlight %}
    </td>
  </tr>
  <tr>
    <td>
{% highlight js %}
Post
  .select('count(id) as count')
  .group('authorId')
  .having('count > 0')
  .order('count', 'desc')
{% endhighlight %}
    </td>
    <td>
{% highlight sql %}
  SELECT count(id) AS count, author_id
    FROM posts
GROUP BY author_id
  HAVING count > 0
ORDER BY count DESC;
{% endhighlight %}
    </td>
  </tr>
  <tr>
    <td>
{% highlight js %}
Book.average('price').group('genre').having('average > 50')
{% endhighlight %}
    </td>
    <td>
{% highlight sql %}
  SELECT AVG('price') AS average, genre
    FROM books
GROUP BY genre
  HAVING average > 50;
{% endhighlight %}
    </td>
  </tr>
  <tr>
  <td>
{% highlight js %}
Post.find({
  id: TagMap.select('targetId').where({ tagId: 1 }),
})
{% endhighlight %}
    </td>
    <td>
{% highlight sql %}
SELECT *
  FROM posts
 WHERE id
    IN (SELECT target_id FROM tag_maps WHERE tag_id = 1);
{% endhighlight %}
    </td>
  </tr>
  <tr>
    <td>
{% highlight js %}
Post.include('author', 'comments')
{% endhighlight %}
    </td>
    <td>
{% highlight sql %}
   SELECT *
     FROM posts AS posts
LEFT JOIN users ON users.id = posts.author_id
LEFT JOIN comments ON comments.post_id = posts.id;
{% endhighlight %}
    </td>
  </tr>
  <tr>
    <td>
{% highlight js %}
Post.join(Attachment, 'attachments.postId = posts.id')
{% endhighlight %}
    </td>
    <td>
{% highlight sql %}
   SELECT *
     FROM posts AS posts
LEFT JOIN attachments ON attachments.post_id = posts.id;
{% endhighlight %}
    </td>
  </tr>
  <tr>
    <td>
{% highlight js %}
Post
  .join(TagMap,
    'tagMaps.targetId = posts.id and tagMaps.targetType = 0')
  .join(Tag, 'targetMaps.tagId = tags.id')
{% endhighlight %}
    </td>
    <td>
{% highlight sql %}
   SELECT *
     FROM posts AS posts
LEFT JOIN tag_maps AS tagMaps
       ON tagMaps.target_id = posts.id AND tag_maps.target_type = 0
LEFT JOIN tags
       ON tagMaps.tag_id = tags.id;
{% endhighlight %}
    </td>
  </tr>
</tbody>
</table>

## 上手指南

推荐依次阅读如下文档了解有关 Leoric 的详细信息

1. [基础]({{ '/zh/basics' | relative_url }})
2. [表结构变更]({{ '/zh/migrations' | relative_url }})
3. [校验]({{ '/zh/validations' | relative_url }})
4. [关联关系]({{ '/zh/associations' | relative_url }})
5. [查询接口]({{ '/zh/querying' | relative_url }})
6. [钩子]({{ '/zh/hooks'}})
7. [Sequelize 适配器]({{ '/zh/sequelize' | relative_url }})
