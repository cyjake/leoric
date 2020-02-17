'use strict';

const assert = require('assert').strict;
const expect = require('expect.js');
const { Bone, Collection } = require('../../..');
const Book = require('../../models/book');
const Comment = require('../../models/comment');
const Post = require('../../models/post');
const TagMap = require('../../models/tagMap');
const User = require('../../models/user');

describe('=> Attributes', function() {
  before(async function() {
    await Post.remove({}, true);
    await Post.create({
      title: 'New Post',
      extra: { versions: [2, 3] },
      thumb: 'https://a1.alicdn.com/image/2016/09/21/29f93b05-5d4a-4b57-99e8-71c52803b9a3.png'
    });
  });

  after(async function() {
    await Post.remove({}, true);
  });

  it('bone.attribute(name)', async function() {
    const post = new Post({ title: 'Untitled' });
    assert.equal(post.attribute('title'), 'Untitled');
    post.title = 'New Post';
    assert.equal(post.title, 'New Post');
    assert.throws(() => post.attribute('missing attribute'), /no attribute/);
  });

  it('bone.attribute(unset attribute)', async function() {
    const post = await Post.first.select('title');
    assert.throws(() => post.thumb, /unset attribute/i);
    assert.throws(() => post.attribute('thumb'), /unset attribute/i);
  });

  it('bone.attribute(name, value)', async function() {
    const post = new Post({ title: 'Untitled' });
    post.attribute('title', undefined);
    assert.equal(post.attribute('title'), null);
    // should return this
    assert.equal(post.attribute('title', 'Untitled'), post);
  });

  it('bone.attribute(unset attribute, value)', async function() {
    const post = await Post.first.select('title');
    expect(() => post.attribute('thumb', 'foo')).to.not.throwException();
    expect(post.attribute('thumb')).to.eql('foo');
  });

  it('bone.attributeWas(name) should be undefined when initialized', async function() {
    const post = new Post({ title: 'Untitled' });
    expect(post.attributeWas('createdAt')).to.be(null);
  });

  it('bone.attributeWas(name) should return original value if instance is persisted before', async function() {
    const post = await Post.findOne({});
    const titleWas = post.title;
    post.title = 'Skeleton King';
    expect(post.attributeWas('title')).to.eql(titleWas);
  });

  it('bone.attributeChanged(name)', async function() {
    const post = new Post({ title: 'Untitled' });
    expect(post.createdAt).to.not.be.ok();
    expect(post.attributeChanged('createdAt')).to.be(false);
    post.createdAt = new Date();
    expect(post.attributeChanged('createdAt')).to.be(true);
  });

  it('bone.attributeChanged(name) should be false when first fetched', async function() {
    const post = await Post.findOne({});
    expect(post.attributeChanged('createdAt')).to.be(false);
  });

  it('bone.attributeChanged(name) should behave consistently on special types such as object', async function() {
    const post = await Post.findOne({ extra: { $ne: null } });
    expect(post.attributeChanged('extra')).to.be(false);
    post.extra.foo = 'bar';
    expect(post.attributeChanged('extra')).to.be(true);
  });

  it('Bone.attribute(name, meta) sets column meta, should not be public', async function() {
    Post.attribute('extra', { type: String });
    expect(Post.attributes.extra.jsType).to.eql(String);
    Post.attribute('extra', { type: JSON });
    expect(() => Post.attribute('missing', { type: JSON })).to.throwException();
  });

  it('Bone.renameAttribute(name, newName) should throw if newName is taken', async function() {
    assert.throws(() => Post.renameAttribute('content', 'title'), /existing attribute/);
  });

  it('Bone.renameAttribute(name, newName)', async function() {
    Post.renameAttribute('thumb', 'thumbnail');
    const post = await Post.findOne({ thumbnail: { $ne: null } });
    expect(post.thumbnail).not.to.be(undefined);

    Post.renameAttribute('thumbnail', 'thumb');
    const post2 = await Post.findOne({ thumb: { $ne: null } });
    expect(post2.thumb).to.be.ok();
  });

  it('bone.reload()', async function() {
    const post = await Post.first;
    await Post.update({ id: post.id }, { title: 'Tyrael' });
    assert.equal(post.title, 'New Post');
    await post.reload();
    assert.equal(post.title, 'Tyrael');
  });
});

