'use strict';

const assert = require('assert').strict;
const path = require('path');

const { connect } = require('../..');

before(async function() {
  await connect({
    host: 'localhost',
    port: process.env.MYSQL_PORT,
    user: 'root',
    database: 'leoric',
    models: path.resolve(__dirname, '../models')
  });
});

require('./suite/index.test');
require('./suite/dates.test');

describe('=> Date functions (mysql)', function() {
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
    const result = await Post.select('MONTH(createdAt)')
      .group('MONTH(createdAt)')
      .count()
      .order({ count: 'desc' });

    assert.deepEqual(result, [
      { count: 2, 'MONTH(`gmt_create`)': 5 },
      { count: 1, 'MONTH(`gmt_create`)': 11 }
    ]);
  });
});
