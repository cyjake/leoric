'use strict';

const assert = require('assert').strict;
const path = require('path');
const sinon = require('sinon');

const { connect, raw } = require('../..');

before(async function() {
  await connect({
    dialect: 'postgres',
    host: process.env.POSTGRES_HOST || '127.0.0.1',
    port: process.env.POSTGRES_PORT,
    user: process.env.POSTGRES_USER || '',
    password: process.env.POSTGRES_PASSWORD || '',
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
    const result = await Post.select('MONTH(createdAt) AS month')
      .group('MONTH(createdAt) AS month')
      .count()
      .order('count', 'desc');
    // PostgreSQL v14 returns string instead
    for (const entry of result) entry.month = parseInt(entry.month);
    assert.deepEqual(result.toJSON(), [
      { count: 2, month: 5 },
      { count: 1, month: 11 },
    ]);
  });
});


describe('=> upsert', function () {
  const Post = require('../models/post');

  it('upsert', function() {
    assert.equal(
      new Post({ id: 1, title: 'New Post', createdAt: raw('CURRENT_TIMESTAMP()'), updatedAt: raw('CURRENT_TIMESTAMP()') }).upsert().toString(),
      `INSERT INTO "articles" ("id", "title", "is_private", "word_count", "gmt_create", "gmt_modified") VALUES (1, 'New Post', false, 0, CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP()) ON CONFLICT ("id") DO UPDATE SET "id"=EXCLUDED."id", "title"=EXCLUDED."title", "is_private"=EXCLUDED."is_private", "word_count"=EXCLUDED."word_count", "gmt_modified"=EXCLUDED."gmt_modified" RETURNING "id"`
    );
    const date = new Date(2017, 11, 12);
    const fakeDate = date.getTime();
    sinon.useFakeTimers(fakeDate);
    assert.equal(
      new Post({ id: 1, title: 'New Post', createdAt: date, updatedAt: date }).upsert().toString(),
      `INSERT INTO "articles" ("id", "title", "is_private", "word_count", "gmt_create", "gmt_modified") VALUES (1, 'New Post', false, 0, '2017-12-12 00:00:00.000', '2017-12-12 00:00:00.000') ON CONFLICT ("id") DO UPDATE SET "id"=EXCLUDED."id", "title"=EXCLUDED."title", "is_private"=EXCLUDED."is_private", "word_count"=EXCLUDED."word_count", "gmt_modified"=EXCLUDED."gmt_modified" RETURNING "id"`
    );
    assert.equal(
      new Post({ title: 'New Post', createdAt: date, updatedAt: date }).upsert().toString(),
      `INSERT INTO "articles" ("title", "is_private", "word_count", "gmt_create", "gmt_modified") VALUES ('New Post', false, 0, '2017-12-12 00:00:00.000', '2017-12-12 00:00:00.000') ON CONFLICT ("id") DO UPDATE SET "title"=EXCLUDED."title", "is_private"=EXCLUDED."is_private", "word_count"=EXCLUDED."word_count", "gmt_modified"=EXCLUDED."gmt_modified" RETURNING "id"`
    );
    // default set createdAt
    assert.equal(
      new Post({ id: 1, title: 'New Post' }).upsert().toString(),
      `INSERT INTO "articles" ("id", "title", "is_private", "word_count", "gmt_create", "gmt_modified") VALUES (1, 'New Post', false, 0, '2017-12-12 00:00:00.000', '2017-12-12 00:00:00.000') ON CONFLICT ("id") DO UPDATE SET "id"=EXCLUDED."id", "title"=EXCLUDED."title", "is_private"=EXCLUDED."is_private", "word_count"=EXCLUDED."word_count", "gmt_modified"=EXCLUDED."gmt_modified" RETURNING "id"`
    );

    assert.equal(
      Post.upsert({ title: 'New Post' }).toSqlString(),
      `INSERT INTO "articles" ("title", "is_private", "word_count", "gmt_create", "gmt_modified") VALUES ('New Post', false, 0, '2017-12-12 00:00:00.000', '2017-12-12 00:00:00.000') ON CONFLICT ("id") DO UPDATE SET "title"=EXCLUDED."title", "is_private"=EXCLUDED."is_private", "word_count"=EXCLUDED."word_count", "gmt_modified"=EXCLUDED."gmt_modified" RETURNING "id"`
    );

  });

  it('upsert returning multiple columns', function() {
    assert.equal(
      new Post({ id: 1, title: 'New Post', createdAt: raw('CURRENT_TIMESTAMP()'), updatedAt: raw('CURRENT_TIMESTAMP()') }).upsert({ returning: [ 'id', 'title' ] }).toString(),
      `INSERT INTO "articles" ("id", "title", "is_private", "word_count", "gmt_create", "gmt_modified") VALUES (1, 'New Post', false, 0, CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP()) ON CONFLICT ("id") DO UPDATE SET "id"=EXCLUDED."id", "title"=EXCLUDED."title", "is_private"=EXCLUDED."is_private", "word_count"=EXCLUDED."word_count", "gmt_modified"=EXCLUDED."gmt_modified" RETURNING "id", "title"`
    );
  });
});
