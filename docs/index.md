---
layout: en
---

Leoric is an object-relational mapping library for Node.js, with which you can manipulate database like this:

```js
const { Bone, connect } = require('leoric')

// define model
class Post extends Bone {
  static describe() {
    this.belongsTo('author', { Model: 'User' })
    this.hasMany('comments')
  }
}

async function() {
  // connect models to database
  await connect({
    client: 'mysql',
    host: 'example.com', /* among other connection options */
    models: [Post]
  })

  // CRUD
  await Post.create({ title: 'New Post' })
  const post = await Post.findOne({ title: 'New Post' })
  post.title = 'Untitled'
  await post.save()

  // or UPDATE directly
  await Post.update({ title: 'Untitled' }, { title: 'New Post' })

  // find with associations
  await Post.include('comments').where('posts.title = ?', 'New Post')
  // => Post { id: 1, title: 'New Post', ...,
  //           comments: [ Comment { id, content }, ... ] }
}
```

本站点提供[中文版本]({{ '/zh' | relative_url }})，猛戳左边了解更多。

## Use in Web Frameworks

Leoric can be used in many web frameworkds from Node.js community. If you are developing with egg framework, it is highly recommended using the egg-orm plugin:

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
  models: 'app/model',
};
```

The models defined in `app/model` will be accessible from `ctx.model`, such as `ctx.model.User`:

```javascript
// app/controller/home.js
const { Controller } = require('egg');
module.exports = class HomeController extends Controller {
  async index() {
    const users = await ctx.model.User.find({
      corpId: ctx.model.Corp.findOne({ name: 'alipay' }),
    });
    ctx.body = users;
  }
};
```

## Syntax Table

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
       ON tagMaps.target_id = posts.id AND tagMaps.target_type = 0
LEFT JOIN tags
       ON tagMaps.tag_id = tags.id;
{% endhighlight %}
    </td>
  </tr>
</tbody>
</table>

## Guides

For detailed informations, please check out following guides accordingly:

1. [Basics]({{ '/basics' | relative_url }})
2. [Migrations]({{ '/migrations' | relative_url }})
3. [Validations]({{ '/validations' | relative_url }})
4. [Associations]({{ '/associations' | relative_url }})
5. [Query Interfaces]({{ '/querying' | relative_url }})
6. [Hooks]({{ '/hooks' | relative_url }})
7. [Sequelize Adapter]({{ '/sequelize' | relative_url }})

## Contributing

There are many ways in which you can participate in the project, for example:

- [Submit bugs and feature requests](https://github.com/cyjake/leoric/issues), and help us verify as they are checked in
- [Review source code changes](https://github.com/cyjake/leoric/pulls)
- Review the [documentation]({{ '/' | relative_url }}) and make pull requests for anything from typo to new content

If you are interested in fixing issues and contributing directly to the code base, please see the document [How to Contribute]({{ '/contributing/guides' | relative_url }}), which covers the following:

- The development workflow, including debugging and running tests
- Coding guidelines
- Submitting pull requests
- Contributing to translations

## Related Projects

If developing web applications with [egg framework](https://eggjs.org/), it's highly recommended using the [egg-orm](https://github.com/eggjs/egg-orm) plugin.

