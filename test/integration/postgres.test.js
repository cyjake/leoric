'use strict';

const assert = require('assert').strict;
const path = require('path');

const { connect, raw } = require('../..');

before(async function() {
  await connect({
    dialect: 'postgres',
    host: process.env.POSTGRES_HOST || '127.0.0.1',
    port: process.env.POSTGRES_PORT,
    user: process.env.POSTGRES_USER || '',
    database: 'leoric',
    models: path.resolve(__dirname, '../models'),
  });
});

require('./suite/index.test');
require('./suite/dates.test');

describe('=> Date functions (postgres)', function() {
  const Post = require('../models/post');

  before(async function() {
    await Promise.all([
      Post.create({ title: 'New Post', createdAt: new Date(2012, 4, 15) }),
      Post.create({ title: 'Archbishop Lazarus', createdAt: new Date(2012, 4, 15) }),
      Post.create({ title: 'Leah', createdAt: new Date(2017, 10, 11) })
    ]);
  });

  after(async function() {
    await Post.remove({}, true);
  });

  it('GROUP BY MONTH(date)', async function() {
    const result = await Post.select('MONTH(createdAt')
      .group('MONTH(createdAt)')
      .count()
      .order('count', 'desc');
    assert.deepEqual(result, [
      { count: 2, 'date_part': 5 },
      { count: 1, 'date_part': 11 }
    ]);
  });
});


describe('=> upsert', function () {
  const Post = require('../models/post');

  it('upsert', function() {
    assert.equal(
      new Post({ id: 1, title: 'New Post', createdAt: raw('CURRENT_TIMESTAMP()'), updatedAt: raw('CURRENT_TIMESTAMP()') }).upsert().toString(),
      'INSERT INTO "articles" ("id", "title", "gmt_modified") VALUES (1, \'New Post\', CURRENT_TIMESTAMP()) ON CONFLICT ("id") DO UPDATE SET "id"=EXCLUDED."id", "title"=EXCLUDED."title", "gmt_modified"=EXCLUDED."gmt_modified" RETURNING "id"'
    );
  });

  it('upsert returning multiple columns', function() {
    assert.equal(
      new Post({ id: 1, title: 'New Post', createdAt: raw('CURRENT_TIMESTAMP()'), updatedAt: raw('CURRENT_TIMESTAMP()') }).upsert({ returning: [ 'id', 'title' ] }).toString(),
      'INSERT INTO "articles" ("id", "title", "gmt_modified") VALUES (1, \'New Post\', CURRENT_TIMESTAMP()) ON CONFLICT ("id") DO UPDATE SET "id"=EXCLUDED."id", "title"=EXCLUDED."title", "gmt_modified"=EXCLUDED."gmt_modified" RETURNING "id", "title"'
    );
  });
});