// Attribute get/set
describe('=> Accessors', function() {
  it('provides bone.attr & bone.attr= by default', async function() {
    const post = new Post();
    post.name = 'Skeleton King';
    expect(post.name).to.eql('Skeleton King');
  });

  it('bone.attr can be overriden by subclass', async function() {
    const book = new Book({ price: Math.PI });
    expect(book.price).to.eql(3.14);
    book.price = 42;
    expect(book.price).to.eql(42);
  });

  it('bone.attr= can be overriden by subclass', async function() {
    const book = new Book({ name: 'Speaking JavaScript' });
    expect(() => book.isbn = null).to.throwException();
    book.isbn = 9781449365035;
    expect(book.isbn).to.eql(9781449365035);
  });

  it('Bone.table should be the model name in plural', function() {
    expect(Comment.table).to.eql('comments');
  });

  it('Bone.table can be overriden with a static table getter', function() {
    /**
     * class Post {
     *   static get table() {
     *     return 'articles'
     *   }
     * }
     */
    expect(Post.table).to.eql('articles');
  });

  it('Bone.primaryKey should default to `id`', function() {
    expect(Post.primaryKey).to.eql('id');
  });

  it('Bone.primaryKey can be overriden with a static primaryKey getter', function() {
    /**
     * class Book {
     *   static get primaryKey() {
     *     return 'isbn'
     *   }
     * }
     */
    expect(Book.primaryKey).to.eql('isbn');
  });

  it('Bone.primaryColumn should be Bone.primaryKey in snake_case', function() {
    expect(Post.primaryColumn).to.eql('id');
    expect(Book.primaryColumn).to.eql('isbn');
  });
});

describe('=> Integration', function() {
  before(async function() {
    const post = await Post.create({
      title: 'New Post',
      extra: { versions: [2, 3] },
      thumb: 'https://a1.alicdn.com/image/2016/09/21/29f93b05-5d4a-4b57-99e8-71c52803b9a3.png'
    });
    await Comment.create({
      articleId: post.id,
      content: 'New Comment'
    });
  });

  after(async function() {
    await Promise.all([
      Post.remove({}, true),
      Comment.remove({}, true)
    ]);
  });

  it('util.inspect(bone)', async function() {
    const post = await Post.findOne({ title: 'New Post' });
    const result = require('util').inspect(post);

    expect(result).to.be.an('string');
    expect(result).to.contain('Post');
    expect(result).to.contain('New Post');
  });

  it('bone.toJSON()', async function() {
    const post = await Post.findOne({ title: 'New Post' });
    const result = post.toJSON();

    delete result.updatedAt;
    delete result.createdAt;

    expect(result).to.be.an('object');
    expect(result.id).to.be.ok();
    expect(result.title).to.equal('New Post');
    expect(result.extra).to.eql({ versions: [2, 3] });
  });

  it('bone.toJSON() with missing attributes', async function() {
    const post = await Post.findOne({ title: 'New Post' }).select('title');
    const result = post.toJSON();
    expect(result).to.eql({ title: 'New Post' });
  });

  it('bone.toJSON() prefers getter properties over bone.attribute(name)', async function() {
    const post = await Post.findOne({ title: 'New Post' });
    const result = post.toJSON();
    expect(result.title).to.equal('New Post');
  });

  it('bone.toJSON() includes associations', async function() {
    const post = await Post.first.with('comments');
    const { title, comments } = post.toJSON();
    assert.equal(title, 'New Post');
    assert(Array.isArray(comments));
    assert(comments.every(comment => !(comment instanceof Collection)));
    assert.equal(comments[0].content, 'New Comment');
  });

  it('bone.toObject() with missing attributes', async function() {
    const post = await Post.findOne({ title: 'New Post' }).select('title');
    const result = post.toObject();
    expect(result).to.eql({ title: 'New Post' });
  });

  // the major difference between `bone.toJSON()` and `bone.toObject()`
  it('bone.toObject() includes null attributes', async function() {
    const post = await Post.first;
    assert(!post.toJSON().hasOwnProperty('content'));
    assert(post.toObject().hasOwnProperty('content'));
    assert.equal(post.toObject().content, null);
    assert.deepEqual(Object.keys(post.toObject()), Object.keys(Post.attributes));
  });

  // the other difference between `bone.toJSON()` and `bone.toObject()`
  it('bone.toObject() prefers bone.attribute(name) over getter properties', async function() {
    const post = await Post.findOne({ title: 'New Post' });
    const result = post.toObject();
    expect(result).to.be.an('object');
    expect(result.title).to.be('New Post');
  });

  it('bone.toObject() includes associations', async function() {
    const post = await Post.first.with('comments');
    const { comments } = post.toObject();
    assert(comments.every(comment => !(comment instanceof Collection)));
    assert.deepEqual(Object.keys(comments[0]), Object.keys(Comment.attributes));
  });
});

