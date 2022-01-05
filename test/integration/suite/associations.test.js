'use strict';

const assert = require('assert').strict;
const expect = require('expect.js');
const sinon = require('sinon');

const Attachment = require('../../models/attachment');
const Comment = require('../../models/comment');
const Post = require('../../models/post');
const Tag = require('../../models/tag');
const TagMap = require('../../models/tagMap');
const { logger } = require('../../../src/utils');


describe('=> Associations', function() {
  // http://diablo.wikia.com/wiki/Archbishop_Lazarus
  const comments = [
    'Abandon your foolish quest!',
    'All that awaits you is the wrath of my master!',
    'You are too late to save the child!',
    "Now you'll join him"
  ];

  const tagNames = ['npc', 'boss', 'player'];
  const topicNames = ['nephalem', 'archangel', 'demon'];

  function mapTags(post, tags) {
    return Promise.all(
      tags.map(tag => TagMap.create({ tagId: tag.id, targetId: post.id, targetType: 0 }))
    );
  }

  let stub;

  before(async function() {
    stub = sinon.stub(logger, 'warn').callsFake((message) => {
      throw new Error(message);
    });
    const posts = await Post.bulkCreate([
      { title: 'Archbishop Lazarus' },
      { title: 'Leah' },
    ]);
    const tags = await Promise.all(tagNames.map(name => Tag.create({ name, type: 0 })));
    const topics = await Promise.all(topicNames.map(name => Tag.create({ name, type: 1 })));

    for (const post of posts) {
      await Promise.all([
        Attachment.create({
          url: 'https://img.alicdn.com/tfs/TB1mIGsfZLJ8KJjy0FnXXcFDpXa-190-140.png',
          postId: post.id
        })
      ]);
    }

    await Promise.all(comments.map(content => {
      return Comment.create({ content, articleId: posts[0].id });
    }));
    await mapTags(posts[0], tags.slice(0, 2));
    await mapTags(posts[0], topics.slice(2, 3));
    await mapTags(posts[1], tags.slice(2, 3));
    await mapTags(posts[1], topics.slice(0, 1));
  });

  after(async function() {
    if (stub) stub.restore();
    await Promise.all([
      Post.remove({}, true),
      Attachment.remove({}, true),
      Comment.remove({}, true),
      TagMap.remove({}, true),
      Tag.remove({}, true)
    ]);
  });

  it('Bone.hasOne should throw if association exists', async function() {
    assert.throws(function() {
      Post.hasOne('attachment'); // exists
    }, /duplicated association/);
  });

  it('Bone.hasOne', async function() {
    const post = await Post.first.with('attachment');
    expect(post.attachment).to.be.a(Attachment);
  });

  it('Bone.belongsTo', async function() {
    const attachment = await Attachment.first.with('post');
    expect(attachment.post).to.be.a(Post);
  });

  it('Bone.hasMany', async function() {
    const post = await Post.first.with('comments');
    expect(post.comments.length).to.be.above(0);
    expect(post.comments[0]).to.be.a(Comment);
    expect(post.comments.map(comment => comment.content).sort()).to.eql(comments.sort());
  });

  it('Bone.hasMany through', async function() {
    const posts = await Post.include('tags');
    expect(posts[0].tags.length).to.greaterThan(0);
    expect(posts[0].tags[0]).to.be.a(Tag);
    expect(posts[0].tags.map(tag => tag.name).sort()).to.eql(['npc', 'boss'].sort());
    expect(posts[1].tags.map(tag => tag.name)).to.eql(['player']);
  });

  it('Bone.hasMany through / finding RefModel', async function() {
    const posts = await Post.include('topics');
    expect(posts[0].topics.map(tag => tag.name)).to.eql(['demon']);
  });

  it('.with(...names)', async function() {
    const post = await Post.first.with('attachment', 'comments', 'tags');
    expect(post.tags[0]).to.be.a(Tag);
    expect(post.tagMaps[0]).to.be.a(TagMap);
    expect(post.attachment).to.be.a(Attachment);
  });

  it('.with({ ...names })', async function() {
    const post = await Post.first.with({
      attachment: {},
      comments: { select: 'id, content' },
      tags: {}
    });
    expect(post.tags[0]).to.be.a(Tag);
    expect(post.tagMaps[0]).to.be.a(TagMap);
    expect(post.attachment).to.be.a(Attachment);
    expect(post.comments.length).to.be.above(0);
    expect(post.comments[0].id).to.be.ok();
    // because createdAt is not selected
    expect(() => post.comments[0].createdAt).to.throwException();
    expect(post.comments.map(comment => comment.content).sort()).to.eql(comments.sort());
  });

  it('.with(...names).select()', async function() {
    const post = await Post.include('attachment').select('attachment.url, posts.title').first;
    expect(post.title).to.be('Archbishop Lazarus');
    expect(post.attachment).to.be.a(Attachment);
  });

  it('.with(...names).where()', async function() {
    const post = await Post.include('attachment').where('attachment.url like ?', 'https://%').first;
    expect(post.attachment).to.be.a(Attachment);
  });

  it('.with(...names).order()', async function() {
    const [ post ] = await Post.include('comments').order('posts.id asc').order('comments.content asc');
    expect(post.comments.map(comment => comment.content)).to.eql(comments.sort());

    const posts = await Post.include('comments').order({ 'posts.title': 'desc', 'comments.content': 'desc' });
    expect(posts[0].title).to.be('Leah');
    expect(posts[1].title).to.be('Archbishop Lazarus');
    expect(posts[1].comments.map(comment => comment.content)).to.eql(comments.sort().reverse());
  });
});

describe('=> Associations order / offset / limit', function() {
  before(async function() {
    const post1 = await Post.create({ title: 'New Post' });
    await Comment.create({ content: 'Abandon your foolish request!', articleId: post1.id });
    const post2 = await Post.create({ title: 'New Post 2' });
    await Comment.create({ content: 'You are too late to save the child!', articleId: post2.id });
    await Comment.create({ content: "Now you'll join them", articleId: post1.id });
  });

  after(async function() {
    await Promise.all([
      Post.remove({}, true),
      Comment.remove({}, true)
    ]);
  });

  it('should return duplicated records', async function() {
    const posts = await Post.include('comments');
    assert.deepEqual(Array.from(posts[0].comments, comment => comment.content).sort(), [
      'Abandon your foolish request!',
      "Now you'll join them"
    ]);
  });

  it('should not limit subquery if query criteria is complicated', async function() {
    const posts = await Post.include('comments').where({
      'comments.content': { $like: '%child%' },
    }).limit(1);
    assert.equal(posts.length, 1);
    assert.equal(posts[0].title, 'New Post 2');
  });

  it('should not limit subquery if ordered by joined columns', async function() {
    const posts = await Post.include('comments').order('comments.content', 'desc').limit(1);
    assert.equal(posts.length, 1);
    assert.equal(posts[0].title, 'New Post 2');
  });

  it('should still limit the query if subquery limit is off', async function() {
    const posts = await Post.include('comments').where({
      'comments.content': { $like: '%oo%' },
    }).limit(1);
    // both posts have comments with content containing `oo` but only one should return
    assert.equal(posts.length, 1);
  });

  it('should not throw if select and order by alias', async function() {
    const result = await Post.include('comments').select('content as cnt').order('cnt', 'desc').limit(1);
    assert.equal(result.length, 1);
  });
});
