'use strict'

const expect = require('expect.js')

const { connect } = require('..')
const Post = require('./models/post')
const TagMap = require('./models/tagMap')
const Comment = require('./models/comment')

before(async function() {
  this.timeout(5000)
  await connect(require('./config'))
})

describe('=> Insert', function() {
  it('insert', function() {
    const date = new Date(2017, 11, 12)
    expect(Post.create({ title: 'New Post', createdAt: date, updatedAt: date }).toString()).to.equal(
      "INSERT INTO `articles` (`title`, `gmt_create`, `gmt_modified`) VALUES ('New Post', '2017-12-12 00:00:00.000', '2017-12-12 00:00:00.000')"
    )
  })

  it('insert ... on duplicate key update', function() {
    const date = new Date(2017, 11, 12)
    expect(new Post({ id: 1, title: 'New Post', createdAt: date, updatedAt: date }).upsert().toString()).to.equal(
      "INSERT INTO `articles` (`id`, `title`, `gmt_create`, `gmt_modified`) VALUES (1, 'New Post', '2017-12-12 00:00:00.000', '2017-12-12 00:00:00.000') ON DUPLICATE KEY UPDATE `id` = 1, `title` = 'New Post', `gmt_create` = '2017-12-12 00:00:00.000', `gmt_modified` = '2017-12-12 00:00:00.000'"
    )
  })
})

describe('=> Select', function() {
  it('where object condition', function() {
    expect(Post.where({ title: { $like: '%Post%' } }).toString()).to.equal(
      "SELECT * FROM `articles` WHERE `title` LIKE '%Post%' AND `gmt_deleted` IS NULL"
    )
  })

  it('where string conditions', function() {
    expect(Post.where('title like ?', '%Post%').toString()).to.equal(
      "SELECT * FROM `articles` WHERE `title` LIKE '%Post%' AND `gmt_deleted` IS NULL"
    )
  })

  it('where compound string conditions', function() {
    expect(Post.where('title like "Arch%" or (title = "New Post" || title = "Skeleton King")').toString()).to.equal(
      "SELECT * FROM `articles` WHERE (`title` LIKE 'Arch%' OR (`title` = 'New Post' OR `title` = 'Skeleton King')) AND `gmt_deleted` IS NULL"
    )
  })

  it('where in Spell', function() {
    expect(Post.where({ id: TagMap.select('targetId').where({ tagId: 1 }) }).toString()).to.equal(
      'SELECT * FROM `articles` WHERE `id` IN (SELECT `target_id` FROM `tag_maps` WHERE `tag_id` = 1) AND `gmt_deleted` IS NULL'
    )
  })

  it('count / group by / having /order', function() {
    expect(Post.group('authorId').count().having({ count: { $gt: 0 } }).order('count desc').toString()).to.equal(
      'SELECT COUNT(*) AS `count`, `author_id` FROM `articles` WHERE `gmt_deleted` IS NULL GROUP BY `author_id` HAVING `count` > 0 ORDER BY `count` DESC'
    )
  })

  it('select with function call', function() {
    expect(Post.select('YEAR(createdAt)').toString()).to.equal(
      'SELECT YEAR(`gmt_create`) FROM `articles` WHERE `gmt_deleted` IS NULL'
    )
  })

  it('select with function call that takes more than one arguments', function() {
    expect(Post.select('IFNULL(title, "Untitled")').toString()).to.equal(
      "SELECT IFNULL(`title`, 'Untitled') FROM `articles` WHERE `gmt_deleted` IS NULL"
    )
  })

  it('select as', function() {
    expect(Post.select('COUNT(id) AS count').toString()).to.equal(
      'SELECT COUNT(`id`) AS `count` FROM `articles` WHERE `gmt_deleted` IS NULL'
    )
  })

  it('predefined hasOne join', function() {
    expect(Post.select('title', 'createdAt').with('attachment').toString()).to.equal(
      'SELECT `posts`.*, `attachment`.* FROM (SELECT `title`, `gmt_create`, `id` FROM `articles` WHERE `gmt_deleted` IS NULL) AS `posts` LEFT JOIN `attachments` AS `attachment` ON `posts`.`id` = `attachment`.`article_id`'
    )
  })

  it('arbitrary join', function() {
    expect(Post.join(Comment, 'comments.articleId = posts.id').toString()).to.equal(
      'SELECT `posts`.*, `comments`.* FROM (SELECT * FROM `articles` WHERE `gmt_deleted` IS NULL) AS `posts` LEFT JOIN `comments` AS `comments` ON `comments`.`article_id` = `posts`.`id`'
    )
  })
})
