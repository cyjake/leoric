'use strict';

const assert = require('assert').strict;

const { connect, raw, Bone } = require('../..');

class Post extends Bone {
  static table = 'articles'
  static initialize() {
    this.hasOne('attachment', { foreignKey: 'articleId' });
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
        if (err) reject(err);
        else resolve(result);
      });
    });
    assert.ok(post instanceof Post);
    assert.ok(post.id);
    assert.equal(post.title, 'Gettysburg Address');
  });

  it('insert', function() {
    const date = new Date(2017, 11, 12);
    assert.equal(
      Post.create({ title: 'New Post', createdAt: date, updatedAt: date }).toString(),
      "INSERT INTO `articles` (`title`, `gmt_create`, `gmt_modified`) VALUES ('New Post', '2017-12-12 00:00:00.000', '2017-12-12 00:00:00.000')"
    );
  });

  it('insert ... on duplicate key update', function() {
    const date = new Date(2017, 11, 12);
    assert.equal(
      new Post({ id: 1, title: 'New Post', createdAt: date, updatedAt: date }).upsert().toString(),
      "INSERT INTO `articles` (`id`, `title`, `gmt_modified`) VALUES (1, 'New Post', '2017-12-12 00:00:00.000') ON DUPLICATE KEY UPDATE `id` = LAST_INSERT_ID(`id`), `id`=VALUES(`id`), `title`=VALUES(`title`), `gmt_modified`=VALUES(`gmt_modified`)"
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
        "SELECT * FROM `articles` WHERE (`title` = 'Leah' AND `title` = 'Diablo') AND `gmt_deleted` IS NULL"
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
        "SELECT * FROM `articles` WHERE (`title` = 'Leah' AND `title` LIKE '%Leah%') AND `gmt_deleted` IS NULL"
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
        "SELECT * FROM `articles` WHERE (`title` = 'Leah' AND `title` != 'Leah') AND `gmt_deleted` IS NULL"
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
        "SELECT * FROM `articles` WHERE (`title` IS NULL AND `title` != 'Leah') AND `gmt_deleted` IS NULL"
      );
    });

    it('not', () => {
      assert.equal(
        Post.where({
          is_private: {
            $not: [
              1,
              2
            ]
          }
        }).toSqlString(),
        'SELECT * FROM `articles` WHERE (NOT IN (1,2)) AND `gmt_deleted` IS NULL'
      );

      assert.equal(
        Post.where({
          is_private: {
            $not: [
              null,
              2
            ]
          }
        }).toSqlString(),
        'SELECT * FROM `articles` WHERE (NOT IN (NULL,2)) AND `gmt_deleted` IS NULL'
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
        'SELECT * FROM `articles` WHERE (NOT (`is_private` = 1 AND `is_private` <= 6)) AND `gmt_deleted` IS NULL'
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
        "SELECT * FROM `articles` WHERE (`title` = 'Leah' OR `title` != 'Leah') AND (`is_private` >= 1 AND `is_private` <= 6) AND `gmt_deleted` IS NULL"
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
        "SELECT * FROM `articles` WHERE (`title` = 'Leah' OR `title` != 'Leah') AND (`is_private` >= 1 AND `is_private` <= 6) AND (NOT (`author_id` = 100 AND `author_id` <= 2)) AND `gmt_deleted` IS NULL"
      );
    });
  });

  it('where string conditions', function() {
    assert.equal(
      Post.where('title like ?', '%Post%').toString(),
      "SELECT * FROM `articles` WHERE `title` LIKE '%Post%' AND `gmt_deleted` IS NULL"
    );
  });

  it('where compound string conditions', function() {
    assert.equal(
      Post.where('title like "Arch%" or (title = "New Post" || title = "Skeleton King")').toString(),
      "SELECT * FROM `articles` WHERE (`title` LIKE 'Arch%' OR (`title` = 'New Post' OR `title` = 'Skeleton King')) AND `gmt_deleted` IS NULL"
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

  it('where in Spell', function() {
    assert.equal(
      Post.where({ id: TagMap.select('targetId').where({ tagId: 1 }) }).toString(),
      'SELECT * FROM `articles` WHERE `id` IN (SELECT `target_id` FROM `tag_maps` WHERE `tag_id` = 1) AND `gmt_deleted` IS NULL'
    );
  });

  it('orWhere', function() {
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

  it('count / group by / having / order', function() {
    assert.equal(
      Post.group('authorId').count().having({ count: { $gt: 0 } }).order('count desc').toString(),
      'SELECT `author_id`, COUNT(*) AS `count` FROM `articles` WHERE `gmt_deleted` IS NULL GROUP BY `author_id` HAVING `count` > 0 ORDER BY `count` DESC'
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

  it('predefined hasOne join', function() {
    assert.equal(
      Post.select('title', 'createdAt').with('attachment').toString(),
      'SELECT `posts`.`title`, `posts`.`gmt_create`, `attachment`.* FROM `articles` AS `posts` LEFT JOIN `attachments` AS `attachment` ON `posts`.`id` = `attachment`.`article_id` AND `attachment`.`gmt_deleted` IS NULL WHERE `posts`.`gmt_deleted` IS NULL'
    );
  });

  it('arbitrary join', function() {
    assert.equal(
      Post.join(Comment, 'comments.articleId = posts.id').toString(),
      'SELECT `posts`.*, `comments`.* FROM `articles` AS `posts` LEFT JOIN `comments` AS `comments` ON `comments`.`article_id` = `posts`.`id` WHERE `posts`.`gmt_deleted` IS NULL'
    );
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

  it('order by string with multiple condition', () => {
    assert.equal(
      Post.order('id asc, gmt_created desc').toString(),
      'SELECT * FROM `articles` WHERE `gmt_deleted` IS NULL ORDER BY `id`, `gmt_created` DESC'
    );
  });

  it('increment', () => {
    assert.equal(
      Book.where({ isbn: 9787550616950 }).increment('price').toString(),
      'UPDATE `books` SET `price` = `price` + 1 WHERE `isbn` = 9787550616950 AND `gmt_deleted` IS NULL'
    );
  });

  it('decrement', () => {
    assert.equal(
      Book.where({ isbn: 9787550616950 }).decrement('price').toString(),
      'UPDATE `books` SET `price` = `price` - 1 WHERE `isbn` = 9787550616950 AND `gmt_deleted` IS NULL'
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
      "INSERT INTO `articles` (`title`, `gmt_create`, `gmt_modified`) VALUES ('New Post', CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP())"
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
      "INSERT INTO `articles` (`id`, `title`, `gmt_modified`) VALUES (1, 'New Post', CURRENT_TIMESTAMP()) ON DUPLICATE KEY UPDATE `id` = LAST_INSERT_ID(`id`), `id`=VALUES(`id`), `title`=VALUES(`title`), `gmt_modified`=VALUES(`gmt_modified`)"
    );
  });
});
