'use strict';

const assert = require('assert').strict;
const { Bone } = require('../../..');
const sequelize = require('../../../lib/adapters/sequelize');
const Book = sequelize(require('../../models/book'));
const Post = sequelize(require('../../models/post'));
const { checkDefinitions } = require('../helpers');

describe('=> Sequelize Adapter', () => {
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

  it('Model.drop()', async () => {
    const { INTEGER, STRING } = Bone;
    const Temp = Bone.define('Temp', {
      id: INTEGER,
      foo: STRING,
    }, { tableName: 'temp' });

    // let schemaInfo = await Temp.driver.querySchemaInfo('leoric', [ Temp.table ]);
    // Temp.init(schemaInfo[Temp.table]);  // manual connect
    // await Temp.sync();
    // assert.ok('id' in Temp.schema);
    // assert.ok('foo' in Temp.schema);

    await Temp.drop();
    await checkDefinitions('temp', null);
  });

  it('Model.findAll()', async () => {

  });
});
