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
      rows: [ { '': { count: 1 } } ],
      fields: [],
    });
    // merge the qualifier layer
    assert(result.every(r => r instanceof Post));
    assert.deepEqual(Array.from(result.map(r => ({
      count: r.count
    }))), [
      { count: 1 },
    ]);
    assert.deepEqual(Array.from(result.map(r => ({ count: r.count }))), [ { count: 1 } ]);
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
