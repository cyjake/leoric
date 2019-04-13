'use strict'

const assert = require('assert').strict
const expect = require('expect.js')
const { Bone } = require('../..')
const Attachment = require('../models/attachment')
const Book = require('../models/book')
const Comment = require('../models/comment')
const Post = require('../models/post')

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
    assert.equal(post.attribute('title'), 'Untitled')
    post.title = 'New Post'
    assert.equal(post.title, 'New Post')
    assert.throws(() => post.attribute('non-existant attribute'), /no attribute/)
  })

  it('bone.attribute(unset attribute)', async function() {
    const post = await Post.first.select('title')
    assert.throws(() => post.thumb, /unset attribute/i)
    assert.throws(() => post.attribute('thumb'), /unset attribute/i)
  })

  it('bone.attribute(name, value)', async function() {
    const post = new Post({ title: 'Untitled' })
    post.attribute('title', undefined)
    assert.equal(post.attribute('title'), null)
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
describe('=> Accessors', function() {
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

describe('=> Config', function() {
  it('Bone.table should be the model name in plural', function() {
    expect(Comment.table).to.eql('comments')
  })

  it('Bone.table can be overriden with a static table getter', function() {
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

  it('util.inspect(bone)', async function() {
    const post = await Post.findOne({ title: 'New Post' })
    const result = require('util').inspect(post)

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
      extra: JSON.stringify({ versions: [2] }),
      gmt_deleted: null
    })
    expect(post).to.be.a(Post)
    expect(post.title).to.equal('Archbishop Lazarus')
    expect(post.deletedAt).to.eql(null)
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

describe('=> Collection', function() {
  before(async function() {
    await Promise.all([
      Post.create({ title: 'New Post' }),
      Post.create({ title: 'Leah' })
    ])
  })

  after(async function() {
    await Post.remove({}, true)
  })

  it('collection.toJSON()', async function() {
    const posts = await Post.all
    // toJSON() skips attributes with null values, hence `post.text` returns undefined.
    for (const post of posts.toJSON()) {
      assert.equal(typeof post.title, 'string')
      assert.equal(typeof post.content, 'undefined')
    }
  })

  it('collection.toObject()', async function() {
    const posts = await Post.all
    for (const post of posts) {
      assert.equal(typeof post.title, 'string')
      assert.equal(post.content, null)
    }
  })

  it('collection.save()', async function() {
    const posts = await Post.order('id', 'asc').all
    posts[0].title = 'Updated Post'
    posts[1].title = 'Diablo'
    await posts.save()
    assert.equal((await Post.first).title, 'Updated Post')
    assert.equal((await Post.last).title, 'Diablo')
  })
})
