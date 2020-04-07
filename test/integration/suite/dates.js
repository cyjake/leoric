'use strict';

const assert = require('assert').strict;
const Post = require('../../models/post');

// https://dev.mysql.com/doc/refman/5.7/en/date-and-time-functions.html
describe('=> Date functions', function() {
  before(async function() {
    await Promise.all([
      Post.create({ title: 'New Post', createdAt: new Date(2012, 4, 15) }),
      Post.create({ title: 'Archbishop Lazarus', createdAt: new Date(2012, 4, 15) }),
      Post.create({ title: 'Leah', createdAt: new Date(2017, 10, 11) })
    ]);
  });

  after(async function() {
    await Post.remove({}, true);
  });

  it('SELECT YEAR(date)', async function() {
    assert.deepEqual(await Post.select('YEAR(createdAt) as year').order('year'), [
      { year: 2012 }, { year: 2012 }, { year: 2017 }
    ]);
  });

  it('WHERE YEAR(date)', async function() {
    const posts = await Post.select('title').where('YEAR(createdAt) = 2017');
    assert.deepEqual(Array.from(posts, post => post.title), ['Leah']);
  });

  it('GROUP BY MONTH(date) AS month', async function() {
    assert.deepEqual(
      await Post.select('MONTH(createdAt) as month').group('month').count().order('count DESC'),
      [ { count: 2, month: 5 },
        { count: 1, month: 11 } ]);
  });

  it('ORDER BY DAY(date)', async function() {
    const posts = await Post.order('DAY(createdAt)').order('title');
    assert.deepEqual(Array.from(posts, post => post.title), [
      'Leah', 'Archbishop Lazarus', 'New Post'
    ]);
  });
});