describe('=> Type casting', function() {
  it('Bone.cast(value, type)', async function() {
    const json = Bone.cast('{"test":1}', JSON);
    expect(json.test).to.eql(1);
    expect(json).to.be.an('object');

    const string = Bone.cast('string', String);
    expect(string).to.eql('string');
  });

  it('Bone.uncast(value, type)', async function() {
    const json = Bone.uncast({test:1}, JSON);
    expect(json).to.be.a('string');
    expect(json).to.contain('test');

    const string = Bone.uncast('string', String);
    expect(string).to.eql('string');
  });

  it('Bone.unalias(attribute)', function() {
    expect(Post.unalias('updatedAt')).to.eql('gmt_modified');
    expect(Post.unalias('title')).to.eql('title');
  });

  it('Bone.instantiate(entry)', function() {
    const post = Post.instantiate({
      id: 1,
      title: 'Archbishop Lazarus',
      extra: JSON.stringify({ versions: [2] }),
      gmt_deleted: null
    });
    expect(post).to.be.a(Post);
    expect(post.title).to.equal('Archbishop Lazarus');
    expect(post.deletedAt).to.eql(null);
  });
});

describe('=> Automatic Versioning', function() {
  before(async function() {
    await Promise.all([
      Post.create({ title: 'New Post' }),
      Post.create({ title: 'New Post 2' }),
      Post.create({ title: 'Leah' })
    ]);
  });

  after(async function() {
    await Post.remove({}, true);
  });

  it('Allows multiple stops', async function() {
    const query = Post.find('title like ?', '%Post%');
    expect((await query.limit(1)).length).to.be(1);
    expect((await query).length).to.be(2);
    expect((await query.order('title')).map(post => post.title)).to.eql([
      'New Post', 'New Post 2'
    ]);
  });
});

describe('=> Collection', function() {
  before(async function() {
    await Promise.all([
      Post.create({ title: 'New Post' }),
      Post.create({ title: 'Leah' })
    ]);
  });

  after(async function() {
    await Post.remove({}, true);
  });

  it('collection.toJSON()', async function() {
    const posts = await Post.all;
    // toJSON() skips attributes with null values, hence `post.text` returns undefined.
    for (const post of posts.toJSON()) {
      assert.equal(typeof post.title, 'string');
      assert.equal(typeof post.content, 'undefined');
    }
  });

  it('collection.toObject()', async function() {
    const posts = await Post.all;
    for (const post of posts.toObject()) {
      assert.equal(typeof post.title, 'string');
      assert.equal(post.content, null);
    }
  });

  it('collection.save()', async function() {
    const posts = await Post.order('id', 'asc').all;
    posts[0].title = 'Updated Post';
    posts[1].title = 'Diablo';
    await posts.save();
    assert.equal((await Post.first).title, 'Updated Post');
    assert.equal((await Post.last).title, 'Diablo');
  });
});

