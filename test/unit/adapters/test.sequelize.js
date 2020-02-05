'use strict';

const assert = require('assert').strict;
const { Bone, connect, sequelize} = require('../../..');

describe('=> Sequelize adapter', () => {
  const Spine = sequelize(Bone);
  class Book extends Spine {};
  class Post extends Spine {
    static get table() {
      return 'articles';
    }
  };

  before(async () => {
    await connect({
      Model: Spine,
      client: 'sqlite',
      database: '/tmp/leoric.sqlite3',
      models: [ Book, Post ],
    });
  });

  beforeEach(async () => {
    await Book.remove({});
    await Post.remove({});
  });

  it('Model.aggregate()', async () => {
    await Promise.all([
      await Book.create({ name: 'Book of Tyrael', price: 20 }),
      await Book.create({ name: 'Book of Cain', price: 10 }),
    ]);

    const count = await Book.aggregate('*', 'count');
    assert.equal(count, 2);

    const average = await Book.aggregate('price', 'average');
    assert.equal(Math.round(average), 15);

    const minimum = await Book.aggregate('price', 'minimum');
    assert.equal(Math.round(minimum), 10);
  });

  it('Model.aggregate(attribute, aggregateFunction, { where })', async () => {
    await Promise.all([
      await Book.create({ name: 'Book of Tyrael', price: 20 }),
      await Book.create({ name: 'Book of Cain', price: 10 }),
    ]);

    const count = await Book.aggregate('*', 'count', {
      where: {
        price: { $gt: 10 },
      },
    });
    assert.equal(count, 1);
  });

  it('Model.build()', async () => {
    const book = Book.build({ name: 'Book of Cain', price: 10 });
    assert.ok(!book.id);
    assert.equal(book.name, 'Book of Cain');
    assert.equal(book.price, 10);
    assert.equal(book.createdAt, null);
  });

  it('Model.bulkCreate()', async () => {

  });

  it('Model.count()', async () => {
    await Promise.all([
      Post.create({ title: 'By three they come' }),
      Post.create({ title: 'By three thy way opens' }),
    ]);
    assert.equal(await Post.count(), 2);
  });

  it('Model.create()', async () => {
    const post = await Post.create({ title: 'By three they come' });
    assert.ok(post.id);
    assert.equal(post.title, 'By three they come');
  });

  it('Model.decrement()', async () => {

  });

  it('Model.describe()', async () => {

  });

  it('Model.destroy()', async () => {
    await Promise.all([
      Post.create({ title: 'By three they come' }),
      Post.create({ title: 'By three thy way opens' }),
    ]);
    const rowCount = await Post.destroy();
    assert.equal(rowCount, 2);
  });

  it('Model.findAll()', async () => {
    await Promise.all([
      { title: 'Leah', createdAt: new Date(Date.now() - 1000) },
      { title: 'Tyrael' },
    ].map(opts => Post.create(opts)));

    let posts = await Post.findAll({
      where: {
        title: { $like: '%ea%' },
      },
    });
    assert.equal(posts.length, 1);
    assert.equal(posts[0].title, 'Leah');

    posts = await Post.findAll({
      order: [[ 'createdAt', 'desc' ]],
    });
    assert.equal(posts.length, 2);
    assert.equal(posts[0].title, 'Tyrael');
    assert.equal(posts[1].title, 'Leah');

    posts = await Post.findAll({
      order: [[ 'createdAt', 'desc' ]],
      offset: 1,
      limit: 2,
    });
    assert.equal(posts.length, 1);
    assert.equal(posts[0].title, 'Leah');

    posts = await Post.findAll({
      order: [[ 'createdAt', 'desc' ]],
      limit: 1,
    });
    assert.equal(posts.length, 1);
    assert.equal(posts[0].title, 'Tyrael');

    posts = await Post.findAll({
      attributes: [ 'title' ],
      where: { title: 'Leah' },
    });
    assert.equal(posts.length, 1);
    assert.equal(posts[0].title, 'Leah');
    assert.throws(() => posts[0].content);
  });

  it('Model.findAndCountAll()', async () => {
    await Promise.all([
      { title: 'Leah', createdAt: new Date(Date.now() - 1000) },
      { title: 'Tyrael' },
    ].map(opts => Post.create(opts)));

    const { rows, count } = await Post.findAndCountAll({
      where: {
        title: { $like: '%ea%' },
      },
    });
    assert.equal(rows.length, 1);
    assert.equal(count, 1);
  });

  it('Model.findOne()', async () => {
    const posts = await Promise.all([
      { title: 'Leah' },
      { title: 'Tyrael' },
    ].map(opts => Post.create(opts)));

    const post = await Post.findOne(posts[1].id);
    assert.equal(post.title, 'Tyrael');

    const post2 = await Post.findOne({ title: 'Leah' });
    assert.equal(post2.title, 'Leah');
  });

  it('model.restore()', async () => {
    const post = await Post.create({ title: 'By three they come' });
    await post.remove();
    assert.equal(await Post.first, null);
    await post.restore();
    assert.ok(await Post.first);
  });

  it('model.update()', async () => {
    const post = await Post.create({ title: 'By three they come' });
    await post.update({ title: 'By three thy way opens' });
    const result = await Post.first;
    assert.equal(result.title, 'By three thy way opens');
  });
});
