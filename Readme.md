# Leoric

[![NPM Downloads](https://img.shields.io/npm/dm/oceanify.svg?style=flat)](https://www.npmjs.com/package/leoric)
[![NPM Version](http://img.shields.io/npm/v/leoric.svg?style=flat)](https://www.npmjs.com/package/leoric)
[![Build Status](https://travis-ci.org/cyjake/leoric.svg)](https://travis-ci.org/cyjake/leoric)
[![Coverage Status](https://coveralls.io/repos/github/cyjake/leoric/badge.svg?branch=master)](https://coveralls.io/github/cyjake/leoric?branch=master)

Leoric is an object-relational mapping for Node.js, which is heavily influenced by Active Record of Ruby on Rails. See the [documentation](http://cyj.me/leoric) for detail.

## Requirements

Currently, Leoric only supports MySQL (and variants such as MariaDB) database.

## Usage

Assume the tables of posts, users, and comments were setup already. We may declare the models as classes extended from the base class `Bone` of Leoric. After the models are connected to the database using `connect`, the columns of the tables are mapped as attributes, the associations are setup, feel free to start querying.

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
  await connect({ host: 'example.com', models: [Post], /* among other options */ })

  // CRUD
  await Post.create({ title: 'New Post' })
  const post = await Post.findOne({ title: 'New Post' })
  post.title = 'Untitled'
  await post.save()

  // or UPDATE directly
  await Post.update({ title: 'Untitled' }, { title: 'New Post' })

  // find with associations
  const postWithComments = await Post.findOne({ title: 'New Post' }).with('comments')
  console.log(post.comments) // => [ Comment { id, content }, ... ]
}
```

## Syntax Table

| JavaScript                              | SQL                                                |
|-----------------------------------------|----------------------------------------------------|
| `Post.create({ title: 'New Post' })` | `INSERT INTO posts (title) VALUES ('New Post')` |
| `Post.all`                              | `SELECT * FROM posts`                              |
| `Post.find({ title: 'New Post' })`   | `SELECT * FROM posts WHERE title = 'New Post'`  |
| `Post.find(42)`                         | `SELECT * FROM posts WHERE id = 42`                |
| `Post.order('title')`                   | `SELECT * FROM posts ORDER BY title`               |
| `Post.order('title', 'desc')`           | `SELECT * FROM posts ORDER BY title DESC`          |
| `Post.limit(20)`                        | `SELECT * FROM posts LIMIT 0, 20`                  |
| `Post.update({ id: 42 }, { title: 'Skeleton King' })` | `UPDATE posts SET title = 'Skeleton King' WHERE id = 42` |
| `Post.remove({ id: 42 })`               | `DELETE FROM posts WHERE id = 42`                  |

A more detailed syntax table may be found at the [documentation](http://cyj.me/leoric/#syntax-table) site.

## Migrations

Currently, Leoric doesn't provide a way to do database migrations. There are two popular approaches:

- A separated migration DSL and database metadata, like Active Record.
- A detailed enumeration of attributes and types in the models, like Django.

There is a third way, which is the very reason Leoric has yet to implement migrations, that the database can be designed through a third-party service. It can be an ER designer, a GUI software for MySQL, or a MySQL-compliant database in the cloud.

But I'm sure we'll get to that.
