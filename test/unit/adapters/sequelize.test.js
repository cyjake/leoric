'use strict';

const assert = require('assert').strict;
const crypto = require('crypto');
const { it } = require('mocha');
const { Bone, connect, sequelize, DataTypes } = require('../../..');

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

  after(() => {
    Bone.driver = null;
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

  it('Model.aggregate(attribute, aggregateFunction, { paranoid: false })', async () => {
    const books = await Promise.all([
      await Book.create({ name: 'Book of Tyrael', price: 20 }),
      await Book.create({ name: 'Book of Cain', price: 10 }),
      await Book.create({ name: 'Book of Cain', price: 30 }),
    ]);

    const count = await Book.aggregate('*', 'count', {
      where: {
        price: { $gt: 10 },
      },
    });
    assert.equal(count, 2);
    await books[2].destroy();
    const count1 = await Book.aggregate('*', 'count', {
      where: {
        price: { $gt: 10 },
      },
    });
    assert.equal(count1, 1);
    const count2 = await Book.aggregate('*', 'count', {
      where: {
        price: { $gt: 10 },
      },
      paranoid: false,
    });
    assert.equal(count2, 2);
    await books[2].destroy({ force: true });
    const count3 = await Book.aggregate('*', 'count', {
      where: {
        price: { $gt: 10 },
      },
      paranoid: false,
    });
    assert.equal(count3, 1);
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

  it('Model.count({ paranoid: false })', async () => {
    await Promise.all([
      Post.create({ title: 'By three they come' }),
      Post.create({ title: 'By three thy way opens' }),
    ]);
    assert.equal(await Post.count(), 2);
    await Post.destroy({ where: { title: 'By three they come' } });
    assert.equal(await Post.count(), 1);
    assert.equal(await Post.count({ paranoid: false }), 2);
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


  it('Model.count({ where, paranoid: false })', async () => {
    const books = await Promise.all([
      Post.create({ title: 'By three they come' }),
      Post.create({ title: 'By three thy way opens' }),
    ]);
    const result = await Post.count({
      where: { title: 'By three they come' },
    });
    assert.equal(result, 1);
    await books[0].destroy();
    const result1 = await Post.count({
      where: { title: 'By three they come' },
    });
    assert.equal(result1, 0);
    const result2 = await Post.count({
      where: { title: 'By three they come' },
      paranoid: false,
    });
    assert.equal(result2, 1);

    await books[0].destroy({ force: true });
    const result3 = await Post.count({
      where: { title: 'By three they come' },
      paranoid: false,
    });
    assert.equal(result3, 0);
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

  it('Model.findAll(opt) with { paranoid: false }', async () => {
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

    await Post.destroy({ title: 'Leah' });
    const post = await Post.findOne({ title: 'Leah' });
    assert(!post);

    posts = await Post.findAll({
      order: [[ 'createdAt', 'desc' ]],
      paranoid: false,
    });
    assert.equal(posts.length, 2);
    assert.equal(posts[0].title, 'Tyrael');
    assert.equal(posts[1].title, 'Leah');

    posts = await Post.findAll({
      order: [[ 'createdAt', 'desc' ]],
      offset: 1,
      limit: 2,
      paranoid: false
    });
    assert.equal(posts.length, 1);
    assert.equal(posts[0].title, 'Leah');

    posts = await Post.findAll({
      order: [[ 'createdAt', 'desc' ]],
      limit: 1,
      paranoid: false,
    });
    assert.equal(posts.length, 1);
    assert.equal(posts[0].title, 'Tyrael');

    posts = await Post.findAll({
      attributes: [ 'title' ],
      where: { title: 'Leah' },
      paranoid: false,
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

  it('Model.findAndCountAll(opt) with paranoid = false', async () => {
    await Promise.all([
      { title: 'Leah', createdAt: new Date(Date.now() - 1000) },
      { title: 'Tyrael' },
    ].map(opts => Post.create(opts)));
    await Post.destroy({ title: 'Leah' });
    const post = await Post.findOne({ title: 'Leah' });
    assert(!post);
    const post1 = await Post.findOne({ where: { title: 'Leah' }, paranoid: false });
    assert.equal(post1.title, 'Leah');

    const { rows, count } = await Post.findAndCountAll({
      where: {
        title: { $like: '%ea%' },
      },
      paranoid: false,
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

  it('Model.findOne(id) with paranoid = false', async () => {
    const { id } = await Post.create({ title: 'Leah' });

    const post = await Post.findOne();
    assert.equal(post.title, 'Leah');
    await post.remove();
    const post1 = await Post.findOne();
    assert(!post1);
    const post2 = await Post.findOne({ paranoid: false });
    assert(post2);

    const post3 = await Post.findOne({ where: { id }, paranoid: false });
    assert.equal(post3.title, 'Leah');
    await post3.destroy({ force: true });
    const post4 = await Post.findOne({ where: { id }, paranoid: false });
    assert(!post4);
  });

  it('Model.findByPk(pk)', async () => {
    const { id } = await Post.create({ title: 'Leah' });

    const post = await Post.findByPk(id);
    assert.equal(post.title, 'Leah');
  });

  it('Model.findByPk(pk, { paranoid: false })', async () => {
    const { id } = await Post.create({ title: 'Leah' });

    const post = await Post.findByPk(id);
    assert.equal(post.title, 'Leah');

    await post.remove();
    const post1 = await Post.findByPk(id);
    assert(!post1);

    const post2 = await Post.findByPk(id, { paranoid: false });
    assert.equal(post2.title, 'Leah');
    await post2.destroy({ force: true });
    const post3 = await Post.findOne({ where: { id }, paranoid: false });
    assert(!post3);
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

  it('Model.max(attribute, { paranoid })', async () => {
    const books = await Promise.all([
      await Book.create({ name: 'Book of Tyrael', price: 20 }),
      await Book.create({ name: 'Book of Cain', price: 10 }),
    ]);
    assert.equal(await Book.max('price'), 20);
    await books[0].destroy();
    assert.equal(await Book.max('price'), 10);
    assert.equal(await Book.max('price', { paranoid: false }), 20);
    await books[0].destroy({ force: true });
    assert.equal(await Book.max('price', { paranoid: false }), 10);
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

  it('Model.max(attribute, { paranoid })', async () => {
    const books = await Promise.all([
      await Book.create({ name: 'Book of Tyrael', price: 20 }),
      await Book.create({ name: 'Book of Cain', price: 10 }),
    ]);
    assert.equal(await Book.min('price'), 10);
    await books[1].destroy();
    assert.equal(await Book.min('price'), 20);
    assert.equal(await Book.min('price', { paranoid: false }), 10);
    await books[1].destroy({ force: true });
    assert.equal(await Book.min('price', { paranoid: false }), 20);
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

  it('Model.sum(attribute, { paranoid })', async () => {
    const books = await Promise.all([
      await Book.create({ name: 'Book of Tyrael', price: 20 }),
      await Book.create({ name: 'Book of Cain', price: 10 }),
    ]);
    assert.equal(await Book.sum('price'), 30);
    await books[0].destroy();
    assert.equal(await Book.sum('price'), 10);
    assert.equal(await Book.sum('price', { paranoid: false }), 30);

    await books[0].destroy({ force: true });
    assert.equal(await Book.sum('price', { paranoid: false }), 10);

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

  it('Model.increment(, { paranoid })', async () => {
    const isbn = 9787550616950;
    const book = await Book.create({ isbn, name: 'Book of Cain', price: 10 });
    await Book.increment('price', { where: { isbn } });
    await book.reload();
    assert.equal(book.price, 11);

    await Book.increment({ price: 2 }, { where: { isbn } });
    await book.reload();
    assert.equal(book.price, 13);

    await book.destroy();
    await Book.increment({ price: 2 }, { where: { isbn } });
    await book.reload();
    assert.equal(book.price, 13);
    await Book.increment({ price: 2 }, { where: { isbn }, paranoid: false });
    await book.reload();
    assert.equal(book.price, 15);

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

  it('model.increment(, { paranoid })', async () => {
    const isbn = 9787550616950;
    const book = await Book.create({ isbn, name: 'Book of Cain', price: 10 });
    await book.increment('price');
    await book.reload();
    assert.equal(book.price, 11);

    await book.increment({ price: 2 });
    await book.reload();
    assert.equal(book.price, 13);
    await book.destroy();
    await book.increment({ price: 2 });
    await book.reload();
    assert.equal(book.price, 13);
    await book.increment({ price: 2 }, { paranoid: false });
    await book.reload();
    assert.equal(book.price, 15);
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

  it('model.previous(key)', async () => {
    const post = await Post.create({ title: 'By three they come' });
    post.title = 'Hello there';
    assert.equal(post.previous('title'), 'By three they come');
    await post.update();
    assert.equal(post.previous('title'), 'By three they come');
  });

  it('model.previous()', async () => {
    const post = await Post.create({ title: 'By three they come' });
    post.title = 'Hello there';
    assert.deepEqual(post.previous(), { title: 'By three they come', id: post.id, updatedAt: post.updatedAt, createdAt: post.createdAt });
    post.content = 'a';
    assert.deepEqual(post.previous(), { title: 'By three they come', id: post.id, updatedAt: post.updatedAt, createdAt: post.createdAt });
    const prevUpdatedAt = post.updatedAt;
    await post.update();
    assert.deepEqual(post.previous(), { title: 'By three they come', id: post.id, updatedAt: prevUpdatedAt, createdAt: post.createdAt });
  });

  it('model.update(, { paranoid })', async () => {
    const post = await Post.create({ title: 'By three they come' });
    await post.update({ title: 'By three thy way opens' });
    const result = await Post.first;
    assert.equal(result.title, 'By three thy way opens');
    await post.destroy();
    await post.update({ title: 'By four thy way opens' });
    const result1 = await Post.findByPk(post.id, { paranoid: false });
    assert.equal(result1.title, 'By four thy way opens');
  });

  it('Model.update(, { paranoid })', async () => {
    const post = await Post.create({ title: 'By three they come' });
    await Post.update({ title: 'By three thy way opens' }, { where: { title: 'By three they come' }});
    const result = await Post.first;
    assert.equal(result.title, 'By three thy way opens');
    await post.destroy();
    const res = await Post.update({ title: 'By four thy way opens' }, { where: { title: 'By three thy way opens' }, paranoid: true });
    assert.equal(res, 0);
    const post1 = await Post.findByPk(post.id, { paranoid: false });
    assert.equal(post1.title, 'By three thy way opens');
    const res1 = await Post.update({ title: 'By four thy way opens' }, { where: { title: 'By three thy way opens' }});
    assert.equal(res1, 1);
    const post2 = await Post.findByPk(post.id, { paranoid: false });
    assert.equal(post2.title, 'By four thy way opens');
  });

  it('model.changed(key)', async () => {
    const post = await Post.create({ title: 'By three they come' });
    post.title = 'Hello there';
    assert.equal(post.changed('title'), true);
    assert.equal(post.previousChanged('title'), true);
    await post.update();
    assert.equal(post.changed('title'), false);
    assert.equal(post.previousChanged('title'), true);
    assert.equal(post.previous('title'), 'By three they come');
  });

  it('model.changed()', async () => {
    const post = await Post.create({ title: 'By three they come', content: 'ssss' });
    post.title = 'Hello there';
    assert.deepEqual(post.changed(), [ 'title' ]);
    post.content = 'a';
    assert.deepEqual(post.changed(), [ 'title', 'content' ]);
    await post.update();
    assert.deepEqual(post.previousChanged().sort(), [ 'title', 'content', 'updatedAt' ].sort());
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
    const book3 = Book.build({ name: 'Book of Outland', }, { isNewRecord: false });
    assert.equal(book3.isNewRecord, false);
  });
});

describe('model.init with getterMethods and setterMethods', () => {
  const attributes = {
    id: DataTypes.BIGINT,
    gmt_create: DataTypes.DATE,
    gmt_deleted: DataTypes.DATE,
    email: {
      type: DataTypes.STRING(256),
      allowNull: false,
      unique: true,
    },
    nickname: {
      type: DataTypes.STRING(256),
      allowNull: false,
    },
    meta: {
      type: DataTypes.JSON,
    },
    status: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    desc: {
      type: DataTypes.STRING,
    },
    fingerprint: {
      type: DataTypes.TEXT,
    },
  };

  const algorithm = 'aes-256-ctr';
  const password = '12Tvzr3p67VC61jMw54rIHu1545x4Tlx';
  const iv = 'iceiceiceiceicei';

  function encrypt(text){
    if (!text) return null;
    const cipher = crypto.createCipheriv(algorithm, password, iv);
    let crypted = cipher.update(text,'utf8','hex');
    crypted += cipher.final('hex');
    return crypted;
  }

  function decrypt(text){
    if (!text) return null;
    const decipher = crypto.createCipheriv(algorithm, password, iv);
    let dec = decipher.update(text,'hex','utf8');
    dec += decipher.final('utf8');
    return dec;
  }

  const Spine = sequelize(Bone);

  class User extends Spine {

    get i () {
      return 's';
    }
  }
  User.init(attributes, {
    getterMethods: {
      nickname() {
        return this.getDataValue('nickname');
      },
      NICKNAME() {
        return this.nickname.toUpperCase();
      },
      specDesc() {
        return this.desc;
      },
      fingerprint() {
        return decrypt(this.getDataValue('fingerprint'));
      }
    },
    setterMethods: {
      specDesc(value) {
        if (value) this.setDataValue('desc', value.toUpperCase());
      },
      nickname(value) {
        if (value === 'Zeus') {
          this.attribute('nickname', 'V');
        } else {
          this.attribute('nickname', value);
        }
      },
      fingerprint(value) {
        this.attribute('fingerprint', encrypt(value));
      }
    }
  });

  before(async () => {
    await connect({
      Model: Spine,
      dialect: 'sqlite',
      database: '/tmp/leoric.sqlite3',
      models: [ User ],
    });
  });

  beforeEach(async () => {
    await User.remove({}, true);
  });

  after(() => {
    Bone.driver = null;
  });

  it('should work', async () => {
    const user = await User.create({ nickname: 'testy', email: 'a@a.com', meta: { foo: 1, bar: 'baz'}, status: 1 });
    user.specDesc = 'hello';
    assert.equal(user.desc, 'HELLO');
    assert.equal(user.specDesc, 'HELLO');
    assert.equal(user.NICKNAME, 'TESTY');
    assert.equal(user.nickname, 'testy');
    await user.update({ nickname: 'Zeus' });
    assert.equal(user.nickname, 'V');
  });

  it('should work with custom en/decrypt setter getter', async () => {
    const user = await User.create({ nickname: 'Old Hunter', email: 'oh@hunter.com', fingerprint: 'Monster Hunter World' });
    assert.equal(user.fingerprint, 'Monster Hunter World');
    assert.equal(user.getRaw('fingerprint'), encrypt('Monster Hunter World'));
    await user.update({ fingerprint: 'Bloodborne' });
    assert.equal(user.fingerprint, 'Bloodborne');
    assert.equal(user.getRaw('fingerprint'), encrypt('Bloodborne'));
  });

  it('toJSON and toObject should work', async () => {
    const user = await User.create({ nickname: 'testy', email: 'a@a.com', meta: { foo: 1, bar: 'baz'}, status: 1 });
    user.specDesc = 'hello';
    assert.equal(user.i, 's');
    assert.equal(user.desc, 'HELLO');
    assert.equal(user.specDesc, 'HELLO');
    assert.equal(user.NICKNAME, 'TESTY');
    assert.equal(user.nickname, 'testy');
    const objStr = JSON.stringify(user);
    assert(objStr.includes('NICKNAME'));
    const revertObj = JSON.parse(objStr);
    assert.equal(revertObj.NICKNAME, 'TESTY');
    const json = user.toJSON();
    assert.equal(json.NICKNAME, 'TESTY');
    const obj = user.toObject();
    assert.equal(obj.NICKNAME, 'TESTY');

    // multiple implement
    class CustomUser extends User {
      get j () {
        return 'j';
      }
    }

    const customUser = await CustomUser.create({ nickname: 'testy', email: 'a@a1.com', meta: { foo: 1, bar: 'baz'}, status: 1, desc: 'sssssq11' });
    const json1 = customUser.toJSON();
    assert.equal(json1.NICKNAME, 'TESTY');
    assert.equal(json1.desc, customUser.desc);
    assert.equal(json1.specDesc, customUser.desc);
    assert.equal(json1.j, customUser.j);
    assert.equal(json1.i, customUser.i);
    const obj1 = customUser.toObject();
    assert.equal(obj1.NICKNAME, 'TESTY');
    assert.equal(obj1.desc, customUser.desc);
    assert.equal(obj1.specDesc, customUser.desc);
    assert.equal(obj1.j, customUser.j);
    assert.equal(obj1.i, customUser.i);

  });

  it('should accept arbitrary properties', async () => {
    const user = await User.create({
      nickname: 'testy', email: 'a@a.com', meta: { foo: 1, bar: 'baz'}, status: 1, specDesc: 'hello'
    });
    assert.equal(user.desc, 'HELLO');
    assert.equal(user.specDesc, 'HELLO');
  });

});

describe('validator should work', () => {
  const Spine = sequelize(Bone);

  const attributes = {
    id: DataTypes.BIGINT,
    gmt_create: DataTypes.DATE,
    gmt_deleted: DataTypes.DATE,
    email: {
      type: DataTypes.STRING(256),
      allowNull: false,
      unique: true,
    },
    nickname: {
      type: DataTypes.STRING(256),
      allowNull: false,
    },
    status: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    fingerprint: {
      type: DataTypes.TEXT,
      validate: {
        contains: 'finger',
      }
    },
    level: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
      validate: {
        max: 10,
        min: 1,
      }
    }
  };

  class User extends Spine {}
  User.init(attributes);


  before(async function() {
    await connect({
      Model: Spine,
      models: [ User ],
      database: 'leoric',
      user: 'root',
      port: process.env.MYSQL_PORT,
    });
  });

  afterEach(async () => {
    await User.remove({}, true);
  });

  after(async () => {
    Bone.driver = null;
  });

  describe('build', () => {
    it('build should work', async () => {
      await assert.rejects(async () => {
        User.build({
          email: 'a@e.com',
          nickname: 'sss',
          fingerprint: 'aaa'
        });
      }, /Validation contains on fingerprint failed/);
    });

    it('build skip validate should work', async () => {
      const user = User.build({
        email: 'a@e.com',
        nickname: 'sss',
        fingerprint: 'aaa',
      }, { validate: false });
      assert(user);
      assert(user.email);
      assert(user.nickname);
      assert(user.fingerprint);
    });


    it('build validate should work', async () => {
      const user = User.build({
        email: 'a@e.com',
        nickname: 'sss',
      });
      assert(user);
      assert(user.email);
      assert(user.nickname);

      await user.save();
      assert(user.id);
      assert(user.email);
      assert(user.nickname);
    });
  });

  describe('decrement(instance only)', () => {
    it('decrement should work', async () => {
      const user = await User.create({
        email: 'a@e.com',
        nickname: 'sss',
        level: 1,
      });

      await assert.rejects(async () => {
        await user.decrement([ 'level' ]);
      }, /Validation min on level failed/);

      await assert.rejects(async () => {
        await user.decrement('level');
      }, /Validation min on level failed/);

      await assert.rejects(async () => {
        await user.decrement({ level: 10 });
      }, /Validation min on level failed/);
    });

    it('decrement skip validate should work', async () => {
      const user = await User.create({
        email: 'a@e.com',
        nickname: 'sss',
        level: 1,
      });

      await user.decrement([ 'level' ], { validate: false });

      assert(user.level, 0);
    });
  });

  describe('increment(instance only)', () => {
    it('increment should work', async () => {
      const user = await User.create({
        email: 'a@e.com',
        nickname: 'sss',
        level: 10,
      });

      await assert.rejects(async () => {
        await user.increment([ 'level' ]);
      }, /Validation max on level failed/);

      await assert.rejects(async () => {
        await user.increment('level');
      }, /Validation max on level failed/);

      await assert.rejects(async () => {
        await user.increment({ level: 10 });
      }, /Validation max on level failed/);

    });

    it('increment skip validate should work', async () => {
      const user = await User.create({
        email: 'a@e.com',
        nickname: 'sss',
        level: 10,
      });

      await user.increment([ 'level' ], { validate: false });

      assert(user.level, 11);
    });
  });

  describe('update', () => {
    it('update(instance) should work', async () => {
      const user = await User.create({
        email: 'a@e.com',
        nickname: 'sss',
        level: 10,
      });

      await assert.rejects(async () => {
        await user.update({ level: 11 });
      }, /Validation max on level failed/);
    });

    it('update(instance) skip validate should work', async () => {
      const user = await User.create({
        email: 'a@e.com',
        nickname: 'sss',
        level: 10,
      });

      await user.update({ level: 11 }, { validate: false });
      await user.reload();
      assert.equal(user.level, 11);
      await user.update({ level: 12 }, { validate: false, fields: [ 'status' ] });
      await user.reload();
      assert.equal(user.level, 11);
      // defaultValue
      assert.equal(user.status, 1);
      await user.update({ status: 0 }, { validate: false, fields: [ 'status' ] });
      await user.reload();
      assert.equal(user.status, 0);
    });

    it('update(class) should work', async () => {
      await User.create({
        email: 'a@e.com',
        nickname: 'sss',
        level: 10,
      });

      await assert.rejects(async () => {
        await User.update({ level: 11 }, { where: { email: 'a@e.com' } });
      }, /Validation max on level failed/);
    });

    it('update(class) skip validate should work', async () => {
      const user = await User.create({
        email: 'a@e.com',
        nickname: 'sss',
        level: 10,
      });

      await User.update({ level: 11 }, { where: { email: 'a@e.com' }, validate: false });
      await user.reload();
      assert.equal(user.level, 11);
    });
  });

  describe('upsert', () => {
    it('should work', async () => {
      await User.create({
        email: 'a@e.com',
        nickname: 'sss',
        level: 10,
      });

      await assert.rejects(async () => {
        await User.upsert({
          email: 'a@e.com',
          nickname: 'sss',
          level: 11,
        });
      }, /Validation max on level failed/);

    });

    it('skip validate should work', async () => {
      const user = await User.create({
        email: 'a@e.com',
        nickname: 'sss',
        level: 10,
      });

      await User.upsert({
        email: 'a@e.com',
        nickname: 'sss',
        level: 11,
      }, { validate: false });

      assert(user);

      const users = await User.findAll();
      assert.equal(users.length, 1);
      assert.equal(users[0].id, user.id);
      await user.reload();
      assert.equal(users[0].level, user.level);
    });
  });
});