describe('=> Create', function() {
  beforeEach(async function() {
    await Post.remove({}, true);
  });

  it('Bone.create(values) should INSERT INTO table', async function() {
    const post = await Post.create({ title: 'New Post' });
    expect(post.id).to.be.above(0);
    const foundPost = await Post.findOne({});
    expect(foundPost.id).to.equal(post.id);
    expect(foundPost.title).to.equal(post.title);
  });

  it('Bone.create(values) should handle timestamps', async function() {
    const post = await Post.create({ title: 'New Post' });
    expect(post.createdAt).to.be.a(Date);
    expect(post.updatedAt).to.be.a(Date);
    expect(post.updatedAt.getTime()).to.equal(post.createdAt.getTime());
  });

  it('bone.save() should INSERT INTO table when primaryKey is undefined', async function() {
    const post = new Post({ title: 'New Post' });
    await post.save();
    expect(post.id).to.be.ok();
    const foundPost = await Post.findOne({});
    expect(foundPost.id).to.equal(post.id);
    expect(foundPost.title).to.equal(post.title);
  });

  it('bone.save() should INSERT INTO table when primaryKey is defined but not saved yet', async function() {
    const post = new Post({ id: 1, title: 'New Post' });
    await post.save();
    expect(post.id).to.equal(1);
    const foundPost = await Post.findOne({ id: 1 });
    expect(foundPost.title).to.equal(post.title);
  });
});

describe('=> Update', function() {
  beforeEach(async function() {
    await Post.remove({}, true);
    await User.remove({}, true);
  });

  it('Bone.update(where, values)', async function() {
    const post = await Post.create({ title: 'New Post', createdAt: new Date(2010, 9, 11) });
    await Post.update({ title: 'New Post' }, { title: 'Skeleton King' });
    const foundPost = await Post.findOne({ title: 'Skeleton King' });
    expect(await Post.findOne({ title: 'New Post' })).to.be(null);
    expect(foundPost.id).to.equal(post.id);
    expect(foundPost.updatedAt.getTime()).to.be.above(post.updatedAt.getTime());
  });

  it('Bone.update(where, values) can UPDATE multiple rows', async function() {
    const posts = await Promise.all([
      Post.create({ title: 'New Post' }),
      Post.create({ title: 'New Post 2'})
    ]);
    const affectedRows = await Post.update({ title: { $like: '%Post%' } }, { title: 'Untitled' });
    expect(posts.length).to.equal(affectedRows);
  });

  it('Bone.update(where, values) should support customized type', async () => {
    const { id } = await Post.create({ title: 'New Post' });
    await Post.update({ id }, {
      extra: { versions: [ 2, 3 ] },
    });
    const post = await Post.findOne(id);
    assert.deepEqual(post.extra, { versions: [ 2, 3 ] });
  });

  it('bone.save() should UPDATE when primaryKey is defined and saved before', async function() {
    const post = await Post.create({ id: 1, title: 'New Post', createdAt: new Date(2010, 9, 11) });
    const updatedAtWas = post.updatedAt;
    post.title = 'Skeleton King';
    await post.save();
    const foundPost = await Post.findOne({ title: 'Skeleton King' });
    expect(foundPost.id).to.equal(post.id);
    expect(foundPost.updatedAt.getTime()).to.be.above(updatedAtWas.getTime());
  });

  it('bone.save() should throw if missing primary key', async function() {
    await Post.create({ title: 'New Post' });
    const post = await Post.findOne().select('title');
    expect(() => post.id).to.throwError();
    post.title = 'Skeleton King';
    await assert.rejects(async () => {
      await post.save();
    }, /primary key/);
  });

  it('bone.save() should allow unset attributes be overridden', async function() {
    await Post.create({ title: 'New Post'});
    const post = await Post.select('id').first;
    expect(() => post.title).to.throwError();
    post.title = 'Skeleton King';
    await post.save();
    expect(await Post.first).to.eql(post);
  });

  it('bone.save() should skip if no attributes were changed', async function() {
    await Post.create({ title: 'New Post' });
    const post = await Post.first;
    // affectedRows is only available through `bone.update()` directly
    assert.equal(await post.update(), 0);
    post.title = 'Skeleton King';
    assert.equal(await post.update(), 1);
    assert.deepEqual(await Post.first, post);
  });

  it('bone.save() should keep primary key intact', async function() {
    const { id } = await User.create({ email: 'john@example.com', nickname: 'John Doe' });
    const user = new User({ id, email: 'john@example.com', nickname: 'John Doe' });
    await user.save();
    expect(user.id).to.eql(id);
    expect((await User.findOne({ email: 'john@example.com' })).id).to.eql(id);
  });

  it('bone.save() should always return itself', async function() {
    const post = await new Post({ title: 'New Post' }).save();
    assert(post instanceof Post);
    post.title = 'Skeleton King';
    assert.deepEqual(await post.save(), post);
  });

  it('bone.upsert() should skip if called directly with no attributes changed', async function() {
    const post = await Post.create({ title: 'New Post' });
    assert.equal(await post.upsert(), 0);
  });

  it('bone.upsert() should return affectedRows', async function() {
    const post = new Post({ title: 'New Post' });
    // INSERT ... UPDATE returns 1 if the INSERT branch were chosen
    assert.equal(await post.upsert(), 1);
    post.title = 'Skeleton King';
    // to pass sql analyse of database
    post.createdAt = new Date();
    // INSERT ... UPDATE returns 2 if the UPDATE branch were chosen in MySQL database
    assert.equal(await post.upsert(), Post.driver.type === 'mysql' ? 2 : 1);
  });

  it('bone.upsert() should not override existing primary key', async function() {
    const { id } = await Post.create({ title: 'New Post' });
    const post = new Post({ id, title: 'New Post 2' });
    await post.upsert();
    assert.equal(post.id, id);
    assert.equal(post.title, 'New Post 2');
  });

  it('bone.upsert() should not touch created_at if update', async () => {
    const { id, createdAt } = await Post.create({ title: 'Leah' });
    const post = new Post({ id, title: 'Cain' });
    await post.upsert();
    assert.equal(post.id, id);
    assert.equal(post.title, 'Cain');
    // upsert does not reload timestamps by default
    await post.reload();
    assert.deepEqual(post.createdAt, createdAt);
  });
});

