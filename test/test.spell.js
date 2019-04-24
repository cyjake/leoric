'use strict'

const assert = require('assert').strict

const { connect } = require('..')
const Post = require('./models/post')
const TagMap = require('./models/tagMap')
const Comment = require('./models/comment')

before(async function() {
  await connect({
    models: `${__dirname}/models`,
    database: 'leoric',
    user: 'root'
  })
})

describe('=> Insert', function() {
  it('insert', function() {
    const date = new Date(2017, 11, 12)
    assert.equal(
      Post.create({ title: 'New Post', createdAt: date, updatedAt: date }).toString(),
      "INSERT INTO `articles` (`title`, `gmt_create`, `gmt_modified`) VALUES ('New Post', '2017-12-12 00:00:00.000', '2017-12-12 00:00:00.000')"
    )
  })

  it('insert ... on duplicate key update', function() {
    const date = new Date(2017, 11, 12)
    assert.equal(
      new Post({ id: 1, title: 'New Post', createdAt: date, updatedAt: date }).upsert().toString(),
      "INSERT INTO `articles` (`id`, `title`, `gmt_create`, `gmt_modified`) VALUES (1, 'New Post', '2017-12-12 00:00:00.000', '2017-12-12 00:00:00.000') ON DUPLICATE KEY UPDATE `id` = LAST_INSERT_ID(`id`), `title` = 'New Post', `gmt_create` = '2017-12-12 00:00:00.000', `gmt_modified` = '2017-12-12 00:00:00.000'"
    )
  })
})

describe('=> Select', function() {
  it('where object condition', function() {
    assert.equal(
      Post.where({ title: { $like: '%Post%' } }).toString(),
      "SELECT * FROM `articles` WHERE `title` LIKE '%Post%' AND `gmt_deleted` IS NULL"
    )
  })

  it('where string conditions', function() {
    assert.equal(
      Post.where('title like ?', '%Post%').toString(),
      "SELECT * FROM `articles` WHERE `title` LIKE '%Post%' AND `gmt_deleted` IS NULL"
    )
  })

  it('where compound string conditions', function() {
    assert.equal(
      Post.where('title like "Arch%" or (title = "New Post" || title = "Skeleton King")').toString(),
      "SELECT * FROM `articles` WHERE (`title` LIKE 'Arch%' OR (`title` = 'New Post' OR `title` = 'Skeleton King')) AND `gmt_deleted` IS NULL"
    )
  })

  it('where arithmetic conditions', function() {
    assert.equal(
      Post.where('id % 2 - 1 = -1').toString(),
      'SELECT * FROM `articles` WHERE `id` % 2 - 1 = -1 AND `gmt_deleted` IS NULL'
    )
  })

  it('where conditions with unary operators', function() {
    assert.equal(
      Post.where('~id = -1').toString(),
      'SELECT * FROM `articles` WHERE ~ `id` = -1 AND `gmt_deleted` IS NULL'
    )
  })

  it('where in Spell', function() {
    assert.equal(
      Post.where({ id: TagMap.select('targetId').where({ tagId: 1 }) }).toString(),
      'SELECT * FROM `articles` WHERE `id` IN (SELECT `target_id` FROM `tag_maps` WHERE `tag_id` = 1) AND `gmt_deleted` IS NULL'
    )
  })

  it('orWhere', function() {
    assert.equal(
      Post.where({ id: 1 }).where('title = ?', 'New Post').orWhere('title = ?', 'Leah').toString(),
      "SELECT * FROM `articles` WHERE (`id` = 1 AND `title` = 'New Post' OR `title` = 'Leah') AND `gmt_deleted` IS NULL"
    )
  })

  it('orHaving', function() {
    assert.equal(
      Post.count().group('authorId').having('count > ?', 10).orHaving('count = 5').toString(),
      'SELECT COUNT(*) AS `count`, `author_id` FROM `articles` WHERE `gmt_deleted` IS NULL GROUP BY `author_id` HAVING `count` > 10 OR `count` = 5'
    )
  })

  it('count / group by / having / order', function() {
    assert.equal(
      Post.group('authorId').count().having({ count: { $gt: 0 } }).order('count desc').toString(),
      'SELECT COUNT(*) AS `count`, `author_id` FROM `articles` WHERE `gmt_deleted` IS NULL GROUP BY `author_id` HAVING `count` > 0 ORDER BY `count` DESC'
    )
  })

  it('select with function call', function() {
    assert.equal(
      Post.select('YEAR(createdAt)').toString(),
      'SELECT YEAR(`gmt_create`) FROM `articles` WHERE `gmt_deleted` IS NULL'
    )
  })

  it('select with function call that takes more than one arguments', function() {
    assert.equal(
      Post.select('IFNULL(title, "Untitled")').toString(),
      "SELECT IFNULL(`title`, 'Untitled') FROM `articles` WHERE `gmt_deleted` IS NULL"
    )
  })

  it('select as', function() {
    assert.equal(
      Post.select('COUNT(id) AS count').toString(),
      'SELECT COUNT(`id`) AS `count` FROM `articles` WHERE `gmt_deleted` IS NULL'
    )
  })

  it('predefined hasOne join', function() {
    assert.equal(
      Post.select('title', 'createdAt').with('attachment').toString(),
      'SELECT `posts`.*, `attachment`.* FROM (SELECT `title`, `gmt_create`, `id` FROM `articles` WHERE `gmt_deleted` IS NULL) AS `posts` LEFT JOIN `attachments` AS `attachment` ON `posts`.`id` = `attachment`.`article_id`'
    )
  })

  it('arbitrary join', function() {
    assert.equal(
      Post.join(Comment, 'comments.articleId = posts.id').toString(),
      'SELECT `posts`.*, `comments`.* FROM (SELECT * FROM `articles` WHERE `gmt_deleted` IS NULL) AS `posts` LEFT JOIN `comments` AS `comments` ON `comments`.`article_id` = `posts`.`id`'
    )
  })
})
