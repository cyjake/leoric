# Leoric

[![Package Quality](https://packagequality.com/shield/leoric.svg)](https://packagequality.com/#?package=leoric)
[![NPM Downloads](https://img.shields.io/npm/dm/leoric.svg?style=flat)](https://www.npmjs.com/package/leoric)
[![NPM Version](http://img.shields.io/npm/v/leoric.svg?style=flat)](https://www.npmjs.com/package/leoric)
[![Build Status](https://github.com/cyjake/leoric/actions/workflows/nodejs.yml/badge.svg)](https://github.com/cyjake/leoric/actions/workflows/nodejs.yml)
[![codecov](https://codecov.io/gh/cyjake/leoric/branch/master/graph/badge.svg?token=OZZWTZTDS1)](https://codecov.io/gh/cyjake/leoric)

Leoric is an object-relational mapping for Node.js, which is heavily influenced by Active Record of Ruby on Rails. See the [documentation](https://leoric.js.org) for detail.

## Usage

Assume the tables of posts, users, and comments were setup already. We may declare the models as classes by extending from the base class `Bone` of Leoric. After the models are connected to the database, the columns of the tables are mapped as attributes, the associations are setup, feel free to start querying.

```js
const { Bone, connect } = require('leoric')

// define model
class Post extends Bone {
  static initialize() {
    this.belongsTo('author', { Model: 'User' })
    this.hasMany('comments')
  }
}

async function main() {
  // connect models to database
  await connect({ host: 'example.com', models: [ Post ], /* among other options */ })

  // CRUD
  await Post.create({ title: 'New Post' })
  const post = await Post.findOne({ title: 'New Post' })
  post.title = 'Untitled'
  await post.save()

  // or UPDATE directly
  await Post.update({ title: 'Untitled' }, { title: 'New Post' })

  // find with associations
  const post = await Post.findOne({ title: 'New Post' }).with('comments')
  console.log(post.comments) // => [ Comment { id, content }, ... ]
}
```

If table structures were intended to be maintained in the models, Leoric can be used as a table migration tool as well. We can just define attributes in the models, and call `realm.sync()` whenever we are ready.

```js
const { BIGINT, STRING } = Bone.DataTypes;
class Post extends Bone {
  static attributes = {
    id: { type: BIGINT, primaryKey: true },
    email: { type: STRING, allowNull: false },
    nickname: { type: STRING, allowNull: false },
  }
}

const realm = new Realm({ models: [ Post ] });
await realm.sync();
```

## Syntax Table

| JavaScript                              | SQL                                                |
|-----------------------------------------|----------------------------------------------------|
| `Post.create({ title: 'New Post' })`    | `INSERT INTO posts (title) VALUES ('New Post')`    |
| `Post.all`                              | `SELECT * FROM posts`                              |
| `Post.find({ title: 'New Post' })`      | `SELECT * FROM posts WHERE title = 'New Post'`     |
| `Post.find(42)`                         | `SELECT * FROM posts WHERE id = 42`                |
| `Post.order('title')`                   | `SELECT * FROM posts ORDER BY title`               |
| `Post.order('title', 'desc')`           | `SELECT * FROM posts ORDER BY title DESC`          |
| `Post.limit(20)`                        | `SELECT * FROM posts LIMIT 0, 20`                  |
| `Post.update({ id: 42 }, { title: 'Skeleton King' })` | `UPDATE posts SET title = 'Skeleton King' WHERE id = 42` |
| `Post.remove({ id: 42 })`               | `DELETE FROM posts WHERE id = 42`                  |

A more detailed syntax table may be found at the [documentation](https://leoric.js.org/#syntax-table) site.

## TypeScript charged

```ts
import { Bone, BelongsTo, Column, DataTypes: { TEXT } } from 'leoric';
import User from './user';

export default class Post extends Bone {
  @Column({ autoIncrement: true })
  id: bigint;

  @Column(TEXT)
  content: string;

  @Column()
  description: string;

  @Column()
  userId: bigint;

  @BelongsTo()
  user: User;
}
```

More about TypeScript integration examples can be found at [the TypeScript support documentation](https://leoric.js.org/types)

## Contributing

There are many ways in which you can participate in the project, for example:

- [Submit bugs and feature requests](https://github.com/cyjake/leoric/issues), and help us verify as they are checked in
- [Review source code changes](https://github.com/cyjake/leoric/pulls)
- Review the [documentation](https://leoric.js.org) and make pull requests for anything from typo to new content

If you are interested in fixing issues and contributing directly to the code base, please see the document [How to Contribute](https://leoric.js.org/contributing/guides), which covers the following:

- The development workflow, including debugging and running tests
- Coding guidelines
- Submitting pull requests
- Contributing to translations

## egg-orm

If developing web applications with [egg framework](https://eggjs.org/), it's highly recommended using the [egg-orm](https://github.com/eggjs/egg-orm) plugin. More detailed examples about setting up egg-orm with egg framework in either JavaScript or TypeScript can be found at <https://github.com/eggjs/egg-orm/tree/master/examples>
