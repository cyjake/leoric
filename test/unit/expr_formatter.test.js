'use strict';

const assert = require('assert').strict;
const strftime = require('strftime');
const { connect, Bone } = require('../..');

describe('=> formatExpr', function() {

  class Post extends Bone {
    static table = 'articles'
    static initialize() {
      this.attribute('settings', { type: JSON });
    }
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

  it('should not double escape string in queries on JSON attribute', async function() {
    assert.equal(
      Post.where({ settings: { $like: '%foo%' } }).toString(),
      "SELECT * FROM `articles` WHERE `settings` LIKE '%foo%' AND `gmt_deleted` IS NULL"
    );
  });
});
