'use strict'

const assert = require('assert')
const expect = require('expect.js')

const { Bone } = require('../..')

const Attachment = require('../models/attachment')
const Book = require('../models/book')
const Comment = require('../models/comment')
const Post = require('../models/post')
const TagMap = require('../models/tagMap')
const Tag = require('../models/tag')
const Like = require('../models/like')

module.exports = function() {
  describe('=> Attributes', function() {
    before(async function() {
      await Post.create({
        title: 'New Post',
        extra: { versions: [2, 3] },
        thumb: 'https://a1.alicdn.com/image/2016/09/21/29f93b05-5d4a-4b57-99e8-71c52803b9a3.png'
      })
    })

    after(async function() {
      await Post.remove({}, true)
    })

    it('bone.attribute(name)', async function() {
      const post = new Post({ title: 'Untitled' })
      expect(post.attribute('title')).to.eql('Untitled')
      post.title = 'New Post'
      expect(post.title).to.eql('New Post')
      expect(() => post.attribute('non-existant attribute')).to.throwException()
    })

    it('bone.attribute(unset attribute)', async function() {
      const post = await Post.first.select('title')
      expect(() => post.thumb).to.throwException()
      expect(() => post.attribute('thumb')).to.throwException()
    })

    it('bone.attribute(name, value)', async function() {
      const post = new Post({ title: 'Untitled' })
      post.attribute('title', undefined)
      expect(post.attribute('title')).to.be(null)
    })

    it('bone.attribute(unset attribute, value)', async function() {
      const post = await Post.first.select('title')
      expect(() => post.attribute('thumb', 'foo')).to.not.throwException()
      expect(post.attribute('thumb')).to.eql('foo')
    })

    it('bone.attributeWas(name) should be undefined when initialized', async function() {
      const post = new Post({ title: 'Untitled' })
      expect(post.attributeWas('createdAt')).to.be(null)
    })

    it('bone.attributeWas(name) should return original value if instance is persisted before', async function() {
      const post = await Post.findOne({})
      const titleWas = post.title
      post.title = 'Skeleton King'
      expect(post.attributeWas('title')).to.eql(titleWas)
    })

    it('bone.attributeChanged(name)', async function() {
      const post = new Post({ title: 'Untitled' })
      expect(post.createdAt).to.not.be.ok()
      expect(post.attributeChanged('createdAt')).to.be(false)
      post.createdAt = new Date()
      expect(post.attributeChanged('createdAt')).to.be(true)
    })

    it('bone.attributeChanged(name) should be false when first fetched', async function() {
      const post = await Post.findOne({})
      expect(post.attributeChanged('createdAt')).to.be(false)
    })

    it('bone.attributeChanged(name) should behave consistently on special types such as object', async function() {
      const post = await Post.findOne({ extra: { $ne: null } })
      expect(post.attributeChanged('extra')).to.be(false)
      post.extra.foo = 'bar'
      expect(post.attributeChanged('extra')).to.be(true)
    })

    // This test case might be misleading. Model authors can use Bone.attribute(name, { type })
    // to override attribute types. Other usage of Bone.attribute have got no effect.
    it('Bone.attribute(name, meta) sets column meta, should not be public', async function() {
      Post.attribute('extra', { foo: 'bar' })
      expect(Post.schema['extra']['foo']).to.eql('bar')
      delete Post.schema['extra']['foo']
      expect(() => Post.attribute('non-existant attribtue', { foo: 'bar' })).to.throwException()
    })

    it('Bone.renameAttribute(name, newName)', async function() {
      Post.renameAttribute('thumb', 'thumbnail')
      const post = await Post.findOne({ thumbnail: { $ne: null } })
      expect(post.thumbnail).not.to.be(undefined)

      Post.renameAttribute('thumbnail', 'thumb')
      const post2 = await Post.findOne({ thumb: { $ne: null } })
      expect(post2.thumb).to.be.ok()
    })
  })

  // Attribute get/set
  describe('=> Accessor', function() {
    it('provides bone.attr & bone.attr= by default', async function() {
      const post = new Post()
      post.name = 'Skeleton King'
      expect(post.name).to.eql('Skeleton King')
    })

    it('bone.attr can be overriden by subclass', async function() {
      const book = new Book({ price: Math.PI })
      expect(book.price).to.eql(3.14)
      book.price = 42
      expect(book.price).to.eql(42)
    })

    it('bone.attr= can be overriden by subclass', async function() {
      const book = new Book({ name: 'Speaking JavaScript' })
      expect(() => book.isbn = null).to.throwException()
      book.isbn = 9781449365035
      expect(book.isbn).to.eql(9781449365035)
    })
  })

  describe('=> Getter', function() {
    it('Bone.table should be the model name in plural', function() {
      expect(Comment.table).to.eql('comments')
    })

    it('.table can be overriden with a static table getter', function() {
      /**
       * class Post {
       *   static get table() {
       *     return 'articles'
       *   }
       * }
       */
      expect(Post.table).to.eql('articles')
    })

    it('Bone.primaryKey should default to `id`', function() {
      expect(Post.primaryKey).to.eql('id')
    })

    it('Bone.primaryKey can be overriden with a static primaryKey getter', function() {
      /**
       * class Book {
       *   static get primaryKey() {
       *     return 'isbn'
       *   }
       * }
       */
      expect(Book.primaryKey).to.eql('isbn')
    })

    it('Bone.primaryColumn should be Bone.primaryKey in snake_case', function() {
      expect(Post.primaryColumn).to.eql('id')
      expect(Book.primaryColumn).to.eql('isbn')
    })

    it('Bone.columns should contain the names of columns', function() {
      expect(Post.columns).to.be.a(Array)
      expect(Post.columns.length).to.be.above(1)
      expect(Post.columns.includes('title')).to.be.ok()
      expect(Post.columns.includes('gmt_create')).to.be.ok()
    })

    it('Bone.attributes should be the names of attributes', function() {
      // Bone.renameAttribute('oldName', 'newName')
      expect(Post.attributes).to.be.a(Array)
      expect(Post.attributes.length).to.be.above(1)
      expect(Post.attributes.includes('title')).to.be.ok()
      expect(Post.attributes.includes('createdAt')).to.be.ok()
    })
  })

  describe('=> Integration', function() {
    before(async function() {
      await Post.create({
        title: 'New Post',
        extra: { versions: [2, 3] },
        thumb: 'https://a1.alicdn.com/image/2016/09/21/29f93b05-5d4a-4b57-99e8-71c52803b9a3.png'
      })
    })

    after(async function() {
      await Post.remove({}, true)
    })

    it('bone.inspect()', async function() {
      const post = await Post.findOne({ title: 'New Post' })
      const result = post.inspect()

      expect(result).to.be.an('string')
      expect(result).to.contain('Post')
      expect(result).to.contain('New Post')
    })

    it('bone.toJSON()', async function() {
      const post = await Post.findOne({ title: 'New Post' })
      const result = post.toJSON()

      delete result.updatedAt
      delete result.createdAt

      expect(result).to.be.an('object')
      expect(result.id).to.be.ok()
      expect(result.title).to.equal('New Post')
      expect(result.extra).to.eql({ versions: [2, 3] })
    })

    it('bone.toJSON() with missing attributes', async function() {
      const post = await Post.findOne({ title: 'New Post' }).select('title')
      const result = post.toJSON()
      expect(result).to.eql({ title: 'New Post' })
    })

    it('bone.toJSON() prefers getter properties over bone.attribute(name)', async function() {
      const post = await Post.findOne({ title: 'New Post' })
      const result = post.toJSON()
      expect(result.title).to.equal('New Post')
    })

    it('bone.toObject() with missing attributes', async function() {
      const post = await Post.findOne({ title: 'New Post' }).select('title')
      const result = post.toObject()
      expect(result).to.eql({ title: 'New Post' })
    })

    it('bone.toObject() prefers bone.attribute(name) over getter properties', async function() {
      const post = await Post.findOne({ title: 'New Post' })
      const result = post.toObject()
      expect(result).to.be.an('object')
      expect(result.title).to.be('New Post')
    })
  })

  describe('=> Type casting', function() {
    it('Bone.cast(value, type)', async function() {
      const json = Bone.cast('{"test":1}', JSON)
      expect(json.test).to.eql(1)
      expect(json).to.be.an('object')

      const string = Bone.cast('string', String)
      expect(string).to.eql('string')
    })

    it('Bone.uncast(value, type)', async function() {
      const json = Bone.uncast({test:1}, JSON)
      expect(json).to.be.a('string')
      expect(json).to.contain('test')

      const string = Bone.uncast('string', String)
      expect(string).to.eql('string')
    })

    it('Bone.unalias(attribute)', function() {
      expect(Post.unalias('updatedAt')).to.eql('gmt_modified')
      expect(Post.unalias('title')).to.eql('title')
    })

    it('Bone.reflectType(type)', function() {
      expect(Bone.reflectType('bigint')).to.be(Number)
      expect(Bone.reflectType('smallint')).to.be(Number)
      expect(Bone.reflectType('tinyint')).to.be(Number)
      expect(Bone.reflectType('int')).to.be(Number)
      expect(Bone.reflectType('datetime')).to.be(Date)
      expect(Bone.reflectType('longtext')).to.be(String)
      expect(Bone.reflectType('mediumtext')).to.be(String)
      expect(Bone.reflectType('text')).to.be(String)
      expect(Bone.reflectType('varchar')).to.be(String)
      expect(Bone.reflectType('timestamp')).to.be(String)
    })

    it('Bone.reflectClass(ClassName)', function() {
      expect(Post.reflectClass('Post')).to.be(Post)
      expect(Post.reflectClass('Comment')).to.be(Comment)
      expect(Post.reflectClass('Attachment')).to.be(Attachment)
      expect(() => Post.reflectClass('NonExistantModel')).to.throwException()
    })

    it('Bone.instantiate(entry)', function() {
      const post = Post.instantiate({
        id: 1,
        title: 'Archbishop Lazarus',
        extra: JSON.stringify({ versions: [2] })
      })
      expect(post).to.be.a(Post)
      expect(post.title).to.equal('Archbishop Lazarus')
    })
  })

  describe('=> Automatic Versioning', function() {
    before(async function() {
      await Promise.all([
        Post.create({ title: 'New Post' }),
        Post.create({ title: 'New Post 2' }),
        Post.create({ title: 'Leah' })
      ])
    })

    after(async function() {
      await Post.remove({}, true)
    })

    it('Allows multiple stops', async function() {
      const query = Post.find('title like ?', '%Post%')
      expect((await query.limit(1)).length).to.be(1)
      expect((await query).length).to.be(2)
      expect((await query.order('title')).map(post => post.title)).to.eql([
        'New Post', 'New Post 2'
      ])
    })
  })

  describe('=> Query', function() {
    before(async function() {
      await Promise.all([
        Post.create({ id: 1, title: 'New Post', createdAt: new Date(2017, 10) }),
        Post.create({ id: 2, title: 'Archbishop Lazarus', createdAt: new Date(2017, 10) }),
        Post.create({ id: 3, title: 'Archangel Tyrael', isPrivate: true }),
        Post.create({ id: 4, title: 'Diablo', deletedAt: new Date(2012, 4, 15) })
      ])
    })

    after(async function() {
      await Post.remove({}, true)
    })

    it('.all', async function() {
      const posts = await Post.all
      expect(posts.length).to.be(3)
      expect(posts.map(post => post.title)).to.contain('New Post')
    })

    it('.first', async function() {
      const post = await Post.first
      expect(post).to.be.a(Post)
      expect(post.title).to.be('New Post')
    })

    it('.last', async function() {
      const post = await Post.last
      expect(post).to.be.a(Post)
      expect(post.title).to.be('Archangel Tyrael')
    })

    it('.unscoped', async function() {
      const posts = await Post.unscoped.all
      expect(posts.length).to.be(4)
      const post = await Post.unscoped.last
      expect(post).to.eql(posts[3])
    })

    it('.get()', async function() {
      expect(await Post.get(0)).to.eql(await Post.first)
      expect(await Post.get(2)).to.eql(await Post.last)
      expect(await Post.unscoped.get(2)).to.eql(await Post.unscoped.last)
    })

    it('.findOne()', async function() {
      const post = await Post.findOne()
      expect(post).to.be.a(Post)
      expect(post.id).to.be.ok()
    })

    it('.findOne(id)', async function() {
      const post = await Post.first
      expect(await Post.findOne(post.id)).to.eql(post)
    })

    // the same as Model.all
    it('.find()', async function() {
      const posts = await Post.find()
      expect(posts.length).to.be(3)
      expect(posts.map(post => post.title)).to.contain('New Post')
    })

    it('.find(id)', async function() {
      const post = await Post.first
      const posts = await Post.find(post.id)
      expect(posts.length).to.be(1)
      expect(posts[0]).to.be.a(Post)
      expect(posts[0].title).to.eql('New Post')
    })

    it('.find([ id ])', async function() {
      const postIds = (await Post.all).map(post => post.id)
      const posts = await Post.find(postIds)
      expect(posts.map(post => post.title)).to.contain('New Post')
    })

    it('.find({ foo })', async function() {
      const posts = await Post.find({ title: 'New Post' })
      expect(posts.length).to.be(1)
      expect(posts[0]).to.be.a(Post)
      expect(posts[0].title).to.be('New Post')
    })

    it('.find({ foo: null })', async function() {
      const posts = await Post.find({ thumb: null })
      expect(posts.length).to.be(3)
      expect(posts[0]).to.be.a(Post)
      expect(posts[0].thumb).to.eql(null)
    })

    it('.find({ foo: [] })', async function() {
      const posts = await Post.find({ title: ['New Post', 'Archangel Tyrael'] })
      expect(posts.length).to.be(2)
      expect(posts.map(post => post.title)).to.eql([
        'New Post', 'Archangel Tyrael'
      ])
    })

    it('.find({ foo: Set })', async function() {
      const posts = await Post.find({ title: new Set(['New Post', 'Archangel Tyrael']) })
      expect(posts.map(post => post.title)).to.eql([
        'New Post', 'Archangel Tyrael'
      ])
    })

    it('.find({ foo: Date })', async function() {
      const posts = await Post.find('createdAt <= ?', new Date(2017, 11))
      expect(posts.map(post => post.title)).to.eql(['New Post', 'Archbishop Lazarus'])
    })

    it('.find({ foo: boolean })', async function() {
      const posts = await Post.find({ isPrivate: true })
      expect(posts.map(post => post.title)).to.eql([ 'Archangel Tyrael' ])
      expect((await Post.find({ isPrivate: false })).length).to.be(2)
    })

    it('.find { limit }', async function() {
      const posts = await Post.find({}, { limit: 1 })
      expect(posts.length).to.equal(1)
      expect(posts[0]).to.be.a(Post)
    })

    it('.find { order }', async function() {
      const posts = await Post.find({}, { order: 'id desc', limit: 3 })
      expect(posts[0].id).to.be.above(posts[1].id)
      expect(posts[1].id).to.be.above(posts[2].id)
    })

    it('.find { offset }', async function() {
      const posts1 = await Post.find({}, { order: 'id asc', limit: 3 })
      const posts2 = await Post.find({}, { order: 'id asc', limit: 3, offset: 1 })

      expect(posts1[1].id).to.equal(posts2[0].id)
      expect(posts1[2].id).to.equal(posts2[1].id)
    })

    it('.find { select }', async function() {
      const post = await Post.findOne({ title: 'New Post' }, { select: 'title' })
      expect(post.title).to.equal('New Post')
      expect(() => post.content).to.throwError()
    })

    it('.find aliased attribute', async function() {
      const post = await Post.findOne({ deletedAt: { $ne: null } })
      expect(post.deletedAt).to.be.a(Date)
    })

    it('.find undefined', async function() {
      const post = await Post.findOne({ extra: undefined })
      expect(post.extra).to.be(null)
    })
  })

  describe('=> Query $op', function() {
    before(async function() {
      await Post.create({ id: 1, title: 'New Post', createdAt: new Date(2012, 4, 15) })
      await Post.create({ id: 2, title: 'Diablo' })
      await Post.create({ id: 99, title: 'Leah' })
      await Post.create({ id: 100, title: 'Deckard Cain' })
    })

    after(async function() {
      await Post.remove({}, true)
    })

    it('.find $eq', async function() {
      const posts = await Post.find({ title: { $eq: 'New Post' } })
      expect(posts.length).to.be.above(0)
      expect(posts[0].title).to.equal('New Post')
    })

    it('.find $eq Date', async function() {
      const posts = await Post.find({ createdAt: { $eq: new Date(2012, 4, 15) } })
      expect(posts.length).to.be(1)
      expect(posts[0].title).to.be('New Post')
    })

    it('.find $gt', async function() {
      const posts = await Post.find({ id: { $gt: 99 } }, { limit: 10 })
      expect(posts.length).to.be.above(0)
      expect(posts[0].id).to.be.above(99)
    })

    it('.find $gte', async function() {
      const posts = await Post.find({ id: { $gte: 100 }}, { limit: 10 })
      expect(posts.length).to.be.above(0)
      expect(posts[0].id).to.be.above(99)
    })

    it('.find $lt', async function() {
      const posts = await Post.find({ id: { $lt: 100 }}, { limit: 10 })
      expect(posts.length).to.be.above(0)
      expect(posts[0].id).to.be.below(100)
    })

    it('.find $lte', async function() {
      const posts = await Post.find({ id: { $lte: 99 }}, { limit: 10 })
      expect(posts.length).to.be.above(0)
      expect(posts[0].id).to.be.below(100)
    })

    it('.find $ne', async function() {
      const posts = await Post.find({ id: { $ne: 100 }}, { limit: 10 })
      expect(posts.some(post => post.id == 100)).to.not.be.ok()
    })

    it('.find $between', async function() {
      const post = await Post.findOne({ id: { $between: [90, 100] }})
      expect(post.id).to.be.above(90)
      expect(post.id).to.be.below(100)
    })

    it('.find $notBetween', async function() {
      const post = await Post.findOne({ id: { $notBetween: [1, 2] }})
      expect(post.id).to.be.above(2)
    })

    it('.find $in', async function() {
      const post = await Post.findOne({ id: { $in: [1, 2, 3] } })
      expect(post.id).to.equal(1)
    })

    it('.find $notIn or $nin', async function() {
      const post1 = await Post.findOne({ id: { $nin: [1, 2, 3]} })
      expect(post1.id).to.above(3)
      const post2 = await Post.findOne({ id: { $notIn: [1, 2, 3]} })
      expect(post2.id).to.above(3)
    })

    it('.find $like', async function() {
      const post = await Post.findOne({ title: { $like: '%Post%' } })
      expect(post.title).to.match(/Post/)
    })

    it('.find $notLike', async function() {
      const post = await Post.findOne({ title: { $notLike: '%Post' } })
      expect(post.title).to.not.match(/Post/)
    })
  })

  describe('=> Where', function() {
    before(async function() {
      await Promise.all([
        Post.create({ title: 'New Post', authorId: 1 }),
        Post.create({ title: 'Skeleton King', authorId: 1 }),
        Post.create({ title: 'Archbishop Lazarus', authorId: 2 })
      ])
    })

    after(async function() {
      await Post.remove({}, true)
    })

    it('.where({ foo, bar })', async function() {
      const posts = await Post.where({ title: ['New Post', 'Skeleton King'], authorId: 2 })
      expect(posts).to.be.empty()
    })

    it('.where(query, ...values)', async function() {
      const posts = await Post.where('title = ? and authorId = ?', ['New Post', 'Skeleton King'], 2)
      expect(posts).to.be.empty()
    })

    it('.where(compoundQuery, ...values)', async function() {
      const posts = await Post.where('authorId = ? || (title = ? && authorId = ?)', 2, 'New Post', 1).order('authorId')
      expect(posts.length).to.be(2)
      expect(posts[0].title).to.equal('New Post')
      expect(posts[0].authorId).to.equal(1)
      expect(posts[1].title).to.equal('Archbishop Lazarus')
      expect(posts[1].authorId).to.equal(2)
    })
  })

  describe('=> Select', function() {
    before(async function() {
      await Post.create({ id: 1, title: 'New Post', createdAt: new Date(2012, 4, 15) })
    })

    after(async function() {
      await Post.remove({}, true)
    })

    it('.select(...name)', async function() {
      const post = await Post.select('id', 'title').first
      expect(post.toJSON()).to.eql({ id: 1, title: 'New Post' })
    })

    it('.select(names[])', async function() {
      const post = await Post.select(['id', 'title']).first
      expect(post.toJSON()).to.eql({ id: 1, title: 'New Post' })
    })

    it('.select(name => filter(name))', async function() {
      const post = await Post.select(name => name == 'id' || name == 'title').first
      expect(post.toJSON()).to.eql({ id: 1, title: 'New Post' })
    })

    it('.select("...name")', async function() {
      const post = await Post.select('id, title').first
      expect(post.toJSON()).to.eql({ id: 1, title: 'New Post' })
    })
  })

  describe('=> Scopes', function() {
    before(async function() {
      const results = await Promise.all([
        Post.create({ title: 'New Post', deletedAt: new Date() }),
        Tag.create({ name: 'npc', type: 0 })
      ])
      const [postId, tagId] = results.map(result => result.id)
      await TagMap.create({ targetId: postId, targetType: 0, tagId })
    })

    after(async function() {
      await Promise.all([
        Post.remove({}, true),
        Tag.remove({}, true),
        TagMap.remove({}, true)
      ])
    })

    it('.find({ deleteAt: null }) by default', async function() {
      expect(await Post.findOne({ title: 'New Post' })).to.be(null)
    })

    it('.find().unscoped removes default scopes', async function() {
      const post = await Post.findOne({ title: 'New Post' }).unscoped
      expect(post).to.be.a(Post)
      expect(post.title).to.be('New Post')
    })

    it('.update().unscoped', async function() {
      await Post.update({ title: 'New Post' }, { title: 'Skeleton King' })
      expect(await Post.findOne({ title: 'Skeleton King' })).to.be(null)
      await Post.update({ title: 'New Post' }, { title: 'Skeleton King' }).unscoped
      expect(await Post.findOne({ title: 'New Post' })).to.be(null)
    })
  })


  describe('=> Associations', function() {
    // http://diablo.wikia.com/wiki/Archbishop_Lazarus
    const comments = [
      'Abandon your foolish quest!',
      'All that awaits you is the wrath of my master!',
      'You are too late to save the child!',
      "Now you'll join him"
    ]

    const tagNames = ['npc', 'boss', 'player']
    const topicNames = ['nephalem', 'archangel', 'demon']

    function mapTags(post, tags) {
      return Promise.all(
        tags.map(tag => TagMap.create({ tagId: tag.id, targetId: post.id, targetType: 0 }))
      )
    }

    before(async function() {
      const posts = [
        await Post.create({ title: 'Archbishop Lazarus' }),
        await Post.create({ title: 'Leah' })
      ]
      const tags = await Promise.all(tagNames.map(name => Tag.create({ name, type: 0 })))
      const topics = await Promise.all(topicNames.map(name => Tag.create({ name, type: 1 })))

      for (const post of posts) {
        await Promise.all([
          Attachment.create({
            url: 'https://img.alicdn.com/tfs/TB1mIGsfZLJ8KJjy0FnXXcFDpXa-190-140.png',
            postId: post.id
          })
        ])
      }

      await Promise.all(comments.map(content => {
        return Comment.create({ content, articleId: posts[0].id })
      }))
      await mapTags(posts[0], tags.slice(0, 2))
      await mapTags(posts[0], topics.slice(2, 3))
      await mapTags(posts[1], tags.slice(2, 3))
      await mapTags(posts[1], topics.slice(0, 1))
    })

    after(async function() {
      await Promise.all([
        Post.remove({}, true),
        Attachment.remove({}, true),
        Comment.remove({}, true),
        TagMap.remove({}, true),
        Tag.remove({}, true)
      ])
    })

    it('Bone.hasOne', async function() {
      const post = await Post.first.with('attachment')
      expect(post.attachment).to.be.a(Attachment)
    })

    it('Bone.belongsTo', async function() {
      const attachment = await Attachment.first.with('post')
      expect(attachment.post).to.be.a(Post)
    })

    it('Bone.hasMany', async function() {
      const post = await Post.first.with('comments')
      expect(post.comments.length).to.be.above(0)
      expect(post.comments[0]).to.be.a(Comment)
      expect(post.comments.map(comment => comment.content).sort()).to.eql(comments.sort())
    })

    it('Bone.hasMany through', async function() {
      const posts = await Post.include('tags')
      expect(posts[0].tags.length).to.greaterThan(0)
      expect(posts[0].tags[0]).to.be.a(Tag)
      expect(posts[0].tags.map(tag => tag.name).sort()).to.eql(['npc', 'boss'].sort())
      expect(posts[1].tags.map(tag => tag.name)).to.eql(['player'])
    })

    it('Bone.hasMany through / finding RefModel', async function() {
      // It seems mysql2 analyses queries and tries to return cached results if possible. Without the `.limit(1)` part, the query generated below is no different than the one above, except the `AS topics` part, which then gives wrong result because the qualifier `tags` is used instead of `topics`.
      const posts = await Post.include('topics').limit(1)
      expect(posts[0].topics.map(tag => tag.name)).to.eql(['demon'])
    })

    it('.with(...names)', async function() {
      const post = await Post.first.with('attachment', 'comments', 'tags')
      expect(post.tags[0]).to.be.a(Tag)
      expect(post.tagMaps[0]).to.be.a(TagMap)
      expect(post.attachment).to.be.a(Attachment)
    })

    it('.with({ ...names })', async function() {
      const post = await Post.first.with({
        attachment: {},
        comments: { select: 'id, content' },
        tags: {}
      })
      expect(post.tags[0]).to.be.a(Tag)
      expect(post.tagMaps[0]).to.be.a(TagMap)
      expect(post.attachment).to.be.a(Attachment)
      expect(post.comments.length).to.be.above(0)
      expect(post.comments[0].id).to.be.ok()
      // because createdAt is not selected
      expect(() => post.comments[0].createdAt).to.throwException()
      expect(post.comments.map(comment => comment.content).sort()).to.eql(comments.sort())
    })

    it('.with(...names).select()', async function() {
      const post = await Post.include('attachment').select('attachment.url, posts.title').first
      expect(post.title).to.be('Archbishop Lazarus')
      expect(post.attachment).to.be.a(Attachment)
    })

    it('.with(...names).where()', async function() {
      const post = await Post.include('attachment').where('attachment.url like ?', 'https://%').first
      expect(post.attachment).to.be.a(Attachment)
    })

    it('.with(...names).order()', async function() {
      const post = await Post.include('comments').order('comments.content asc').first
      expect(post.comments.map(comment => comment.content)).to.eql(comments.sort())

      const posts = await Post.include('comments').order({ 'posts.title': 'desc', 'comments.content': 'desc' })
      expect(posts[0].title).to.be('Leah')
      expect(posts[1].title).to.be('Archbishop Lazarus')
      expect(posts[1].comments.map(comment => comment.content)).to.eql(comments.sort().reverse())
    })
  })

  describe('=> Create', function() {
    beforeEach(async function() {
      await Post.remove({}, true)
    })

    it('Bone.create(values) should INSERT INTO table', async function() {
      const post = await Post.create({ title: 'New Post' })
      expect(post.id).to.be.above(0)
      const foundPost = await Post.findOne({})
      expect(foundPost.id).to.equal(post.id)
      expect(foundPost.title).to.equal(post.title)
    })

    it('Bone.create(values) should handle timestamps', async function() {
      const post = await Post.create({ title: 'New Post' })
      expect(post.createdAt).to.be.a(Date)
      expect(post.updatedAt).to.be.a(Date)
      expect(post.updatedAt.getTime()).to.equal(post.createdAt.getTime())
    })

    it('bone.save() should INSERT INTO table when primaryKey is undefined', async function() {
      const post = new Post({ title: 'New Post' })
      await post.save()
      expect(post.id).to.be.ok()
      const foundPost = await Post.findOne({})
      expect(foundPost.id).to.equal(post.id)
      expect(foundPost.title).to.equal(post.title)
    })

    it('bone.save() should INSERT INTO table when primaryKey is defined but not saved yet', async function() {
      const post = new Post({ id: 1, title: 'New Post' })
      await post.save()
      expect(post.id).to.equal(1)
      const foundPost = await Post.findOne({ id: 1 })
      expect(foundPost.title).to.equal(post.title)
    })
  })

  describe('=> Update', function() {
    beforeEach(async function() {
      await Post.remove({}, true)
    })

    it('Bone.update(where, values)', async function() {
      const post = await Post.create({ title: 'New Post', createdAt: new Date(2010, 9, 11) })
      await Post.update({ title: 'New Post' }, { title: 'Skeleton King' })
      const foundPost = await Post.findOne({ title: 'Skeleton King' })
      expect(await Post.findOne({ title: 'New Post' })).to.be(null)
      expect(foundPost.id).to.equal(post.id)
      expect(foundPost.updatedAt.getTime()).to.be.above(post.updatedAt.getTime())
    })

    it('Bone.update(where, values) can UPDATE multiple rows', async function() {
      const posts = await Promise.all([
        Post.create({ title: 'New Post' }),
        Post.create({ title: 'New Post 2'})
      ])
      const affectedRows = await Post.update({ title: { $like: '%Post%' } }, { title: 'Untitled' })
      expect(posts.length).to.equal(affectedRows)
    })

    it('bone.save() should UPDATE when primaryKey is defined and saved before', async function() {
      const post = await Post.create({ id: 1, title: 'New Post', createdAt: new Date(2010, 9, 11) })
      const updatedAtWas = post.updatedAt
      post.title = 'Skeleton King'
      await post.save()
      const foundPost = await Post.findOne({ title: 'Skeleton King' })
      expect(foundPost.id).to.equal(post.id)
      expect(foundPost.updatedAt.getTime()).to.be.above(updatedAtWas.getTime())
    })

    it('bone.save() should throw if missing primary key', async function() {
      await Post.create({ title: 'New Post' })
      const post = await Post.findOne().select('title')
      expect(() => post.id).to.throwError()
      post.title = 'Skeleton King'
      expect(() => post.save()).to.throwError()
    })

    it('bone.save() should allow unset attributes be overridden', async function() {
      await Post.create({ title: 'New Post'})
      const post = await Post.select('id').first
      expect(() => post.title).to.throwError()
      post.title = 'Skeleton King'
      await post.save()
      expect(await Post.first).to.eql(post)
    })

    it('bone.save() should skip if no attributes were changed', async function() {
      await Post.create({ title: 'New Post' })
      const post = await Post.first
      const changed = await post.save()
      expect(changed).to.eql(0)
      post.title = 'Skeleton King'
      expect(await post.save()).to.eql(1)
      expect(await Post.first).to.eql(post)
    })
  })

  describe('=> Remove', function() {
    beforeEach(async function() {
      await Post.remove({}, true)
    })

    it('Bone.remove(where) should fake removal with deletedAt updated', async function() {
      const post = await Post.create({ title: 'New Post' })
      await Post.remove({ title: 'New Post' })
      const foundPost = await Post.findOne({ id: post.id })
      expect(foundPost).to.be(null)
      const removedPost = await Post.findOne({ id: post.id, deletedAt: { $ne: null } })
      expect(removedPost.id).to.equal(post.id)
    })

    it('Bone.remove(where) should throw error unless deletedAt presents', async function() {
      await TagMap.create({ targetId: 1, targetType: 1, tagId: 1 })
      expect(() => TagMap.remove({ targetId: 1 })).to.throwException()
    })

    it('Bone.remove(where, true) should REMOVE rows no matter the presence of deletedAt', async function() {
      await Post.create({ title: 'New Post' })
      expect(await Post.remove({ title: 'New Post' }, true)).to.be(1)
      expect(await Post.unscoped.all).to.empty()
    })
  })

  describe('=> Count / Group / Having', function() {
    before(async function() {
      await Promise.all([
        Post.create({ title: 'New Post' }),
        Post.create({ title: 'New Post' }),
        Post.create({ title: 'Archbishop Lazarus' }),
        Post.create({ title: 'Archangel Tyrael' })
      ])
    })

    after(async function() {
      await Post.remove({}, true)
    })

    it('Bone.count()', async function() {
      expect(await Post.count()).to.eql([ { count: 4 } ])
      expect(await Post.where('title like "Arch%"').count()).to.eql([ { count: 2 } ])
    })

    it('Bone.group().count()', async function() {
      expect(await Post.group('title').count().order('count').order('title')).to.eql([
        { count: 1, title: 'Archangel Tyrael' },
        { count: 1, title: 'Archbishop Lazarus' },
        { count: 2, title: 'New Post' }
      ])
    })

    it('Bone.group().having()', async function() {
      expect(await Post.group('title').count().having('count > ?', 1)).to.eql([
        { count: 2, title: 'New Post' }
      ])
    })
  })

  describe('=> Group / Join / Subqueries', function() {
    before(async function() {
      const posts = await Promise.all([
        Post.create({ id: 1, title: 'New Post' }),
        Post.create({ id: 2, title: 'Archbishop Lazarus' }),
        Post.create({ id: 3, title: 'Archangel Tyrael' }),
        Post.create({ id: 4, title: 'New Post' })
      ])

      await Promise.all([
        Attachment.create({ postId: posts[0].id }),
        Attachment.create({ postId: posts[0].id }),
        Attachment.create({ postId: posts[1].id })
      ])

      await Promise.all([
        Comment.create({ articleId: posts[1].id, content: 'foo' }),
        Comment.create({ articleId: posts[1].id, content: 'bar' }),
        Comment.create({ articleId: posts[2].id, content: 'baz' })
      ])
    })

    after(async function() {
      await Promise.all([
        Post.remove({}, true),
        Comment.remove({}, true),
        Attachment.remove({}, true)
      ])
    })

    it('Bone.group() subquery', async function() {
      const posts = await Post.find({
        id: Comment.select('articleId').from(Comment.group('articleId').count().having('count > 0'))
      }).with('attachment')
      expect(posts.length).to.be(2)
      expect(posts[0].title).to.eql('Archbishop Lazarus')
      expect(posts[0].attachment).to.be.an(Attachment)
      expect(posts[0].attachment.id).to.be.ok()
      expect(posts[1].title).to.eql('Archangel Tyrael')
      expect(posts[1].attachment).to.be(null)
    })

    it('Bone.group().join()', async function() {
      const comments = await Comment.join(Post, 'comments.articleId = posts.id')
        .select('count(comments.id) as count', 'posts.title').group('comments.articleId').order('count')
      expect(comments).to.eql([
        { count: 1, articleId: 3, title: 'Archangel Tyrael' },
        { count: 2, articleId: 2, title: 'Archbishop Lazarus' }
      ])
    })

    it('query / query.with() / query.count()', async function() {
      const query = Post.find({ title: ['Archangel Tyrael', 'New Post'], deletedAt: null })
      const [{ count }] = await query.count()
      const posts = await query.order('title').with('attachment')
      expect(posts.length).to.equal(count)
      expect(posts[0]).to.be.a(Post)
      expect(posts[0].title).to.equal('Archangel Tyrael')
      expect(posts[0].attachment).to.be(null)
      expect(posts[1].attachment).to.be.an(Attachment)
      expect(posts[1].attachment.postId).to.equal(posts[1].id)
    })

    it('Bone.join().group()', async function() {
      const query = Post.include('comments').group('title').count('comments.id').having('count > 0').order('count')
      expect(await query).to.eql([
        { count: 1, title: 'Archangel Tyrael' },
        { count: 2, title: 'Archbishop Lazarus' }
      ])
      expect(await query.select('posts.title')).to.eql([
        { count: 1, title: 'Archangel Tyrael' },
        { count: 2, title: 'Archbishop Lazarus' }
      ])
    })
  })

  describe('=> Calculations', function() {
    before(async function() {
      await Promise.all([
        Book.create({ isbn: 9780596006624, name: 'Hackers and Painters', price: 22.95 }),
        Book.create({ isbn: 9780881792065, name: 'The Elements of Typographic Style', price: 29.95 }),
        Book.create({ isbn: 9781575863269, name: 'Things a Computer Scientist Rarely Talks About', price: 21 })
      ])
    })

    after(async function() {
      await Book.remove({}, true)
    })

    it('Bone.count() should count records', async function() {
      const [ { count } ] = await Book.count()
      expect(count).to.equal(3)
    })

    it('Bone.average() should return the average of existing records', async function() {
      const [ { average } ] = await Book.average('price')
      expect(Math.abs((22.95 + 29.95 + 21) / 3 - average)).to.be.within(0, 1)
    })

    it('Bone.minimum() should return the minimum value of existing records', async function() {
      const [ { minimum } ] = await Book.minimum('price')
      expect(parseFloat(minimum)).to.equal(21)
    })

    it('Bone.maximum() should return the maximum value of existing records', async function() {
      const [ { maximum } ] = await Book.maximum('price')
      expect(Math.floor(maximum)).to.equal(Math.floor(29.95))
    })

    it('Bone.sum()', async function() {
      const [ { sum } ] = await Book.sum('price')
      expect(Math.floor(sum)).to.equal(Math.floor(22.95 + 29.95 + 21))
    })
  })

  describe('=> Transaction', function() {
    afterEach(async function() {
      await Post.remove({}, true)
    })

    it('Bone.transaction()', async function() {
      await Post.transaction(function* () {
        yield new Post({ title: 'Leah' }).create()
        yield new Post({ title: 'Diablo' }).create()
      })

      const posts = await Post.find()
      expect(posts.map(post => post.title)).to.eql(['Leah', 'Diablo'])
    })

    it('should be able to rollback transaction', async function() {
      try {
        await Post.transaction(function* () {
          yield new Post({ title: 'Leah' }).create()
          yield new Post({ title: 'Diablo' }).create()
          throw new Error('rollback')
        })
      } catch (err) {
        if (err.message !== 'rollback') {
          throw err
        }
      }

      const posts = await Post.find()
      expect(posts).to.eql([])
    })

    it('should not interfere with other connections', async function() {
      await Promise.all([
        Post.transaction(function* () {
          yield new Post({ title: 'Leah' }).create()
          yield new Post({ title: 'Diablo' }).create()
          throw new Error('rollback')
        }).catch(() => {}),
        new Post({ title: 'Archangel Tyrael' }).create()
      ])

      const posts = await Post.find()
      expect(posts.map(post => post.title)).to.eql(['Archangel Tyrael'])
    })
  })

  // a very premature sharding check
  describe('=> Sharding', function() {
    after(async function() {
      await Post.remove({}, true)
      await Like.remove({ userId: 1 }, true)
    })

    it('should function properly if sharding key is not defined', async function() {
      await new Post({ title: 'Leah' }).create()
      const post = await Post.findOne()
      expect(post.id).to.be.ok()
      expect(post.title).to.eql('Leah')
      await post.remove()
    })

    it('should throw if sharding key is defined but not set when INSERT', async function() {
      await assert.rejects(async () => {
        await new Like({ articleId: 1 }).create()
      }, /sharding key/i)
    })

    it('should throw if sharding key is defined but not present in where conditions when SELECT', async function() {
      await assert.rejects(async () => {
        await Like.find()
      }, /sharding key/i)
    })

    it('should throw if sharding key is defined but not present in where conditions when DELETE', async function() {
      await assert.rejects(async () => {
        await Like.remove({})
      }, /sharding key/i)
    })

    it('should throw if sharding key is defined but set to null when UPDATE', async function() {
      await assert.rejects(async () => {
        await Like.update({ userId: 1 }, { userId: null })
      }, /sharding key/i)
    })

    it('should not throw if sharding key is defined and not set when UPDATE', async function() {
      await assert.doesNotReject(async () => {
        await Like.update({ userId: 1 }, { deletedAt: new Date() })
      }, /sharding key/i)
    })
  })
}
