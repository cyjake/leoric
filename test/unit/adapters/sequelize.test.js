'use strict';

const assert = require('assert').strict;
const crypto = require('crypto');
const sinon = require('sinon');
const { Bone, connect, sequelize, DataTypes, raw } = require('../../..');
const { Hint } = require('../../../src/hint');
const { logger } = require('../../../src/utils');

const userAttributes = {
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

describe('=> Sequelize adapter', () => {
  const Spine = sequelize(Bone);

  class Book extends Spine {
    static get primaryKey() {
      return 'isbn';
    }

    set name(value) {
      this.setDataValue('name', value == 'Book of Eli' ? 'Book of Tyrael' : value);
    }

    get slug() {
      return this.getDataValue('name').replace(/[^a-z]/gi, '-').toLowerCase();
    }
  };

  class Post extends Spine {
    static get table() {
      return 'articles';
    }
  };

  before(async () => {
    await connect({
      Bone: Spine,
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

    const stub = sinon.stub(logger, 'warn').callsFake((tag, message) => {
        throw new Error(message);
      }
    );

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

    // empty id array should be NULL
    posts = await Post.findAll({
      where: {
        id: [],
      }
    });
    assert.equal(posts.length, 0);

    posts = await Post.findAll({
      order: 'createdAt desc, id desc',
      limit: 1,
    });
    assert.equal(posts.length, 1);
    assert.equal(posts[0].title, 'Tyrael');

    posts = await Post.findAll({
      order: ['createdAt desc', 'id desc'],
      limit: 1,
    });
    assert.equal(posts.length, 1);
    assert.equal(posts[0].title, 'Tyrael');

    posts = await Post.findAll({
      order: [['createdAt', 'desc'], ['id', 'desc']],
      limit: 1,
    });
    assert.equal(posts.length, 1);
    assert.equal(posts[0].title, 'Tyrael');

    stub.restore();
  });

  it('Model.findAll(opt) with { paranoid: false }', async () => {
    await Promise.all([
      { title: 'Leah', createdAt: new Date(Date.now() - 1000) },
      { title: 'Tyrael' },
    ].map(opts => Post.create(opts)));

    const stub = sinon.stub(logger, 'warn').callsFake((tag, message) => {
      throw new Error(message);
    });

    let posts = await Post.findAll({
      where: {
        title: { $like: '%ea%' },
      },
    });
    assert.equal(posts.length, 1);
    assert.equal(posts[0].title, 'Leah');

    await Post.destroy({ title: 'Leah' });
    const post = await Post.findOne({ where: { title: 'Leah' } });
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

    stub.restore();
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

  it('Mode.findAll({ order: [] })', async function() {
    await Promise.all([
      { title: 'Leah' },
      { title: 'Tyrael' },
    ].map(opts => Post.create(opts)));

    const posts = await Post.findAll({
      order: [ 'title', 'desc' ],
    });
    assert.equal(posts.length, 2);
    assert.equal(posts[0].title, 'Tyrael');
    assert.equal(posts[1].title, 'Leah');
  });

  it('Model.findAll({ order: <malformed> })', async () => {
    const posts = await Post.findAll({
      order: [ null ],
    });
    assert.equal(posts.length, 0);
  });

  describe('Model.findAll({ group })', () => {
    beforeEach(async () => {
      await Promise.all([
        { title: 'Leah' },
        { title: 'Leah' },
        { title: 'Tyrael' },
      ].map(opts => Post.create(opts)));
    });

    it('Model.findAll({ group: string })', async () => {
      let result = await Post.findAll({
        attributes: 'count(*) AS count',
        group: 'title',
        order: [[ 'title', 'desc' ]],
      });
      assert.deepEqual(result.toJSON(), [
        { title: 'Tyrael', count: 1 },
        { title: 'Leah', count: 2 },
      ]);
    });

    it('Model.findAll({ group: [] })', async () => {
      let result = await Post.findAll({
        attributes: 'count(*) AS count',
        group: [ 'title' ],
        order: [[ 'title', 'desc' ]],
      });
      assert.deepEqual(result.toJSON(), [
        { title: 'Tyrael', count: 1 },
        { title: 'Leah', count: 2 },
      ]);
    });
  });

  describe('Model.findAll({ having })', () => {
    beforeEach(async () => {
      await Promise.all([
        { title: 'Leah' },
        { title: 'Leah' },
        { title: 'Tyrael' },
      ].map(opts => Post.create(opts)));
    });

    it('Model.findAll({ having: string })', async () => {
      let result = await Post.findAll({
        attributes: 'count(*) AS count',
        group: 'title',
        order: [[ 'title', 'desc' ]],
        having: 'count(*) = 2'
      });
      assert.deepEqual(result.toJSON(), [
        { title: 'Leah', count: 2 },
      ]);
    });

    it('Model.findAll({ having: rawObject })', async () => {
      let result = await Post.findAll({
        attributes: 'count(*) AS count',
        group: 'title',
        order: [[ 'title', 'desc' ]],
        having: raw('count(*) = 2')
      });

      assert.deepEqual(result.toJSON(), [
        { title: 'Leah', count: 2 },
      ]);
    });
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

    // with limit
    const { rows: rows1, count: count1 } = await Post.findAndCountAll({
      where: {
        title: { $like: '%ea%' },
      },
      offset: 1,
      limit: 2,
    });

    assert.equal(rows1.length, 0);
    assert.equal(count1, 1);

    //ignore attributes

    const { rows: rows2, count: count2 } = await Post.findAndCountAll({
      where: {
        title: { $like: '%ea%' },
      },
      attributes: [ 'id' ],
    });

    assert.equal(rows2.length, 1);
    assert.equal(count2, 1);
    assert.deepEqual(Object.keys(rows2[0].getRaw()), [ 'id' ]);
  });

  it('Model.findAndCountAll(opt) with paranoid = false', async () => {
    await Promise.all([
      { title: 'Leah', createdAt: new Date(Date.now() - 1000) },
      { title: 'Tyrael' },
    ].map(opts => Post.create(opts)));
    await Post.destroy({ title: 'Leah' });
    const post = await Post.findOne({ where: { title: 'Leah' } });
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

    const post2 = await Post.findOne({ where: { title: 'Leah' } });
    assert.equal(post2.title, 'Leah');
  });

  it('Model.find()', async () => {
    const posts = await Promise.all([
      { title: 'Leah' },
      { title: 'Tyrael' },
    ].map(opts => Post.create(opts)));

    const post = await Post.find(posts[1].id);
    assert.equal(post.title, 'Tyrael');

    const post2 = await Post.find({ where: { title: 'Leah' } });
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
    assert.equal(post2.isNewRecord, false);
    assert(post2);

    const post3 = await Post.findOne({ where: { id }, paranoid: false });
    assert.equal(post3.title, 'Leah');
    assert.equal(post3.isNewRecord, false);
    await post3.destroy({ force: true });
    const post4 = await Post.findOne({ where: { id }, paranoid: false });
    assert(!post4);
  });

  it('Model.findByPk(pk)', async () => {
    const { id } = await Post.create({ title: 'Leah' });

    const post = await Post.findByPk(id);
    assert.equal(post.title, 'Leah');
    assert.equal(post.isNewRecord, false);
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

  it('Model.findOrBuild()', async function() {
    const { id } = await Post.create({ title: 'Leah' });
    const [ post, isNewRecord ] = await Post.findOrBuild({
      where: { title: 'Leah' },
    });
    assert.equal(post.id, id);
    assert.equal(isNewRecord, false);
  });

  it('Model.findOrBuild({ defaults })', async function() {
    const { id } = await Post.create({ title: 'Leah' });
    const [ post, isNewRecord ] = await Post.findOrBuild({
      where: { title: 'Tyrael' },
    });
    assert.notEqual(post.id, id);
    assert.equal(post.id, null);
    assert.equal(isNewRecord, true);
  });

  it('Model.findOrCreate()', async function() {
    const { id } = await Post.create({ title: 'Leah' });
    const [ post, isNewRecord ] = await Post.findOrCreate({
      where: { title: 'Leah' },
    });
    assert.equal(post.id, id);
    assert.equal(isNewRecord, false);
  });

  it('Model.findOrCreate({ defaults })', async function() {
    const { id } = await Post.create({ title: 'Leah' });
    const [ post, isNewRecord ] = await Post.findOrCreate({
      where: { title: 'Tyrael' },
      defaults: { content: 'I am Justice itself!' },
    });
    assert.notEqual(post.id, id);
    assert.notEqual(post.id, null);
    assert.equal(post.title, 'Tyrael');
    assert.equal(post.content, 'I am Justice itself!');
    assert.equal(isNewRecord, true);
    assert.equal(await Post.count(), 2);
  });

  it('Model.findCreateFind()', async function() {
    const result = await Promise.all([
      Post.create({ id: 1, title: 'Leah' }),
      Post.findCreateFind({
        where: { id: 1 },
        defaults: { id: 1, title: 'Tyrael' },
      }),
    ]);
    assert.equal(result[0].id, 1);
    assert.equal(result[1].id, 1);
    assert.equal(result[1].title, 'Leah');
  });

  it('Model.getTableName()', async function() {
    assert.equal(Post.getTableName(), 'articles');
    assert.equal(Book.getTableName(), 'books');
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
    const fakeDate = new Date(`2012-12-14 12:00:00`).getTime();
    const book = await Book.create({ isbn, name: 'Book of Cain', price: 10 });
    assert.notEqual(new Date(book.updatedAt).toString(), new Date(fakeDate).toString());
    const clock = sinon.useFakeTimers(fakeDate);
    await Book.increment('price', { where: { isbn } });
    await book.reload();
    assert.equal(book.price, 11);
    assert.equal(new Date(book.updatedAt).toString(), new Date(fakeDate).toString());

    await Book.increment({ price: 2 }, { where: { isbn } });
    await book.reload();
    assert.equal(book.price, 13);
    clock.restore();
  });

  it('Model.increment(, { paranoid })', async () => {
    const isbn = 9787550616950;
    const fakeDate = new Date(`2012-12-14 12:00:00`).getTime();
    const book = await Book.create({ isbn, name: 'Book of Cain', price: 10 });
    assert.notEqual(new Date(book.updatedAt).toString(), new Date(fakeDate).toString());
    const clock = sinon.useFakeTimers(fakeDate);
    await Book.increment('price', { where: { isbn } });
    await book.reload();
    assert.equal(book.price, 11);
    assert.equal(new Date(book.updatedAt).toString(), new Date(fakeDate).toString());
    clock.restore();

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

  it('Model.increment(, { silent })', async () => {
    const fakeDate = new Date(`2012-12-14 12:00-08:00`).getTime();
    const clock = sinon.useFakeTimers(fakeDate);
    const isbn = 9787550616950;
    const book = await Book.create({ isbn, name: 'Book of Cain', price: 10 });
    assert.equal(new Date(book.updatedAt).toString(), new Date(fakeDate).toString());
    clock.restore();
    await Book.increment('price', { where: { isbn }, silent: true });
    await book.reload();
    assert.equal(book.price, 11);
    console.log(new Date(book.updatedAt).toString(), new Date(fakeDate).toString());
    assert.equal(new Date(book.updatedAt).toString(), new Date(fakeDate).toString());
  });

  it('Model.removeAttribute()', async function() {
    const Model = sequelize(Bone);
    class User extends Model {};
    await connect({
      Bone: Model,
      models: [ User ],
      dialect: 'sqlite',
      database: '/tmp/leoric.sqlite3',
    });
    assert(User.attributes.birthday);
    User.removeAttribute('birthday');
    assert(User.attributes.birthday == null);
  });

  it('Model.restore()', async () => {
    const post = await Post.create({ title: 'By three they come' });
    await post.remove();
    assert.equal(await Post.first, null);
    assert(post.deletedAt);
    await Post.restore({ where: { title: 'By three they come' } });
    assert.ok(await Post.first);
  });

  it('Model.update(values, { paranoid })', async () => {
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

  it('Model.truncate()', async () => {
    await Promise.all([
      await Book.create({ name: 'Book of Tyrael', price: 20 }),
      await Book.create({ name: 'Book of Cain', price: 10 }),
    ]);
    assert.equal(await Book.count(), 2);

    await Book.truncate();
    assert.equal(await Book.count(), 0);
  });

  it('Model.Instance', async function() {
    // sequelize models use Model.Instance.prototype to extend instance methods
    assert.equal(Book.Instance, Book);
  });

  it('Model.rawAttributes', () => {
    // sequelize models export rawAttributes
    assert.equal(Book.rawAttributes, Book.attributes);
  });

  it('Model.describe()', async function() {
    const result = await Book.describe();
    assert(result.hasOwnProperty('isbn'));
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
    assert(post.deletedAt);
    await post.restore();
    assert.ok(await Post.first);
    assert(!post.deletedAt);
  });

  it('model.update()', async () => {
    const post = await Post.create({ title: 'By three they come', authorId: 1 });
    await post.update({ title: 'By three thy way opens' });
    let result = await Post.first;
    assert.equal(result.title, 'By three thy way opens');
    await post.update({ title: 'By three thy way opened', authorId: undefined });
    result = await Post.first;
    assert.equal(result.title, 'By three thy way opened');
    assert.equal(result.authorId, 1);
  });

  it('model.changed(key)', async () => {
    const post = await Post.create({ title: 'By three they come' });
    post.title = 'Hello there';
    assert.equal(post.changed('title'), true);
    await post.update();
    assert.equal(post.changed('title'), false);
    assert.equal(post.attributeChanged('title'), false);
    assert.equal(post.previous('title'), 'By three they come');
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

  it('model.update(values, { paranoid })', async () => {
    const post = await Post.create({ title: 'By three they come' });
    await post.update({ title: 'By three thy way opens' });
    const result = await Post.first;
    assert.equal(result.title, 'By three thy way opens');
    await post.destroy();
    await post.update({ title: 'By four thy way opens' });
    const result1 = await Post.findByPk(post.id, { paranoid: false });
    assert.equal(result1.title, 'By four thy way opens');

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

  it('model.isNewRecord', async () => {
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
    const book4 = await Book.findOne({ where: { name: 'Book New' }});
    assert.equal(book4.isNewRecord, false);
    const book5 = await Book.findOne({ where: { name: 'Book New' }, attributes: [ 'price' ]});
    assert(!book5.name);
    assert.equal(book5.isNewRecord, false);

  });

  it('instance.dataValues', async () => {
    const post = Post.instantiate({
      title: 'By three they come', content: 'content'
    });
    const dataValues = post.dataValues;
    assert(dataValues);
    assert(dataValues.title === 'By three they come');
  });

  it('instance.getDataValue(unset) should not throw error', async () => {
    const post = Post.instantiate({
      title: 'By three they come', content: 'content'
    });
    const extra = post.getDataValue('extra');
    assert(!extra);
  });

  it('instance.setDataValue', async () => {
    const book = await Book.create({ name: 'Book of Tyrael', price: 20 });
    book.setDataValue('name', 'Book1');
    assert(book.name === 'Book1');
    book.setDataValue('hello', 'hello');
    assert(book.hello === 'hello');
  });

  it('instance.get(name)', async function() {
    const book = await Book.create({ name: 'Book of Cain', price: 42 });
    // went through getter
    assert.equal(book.get('slug'), 'book-of-cain');
    assert.equal(book.getDataValue('name'), 'Book of Cain');
    assert.ok(book.getDataValue('slug') == null);
  });

  it('instance.get()', async function() {
    const book = await Book.create({ name: 'Book of Cain', price: 42 });
    const result = book.get();
    assert.equal(result.name, 'Book of Cain');
    assert.equal(result.price, 42);
  });

  it('instance.set(name)', async function() {
    const book = await Book.create({ name: 'Book of Cain', price: 42 });
    assert.equal(book.name, 'Book of Cain');
    book.set('name', 'Book of Eli');
    assert.equal(book.name, 'Book of Tyrael');
    book.setDataValue('name', 'Book of Eli');
    assert.equal(book.name, 'Book of Eli');
  });

  it('instance.isSoftDeleted()', async function() {
    const book = await Book.create({ name: 'Book of Cain', price: 42 });
    assert.equal(book.isSoftDeleted(), false);
    await book.destroy();
    assert.equal(book.isSoftDeleted(), true);
  });

  it('instance.where()', async function() {
    const book = await Book.create({ name: 'Book of Cain', price: 42 });
    assert(book.where());
  });

  it('instance.Model', async function() {
    const book = await Book.create({ name: 'Book of Tyrael', price: 20 });
    assert.equal(book.Model, Book);
    assert.equal(book.Model.name, 'Book');
  });

  it('instance.reload()', async function() {
    const [ , book ] = await Book.bulkCreate([
      { name: 'Book of Cain', price: 42 },
      { name: 'Book of Tyrael', price: 24 },
    ]);
    await Book.update({ name: 'Book of Justice' }, {
      where: { isbn: book.isbn },
    });
    assert.equal(book.name, 'Book of Tyrael');
    await book.reload();
    assert.equal(book.name, 'Book of Justice');
  });
});

describe('Model scope', () => {
  const Spine = sequelize(Bone);
  class Post extends Spine {
    static table = 'articles';
  };

  class User extends Spine {
    static table = 'users';
  };

  User.init(userAttributes, {
    defaultScope: {
      where: {
        status: 1,
      }
    },
    scopes: {
      gmail: {
        where: {
          email: {
            $like: '%gmail%'
          }
        }
      },
      custom: (order, limit, level) => {
        return {
          where: {
            level,
          },
          order,
          limit,
        };
      }
    }
  });

  class MyPost extends Post {};

  before(async () => {
    await connect({
      Bone: Spine,
      dialect: 'sqlite',
      database: '/tmp/leoric.sqlite3',
      models: [ Post, User ],
    });
  });

  beforeEach(async () => {
    await Post.remove({}, true);
  });

  after(() => {
    Bone.driver = null;
  });

  it('addScope({ where }) should work', () => {
    // object
    MyPost.addScope('NioH', {
      where: {
        type: 1
      }
    });

    assert.equal(
      MyPost.scope('NioH').where({ title: 'New Post' }).toString(),
      'SELECT * FROM "articles" WHERE "title" = \'New Post\' AND "type" = 1 AND "gmt_deleted" IS NULL'
    );
  });

  it('addScope({ where, order, limit }) should work', function() {
    MyPost.addScope('MHW', {
      where: {
        type: 1
      },
      order: 'id desc',
      limit: 1
    });
    assert.equal(
      MyPost.scope('MHW').where({ title: 'New Post' }).toString(),
      'SELECT * FROM "articles" WHERE "title" = \'New Post\' AND "type" = 1 AND "gmt_deleted" IS NULL ORDER BY "id" DESC LIMIT 1'
    );
  });

  it('addScope(function) should work', function() {
    MyPost.addScope('IceBorne', (type, limit) => ({
      where: {
        type
      },
      limit
    }));
    assert.equal(
      MyPost.scope('IceBorne', 2, 4).where({ title: 'New Post' }).toString(),
      'SELECT * FROM "articles" WHERE "title" = \'New Post\' AND "type" = 2 AND "gmt_deleted" IS NULL LIMIT 4'
    );
  });

  it('unscoped() should work', function() {
    assert.equal(
      MyPost.scope('MHW').unscoped().where({ title: 'New Post' }).toString(),
      'SELECT * FROM "articles" WHERE "title" = \'New Post\' AND "gmt_deleted" IS NULL'
    );
  });

  it('scope(function) should work', function() {
    // function should work
    const randNum = Math.floor(Math.random() * 100);
    assert.equal(
      MyPost.scope(() => {
        return {
          where: {
            type: randNum
          }
        };
      }).where({ title: 'New Post' }).toString(),
      `SELECT * FROM "articles" WHERE "title" = \'New Post\' AND "type" = ${randNum} AND "gmt_deleted" IS NULL`
    );

    assert.equal(
      MyPost.scope((type, order, limit) => {
        return {
          where: {
            type
          },
          order,
          limit
        };
      }, 1, 'title desc', 10).where({ title: 'New Post' }).toString(),
      'SELECT * FROM "articles" WHERE "title" = \'New Post\' AND "type" = 1 AND "gmt_deleted" IS NULL ORDER BY "title" DESC LIMIT 10'
    );
  });

  it('scope(object[]) should work', function() {
    // array should work
    const scopes = [{
      where: {
        id: 1,
      },
    }, {
      where: {
        author_id: 1
      }
    }];
    assert.equal(
      MyPost.scope(scopes).where({ title: 'New Post' }).toString(),
      'SELECT * FROM "articles" WHERE "title" = \'New Post\' AND "id" = 1 AND "author_id" = 1 AND "gmt_deleted" IS NULL'
    );
  });

  it('scope() should retain constructor name', function() {
    assert.equal(MyPost.scope('MHW').name, MyPost.name);
  });

  it('init should work', async () => {
    assert.equal(
      User.where({ nickname: 'OldHunter' }).toString(),
      'SELECT * FROM "users" WHERE "nickname" = \'OldHunter\' AND "status" = 1'
    );

    assert.equal(
      User.unscoped().where({ nickname: 'OldHunter' }).toString(),
      'SELECT * FROM "users" WHERE "nickname" = \'OldHunter\''
    );

    assert.equal(
      User.scope('gmail').where({ nickname: 'OldHunter' }).toString(),
      'SELECT * FROM "users" WHERE "nickname" = \'OldHunter\' AND "email" LIKE \'%gmail%\''
    );

    assert.equal(
      User.scope('custom', 'id asc', 2, 10).where({ nickname: 'OldHunter' }).toString(),
      'SELECT * FROM "users" WHERE "nickname" = \'OldHunter\' AND "level" = 10 ORDER BY "id" LIMIT 2'
    );
  });
});

describe('Model.init with getterMethods and setterMethods', () => {

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
  const email = 'shouldupdatemeta@leoric.com';

  class User extends Spine {
    get i () {
      return 's';
    }
  }
  User.init(userAttributes, {
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
      },
      email(value) {
        this.attribute('email', value);
        if (value === email) {
          this.meta.email = value;
        }
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
    const user = await User.create({ nickname: 'test', email: 'a@a.com', meta: { foo: 1, bar: 'baz'}, status: 1 });
    user.specDesc = 'hello';
    assert.equal(user.i, 's');
    assert.equal(user.desc, 'HELLO');
    assert.equal(user.specDesc, 'HELLO');
    assert.equal(user.NICKNAME, 'TEST');
    assert.equal(user.nickname, 'test');
    assert.equal(user.dataValues.nickname, 'test');
    const objStr = JSON.stringify(user);
    assert(objStr.includes('NICKNAME'));
    assert(!objStr.includes('dataValues'));

    const revertObj = JSON.parse(objStr);
    assert.equal(revertObj.NICKNAME, 'TEST');
    assert(!revertObj.dataValues);
    const json = user.toJSON();
    assert.equal(json.NICKNAME, 'TEST');
    assert(!json.dataValues);

    const obj = user.toObject();
    assert.equal(obj.NICKNAME, 'TEST');
    assert(!obj.dataValues);
  });

  it('should accept arbitrary properties', async () => {
    const user = await User.create({
      nickname: 'testy', email: 'a@a.com', meta: { foo: 1, bar: 'baz'}, status: 1, specDesc: 'hello'
    });
    assert.equal(user.desc, 'HELLO');
    assert.equal(user.specDesc, 'HELLO');
  });

  it('should update side effect field in custom setter', async () => {
    const user = await User.create({
      nickname: 'testy', email: 'a@a.com', meta: { foo: 1, bar: 'baz'}, status: 1, specDesc: 'hello'
    });
    await user.update({
      email,
    });
    await user.reload();
    assert(user.meta.email === email);
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
        status: 1,
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

describe('Model.find({ hint })', () => {
  const Spine = sequelize(Bone);

  class Post extends Spine {
    static get table() {
      return 'articles';
    }
  };

  before(async function() {
    await connect({
      Model: Spine,
      models: [ Post ],
      database: 'leoric',
      user: 'root',
      port: process.env.MYSQL_PORT,
    });
  });

  after(async () => {
    Bone.driver = null;
  });

  it('findOne', () => {
    assert.equal(
      Post.findOne({ where: { id: 1 }, hint: new Hint('SET_VAR(foreign_key_checks=OFF)') }).toString(),
      'SELECT /*+ SET_VAR(foreign_key_checks=OFF) */ * FROM `articles` WHERE `id` = 1 AND `gmt_deleted` IS NULL LIMIT 1'
    );
  });

  it('findByPk', () => {
    assert.equal(
      Post.findByPk(1, { hint: new Hint('SET_VAR(foreign_key_checks=OFF)') }).toString(),
      'SELECT /*+ SET_VAR(foreign_key_checks=OFF) */ * FROM `articles` WHERE `id` = 1 AND `gmt_deleted` IS NULL LIMIT 1'
    );
  });

  it('findAll', () => {
    assert.equal(
      Post.findAll({ where: { id: 1 }, hint: new Hint('SET_VAR(foreign_key_checks=OFF)') }).toString(),
      'SELECT /*+ SET_VAR(foreign_key_checks=OFF) */ * FROM `articles` WHERE `id` = 1 AND `gmt_deleted` IS NULL'
    );
  });
});

describe('Transaction', function() {
  const Spine = sequelize(Bone);

  class User extends Spine {
    static table = 'users'
  }

  before(async function() {
    await connect({
      Model: Spine,
      models: [ User ],
      database: 'leoric',
      user: 'root',
      port: process.env.MYSQL_PORT,
    });
  });

  it('should be able to manage transaction', async function() {
    await assert.rejects(async function() {
      await Spine.transaction(async function(transaction) {
        await User.create({
          email: 'justice@heaven.com',
          nickname: 'Tyrael',
          status: 1,
        }, { transaction });
        throw new Error('what could possibly go wrong?');
      });
    }, /go wrong/);
    assert.equal(await User.count(), 0);
  });
});
