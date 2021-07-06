'use strict';

const assert = require('assert').strict;
const { Bone, Collection, connect } = require('../..');

describe('=> Collection', function() {
  class Post extends Bone {
    static table = 'articles'
  }

  before(async function() {
    await connect({
      models: [ Post ],
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
      spell: Post.group('author_id').count(),
      rows: [ { '': { count: 1 } } ],
      fields: [],
    });
    // merge the qualifier layer
    assert.deepEqual(result, [ { count: 1 } ]);
  });
});
