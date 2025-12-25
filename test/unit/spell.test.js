'use strict';

const assert = require('assert').strict;
const sinon = require('sinon');

const { connect, raw, Bone, heresql } = require('../../src');

class Post extends Bone {
  static table = 'articles';
  static initialize() {
    this.hasOne('attachment', { foreignKey: 'articleId' });
    this.hasMany('comments', {
      foreignKey: 'articleId'
    });
  }
}
class TagMap extends Bone {}
class Comment extends Bone {}
class Book extends Bone {}
class User extends Bone {}
class Attachment extends Bone {}

describe('=> Spell', function() {
  before(async function() {
    Bone.driver = null;
    await connect({
      models: [ Post, TagMap, Comment, Book, User, Attachment ],
      database: 'leoric',
      user: 'root',
      port: process.env.MYSQL_PORT,
    });
  });

  it('rejects query if not connected yet', async () => {
    class Note extends Bone {};
    await assert.rejects(async () => await Note.all);
  });

  it('supports error convention with nodeify', async () => {
    const post = await new Promise((resolve, reject) => {
      Post.create({ title: 'Gettysburg Address' }).nodeify((err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      });
    });
    assert.ok(post instanceof Post);
    assert.ok(post.id);
    assert.equal(post.title, 'Gettysburg Address');
  });

  it('error convention should work as expected', async () => {
    await assert.rejects(new Promise((resolve, reject) => {
      User.create({ id: 1 }, { validate: false }).nodeify((err, user) => {
        if (err) {
          reject(err);
        } else {
          resolve(user);
        }
      });
    }), /ER_NO_DEFAULT_FOR_FIELD/);
  });

  it('ignite query with .catch()', async () => {
    const post = await Post.create({ title: 'The Divine Comedy' }).catch(err => {
      // ignored
    });
    assert.ok(post instanceof Post);
    await post.remove(true);
  });

  it('ignite query with .finally()', async () => {
    const post = await Post.create({ title: 'The Divine Comedy' }).finally(() => {
      assert.ok('finally called');
    });
    assert.ok(post instanceof Post);
    await post.remove(true);
  });

  it('insert', function() {
    const date = new Date(2017, 11, 12);
    assert.equal(
      Post.create({ title: 'New Post', createdAt: date, updatedAt: date }).toString(),
      "INSERT INTO `articles` (`is_private`, `title`, `word_count`, `gmt_create`, `gmt_modified`) VALUES (0, 'New Post', 0, '2017-12-12 00:00:00.000', '2017-12-12 00:00:00.000')"
    );
  });

  it('insert ... on duplicate key update', function() {
    const date = new Date(2017, 11, 12);
    const fakeDate = date.getTime();
    sinon.useFakeTimers(fakeDate);
    assert.equal(
      new Post({ id: 1, title: 'New Post', createdAt: date, updatedAt: date }).upsert().toString(),
      "INSERT INTO `articles` (`id`, `is_private`, `title`, `word_count`, `gmt_create`, `gmt_modified`) VALUES (1, 0, 'New Post', 0, '2017-12-12 00:00:00.000', '2017-12-12 00:00:00.000') ON DUPLICATE KEY UPDATE `id`=VALUES(`id`), `is_private`=VALUES(`is_private`), `title`=VALUES(`title`), `word_count`=VALUES(`word_count`), `gmt_modified`=VALUES(`gmt_modified`)"
    );
    assert.equal(
      new Post({ title: 'New Post', createdAt: date, updatedAt: date }).upsert().toString(),
      "INSERT INTO `articles` (`is_private`, `title`, `word_count`, `gmt_create`, `gmt_modified`) VALUES (0, 'New Post', 0, '2017-12-12 00:00:00.000', '2017-12-12 00:00:00.000') ON DUPLICATE KEY UPDATE `id` = LAST_INSERT_ID(`id`), `is_private`=VALUES(`is_private`), `title`=VALUES(`title`), `word_count`=VALUES(`word_count`), `gmt_modified`=VALUES(`gmt_modified`)"
    );
    // default set createdAt
    assert.equal(
      new Post({ id: 1, title: 'New Post' }).upsert().toString(),
      "INSERT INTO `articles` (`id`, `is_private`, `title`, `word_count`, `gmt_create`, `gmt_modified`) VALUES (1, 0, 'New Post', 0, '2017-12-12 00:00:00.000', '2017-12-12 00:00:00.000') ON DUPLICATE KEY UPDATE `id`=VALUES(`id`), `is_private`=VALUES(`is_private`), `title`=VALUES(`title`), `word_count`=VALUES(`word_count`), `gmt_modified`=VALUES(`gmt_modified`)"
    );

    assert.equal(
      Post.upsert({ title: 'New Post' }).toSqlString(),
      "INSERT INTO `articles` (`is_private`, `title`, `word_count`, `gmt_create`, `gmt_modified`) VALUES (0, 'New Post', 0, '2017-12-12 00:00:00.000', '2017-12-12 00:00:00.000') ON DUPLICATE KEY UPDATE `id` = LAST_INSERT_ID(`id`), `is_private`=VALUES(`is_private`), `title`=VALUES(`title`), `word_count`=VALUES(`word_count`), `gmt_modified`=VALUES(`gmt_modified`)"
    );

    assert.equal(
      new Book({ name: 'Dark', price: 100 }).upsert().toSqlString(),
      "INSERT INTO `books` (`name`, `price`, `gmt_create`, `gmt_modified`) VALUES ('Dark', 100, '2017-12-12 00:00:00.000', '2017-12-12 00:00:00.000') ON DUPLICATE KEY UPDATE `isbn` = LAST_INSERT_ID(`isbn`), `name`=VALUES(`name`), `price`=VALUES(`price`), `gmt_modified`=VALUES(`gmt_modified`)"
    );

    assert.equal(
      new Book({ isbn: 10000, name: 'Dark', price: 100 }).upsert().toSqlString(),
      "INSERT INTO `books` (`isbn`, `name`, `price`, `gmt_create`, `gmt_modified`) VALUES (10000, 'Dark', 100, '2017-12-12 00:00:00.000', '2017-12-12 00:00:00.000') ON DUPLICATE KEY UPDATE `isbn`=VALUES(`isbn`), `name`=VALUES(`name`), `price`=VALUES(`price`), `gmt_modified`=VALUES(`gmt_modified`)"
    );
  });

  it('where object condition', function() {
    assert.equal(
      Post.where({ title: { $like: '%Post%' } }).toString(),
      "SELECT * FROM `articles` WHERE `title` LIKE '%Post%' AND `gmt_deleted` IS NULL"
    );
  });

  it('unparanoid', function() {
    assert.equal(
      Post.where({ title: { $like: '%Post%' } }).unparanoid.toString(),
      "SELECT * FROM `articles` WHERE `title` LIKE '%Post%'"
    );
  });

  it('where object condition with logical operator', () => {
    assert.equal(
      Post.where({
        $or: {
          title: { $like: '%Cain%' },
          content: { $like: '%Leah%' },
        },
      }).toString(),
      "SELECT * FROM `articles` WHERE (`title` LIKE '%Cain%' OR `content` LIKE '%Leah%') AND `gmt_deleted` IS NULL"
    );
  });

  it('where object condition with logical operator but insufficient args', async function() {
    assert.equal(
      Post.where({
        $or: {
          content: { $like: '%Leah%' },
        },
      }).toString(),
      "SELECT * FROM `articles` WHERE `content` LIKE '%Leah%' AND `gmt_deleted` IS NULL"
    );

    assert.equal(
      Post.where({
        title: {
          $and: [ { $like: '%bloodborne%' } ]
        }
      }).toSqlString(),
      "SELECT * FROM `articles` WHERE `title` LIKE '%bloodborne%' AND `gmt_deleted` IS NULL"
    );

    assert.equal(
      Post.where({
        title: {
          $and: [ 'Leah' ]
        }
      }).toSqlString(),
      "SELECT * FROM `articles` WHERE `title` = 'Leah' AND `gmt_deleted` IS NULL"
    );

    assert.throws(function() {
      Post.where({
        $or: {},
      }).toString();
    }, /unexpected logical operator value/);
  });

  it('where object condition with multiple operator', async () => {
    assert.equal(
      Post.where({
        title: {
          $like: '%Leah%',
          $not: [ 'Halo', 'EvalGenius' ],
          $ne: 'hello'
        }
      }).toSqlString(),
      "SELECT * FROM `articles` WHERE `title` LIKE '%Leah%' AND `title` NOT IN ('Halo', 'EvalGenius') AND `title` != 'hello' AND `gmt_deleted` IS NULL"
    );

    assert.equal(
      Post.where({
        title: {
          $like: '%Leah%',
          $ne: 'hello'
        }
      }).toSqlString(),
      "SELECT * FROM `articles` WHERE `title` LIKE '%Leah%' AND `title` != 'hello' AND `gmt_deleted` IS NULL"
    );
  });

  it('where object condition with logical operator on same column', async function() {
    assert.equal(
      Post.where({
        $or: [
          { title: { $like: '%Cain%' } },
          { title: { $like: '%Leah%' } },
        ],
      }).toSqlString(),
      "SELECT * FROM `articles` WHERE (`title` LIKE '%Cain%' OR `title` LIKE '%Leah%') AND `gmt_deleted` IS NULL"
    );

    assert.equal(
      Post.where({
        $or: [
          { title: 'Leah' },
          { title: { $like: '%Diablo%' } },
        ],
      }).toSqlString(),
      "SELECT * FROM `articles` WHERE (`title` = 'Leah' OR `title` LIKE '%Diablo%') AND `gmt_deleted` IS NULL"
    );

    assert.equal(
      Post.where({
        $or: [
          { title: 'Leah' },
        ],
      }).toSqlString(),
      "SELECT * FROM `articles` WHERE `title` = 'Leah' AND `gmt_deleted` IS NULL"
    );

    assert.equal(
      Post.where({
        $and: [
          { title: 'Leah' },
        ],
      }).toSqlString(),
      "SELECT * FROM `articles` WHERE `title` = 'Leah' AND `gmt_deleted` IS NULL"
    );
  });

  it('where object condition with logical operator and multiple conditions', async function() {
    assert.equal(
      Post.where({
        $or: [
          {
            title: { $like: '%Cain%' },
            authorId: 1,
          },
          {
            title: { $in: [ 's1', '21' ] },
            authorId: 2,
          },
          {
            title: { $in: [ 's1' ] },
            authorId: 2,
          },
          {
            title: { $in: [ 'sss', 'sss1' ] },
            authorId: { $in: [ 1, 2 ] },
          }
        ],
      }).toSqlString(),
      "SELECT * FROM `articles` WHERE (`title` LIKE '%Cain%' AND `author_id` = 1 OR `title` IN ('s1', '21') AND `author_id` = 2 OR `title` IN ('s1') AND `author_id` = 2 OR `title` IN ('sss', 'sss1') AND `author_id` IN (1, 2)) AND `gmt_deleted` IS NULL"
    );
  });

  describe('multiple logical query conditions within one column', () => {
    it('or', () => {
      assert.equal(
        Post.where({
          title: {
            $or: [
              'Leah',
              'Diablo',
            ],
          }
        }).toSqlString(),
        "SELECT * FROM `articles` WHERE (`title` = 'Leah' OR `title` = 'Diablo') AND `gmt_deleted` IS NULL"
      );

      assert.equal(
        Post.where({
          title: {
            $or: [
              null,
              'Diablo',
            ],
          }
        }).toSqlString(),
        "SELECT * FROM `articles` WHERE (`title` IS NULL OR `title` = 'Diablo') AND `gmt_deleted` IS NULL"
      );

      assert.equal(
        Post.where({
          $or: {
            title: 'Leah',
            content: { $like: '%Leah%' },
          },
        }).toString(),
        "SELECT * FROM `articles` WHERE (`title` = 'Leah' OR `content` LIKE '%Leah%') AND `gmt_deleted` IS NULL"
      );

      assert.equal(
        Post.where({
          title: {
            $or: [
              'Leah',
              {
                $like: '%Leah%'
              },
            ],
          }
        }).toSqlString(),
        "SELECT * FROM `articles` WHERE (`title` = 'Leah' OR `title` LIKE '%Leah%') AND `gmt_deleted` IS NULL"
      );

      assert.equal(
        Post.where({
          title: {
            $or: [
              'Leah',
              {
                $ne: 'Leah'
              },
            ],
          }
        }).toSqlString(),
        "SELECT * FROM `articles` WHERE (`title` = 'Leah' OR `title` != 'Leah') AND `gmt_deleted` IS NULL"
      );

      assert.equal(
        Post.where({
          title: {
            $or: [
              {
                $ne: 'Leah'
              },
              null
            ],
          }
        }).toSqlString(),
        "SELECT * FROM `articles` WHERE (`title` != 'Leah' OR `title` IS NULL) AND `gmt_deleted` IS NULL"
      );
    });

    it('and', () => {
      assert.equal(
        Post.where({
          title: {
            $and: [
              'Leah',
              'Diablo',
            ],
          }
        }).toSqlString(),
        "SELECT * FROM `articles` WHERE `title` = 'Leah' AND `title` = 'Diablo' AND `gmt_deleted` IS NULL"
      );

      assert.equal(
        Post.where({
          $and: {
            title: 'Leah',
            content: { $like: '%Leah%' },
          },
        }).toString(),
        "SELECT * FROM `articles` WHERE `title` = 'Leah' AND `content` LIKE '%Leah%' AND `gmt_deleted` IS NULL"
      );

      assert.equal(
        Post.where({
          title: {
            $and: [
              'Leah',
              {
                $like: '%Leah%'
              },
            ],
          }
        }).toSqlString(),
        "SELECT * FROM `articles` WHERE `title` = 'Leah' AND `title` LIKE '%Leah%' AND `gmt_deleted` IS NULL"
      );

      assert.equal(
        Post.where({
          title: {
            $and: [
              'Leah',
              {
                $ne: 'Leah'
              },
            ],
          }
        }).toSqlString(),
        "SELECT * FROM `articles` WHERE `title` = 'Leah' AND `title` != 'Leah' AND `gmt_deleted` IS NULL"
      );

      assert.equal(
        Post.where({
          title: {
            $and: [
              null,
              {
                $ne: 'Leah'
              },
            ],
          }
        }).toSqlString(),
        "SELECT * FROM `articles` WHERE `title` IS NULL AND `title` != 'Leah' AND `gmt_deleted` IS NULL"
      );
    });

    it('not', () => {
      assert.equal(
        Post.where({
          is_private: {
            $not: [ 1, 2, 3 ],
          }
        }).toSqlString(),
        'SELECT * FROM `articles` WHERE `is_private` NOT IN (1, 2, 3) AND `gmt_deleted` IS NULL'
      );

      assert.equal(
        Post.where({
          is_private: {
            $not: [ null, 2 ],
          }
        }).toSqlString(),
        'SELECT * FROM `articles` WHERE `is_private` NOT IN (NULL, 2) AND `gmt_deleted` IS NULL'
      );

      assert.equal(
        Post.where({
          is_private: {
            $not: [
              1,
              { $lte: 6 }
            ]
          }
        }).toSqlString(),
        'SELECT * FROM `articles` WHERE NOT (`is_private` = 1 AND `is_private` <= 6) AND `gmt_deleted` IS NULL'
      );
    });

    it('mix', () => {
      assert.equal(
        Post.where({
          title: {
            $or: [
              'Leah',
              {
                $ne: 'Leah'
              },
            ],
          },
          is_private: {
            $and: [
              { $gte: 1 },
              { $lte: 6 }
            ]
          }
        }).toSqlString(),
        "SELECT * FROM `articles` WHERE (`title` = 'Leah' OR `title` != 'Leah') AND `is_private` >= 1 AND `is_private` <= 6 AND `gmt_deleted` IS NULL"
      );
      assert.equal(
        Post.where({
          title: {
            $or: [
              'Leah',
              {
                $ne: 'Leah'
              },
            ],
          },
          is_private: {
            $and: [
              { $gte: 1 },
              { $lte: 6 }
            ],
          },
          author_id: {
            $not: [
              100,
              { $lte: 2 }
            ]
          }
        }).toSqlString(),
        "SELECT * FROM `articles` WHERE (`title` = 'Leah' OR `title` != 'Leah') AND `is_private` >= 1 AND `is_private` <= 6 AND NOT (`author_id` = 100 AND `author_id` <= 2) AND `gmt_deleted` IS NULL"
      );
    });
  });

  it('where string conditions', function() {
    assert.equal(
      Post.where('title like ?', '%Post%').toString(),
      "SELECT * FROM `articles` WHERE `title` LIKE '%Post%' AND `gmt_deleted` IS NULL"
    );
  });

  it('where date', function() {
    assert.equal(
      Post.where('createdAt > ?', '2022-11-03').toString(),
      "SELECT * FROM `articles` WHERE `gmt_create` > '2022-11-03 00:00:00.000' AND `gmt_deleted` IS NULL"
    );
  });

  it('where compound string conditions', function() {
    assert.equal(
      Post.where('title like "Arch%" or (title = "New Post" || title = "Skeleton King")').toString(),
      "SELECT * FROM `articles` WHERE (`title` LIKE 'Arch%' OR `title` = 'New Post' OR `title` = 'Skeleton King') AND `gmt_deleted` IS NULL"
    );
  });

  it('where arithmetic conditions', function() {
    assert.equal(
      Post.where('id % 2 - 1 = -1').toString(),
      'SELECT * FROM `articles` WHERE `id` % 2 - 1 = -1 AND `gmt_deleted` IS NULL'
    );
  });

  it('where conditions with unary operators', function() {
    assert.equal(
      Post.where('~id = -1').toString(),
      'SELECT * FROM `articles` WHERE ~ `id` = -1 AND `gmt_deleted` IS NULL'
    );
  });

  it('where not in conditions', function() {
    assert.equal(
      Post.where('id != ?', [ 1, 2 ]).toString(),
      'SELECT * FROM `articles` WHERE `id` NOT IN (1, 2) AND `gmt_deleted` IS NULL'
    );
  });

  it('where in Spell', function() {
    assert.equal(
      Post.where({ id: TagMap.select('targetId').where({ tagId: 1 }) }).toString(),
      'SELECT * FROM `articles` WHERE `id` IN (SELECT `target_id` FROM `tag_maps` WHERE `tag_id` = 1 AND `gmt_deleted` IS NULL) AND `gmt_deleted` IS NULL'
    );
  });

  it('orWhere', function() {
    assert.equal(
      Post.find().orWhere('title = ?', 'Leah').toString(),
      "SELECT * FROM `articles` WHERE `title` = 'Leah' AND `gmt_deleted` IS NULL"
    );
  });

  it('orWhere with existing where conditions', function() {
    assert.equal(
      Post.where({ id: 1 }).where('title = ?', 'New Post').orWhere('title = ?', 'Leah').toString(),
      "SELECT * FROM `articles` WHERE (`id` = 1 AND `title` = 'New Post' OR `title` = 'Leah') AND `gmt_deleted` IS NULL"
    );
  });

  it('orHaving', function() {
    assert.equal(
      Post.count().group('authorId').having('count > ?', 10).orHaving('count = 5').toString(),
      'SELECT COUNT(*) AS `count`, `author_id` FROM `articles` WHERE `gmt_deleted` IS NULL GROUP BY `author_id` HAVING `count` > 10 OR `count` = 5'
    );
  });

  it('orHaving with raw', function() {
    assert.equal(
      Post.count().group('authorId').having(raw('count > 10')).orHaving('count = 5').toString(),
      'SELECT COUNT(*) AS `count`, `author_id` FROM `articles` WHERE `gmt_deleted` IS NULL GROUP BY `author_id` HAVING count > 10 OR `count` = 5'
    );
  });

  it('orHaving with existing having conditions', function() {
    assert.equal(
      Post.count().group('authorId')
        .having({ count: { $gt: 10 } })
        .having({ count: { $lt: 20 } })
        .orHaving('count = 5').toString(),
      'SELECT COUNT(*) AS `count`, `author_id` FROM `articles` WHERE `gmt_deleted` IS NULL GROUP BY `author_id` HAVING `count` > 10 AND `count` < 20 OR `count` = 5'
    );
  });

  it('offset / limit', function() {
    assert.equal(
      Post.find().offset(10).limit(5).toString(),
      'SELECT * FROM `articles` WHERE `gmt_deleted` IS NULL LIMIT 5 OFFSET 10'
    );
  });

  it('offset / limit with invalid args', function() {
    assert.throws(() => {
      Post.find().limit('x').toString();
    }, /invalid limit/);
    assert.throws(() => {
      Post.find().offset('y').toString();
    }, /invalid offset/);
  });

  it('count / group by / having / order', function() {
    assert.equal(
      Post.group('authorId').count().having({ count: { $gt: 0 } }).order('count desc').toString(),
      'SELECT `author_id`, COUNT(*) AS `count` FROM `articles` WHERE `gmt_deleted` IS NULL GROUP BY `author_id` HAVING `count` > 0 ORDER BY `count` DESC'
    );
  });

  it('aggregate with invalid attribute', function() {
    assert.throws(() => {
      Post.average('a > b').toString();
    }, /unexpected operand/);
  });

  it('count / group by / having / order with raw', function() {
    assert.equal(
      Post.group('authorId').count().having(raw('count > 0')).order('count desc').toString(),
      'SELECT `author_id`, COUNT(*) AS `count` FROM `articles` WHERE `gmt_deleted` IS NULL GROUP BY `author_id` HAVING count > 0 ORDER BY `count` DESC'
    );
  });

  it('select with function call', function() {
    assert.equal(
      Post.select('YEAR(createdAt)').toString(),
      'SELECT YEAR(`gmt_create`) FROM `articles` WHERE `gmt_deleted` IS NULL'
    );
  });

  it('select with function call that takes more than one arguments', function() {
    assert.equal(
      Post.select('IFNULL(title, "Untitled")').toString(),
      "SELECT IFNULL(`title`, 'Untitled') FROM `articles` WHERE `gmt_deleted` IS NULL"
    );
  });

  it('select as', function() {
    assert.equal(
      Post.select('COUNT(id) AS count').toString(),
      'SELECT COUNT(`id`) AS `count` FROM `articles` WHERE `gmt_deleted` IS NULL'
    );
  });

  it('select distinct', function() {
    assert.equal(
      Post.select('DISTINCT title').toString(),
      'SELECT DISTINCT `title` FROM `articles` WHERE `gmt_deleted` IS NULL'
    );
  });

  it('predefined hasOne join', function() {
    assert.equal(
      Post.select('title', 'createdAt').with('attachment').toString(),
      'SELECT `posts`.`title`, `posts`.`gmt_create`, `attachment`.* FROM `articles` AS `posts` LEFT JOIN `attachments` AS `attachment` ON `posts`.`id` = `attachment`.`article_id` AND `attachment`.`gmt_deleted` IS NULL WHERE `posts`.`gmt_deleted` IS NULL'
    );
  });

  it('should throw error when joining undefined relation', function() {
    assert.throws(() => {
      Post.find().with('undefined').toString();
    }, /unable to find association/i);
  });

  it('arbitrary join', function() {
    assert.equal(
      Post.join(Comment, 'comments.articleId = posts.id').toString(),
      'SELECT `posts`.*, `comments`.* FROM `articles` AS `posts` LEFT JOIN `comments` AS `comments` ON `comments`.`article_id` = `posts`.`id` WHERE `posts`.`gmt_deleted` IS NULL'
    );

    assert.equal(Post.include('comments').limit(1).toSqlString(), heresql(`
      SELECT "posts".*, "comments".* FROM "articles" AS "posts"
        LEFT JOIN "comments" AS "comments" ON "posts"."id" = "comments"."article_id" AND "comments"."gmt_deleted" IS NULL
      WHERE "posts"."gmt_deleted" IS NULL LIMIT 1
    `).replaceAll('"', '`'));

    assert.equal(Post.include('comments').where({
      'posts.title': { $like: '%oo%' },
      'comments.content': { $like: '%oo%' },
    }).limit(1).toSqlString(), heresql(`
      SELECT "posts".*, "comments".* FROM "articles" AS "posts"
        LEFT JOIN "comments" AS "comments" ON "posts"."id" = "comments"."article_id" AND "comments"."gmt_deleted" IS NULL
        WHERE
          "posts"."title" LIKE '%oo%'
        AND "comments"."content" LIKE '%oo%'
        AND "posts"."gmt_deleted" IS NULL
        LIMIT 1
      `).replaceAll('"', '`'));

    assert.equal(
      Post.join(Comment, 'comments.articleId = posts.id').limit(1).toString(),
      'SELECT `posts`.*, `comments`.* FROM `articles` AS `posts` LEFT JOIN `comments` AS `comments` ON `comments`.`article_id` = `posts`.`id` WHERE `posts`.`gmt_deleted` IS NULL LIMIT 1'
    );
  });

  it('abitrary join with predefined association', function() {
    assert.equal(
      Post.join('comments').toString(),
      'SELECT `posts`.*, `comments`.* FROM `articles` AS `posts` LEFT JOIN `comments` AS `comments` ON `posts`.`id` = `comments`.`article_id` AND `comments`.`gmt_deleted` IS NULL WHERE `posts`.`gmt_deleted` IS NULL'
    );
  });

  it('arbitrary join with conflicting qualifiers should throw error', function() {
    assert.throws(() => {
      Post.find().with('comments').join(Comment, 'comments.articleId = posts.id').toString();
    }, /invalid join target/);
  });

  it('batch select with invalid batch limit', function() {
    assert.rejects(async () => {
      [...Post.find().batch(-1)];
    }, /invalid batch limit/);
  });

  describe('form should work', function () {
    it('should work with simple table', function () {
      assert.equal(Post.select('title').from('articles').where({
        title: {
          $like: '%yoxi%',
        },
        id: {
          $gte: 1
        }
      })
      .limit(1)
      .order('createdAt').toSqlString(), heresql(`
        SELECT "title"
          FROM "articles"
        WHERE "title" LIKE '%yoxi%'
        AND "id" >= 1
        AND "gmt_deleted" IS NULL
        ORDER BY "gmt_create" LIMIT 1
      `).replaceAll('"', '`'));
    });

    it('should work with subquery', function () {
      assert.equal(Post.select('title').from(Post.select('id', 'title', 'createdAt').where({
        title: {
          $like: '%yoxi%',
        }
      }).limit(10).order('id'))
      .where({
        id: {
          $gte: 1
        }
      })
      .limit(1)
      .order('createdAt').toSqlString(), heresql(`
        SELECT "title"
          FROM (SELECT "id", "title", "gmt_create"
            FROM "articles" WHERE "title" LIKE '%yoxi%'
          AND "gmt_deleted" IS NULL ORDER BY "id" LIMIT 10)
          AS "posts"
        WHERE "id" >= 1 ORDER BY "gmt_create" LIMIT 1
      `).replaceAll('"', '`'));
    });

    it('should work with nest', function () {
      assert.equal(Post.select('title').from(
        Post.from(
          Post.where({
            id: {
              $gte: 10
            }
          }).limit(100)
        ).select('id', 'title', 'createdAt').where({
          title: {
            $like: '%yoxi%',
          }
        }).limit(10).order('id')
      ).where({
        id: {
          $gte: 1
        }
      })
      .limit(1)
      .order('createdAt').toSqlString(), heresql(`
        SELECT "title"
          FROM (SELECT "id", "title", "gmt_create"
            FROM (SELECT * FROM "articles" WHERE "id" >= 10 AND "gmt_deleted" IS NULL LIMIT 100)
            AS "posts"
            WHERE "title" LIKE '%yoxi%'
          ORDER BY "id" LIMIT 10)
          AS "posts"
        WHERE "id" >= 1 ORDER BY "gmt_create" LIMIT 1
      `).replaceAll('"', '`'));
    });
  });

  it('make OFFSET and LIMIT on left table takes effect while use from', function () {
    assert.equal(Post.from(Post.where({
      title: {
        $like: '%yoxi%',
      }
    })).with('comments').where({
      'comments.content': { $like: '%oo1%' },
      id: {
        $gte: 1
      }
    }).limit(1).toSqlString(), heresql(`
      SELECT "posts".*, "comments".*
        FROM (SELECT * FROM "articles" WHERE "title" LIKE '%yoxi%' AND "gmt_deleted" IS NULL) AS "posts"
      LEFT JOIN "comments" AS "comments" ON "posts"."id" = "comments"."article_id" AND "comments"."gmt_deleted" IS NULL
      WHERE "comments"."content" LIKE '%oo1%'
      AND "posts"."id" >= 1
      LIMIT 1
    `).replaceAll('"', '`'));

    assert.equal(Post.from(Post.where({
      title: {
        $like: '%yoxi%',
      }
    }).limit(10)).with('comments').where({
      'comments.content': { $like: '%oo1%' },
    }).limit(1).toSqlString(), heresql(`
      SELECT "posts".*, "comments".*
        FROM (SELECT * FROM "articles" WHERE "title" LIKE '%yoxi%' AND "gmt_deleted" IS NULL LIMIT 10) AS "posts"
      LEFT JOIN "comments" AS "comments" ON "posts"."id" = "comments"."article_id" AND "comments"."gmt_deleted" IS NULL
      WHERE "comments"."content" LIKE '%oo1%'
      LIMIT 1
    `).replaceAll('"', '`'));
  });

  describe('make OFFSET and LIMIT on left table takes effect while use limit/offset on the left of join', function () {
    it('should work', function () {
      assert.equal(Post.where({
        title: {
          $like: '%yoxi%',
        }
      }).limit(1).with('comments').where({
        'comments.content': { $like: '%oo1%' },
        id: {
          $gte: 1
        }
      }).limit(1).toSqlString(), heresql(`
        SELECT "posts".*, "comments".*
          FROM (SELECT * FROM "articles" WHERE "title" LIKE '%yoxi%' AND "gmt_deleted" IS NULL LIMIT 1) AS "posts"
        LEFT JOIN "comments" AS "comments" ON "posts"."id" = "comments"."article_id" AND "comments"."gmt_deleted" IS NULL
        WHERE "comments"."content" LIKE '%oo1%'
        AND "posts"."id" >= 1
        LIMIT 1
      `).replaceAll('"', '`'));
    });

    it('should work with offset', function () {
      assert.equal(Post.where({
        title: {
          $like: '%yoxi%',
        }
      }).limit(1).offset(1).with('comments').where({
        'comments.content': { $like: '%oo1%' },
        id: {
          $gte: 1
        }
      }).limit(1).toSqlString(), heresql(`
        SELECT "posts".*, "comments".*
          FROM (SELECT * FROM "articles" WHERE "title" LIKE '%yoxi%' AND "gmt_deleted" IS NULL LIMIT 1 OFFSET 1) AS "posts"
        LEFT JOIN "comments" AS "comments" ON "posts"."id" = "comments"."article_id" AND "comments"."gmt_deleted" IS NULL
        WHERE "comments"."content" LIKE '%oo1%'
        AND "posts"."id" >= 1
        LIMIT 1
      `).replaceAll('"', '`'));
    });

    it('should work with order in subquery', function () {
      assert.equal(Post.where({
        title: {
          $like: '%yoxi%',
        }
      }).limit(1).order('id', 'desc').with('comments').where({
        'comments.content': { $like: '%oo1%' },
        id: {
          $gte: 1
        }
      }).limit(1).toSqlString(), heresql(`
        SELECT "posts".*, "comments".*
          FROM (SELECT * FROM "articles" WHERE "title" LIKE '%yoxi%' AND "gmt_deleted" IS NULL ORDER BY "id" DESC LIMIT 1) AS "posts"
        LEFT JOIN "comments" AS "comments" ON "posts"."id" = "comments"."article_id" AND "comments"."gmt_deleted" IS NULL
        WHERE "comments"."content" LIKE '%oo1%'
        AND "posts"."id" >= 1
        ORDER BY "posts"."id" DESC
        LIMIT 1
      `).replaceAll('"', '`'));
    });
  });

  it('select as', function() {
    assert.equal(
      Post.select("IFNULL(title, 'foo') AS title").order('title', 'desc').toString(),
      "SELECT IFNULL(`title`, 'foo') AS `title` FROM `articles` WHERE `gmt_deleted` IS NULL ORDER BY `title` DESC"
    );
  });

  it('order by field()', function() {
    assert.equal(
      Post.order('field(id, 1, 2, 3)').toString(),
      'SELECT * FROM `articles` WHERE `gmt_deleted` IS NULL ORDER BY FIELD(`id`, 1, 2, 3)'
    );
  });

  it('order by find_in_set()', function() {
    assert.equal(
      Post.order("find_in_set(id, '1,2,3')").toString(),
      "SELECT * FROM `articles` WHERE `gmt_deleted` IS NULL ORDER BY FIND_IN_SET(`id`, '1,2,3')"
    );
  });

  it('order by Raw', function() {
    assert.equal(
      Post.order(raw('FIELD(id, 1, 2, 3) DESC')).toString(),
      'SELECT * FROM `articles` WHERE `gmt_deleted` IS NULL ORDER BY FIELD(id, 1, 2, 3) DESC'
    );
  });

  it('where conditions with array', () => {
    assert.equal(
      Post.where({ id: [ 1, 2, 3 ] }).toString(),
      'SELECT * FROM `articles` WHERE `id` IN (1, 2, 3) AND `gmt_deleted` IS NULL'
    );
    // empty array
    assert.equal(
      Post.where({ id: [ ] }).toString(),
      'SELECT * FROM `articles` WHERE `id` IN (NULL) AND `gmt_deleted` IS NULL'
    );

    assert.equal(
      Post.where({ id: {
        $in: [ ],
      }}).toString(),
      'SELECT * FROM `articles` WHERE `id` IN (NULL) AND `gmt_deleted` IS NULL'
    );
  });

  it('where conditions with null', () => {
    assert.throws(() => Post.where(null).toString(), /unexpected conditions/i);
  });

  it('order by string with multiple condition', () => {
    assert.equal(
      Post.order('id asc, gmt_create desc').toString(),
      'SELECT * FROM `articles` WHERE `gmt_deleted` IS NULL ORDER BY `id`, `gmt_create` DESC'
    );
  });

  it('order by string with mixed condition', () => {
    assert.equal(
      Post.order('id desc, gmt_create').toString(),
      'SELECT * FROM `articles` WHERE `gmt_deleted` IS NULL ORDER BY `id` DESC, `gmt_create`'
    );
  });

  it('order by raw object', () => {
    assert.equal(
      Post.order(raw('FIELD(id, 1, 2, 3)')).toString(),
      'SELECT * FROM `articles` WHERE `gmt_deleted` IS NULL ORDER BY FIELD(id, 1, 2, 3)'
    );
  });

  it('increment', () => {
    const fakeDate = new Date(`2012-12-14 12:00:00`).getTime();
    sinon.useFakeTimers(fakeDate);
    assert.equal(
      Book.where({ isbn: 9787550616950 }).increment('price').toString(),
      "UPDATE `books` SET `price` = `price` + 1, `gmt_modified` = '2012-12-14 12:00:00.000' WHERE `isbn` = 9787550616950 AND `gmt_deleted` IS NULL"
    );
  });

  it('increment undefined attribute', () => {
    assert.throws(() => {
      Book.where({ isbn: 9787550616950 }).increment('undefined').toString();
    }, /undefined attribute/i);
  });

  it('increment infinite', () => {
    assert.throws(() => {
      Book.where({ isbn: 9787550616950 }).increment('price', Infinity).toString();
    }, /unexpected increment value/i);
  });

  it('decrement', () => {
    const fakeDate = new Date(`2012-12-14 12:00:00`).getTime();
    sinon.useFakeTimers(fakeDate);
    assert.equal(
      Book.where({ isbn: 9787550616950 }).decrement('price').toString(),
      "UPDATE `books` SET `price` = `price` - 1, `gmt_modified` = '2012-12-14 12:00:00.000' WHERE `isbn` = 9787550616950 AND `gmt_deleted` IS NULL"
    );
  });

  it('delete where object condition', function() {
    const sqlString = Post.remove({ title: { $like: '%Post%' } }).toString();
    assert(/UPDATE `articles` SET `gmt_deleted` = '[\s\S]*' WHERE `title` LIKE '%Post%' AND `gmt_deleted` IS NULL$/.test(sqlString));
  });

  it('force delete', function() {
    const sqlString = Post.remove({ title: { $like: '%Post%' } }, true).toString();
    assert.equal(sqlString, "DELETE FROM `articles` WHERE `title` LIKE '%Post%'");
  });

  it('soft delete with custom timestamp', function() {
    const sqlString = Post.remove({ title: { $like: '%Post%' }, deletedAt: new Date() }).toString();
    assert(/UPDATE `articles` SET `gmt_deleted` = '[\s\S]*' WHERE `title` LIKE '%Post%' AND `gmt_deleted` = '[\s\S]*'$/.test(sqlString));
  });

  it('update with order, limit and offset', function () {
    assert.equal(
      User.update({}, { level: 2 }).limit(5).toString(),
      'UPDATE `users` SET `level` = 2 LIMIT 5'
    );

    assert.equal(
      User.update({ title: { $like: '%halo%' } }, { level: 2 }).limit(5).toString(),
      'UPDATE `users` SET `level` = 2 WHERE `title` LIKE \'%halo%\' LIMIT 5'
    );

    assert.equal(
      User.update({ title: { $like: '%halo%' } }, { level: 2 }).limit(5).order('id DESC').toString(),
      'UPDATE `users` SET `level` = 2 WHERE `title` LIKE \'%halo%\' ORDER BY `id` DESC LIMIT 5'
    );
  });

  it('update with raw sql', function() {
    assert.equal(
      User.update({ id: 1 }, { level: raw('level + 1') }).toString(),
      'UPDATE `users` SET `level` = level + 1 WHERE `id` = 1'
    );

    assert.equal(
      User.update({ id: 1 }, { nickname: raw("replace(nickname, 'gta', 'mhw')") }).toString(),
      "UPDATE `users` SET `nickname` = replace(nickname, 'gta', 'mhw') WHERE `id` = 1"
    );

    assert.equal(
      User.update({ id: 1 }, { nickname: raw("replace(nickname, 'gta', 'mhw')") }).toString(),
      "UPDATE `users` SET `nickname` = replace(nickname, 'gta', 'mhw') WHERE `id` = 1"
    );

    assert.equal(
      User.update({ id: 1 }, { nickname: raw("replace(nickname, 'gta', 'mhw')"), level: raw('level + 1') }).toString(),
      "UPDATE `users` SET `nickname` = replace(nickname, 'gta', 'mhw'), `level` = level + 1 WHERE `id` = 1"
    );
  });

  it('create with raw sql', function() {
    assert.equal(
      Post.create({ title: 'New Post', createdAt: raw('CURRENT_TIMESTAMP()'), updatedAt: raw('CURRENT_TIMESTAMP()') }).toString(),
      "INSERT INTO `articles` (`is_private`, `title`, `word_count`, `gmt_create`, `gmt_modified`) VALUES (0, 'New Post', 0, CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP())"
    );
  });

  it('select sub raw query', function() {
    assert.equal(
      Post.where({
        author_id: {
          $in: raw('(SELECT id FROM `users` WHERE level > 10 ORDER BY rand())')
        }
      }).toString(),
      'SELECT * FROM `articles` WHERE `author_id` IN (SELECT id FROM `users` WHERE level > 10 ORDER BY rand()) AND `gmt_deleted` IS NULL'
    );

    assert.equal(
      Post.where({
        author_id: raw('(SELECT id FROM `users` WHERE level > 10 ORDER BY rand() LIMIT 1)')
      }).toString(),
      'SELECT * FROM `articles` WHERE `author_id` = (SELECT id FROM `users` WHERE level > 10 ORDER BY rand() LIMIT 1) AND `gmt_deleted` IS NULL'
    );

    assert.equal(
      Post.where({
        author_id: {
          $gt: raw('(SELECT id FROM `users` WHERE level > 10 ORDER BY rand() LIMIT 1)')
        }
      }).toString(),
      'SELECT * FROM `articles` WHERE `author_id` > (SELECT id FROM `users` WHERE level > 10 ORDER BY rand() LIMIT 1) AND `gmt_deleted` IS NULL'
    );
  });

  it('order with raw sql', function() {
    assert.equal(
      Post.order(raw("find_in_set(id, '1,2,3')")).toString(),
      "SELECT * FROM `articles` WHERE `gmt_deleted` IS NULL ORDER BY find_in_set(id, '1,2,3')"
    );
    assert.equal(
      User.order(raw('rand()')).toString(),
      'SELECT * FROM `users` ORDER BY rand()'
    );
  });

  it('delete with raw sql', function () {
    assert.equal(
      User.remove({ deletedAt: raw('CURRENT_TIMESTAMP()') }).toString(),
      'DELETE FROM `users` WHERE `deletedAt` = CURRENT_TIMESTAMP()'
    );
  });

  it('upsert with raw sql', function () {
    assert.equal(
      new Post({ id: 1, title: 'New Post', createdAt: raw('CURRENT_TIMESTAMP()'), updatedAt: raw('CURRENT_TIMESTAMP()') }).upsert().toString(),
      "INSERT INTO `articles` (`id`, `is_private`, `title`, `word_count`, `gmt_create`, `gmt_modified`) VALUES (1, 0, 'New Post', 0, CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP()) ON DUPLICATE KEY UPDATE `id`=VALUES(`id`), `is_private`=VALUES(`is_private`), `title`=VALUES(`title`), `word_count`=VALUES(`word_count`), `gmt_modified`=VALUES(`gmt_modified`)"
    );
  });

  it('select with raw sql', function () {
    assert.equal(
      Post.select('id', raw(`COUNT(title) as count`)).toString(),
      'SELECT `id`, COUNT(title) as count FROM `articles` WHERE `gmt_deleted` IS NULL'
    );
  });

  it('select with non existent columns', function () {
    assert.throws(() => {
      Post.select('id', 'non_existent_column').toString();
    }, /unable to find attribute/i);
  });

  describe('silent should work', function() {
    it('update', function () {
      assert.equal(
        Post.update({ id: 1 }, { title: 'hello' }, { silent: true }).toString(),
        "UPDATE `articles` SET `title` = 'hello' WHERE `id` = 1 AND `gmt_deleted` IS NULL"
      );
    });

    it('increment, decrement', function () {
      assert.equal(
        Book.find({ name: 'hello' }).increment('price', 1, { silent: true }).toString(),
        "UPDATE `books` SET `price` = `price` + 1 WHERE `name` = 'hello' AND `gmt_deleted` IS NULL"
      );

      assert.equal(
        Book.find({ name: 'hello' }).decrement('price', 1, { silent: true }).toString(),
        "UPDATE `books` SET `price` = `price` - 1 WHERE `name` = 'hello' AND `gmt_deleted` IS NULL"
      );

      const fakeDate = new Date(`2012-12-14 12:00:00`).getTime();
      const clock = sinon.useFakeTimers(fakeDate);
      const spell = Book.find({ name: 'hello' });
      spell.silent = false;
      assert.equal(
        spell.decrement('price', 1).toString(),
        "UPDATE `books` SET `price` = `price` - 1, `gmt_modified` = '2012-12-14 12:00:00.000' WHERE `name` = 'hello' AND `gmt_deleted` IS NULL"
      );
      assert.equal(
        spell.decrement('price', 1, { silent: true }).toString(),
        "UPDATE `books` SET `price` = `price` - 1 WHERE `name` = 'hello' AND `gmt_deleted` IS NULL"
      );

      const spell1 = Book.find({ name: 'hello' });
      assert.equal(
        spell1.decrement('price', 1, { silent: true }).toString(),
        "UPDATE `books` SET `price` = `price` - 1 WHERE `name` = 'hello' AND `gmt_deleted` IS NULL"
      );
      assert.equal(
        spell1.decrement('price', 1, { silent: false }).toString(),
        "UPDATE `books` SET `price` = `price` - 1, `gmt_modified` = '2012-12-14 12:00:00.000' WHERE `name` = 'hello' AND `gmt_deleted` IS NULL"
      );
      clock.restore();
    });
  });
});
