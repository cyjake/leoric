'use strict';

const assert = require('assert').strict;
const path = require('path');

const { connect, Bone } = require('../..');
const Post = require('../models/post');
const TagMap = require('../models/tagMap');
const Comment = require('../models/comment');
const Book = require('../models/book');

before(async function() {
  await connect({
    models: path.resolve(__dirname, '../models'),
    database: 'leoric',
    user: 'root',
    port: process.env.MYSQL_PORT,
  });
});

describe('=> Spell', function() {
  it('rejects query if not connected yet', async () => {
    class Note extends Bone {};
    await assert.rejects(async () => await Note.all);
  });

  it('supports error convention with nodeify', async () => {
    const result = await new Promise((resolve, reject) => {
      Post.create({ title: 'Gettysburg Address' }).nodeify((err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });
    assert.ok(result instanceof Post);
    assert.ok(result.id);
    assert.equal(result.title, 'Gettysburg Address');
  });
});

describe('=> Insert', function() {
  it('insert', function() {
    const date = new Date(2017, 11, 12);
    assert.equal(
      Post.create({ title: 'New Post', createdAt: date, updatedAt: date }).toString(),
      "INSERT INTO `articles` (`gmt_create`, `gmt_modified`, `title`) VALUES ('2017-12-12 00:00:00.000', '2017-12-12 00:00:00.000', 'New Post')"
    );
  });

  it('insert ... on duplicate key update', function() {
    const date = new Date(2017, 11, 12);
    assert.equal(
      new Post({ id: 1, title: 'New Post', createdAt: date, updatedAt: date }).upsert().toString(),
      "INSERT INTO `articles` (`gmt_create`, `gmt_modified`, `id`, `title`) VALUES ('2017-12-12 00:00:00.000', '2017-12-12 00:00:00.000', 1, 'New Post') ON DUPLICATE KEY UPDATE `id` = LAST_INSERT_ID(`id`), `gmt_modified` = '2017-12-12 00:00:00.000', `title` = 'New Post'"
    );
  });
});

describe('=> Select', function() {
  it('where object condition', function() {
    assert.equal(
      Post.where({ title: { $like: '%Post%' } }).toString(),
      "SELECT * FROM `articles` WHERE `title` LIKE '%Post%' AND `gmt_deleted` IS NULL"
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
});

describe('=> Update', () => {
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
});

describe('=> Delete', () => {
  it('where object condition', function() {
    const sqlString = Post.remove({ title: { $like: '%Post%' } }).toString();
    assert(/UPDATE `articles` SET `gmt_deleted` = '[\s\S]*' WHERE `title` LIKE '%Post%' AND `gmt_deleted` IS NULL$/.test(sqlString));
  });

  it('force delete', function() {
    const sqlString = Post.remove({ title: { $like: '%Post%' } }, true).toString();
    assert.equal(sqlString, "DELETE FROM `articles` WHERE `title` LIKE '%Post%'");
  });

  it('set deletedAt', function() {
    const sqlString = Post.remove({ title: { $like: '%Post%' }, deletedAt: new Date() }).toString();
    assert(/UPDATE `articles` SET `gmt_deleted` = '[\s\S]*' WHERE `title` LIKE '%Post%' AND `gmt_deleted` = '[\s\S]*'$/.test(sqlString));
  });
});
