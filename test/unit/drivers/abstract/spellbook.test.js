'use strict';

const assert = require('assert').strict;
const { connect, heresql, Bone } = require('../../../../src');

describe('=> Spellbook', function() {
  class User extends Bone {}
  class Attachment extends Bone {}
  class Post extends Bone {
    static table = 'articles';
    static initialize() {
      this.belongsTo('author', { className: 'User' });
    }
  }
  class Comment extends Bone {
    static shardingKey = 'articleId';
  }

  before(async function() {
    Bone.driver = null;
    await connect({
      models: [ User, Post, Attachment, Comment ],
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

      assert.equal(query.limit(10).toString(), heresql(`
        SELECT "posts".*, "author".*
          FROM "articles" AS "posts"
      LEFT JOIN "users" AS "author"
            ON "posts"."userId" = "author"."id"
      WHERE "posts"."is_private" = true
          AND "posts"."author_id" IN (SELECT * FROM "users" WHERE "stauts" = 1)
          AND "posts"."gmt_deleted" IS NULL
          LIMIT 10
        `).replaceAll('"', '`'));

      assert.doesNotThrow(function() {
        assert.equal(query.count().toString(), heresql(`
          SELECT COUNT(*) AS "count"
            FROM "articles" AS "posts"
       LEFT JOIN "users" AS "author"
              ON "posts"."userId" = "author"."id"
           WHERE "posts"."is_private" = true
             AND "posts"."author_id" IN (SELECT * FROM "users" WHERE "stauts" = 1)
             AND "posts"."gmt_deleted" IS NULL
          `).replaceAll('"', '`'));
      });
    });

    it('should format arithmetic operators as is', async function() {
      const query = Attachment.where('width/height > 16/9');
      assert.equal(query.toString(), heresql(`
          SELECT * FROM "attachments" WHERE "width" / "height" > 16 / 9 AND "gmt_deleted" IS NULL
        `).replaceAll('"', '`'));
    });

    it('aggregate functions should be formatted without star', async function() {
      const query = Post.include('authors')
          .maximum('posts.createdAt');
      assert.equal(query.toString(), heresql(`
          SELECT MAX("posts"."gmt_create") AS "maximum" FROM "articles" AS "posts" LEFT JOIN "users" AS "authors" ON "posts"."userId" = "authors"."id" WHERE "posts"."gmt_deleted" IS NULL
        `).replaceAll('"', '`'));
    });

    it('should throw error if OFFSET is used without LIMIT', function() {
      const query = Post.find().offset(10);
      assert.throws(function() {
        query.toString();
      }, /Unable to query with OFFSET yet without LIMIT/i);
    });
  });

  describe('formatInsert()', function() {
    it('should throw error when inserting rows without sharding key', function() {
      const query = Comment.create({ content: 'photo1.jpg' }, { validate: false });
      assert.throws(function() {
        query.toString();
      }, /Sharding key comments.articleId cannot be NULL/i);
    });
  });

  describe('formatUpdate()', function() {
    it('should throw error when updating rows without sharding key', function() {
      const query = Comment.update({ id: 1 }, { content: 'updated photo1.jpg' });
      assert.throws(function() {
        query.toString();
      }, /Sharding key comments.articleId is required/i);
    });

    it('should throw error when nothing to update', function() {
      const query = Post.update({ id: 1 }, {}, { silent: true });
      assert.throws(function() {
        query.toString();
      }, /Unable to update with empty set/i);
    });
  });

  describe('formatDelete()', function() {
    it('should throw error when deleting rows without sharding key', function() {
      const query = Comment.remove({ id: 1 });
      assert.throws(function() {
        query.toString();
      }, /Sharding key comments.articleId is required/i);
    });
  });

  describe('format()', function() {
    it('should throw error when formatting invalid SQL', function() {
      assert.throws(function() {
        const query = Post.findOne();
        query.command = 'INVALID SQL';
        query.toString();
      }, /Unsupported SQL command/i);
    });
  });
});
