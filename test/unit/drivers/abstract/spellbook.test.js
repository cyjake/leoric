'use strict';

const assert = require('assert').strict;
const { connect, heresql, Bone } = require('../../../..');

describe('=> Spellbook', function() {
  class User extends Bone {}
  class Post extends Bone {
    static table = 'articles'
    static initialize() {
      this.belongsTo('author', { className: 'User' });
    }
  }

  before(async function() {
    await connect({
      models: [ User, Post ],
      database: 'leoric',
      user: 'root',
      port: process.env.MYSQL_PORT,
    });
  });

  describe('formatSelect', function() {
    it('should not tamper subquery when formatting subspell', async function() {
      const query = Post.where({
        isPrivate: true,
        authorId: User.where({ stauts: 1 }),
      }).with('author');

      assert.equal(query.limit(10).toString(), heresql(function() {/*
        SELECT `posts`.*, `author`.*
          FROM (SELECT * FROM `articles`
                  WHERE `is_private` = true
                    AND `author_id` IN (SELECT * FROM `users` WHERE `stauts` = 1)
                    AND `gmt_deleted` IS NULL LIMIT 10) AS `posts`
      LEFT JOIN `users` AS `author`
            ON `posts`.`userId` = `author`.`id`
      */}));

      assert.doesNotThrow(function() {
        assert.equal(query.count().toString(), heresql(function() {/*
          SELECT `posts`.*, `author`.*, COUNT(*) AS `count`
            FROM `articles` AS `posts`
       LEFT JOIN `users` AS `author`
              ON `posts`.`userId` = `author`.`id`
           WHERE `posts`.`is_private` = true
             AND `posts`.`author_id` IN (SELECT * FROM `users` WHERE `stauts` = 1)
             AND `posts`.`gmt_deleted` IS NULL
        */}));
      });
    });
  });
});
