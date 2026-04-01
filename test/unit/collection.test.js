'use strict';

const assert = require('assert').strict;
const { Bone, Collection, connect, raw } = require('../../src');

describe('=> Collection', function() {
  class Post extends Bone {
    static table = 'articles';
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

  it('should instantiate', async function () {
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

  it('should not instantiate if grouped', async function() {
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

  it('should not instantiate if grouped without aggregation', async function() {
    const result = Collection.init({
      spell: Post.group('authorId').count(),
      rows: [
        { 'articles': { author_id: 1 } },
        { 'articles': { author_id: 2 } },
      ],
      fields: [],
    });
    assert.ok(result.every(r => !(r instanceof Post)));
    assert.deepEqual(result.toJSON(), [
      { authorId: 1 },
      { authorId: 2 },
    ]);
  });

  it('should not instantiate when SELECT field AS another_field', async function() {
    const result = Collection.init({
      spell: Post.select(raw('author_id AS authorId')),
      rows: [
        { 'articles': { authorId: 1 } },
        { 'articles': { authorId: 2 } },
      ],
      fields: [],
    });
    result.every(r => assert.equal(r instanceof Post, false));
    assert.deepEqual(result.toJSON(), [
      { authorId: 1 },
      { authorId: 2 },
    ]);
  });

  /**
   * Currently SELECT DISTINCT queries are treated different than group queries even though most SELECT DISTINCT queries are equivalent to group queries.
   * - https://dev.mysql.com/doc/refman/8.0/en/distinct-optimization.html
   */
  it('should instantiate when SELECT DISTINCT field', async function() {
    const result = Collection.init({
      spell: Post.select(raw('DISTINCT author_id')),
      rows: [
        { 'articles': { author_id: 1 } },
        { 'articles': { author_id: 2 } },
      ],
      fields: [],
    });
    assert.ok(result.every(r => r instanceof Post));
    assert.deepEqual(result.toJSON(), [
      { authorId: 1 },
      { authorId: 2 },
    ]);
  });

  it('should instantiate when SELECT DISTINCT field AS field', async function() {
    const result = Collection.init({
      spell: Post.select(raw('DISTINCT author_id AS author_id')),
      rows: [
        { 'articles': { author_id: 1 } },
        { 'articles': { author_id: 2 } },
      ],
      fields: [],
    });
    assert.ok(result.every(r => r instanceof Post));
    assert.deepEqual(result.toJSON(), [
      { authorId: 1 },
      { authorId: 2 },
    ]);
  });

  it('should instantiate when SELECT DISTINCT field with built-in parser', async function() {
    const result = Collection.init({
      spell: Post.select('DISTINCT authorId'),
      rows: [
        { 'articles': { author_id: 1 } },
        { 'articles': { author_id: 2 } },
      ],
      fields: [],
    });
    assert.ok(result.every(r => r instanceof Post));
    assert.deepEqual(result.toJSON(), [
      { authorId: 1 },
      { authorId: 2 },
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

  it('should not throw error if contains null or undefined', async function() {
    const result = new Collection(null, undefined);
    assert.deepEqual(result.toJSON(), [ null, undefined ]);
    assert.deepEqual(result.toObject(), [ null, undefined ]);
  });

  // covers the loose equality check (`==`) in dispatchJoins for bigint primary keys,
  // where mysql can return id as string instead of number (e.g. with supportBigNumbers/bigNumberStrings).
  it('should deduplicate joined rows with bigint primary key as string', async function() {
    const result = Collection.init({
      spell: User.include('posts').where({ id: 1 }),
      rows: [
        {
          users: { id: 1, email: 'a@b.com', nickname: 'test', status: 1 },
          posts: { id: '1', author_id: 1, title: 'Post A' },
        },
        {
          users: { id: 1, email: 'a@b.com', nickname: 'test', status: 1 },
          posts: { id: '2', author_id: 1, title: 'Post B' },
        },
        {
          users: { id: 1, email: 'a@b.com', nickname: 'test', status: 1 },
          // duplicate post id as string, should be deduplicated
          posts: { id: '1', author_id: 1, title: 'Post A' },
        },
      ],
      fields: [],
    });
    assert.equal(result.length, 1);
    const user = result[0];
    // 2 unique posts, not 3
    assert.equal(user.posts.length, 2);
  });
});
