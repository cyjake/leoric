'use strict'

const expect = require('expect.js')

const { connect, Bone } = require('..')

const Attachment = require('./models/attachment')
const Book = require('./models/book')
const Comment = require('./models/comment')
const Post = require('./models/post')
const TagMap = require('./models/tagMap')
const Tag = require('./models/tag')


before(async function() {
  this.timeout(5000)
  await connect(require('./config'))
})

describe('=> Attributes', function() {
  before(async function() {
    await Post.create({
      title: 'King Leoric',
      extra: { versions: [2, 3] },
      thumb: 'https://vignette.wikia.nocookie.net/diablo/images/2/29/KingLeoric.png/revision/latest?cb=20120603170950'
    })
  })

  after(async function() {
    await Post.remove({}, true)
  })

  it('bone.attribute(name)', async function() {
    const post = new Post({ title: 'Untitled' })
    expect(post.attribute('title')).to.eql('Untitled')
    post.title = 'King Leoric'
    expect(post.title).to.eql('King Leoric')
    expect(() => post.attribute('non-existant attribute')).to.throwException()
  })

  it('bone.attribute(name, value)', async function() {
    const post = new Post({ title: 'Untitled' })
    post.attribute('title', undefined)
    expect(post.attribute('title')).to.be(null)
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
    expect(Post.columns).to.be.a(Set)
    expect(Post.columns.size).to.be.above(1)
    expect(Post.columns.has('title')).to.be.ok()
    expect(Post.columns.has('gmt_create')).to.be.ok()
  })

  it('Bone.attributes should be the names of attributes', function() {
    // Bone.renameAttribute('oldName', 'newName')
    expect(Post.attributes).to.be.a(Set)
    expect(Post.attributes.size).to.be.above(1)
    expect(Post.attributes.has('title')).to.be.ok()
    expect(Post.attributes.has('createdAt')).to.be.ok()
  })
})

