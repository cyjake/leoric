'use strict';

const assert = require('assert').strict;
const SqlString = require('sqlstring');

const { parseObject } = require('../../src/query_object');
const { formatConditions, collectLiteral } = require('../../src/expr_formatter');
const { Bone, connect } = require('../..');

describe('=> parseObject', function() {
  class Post extends Bone {
    static table = 'articles'
  }

  let spell;

  before(async function() {
    Bone.driver = null;
    await connect({
      models: [ Post ],
      database: 'leoric',
      user: 'root',
      port: process.env.MYSQL_PORT,
    });

    // create a stub spell to format conditions with Post model
    spell = Post.all;
  });

  function query(object) {
    const values = [];
    const conditions = parseObject(object);
    for (const condition of conditions) collectLiteral(spell, condition, values);
    return SqlString.format(formatConditions(spell, conditions), values);
  }

  it('{ field: Literal }', function() {
    assert.equal(query({ title: null }), '`title` IS NULL');
    assert.equal(query({ title: 'Leah' }), "`title` = 'Leah'");
    assert.equal(query({ id: 42 }), '`id` = 42');
    assert.equal(query({ id: [ 2, 3, 5, 7 ] }), '`id` IN (2, 3, 5, 7)');

    assert.equal(
      query({ title: [ 'Stranger', 'Tyrael' ] }),
      "`title` IN ('Stranger', 'Tyrael')"
    );
  });

  it('{ field: { $op: Literal } }', function() {
    assert.equal(
      query({ createdAt: { $gt: new Date(2012, 4, 15) } }),
      "`gmt_create` > '2012-05-15 00:00:00.000'"
    );
  });

  it('{ field: { $op: [ Literal, Literal, ... ] } }', function() {
    assert.equal(
      query({ wordCount: { $between: [800, 1000] } }),
      '`word_count` BETWEEN 800 AND 1000'
    );

    assert.equal(
      query({ wordCount: { $notBetween: [800, 1000] } }),
      '`word_count` NOT BETWEEN 800 AND 1000'
    );

    assert.equal(
      query({ title: { $not: [ 'Leah', 'Nephalem' ] } }),
      "`title` NOT IN ('Leah', 'Nephalem')"
    );

    assert.equal(
      query({ title: { $notIn: [ 'Leah', 'Nephalem' ] } }),
      "`title` NOT IN ('Leah', 'Nephalem')"
    );
  });

  it('{ field: { $logical: [ Literal, { $op: Literal }, ... ] } }', function() {
    assert.equal(
      query({ title: { $or: [ 'Leah', { $like: '%Leah%' } ] } }),
      "`title` = 'Leah' OR `title` LIKE '%Leah%'"
    );
    assert.equal(
      query({ createdAt: { $not: [ '2021-09-30', { $gte: '2021-10-07' } ] } }),
      "NOT (`gmt_create` = '2021-09-30' AND `gmt_create` >= '2021-10-07')"
    );
    assert.equal(
      query({ createdAt: { $not: { $gt: '2021-01-01', $lte: '2021-12-31' } } }),
      "NOT (`gmt_create` > '2021-01-01' AND `gmt_create` <= '2021-12-31')"
    );
  });

  it('{ $logical: { field: Literal, field2: Literal } }', function() {
    assert.equal(
      query({ $or: { title: 'Leah', content: 'Diablo' } }),
      "`title` = 'Leah' OR `content` = 'Diablo'"
    );
  });

  it('{ $logical: [ { field: Literal }, ... ] }', function() {
    assert.equal(
      query({ $or: [ { title: 'Leah', content: 'Diablo' }, { title: 'Stranger' } ] }),
      "`title` = 'Leah' AND `content` = 'Diablo' OR `title` = 'Stranger'"
    );
  });

  it('{ $logical: { $logical: [ { field: Literal }, ... ] } }', function() {
    assert.equal(
      query({ $not: { $not: { $not: { title: 'Leah', content: 'Diablo' } } } }),
      "NOT NOT NOT (`title` = 'Leah' AND `content` = 'Diablo')"
    );
    assert.equal(
      query({ $not: { $or: [ { title: 'Leah', content: 'Diablo' }, { title: 'Stranger' } ] } }),
      "NOT (`title` = 'Leah' AND `content` = 'Diablo' OR `title` = 'Stranger')"
    );
  });
});
