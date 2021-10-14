'use strict';

const assert = require('assert').strict;
const { Bone, Collection, connect } = require('../..');

describe('=> Collection', function() {
  class Post extends Bone {
    static table = 'articles'
  }

  class User extends Bone {
    static initialize() {
      this.hasMany('posts', { foreignKey: 'authorId' });
    }
  }

  before(async function() {
    await connect({
      models: [ User, Post ],
      database: 'leoric',
      user: 'root',
      port: process.env.MYSQL_PORT,
    });
  });

  it('should destruct result if query is simple aggregate', async function() {
    const result = Collection.init({
      spell: Post.count(),
      rows: [ { '': { count: 1 } } ],
      fields: [],
    });
    assert.equal(result, 1);
  });

  it('should accept table as result qualifier as well', async function() {
    const result = Collection.init({
      spell: Post.count(),
      rows: [ { articles: { count: 1 } } ],
      fields: [],
    });
    assert.equal(result, 1);
  });

  it('should not destruct result if query is grouped', async function() {
    const result = Collection.init({
      spell: Post.group('authorId').count(),
      rows: [ { '': { count: 1 }, articles: { author_id: 1 } } ],
      fields: [],
    });
    // merge the qualifier layer
    assert.equal(result.every(r => r instanceof Post), false);
    assert.deepEqual(result.toJSON(), [
      { authorId: 1, count: 1 },
    ]);
  });

  it('should map to model', async function () {
    const result = Collection.init({
      spell: Post.select('authorId'),
      rows: [ { articles: { author_id: 1 } } ],
      fields: [],
    });
    assert.ok(result.every(r => r instanceof Post));
    assert.deepEqual(result.toJSON(), [
      { authorId: 1 },
    ]);
  });

  it('should map to model even if aggregated', async function() {
    const result = Collection.init({
      spell: Post.group('authorId').count(),
      rows: [
        { 'articles': { author_id: 1 }, '': { count: 42 } },
        { 'articles': { author_id: 2 }, '': { count: 23 } },
      ],
      fields: [],
    });
    assert.ok(result.every(r => !(r instanceof Post)));
    assert.deepEqual(result.toJSON(), [
      { authorId: 1, count: 42 },
      { authorId: 2, count: 23 },
    ]);
  });

  it('should call element.toJSON', async function() {
    const result = new Collection({ toJSON: () => 1 }, 2);
    assert.deepEqual(result.toJSON(), [ 1, 2 ]);
  });

  it('should call element.toObject', async function() {
    const result = new Collection({ toObject: () => 1 }, 3);
    assert.deepEqual(result.toObject(), [ 1, 3 ]);
  });

  it('should reject if not all of the elements can be saved', async function() {
    const result = new Collection(1, 2);
    await assert.rejects(async function() {
      return await result.save();
    }, /cannot be saved/);
  });
});
