'use strict';

const assert = require('assert').strict;
const strftime = require('strftime');
const { connect, Bone } = require('../..');

describe('=> formatExpr', function() {

  class Post extends Bone {
    static table = 'articles'
  }

  class User extends Bone {}

  before(async function() {
    Bone.driver = null;
    await connect({
      models: [ Post, User ],
      database: 'leoric',
      user: 'root',
      port: process.env.MYSQL_PORT,
    });
  });

  it('should cast string into integer', async function() {
    assert.equal(
      Post.where({ id: '1' }).toSqlString(),
      'SELECT * FROM `articles` WHERE `id` = 1 AND `gmt_deleted` IS NULL'
    );
  });

  it('should cast date with precision set in database', async function() {
    // users.birthday stores DATE without specific hours or so
    const today = new Date();
    const formatted = strftime('%Y-%m-%d', today);
    assert.equal(
      User.where({ birthday: today }).toSqlString(),
      "SELECT * FROM `users` WHERE `birthday` = '" + formatted + " 00:00:00.000'"
    );
  });
});