describe('=> Integration', function() {
  before(async function() {
    await Post.create({
      title: 'King Leoric',
      extra: { versions: [2, 3] },
      thumb: 'https://vignette.wikia.nocookie.net/diablo/images/2/29/KingLeoric.png/revision/latest?cb=20120603170950'
    })
  })

  after(async function() {
    await Post.remove({}, true)
  })

  it('bone.inspect()', async function() {
    const post = await Post.findOne({ title: 'King Leoric' })
    const result = post.inspect()

    expect(result).to.be.an('string')
    expect(result).to.contain('Post')
    expect(result).to.contain('King Leoric')
  })

  it('bone.toJSON()', async function() {
    const post = await Post.findOne({ title: 'King Leoric' })
    const result = post.toJSON()

    delete result.updatedAt
    delete result.createdAt

    expect(result).to.be.an('object')
    expect(result.id).to.be.ok()
    expect(result.title).to.equal('King Leoric')
    expect(result.extra).to.eql({ versions: [2, 3] })
  })

  it('bone.toJSON() prefers getter properties over bone.attribute(name)', async function() {
    const post = await Post.findOne({ title: 'King Leoric' })
    const result = post.toJSON()
    expect(result.title).to.equal('King Leoric')
  })

  it('bone.toObject() prefers bone.attribute(name) over getter properties', async function() {
    const post = await Post.findOne({ title: 'King Leoric' })
    const result = post.toObject()
    expect(result).to.be.an('object')
    expect(result.title).to.be('King Leoric')
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

describe('=> Query', function() {
  before(async function() {
    await Post.create({ title: 'King Leoric' })
    await Post.create({ title: 'Archbishop Lazarus' })
    await Post.create({ title: 'Archangel Tyrael'})
  })

  after(async function() {
    await Post.remove({}, true)
  })

  it('.findOne', async function() {
    const post = await Post.findOne({})
    expect(post).to.be.a(Post)
    expect(post.id).to.be.ok()
  })

  it('.find', async function() {
    const posts = await Post.find({ title: 'King Leoric' })
    expect(posts.length).to.be(1)
    expect(posts[0]).to.be.a(Post)
    expect(posts[0].title).to.equal('King Leoric')
  })

  it('.find({ foo: null })', async function() {
    const posts = await Post.find({ thumb: null })
    expect(posts.length).to.be(3)
    expect(posts[0]).to.be.a(Post)
    expect(posts[0].thumb).to.eql(null)
  })

  it('.find({ foo: [] })', async function() {
    const posts = await Post.find({ title: ['King Leoric', 'Archangel Tyrael'] })
    expect(posts.length).to.be(2)
    expect(posts.map(post => post.title)).to.eql([
      'King Leoric', 'Archangel Tyrael'
    ])
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
    const post = await Post.findOne({ title: 'King Leoric' }, { select: 'title' })
    expect(post.title).to.equal('King Leoric')
    // Currently excluded columns will return undefined, maybe an error should be thrown?
    expect(post.content).to.be(null)
  })

  it('.find aliased attribute', async function() {
    await Post.create({ title: 'Diablo', deletedAt: new Date(2012, 4, 15) })
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
    await Post.create({ id: 1, title: 'King Leoric', createdAt: new Date(2012, 4, 15) })
    await Post.create({ id: 2, title: 'Diablo' })
    await Post.create({ id: 99, title: 'Leah' })
    await Post.create({ id: 100, title: 'Deckard Cain' })
  })

  after(async function() {
    await Post.remove({}, true)
  })

  it('.find $eq', async function() {
    const posts = await Post.find({ title: { $eq: 'King Leoric' } })
    expect(posts.length).to.be.above(0)
    expect(posts[0].title).to.equal('King Leoric')
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
    const post = await Post.findOne({ title: { $like: '%Leoric%' } })
    expect(post.title).to.match(/Leoric/)
  })

  it('.find $notLike', async function() {
    const post = await Post.findOne({ title: { $notLike: '%Leoric' } })
    expect(post.title).to.not.match(/Leoric/)
  })
})

describe('=> Scopes', function() {
  before(async function() {
    const results = await Promise.all([
      Post.create({ title: 'King Leoric', deletedAt: new Date() }),
      Tag.create({ name: 'NPC' })
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
    expect(await Post.findOne({ title: 'King Leoric' })).to.be(null)
  })

  it('.find().unscoped removes default scopes', async function() {
    const post = await Post.findOne({ title: 'King Leoric' }).unscoped
    expect(post).to.be.a(Post)
    expect(post.title).to.be('King Leoric')
  })

  it ('.update().unscoped', async function() {
    await Post.update({ title: 'King Leoric' }, { title: 'Skeleton King' })
    expect(await Post.findOne({ title: 'Skeleton King' })).to.be(null)
    await Post.update({ title: 'King Leoric' }, { title: 'Skeleton King' }).unscoped
    expect(await Post.findOne({ title: 'King Leoric' })).to.be(null)
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

  before(async function() {
    const post = await Post.create({ title: 'Archbishop Lazarus' })
    await Promise.all([
      Attachment.create({
        url: 'https://img.alicdn.com/tfs/TB1mIGsfZLJ8KJjy0FnXXcFDpXa-190-140.png',
        postId: post.id
      })
    ])
    await Promise.all(comments.map(content => {
      return Comment.create({ content, articleId: post.id })
    }))
    for (const name of ['nephalem', 'archangel', 'demon']) {
      const tag = await Tag.create({ name })
      await TagMap.create({
        tagId: tag.id,
        targetId: post.id,
        targetType: 0
      })
    }
  })

  after(async function() {
    await Promise.all([
      Post.remove({}, true),
      Attachment.remove({}, true),
      Comment.remove({}, true)
    ])
  })

  it('Bone.hasOne', async function() {
    const post = await Post.findOne({ title: 'Archbishop Lazarus' }).with('attachment')
    expect(post.attachment).to.be.a(Attachment)
  })

  it('Bone.belongsTo', async function() {
    const attachment = await Attachment.findOne({}).with('post')
    expect(attachment.post).to.be.a(Post)
  })

  it('Bone.hasMany', async function() {
    const post = await Post.findOne({ title: 'Archbishop Lazarus' }).with('comments')
    expect(post.comments.length).to.greaterThan(0)
    expect(post.comments[0]).to.be.a(Comment)
    expect(post.comments.map(comment => comment.content).sort()).to.eql(comments.sort())
  })

  it('Bone.hasMany through', async function() {
    const post = await Post.findOne({ title: 'Archbishop Lazarus' }).with('tags')
    expect(post.tags.length).to.greaterThan(0)
    expect(post.tags[0]).to.be.a(Tag)
  })

  it('.with(...names)', async function() {
    const post = await Post.findOne({ title: 'Archbishop Lazarus' }).with('attachment', 'comments', 'tags')
    expect(post.tags[0]).to.be.a(Tag)
    expect(post.tagMaps[0]).to.be.a(TagMap)
    expect(post.attachment).to.be.a(Attachment)
  })

  it('.with({ ...names })', async function() {
    const post = await Post.findOne({ title: 'Archbishop Lazarus' }).with({
      attachment: {},
      comments: { select: 'id' },
      tags: {}
    })
    expect(post.tags[0]).to.be.a(Tag)
    expect(post.tagMaps[0]).to.be.a(TagMap)
    expect(post.attachment).to.be.a(Attachment)
  })

  it('.with(...names).select()', async function() {
    const query = Post.findOne().with('attachment').select('attachment.url')
    const post = await query
    expect(post.attachment).to.be.a(Attachment)
  })

  it('.with(...names).where()', async function() {
    const post = await Post.findOne().with('attachment').where('attachment.url like ?', 'https://%')
    expect(post.attachment).to.be.a(Attachment)
  })

  it('.with(...names).order()', async function() {
    const post = await Post.findOne({ title: 'Archbishop Lazarus' }).with('comments').order('comments.content desc')
    expect(post.comments.map(comment => comment.content)).to.eql([
      'You are too late to save the child!',
      "Now you'll join him",
      'All that awaits you is the wrath of my master!',
      'Abandon your foolish quest!'
    ])
  })
})

describe('=> Create', function() {
  beforeEach(async function() {
    await Post.remove({}, true)
  })

  it('Bone.create(values) should INSERT INTO table', async function() {
    const post = await Post.create({ title: 'King Leoric' })
    expect(post.id).to.be.above(0)
    const foundPost = await Post.findOne({})
    expect(foundPost.id).to.equal(post.id)
    expect(foundPost.title).to.equal(post.title)
  })

  it('Bone.create(values) should handle timestamps', async function() {
    const post = await Post.create({ title: 'King Leoric' })
    expect(post.createdAt).to.be.a(Date)
    expect(post.updatedAt).to.be.a(Date)
    expect(post.updatedAt.getTime()).to.equal(post.createdAt.getTime())
  })

  it('bone.save() should INSERT INTO table when primaryKey is undefined', async function() {
    const post = new Post({ title: 'King Leoric' })
    await post.save()
    expect(post.id).to.be.ok()
    const foundPost = await Post.findOne({})
    expect(foundPost.id).to.equal(post.id)
    expect(foundPost.title).to.equal(post.title)
  })

  it('bone.save() should INSERT INTO table when primaryKey is defined but not saved yet', async function() {
    const post = new Post({ id: 1, title: 'King Leoric' })
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
    const post = await Post.create({ title: 'King Leoric' })
    await new Promise(resolve => setTimeout(resolve, 500))
    await Post.update({ title: 'King Leoric' }, { title: 'Skeleton King' })
    const foundPost = await Post.findOne({ title: 'Skeleton King' })
    expect(await Post.findOne({ title: 'King Leoric' })).to.be(null)
    expect(foundPost.id).to.equal(post.id)
    expect(foundPost.updatedAt.getTime()).to.be.above(post.updatedAt.getTime())
  })

  it('Bone.update(where, values) can UPDATE multiple rows', async function() {
    const posts = await Promise.all([
      Post.create({ title: 'King Leoric' }),
      Post.create({ title: 'Skeleton King'})
    ])
    const affectedRows = await Post.update({ title: { $like: '%King%' } }, { title: 'the Black King' })
    expect(posts.length).to.equal(affectedRows)
  })

  it('bone.save() should UPDATE when primaryKey is defined and saved before', async function() {
    const post = await Post.create({ id: 1, title: 'King Leoric' })
    const updatedAtWas = post.updatedAt
    post.title = 'Skeleton King'
    await new Promise(resolve => setTimeout(resolve, 500))
    await post.save()
    const foundPost = await Post.findOne({ title: 'Skeleton King' })
    expect(foundPost.id).to.equal(post.id)
    expect(foundPost.updatedAt.getTime()).to.be.above(updatedAtWas.getTime())
  })
})

describe('=> Remove', function() {
  beforeEach(async function() {
    await Post.remove({}, true)
  })

  it('Bone.remove(where) should fake removal with deletedAt updated', async function() {
    const post = await Post.create({ title: 'King Leoric' })
    await Post.remove({ title: 'King Leoric' })
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
    await Post.create({ title: 'King Leoric' })
    expect(await Post.remove({ title: 'King Leoric' }, true)).to.be(1)
    expect(await Post.findOne({ title: 'King Leoric' })).to.be(null)
  })
})

describe('=> Count / Group / Having', function() {
  before(async function() {
    await Post.remove({}, true)
    await Promise.all([
      Post.create({ title: 'King Leoric' }),
      Post.create({ title: 'King Leoric' }),
      Post.create({ title: 'Archbishop Lazarus' }),
      Post.create({ title: 'Archangel Tyrael' })
    ])
  })

  after(async function() {
    await Post.remove({}, true)
  })

  it('Bone.count()', async function() {
    expect(await Post.count()).to.eql([ { count: 4 } ])
    expect(await Post.count('title like "Arch%"')).to.eql([ { count: 2 } ])
  })

  it('Bone.group().count()', async function() {
    expect(await Post.group('title').count()).to.eql([
      { count: 1, title: 'Archangel Tyrael' },
      { count: 1, title: 'Archbishop Lazarus' },
      { count: 2, title: 'King Leoric' }
    ])
  })

  it('Bone.group().having()', async function() {
    expect(await Post.group('title').count().having('count > ?', 1)).to.eql([
      { count: 2, title: 'King Leoric' }
    ])
  })
})

describe('=> Group / Join / Subqueries', function() {
  before(async function() {
    const posts = await Promise.all([
      Post.create({ title: 'King Leoric' }),
      Post.create({ title: 'Archbishop Lazarus' }),
      Post.create({ title: 'Archangel Tyrael' })
    ])

    await Promise.all([
      Attachment.create({ postId: posts[0].id }),
      Attachment.create({ postId: posts[0].id }),
      Attachment.create({ postId: posts[1].id })
    ])

    await Promise.all([
      Comment.create({ articleId: posts[1].id, content: '' }),
      Comment.create({ articleId: posts[1].id, content: '' }),
      Comment.create({ articleId: posts[2].id, content: '' })
    ])
  })

  after(async function() {
    await Promise.all([
      Post.remove({}, true),
      Comment.remove({}, true),
      Attachment.remove({}, true)
    ])
  })

  it('Bone.group().join()', async function() {
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
})

describe('=> Automatic Versioning', function() {
  before(async function() {
    await Post.remove({}, true)
    await Promise.all([
      Post.create({ title: 'King Leoric' }),
      Post.create({ title: 'Skeleton King' }),
      Post.create({ title: 'Leah' })
    ])
  })

  after(async function() {
    await Post.remove({}, true)
  })

  it('Allows multiple stops', async function() {
    const query = Post.find('title like ?', '%King%')
    expect((await query.limit(1)).length).to.be(1)
    expect((await query).length).to.be(2)
    expect((await query.order('title')).map(post => post.title)).to.eql([
      'King Leoric', 'Skeleton King'
    ])
  })
})
