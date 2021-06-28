'use strict';

const assert = require('assert').strict;
const path = require('path');
const strftime = require('strftime');

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

describe('=> Data types (mysql)', function() {
  const Post = require('../models/post');
  const User = require('../models/user');

  afterEach(async function() {
    await Post.truncate();
    await User.truncate();
  });

  it('MEDIUMTEXT', async function() {
    assert.ok(Post.attributes.hasOwnProperty('summary'));
    const post = await Post.create({
      title: 'By three they come',
      summary: 'By three thy way opens',
    });
    assert.ok(post);
    assert.equal(post.summary, 'By three thy way opens');
  });

  it('MEDIUMINT', async function() {
    assert.ok(Post.attributes.hasOwnProperty('wordCount'));
    const post = await Post.create({
      title: 'By three they come',
      wordCount: 10,
    });
    assert.ok(post);
    assert.equal(post.wordCount, 10);
  });

  it('DATE', async function() {
    assert.ok(User.attributes.hasOwnProperty('sex'));
    const user = await User.create({
      nickname: 'Tyrael',
      email: 'tyrael@crater',
      birthday: new Date(2021, 5, 26),
      sex: 'M',
    });
    assert.equal(strftime('%Y-%m-%d', user.birthday), '2021-06-26');
  });

  it('CHAR', async function() {
    assert.ok(User.attributes.hasOwnProperty('birthday'));
    const user = await User.create({
      nickname: 'Tyrael',
      email: 'tyrael@crater',
      birthday: new Date(2021, 5, 26),
      sex: 'M',
    });
    assert.equal(user.sex, 'M');
  });
});
