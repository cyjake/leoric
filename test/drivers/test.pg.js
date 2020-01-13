'use strict';

const assert = require('assert').strict;
const path = require('path');

const { connect } = require('../..');

before(async function() {
  await connect({
    client: 'pg',
    host: '127.0.0.1',
    // user: 'root',
    database: 'leoric',
    models: path.resolve(__dirname, '../models')
  });
});

require('../suite');
require('../suite/dates');

describe('=> Date Functions', function() {
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