describe('=> Remove', function() {
  beforeEach(async function() {
    await Post.remove({}, true);
  });

  it('Bone.remove(where) should fake removal if deletedAt presents', async function() {
    const post = await Post.create({ title: 'New Post' });
    await Post.remove({ title: 'New Post' });
    const foundPost = await Post.findOne({ id: post.id });
    expect(foundPost).to.be(null);
    const removedPost = await Post.findOne({ id: post.id }).unscoped;
    expect(removedPost.id).to.equal(post.id);
  });

  it('Bone.remove(where) should DELETE if deletedAt does not present', async function() {
    await TagMap.create({ targetId: 1, targetType: 1, tagId: 1 });
    await TagMap.remove({ targetId: 1 });
    expect((await TagMap.find()).length).to.eql(0);
  });

  it('Bone.remove(where, true) should DELETE rows no matter the presence of deletedAt', async function() {
    await Post.create({ title: 'New Post' });
    expect(await Post.remove({ title: 'New Post' }, true)).to.be(1);
    expect(await Post.unscoped.all).to.empty();
  });

  it('bone.remove() should fake removal if deletedAt presents', async function() {
    const post = await Post.create({ title: 'New Post' });
    const effected = await post.remove();
    expect(effected).to.eql(1);
    expect((await Post.find({})).length).to.eql(0);
  });

  it('bone.remove() should DELETE if deletedAt does not present', async function() {
    const tagMap = await TagMap.create({ targetId: 1, targetType: 1, tagId: 1 });
    const effected = await tagMap.remove();
    expect(effected).to.eql(1);
    expect((await TagMap.find({})).length).to.eql(0);
  });
});

describe('=> Bulk', () => {
  beforeEach(async () => {
    await Post.remove({}, true);
  });

  it('Bone.bulkCreate() should return bulk created instances', async () => {
    // await Post.create({ id: 1, title: 'Mipha' });
    const posts = await Post.bulkCreate([
      { title: 'Tyrael' },
      { title: 'Leah' },
    ]);
    console.log(posts, await Post.find())
    for (const entry of posts) {
      assert.ok(entry.id);
      const post = await Post.findOne(entry.id);
      assert.equal(entry.title, post.title);
      assert.deepEqual(entry.createdAt, post.createdAt);
      assert.deepEqual(entry.updatedAt, post.updatedAt);
    }
  });
});
