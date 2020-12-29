'use strict';

const assert = require('assert').strict;
const { Bone, connect, sequelize} = require('../../..');

describe('=> Sequelize adapter', () => {
  const Spine = sequelize(Bone);

  class Book extends Spine {
    static get primaryKey() {
      return 'isbn';
    }

    set name(value) {
      this.attribute('name', value == 'Book of Eli' ? 'Book of Tyrael' : value);
    }
  };

  class Post extends Spine {
    static get table() {
      return 'articles';
    }
  };

  before(async () => {
    await connect({
      Model: Spine,
      dialect: 'sqlite',
      database: '/tmp/leoric.sqlite3',
      models: [ Book, Post ],
    });
  });

  beforeEach(async () => {
    await Book.remove({}, true);
    await Post.remove({}, true);
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

  it('Model.build(values, { raw })', async () => {
    let book = Book.build({ name: 'Book of Eli' });
    assert.ok(!book.id);
    assert.equal(book.name, 'Book of Tyrael');

    book = Book.build({ name: 'Book of Eli' }, { raw: true });
    assert.ok(!book.id);
    assert.equal(book.name, 'Book of Eli');
  });

  it('Model.bulkCreate()', async () => {
    const books = await Book.bulkCreate([
      { name: 'Rendezvous with Rama', price: 42 },
      { name: 'Excellent Sheep', price: 23 },
    ]);
    assert.equal(books.length, 2);
    assert.ok(books[0].isbn);
    assert.ok(books[1].isbn);
    assert.equal(books[0].name, 'Rendezvous with Rama');
    assert.equal(books[1].name, 'Excellent Sheep');
  });

  it('Model.count()', async () => {
    await Promise.all([
      Post.create({ title: 'By three they come' }),
      Post.create({ title: 'By three thy way opens' }),
    ]);
    assert.equal(await Post.count(), 2);
  });

  it('Model.count({ where })', async () => {
    await Promise.all([
      Post.create({ title: 'By three they come' }),
      Post.create({ title: 'By three thy way opens' }),
    ]);
    const result = await Post.count({
      where: { title: 'By three they come' },
    });
    assert.equal(result, 1);
  });

  it('Model.create()', async () => {
    const post = await Post.create({ title: 'By three they come' });
    assert.ok(post.id);
    assert.equal(post.title, 'By three they come');
  });

  it('Model.decrement()', async () => {
    const isbn = 9787550616950;
    const book = await Book.create({ isbn, name: 'Book of Cain', price: 10 });
    await Book.decrement('price', { where: { isbn } });
    await book.reload();
    assert.equal(book.price, 9);

    await Book.decrement({ price: 2 }, { where: { isbn } });
    await book.reload();
    assert.equal(book.price, 7);
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

  it('Model.findAll({ order })', async () => {
    await Promise.all([
      { title: 'Leah' },
      { title: 'Leah', createdAt: new Date(Date.now() - 1000) },
      { title: 'Tyrael' },
    ].map(opts => Post.create(opts)));

    const posts = await Post.findAll({
      order: [
        [ 'title', 'desc' ],
        [ 'createdAt', 'desc' ],
      ],
    });
    assert.equal(posts.length, 3);
    assert.equal(posts[0].title, 'Tyrael');
    assert.ok(posts[1].createdAt > posts[2].createdAt);
  });

  it('Model.findAll({ order }) malformed', async () => {
    const posts = await Post.findAll({
      order: [ null ],
    });
    assert.equal(posts.length, 0);
  });

  it('Model.findAll({ group })', async () => {
    await Promise.all([
      { title: 'Leah' },
      { title: 'Leah' },
      { title: 'Tyrael' },
    ].map(opts => Post.create(opts)));

    const result = await Post.findAll({
      attributes: 'count(*) AS count',
      group: 'title',
      order: [[ 'title', 'desc' ]],
    });
    assert.deepEqual(result, [
      { title: 'Tyrael', count: 1 },
      { title: 'Leah', count: 2 },
    ]);
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

  it('Model.findOne(id)', async () => {
    const { id } = await Post.create({ title: 'Leah' });

    const post = await Post.findOne();
    assert.equal(post.title, 'Leah');

    // if passed value, take the value as primary key
    assert.deepEqual((await Post.findOne(id)).toJSON(), post.toJSON());

    // if passed null or undefined, return null
    assert.equal(await Post.findOne(null), null);
    assert.equal(await Post.findOne(undefined), null);
  });

  it('Model.max(attribute)', async () => {
    await Promise.all([
      await Book.create({ name: 'Book of Tyrael', price: 20 }),
      await Book.create({ name: 'Book of Cain', price: 10 }),
    ]);
    assert.equal(await Book.max('price'), 20);
  });

  it('Model.max(attribute, { where })', async () => {
    await Promise.all([
      await Book.create({ name: 'Book of Tyrael', price: 20 }),
      await Book.create({ name: 'Book of Cain', price: 10 }),
    ]);
    const max = await Book.max('price', {
      where: { name: 'Book of Cain' },
    });
    assert.equal(max, 10);
  });

  it('Model.min(attribute)', async () => {
    await Promise.all([
      await Book.create({ name: 'Book of Tyrael', price: 20 }),
      await Book.create({ name: 'Book of Cain', price: 10 }),
    ]);
    assert.equal(await Book.min('price'), 10);
  });

  it('Model.min(attribute, { where })', async () => {
    await Promise.all([
      await Book.create({ name: 'Book of Tyrael', price: 20 }),
      await Book.create({ name: 'Book of Cain', price: 10 }),
    ]);
    const min = await Book.min('price', {
      where: { name: 'Book of Tyrael' },
    });
    assert.equal(min, 20);
  });

  it('Model.sum(attribute)', async () => {
    await Promise.all([
      await Book.create({ name: 'Book of Tyrael', price: 20 }),
      await Book.create({ name: 'Book of Cain', price: 10 }),
    ]);
    assert.equal(await Book.sum('price'), 30);
  });

  it('Model.sum(attribute, { where })', async () => {
    await Promise.all([
      await Book.create({ name: 'Book of Tyrael', price: 20 }),
      await Book.create({ name: 'Book of Cain', price: 10 }),
    ]);
    const sum = await Book.sum('price', {
      where: { name: 'Book of Cain' },
    });
    assert.equal(sum, 10);
  });

  it('Model.increment()', async () => {
    const isbn = 9787550616950;
    const book = await Book.create({ isbn, name: 'Book of Cain', price: 10 });
    await Book.increment('price', { where: { isbn } });
    await book.reload();
    assert.equal(book.price, 11);

    await Book.increment({ price: 2 }, { where: { isbn } });
    await book.reload();
    assert.equal(book.price, 13);
  });

  it('model.decrement()', async () => {
    const isbn = 9787550616950;
    const book = await Book.create({ isbn, name: 'Book of Cain', price: 10 });
    await book.decrement('price');
    await book.reload();
    assert.equal(book.price, 9);

    await book.decrement({ price: 2 });
    await book.reload();
    assert.equal(book.price, 7);
  });

  it('model.increment()', async () => {
    const isbn = 9787550616950;
    const book = await Book.create({ isbn, name: 'Book of Cain', price: 10 });
    await book.increment('price');
    await book.reload();
    assert.equal(book.price, 11);

    await book.increment({ price: 2 });
    await book.reload();
    assert.equal(book.price, 13);
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

  it('model.changed(key)', async () => {
    const post = await Post.create({ title: 'By three they come' });
    post.title = 'Hello there';
    assert.equal(post.changed('title'), true);
    await post.update();
    assert.equal(post.changed('title'), true);
    assert.equal(post.attributeChanged('title'), false);
    assert.equal(post.previous('title'), 'By three they come');
  });

  it('model.changed()', async () => {
    const post = await Post.create({ title: 'By three they come' });
    post.title = 'Hello there';
    assert.deepEqual(post.changed(), [ 'title' ]);
    post.content = 'a';
    assert.deepEqual(post.changed(), [ 'title', 'content' ]);
    await post.update();
    assert.deepEqual(post.changed(), [ 'title', 'content' ]);
  });

  it('model.isNewRecord', async() => {
    const book = await Book.create({ name: 'Book of Cain', price: 10 });
    assert.equal(book.isNewRecord, false);
    const book1 = Book.build({ name: 'Book New', price: 10 });
    assert.equal(book1.isNewRecord, true);
    await book1.save();
    assert.equal(book1.isNewRecord, false);
    const book2 = Book.build({ name: 'Book New', price: 10 });
    assert.equal(book2.isNewRecord, true);
    await book2.upsert();
    assert.equal(book2.isNewRecord, false);
  })
});
