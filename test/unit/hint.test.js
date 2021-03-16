'use strict';

const assert = require('assert').strict;
const path = require('path');

const { connect } = require('../..');
const Post = require('../models/post');

const { IndexHint, Hint, INDEX_HINT_TYPE, INDEX_HINT_USE_TYPE, HINT_TYPE } = require('../../lib/hint');

describe('MySQL', async () => {
  before(async function() {
    await connect({
      models: path.resolve(__dirname, '../models'),
      database: 'leoric',
      user: 'root',
      port: process.env.MYSQL_PORT,
    });
  });

  describe('optimize hint', () => {

    it('insert', () => {
      const date = new Date(2017, 11, 12);
      assert.equal(
        Post.create({ title: 'New Post', createdAt: date, updatedAt: date }, { hint: new Hint('SET_VAR(foreign_key_checks=OFF)') }).toString(),
        "INSERT /*+ SET_VAR(foreign_key_checks=OFF) */ INTO `articles` (`gmt_create`, `gmt_modified`, `title`) VALUES ('2017-12-12 00:00:00.000', '2017-12-12 00:00:00.000', 'New Post')"
      );
      // array
      assert.equal(
        Post.create({ title: 'New Post', createdAt: date, updatedAt: date }, { hints: [ new Hint('SET_VAR(foreign_key_checks=OFF)'), new Hint('SET_VAR(sort_buffer_size = 16M)') ] }).toString(),
        "INSERT /*+ SET_VAR(foreign_key_checks=OFF) SET_VAR(sort_buffer_size = 16M) */ INTO `articles` (`gmt_create`, `gmt_modified`, `title`) VALUES ('2017-12-12 00:00:00.000', '2017-12-12 00:00:00.000', 'New Post')"
      );

      assert.equal(
        Post.create({ title: 'New Post', createdAt: date, updatedAt: date }, { hints: [ new Hint('SET_VAR(foreign_key_checks=OFF)'), new Hint('SET_VAR(sort_buffer_size = 16M)'), { value: 'BKA(users)' } ] }).toString(),
        "INSERT /*+ SET_VAR(foreign_key_checks=OFF) SET_VAR(sort_buffer_size = 16M) BKA(users) */ INTO `articles` (`gmt_create`, `gmt_modified`, `title`) VALUES ('2017-12-12 00:00:00.000', '2017-12-12 00:00:00.000', 'New Post')"
      );

      assert.equal(
        Post.create({ title: 'New Post', createdAt: date, updatedAt: date }, {
          hint: new Hint('SET_VAR(optimizer_switch = \'mrr_cost_based=off\')'),
          hints: [ new Hint('SET_VAR(foreign_key_checks=OFF)'), new Hint('SET_VAR(sort_buffer_size = 16M)') ]
        }).toString(),
        "INSERT /*+ SET_VAR(foreign_key_checks=OFF) SET_VAR(sort_buffer_size = 16M) SET_VAR(optimizer_switch = 'mrr_cost_based=off') */ INTO `articles` (`gmt_create`, `gmt_modified`, `title`) VALUES ('2017-12-12 00:00:00.000', '2017-12-12 00:00:00.000', 'New Post')"
      );
    });

    it('find', () => {
      assert.equal(
        Post.find({ title: { $like: '%Post%' } }, { hint: new Hint('SET_VAR(foreign_key_checks=OFF)') }).toString(),
        "SELECT /*+ SET_VAR(foreign_key_checks=OFF) */ * FROM `articles` WHERE `title` LIKE '%Post%' AND `gmt_deleted` IS NULL"
      );

      assert.equal(
        Post.find({ title: { $like: '%Post%' } }, { hints: [ new Hint('SET_VAR(foreign_key_checks=OFF)'), new Hint('MAX_EXECUTION_TIME(1000)') ] }).toString(),
        "SELECT /*+ SET_VAR(foreign_key_checks=OFF) MAX_EXECUTION_TIME(1000) */ * FROM `articles` WHERE `title` LIKE '%Post%' AND `gmt_deleted` IS NULL"
      );
    });

    it('update', () => {
      const date = new Date(2017, 11, 12);
      assert.equal(
        Post.update({ title: { $like: '%Post%' } }, { title: 'hello', updatedAt: date }, { hint: new Hint('SET_VAR(foreign_key_checks=OFF)') }).toString(),
        "UPDATE /*+ SET_VAR(foreign_key_checks=OFF) */ `articles` SET `title` = 'hello', `gmt_modified` = '2017-12-12 00:00:00.000' WHERE `title` LIKE '%Post%' AND `gmt_deleted` IS NULL"
      );

      assert.equal(
        Post.update({ title: { $like: '%Post%' } }, { title: 'hello', updatedAt: date }, { hints: [ new Hint('SET_VAR(foreign_key_checks=OFF)'), new Hint('MAX_EXECUTION_TIME(1000)') ] }).toString(),
        "UPDATE /*+ SET_VAR(foreign_key_checks=OFF) MAX_EXECUTION_TIME(1000) */ `articles` SET `title` = 'hello', `gmt_modified` = '2017-12-12 00:00:00.000' WHERE `title` LIKE '%Post%' AND `gmt_deleted` IS NULL"
      );
    });

    it('delete', () => {
      assert.equal(
        Post.remove({ title: { $like: '%Post%' } }, true , { hints: [ new Hint('SET_VAR(foreign_key_checks=OFF)'), new Hint('MAX_EXECUTION_TIME(1000)') ] }).toString(),
        "DELETE /*+ SET_VAR(foreign_key_checks=OFF) MAX_EXECUTION_TIME(1000) */ FROM `articles` WHERE `title` LIKE '%Post%'"
      )
    });

  });

  describe('index hint', () => {
    it('find', () => {
      assert.equal(
        Post.find({ title: { $like: '%Post%' } }, { hint: new IndexHint('idx_title', INDEX_HINT_TYPE.USE) }).toString(),
        "SELECT * FROM `articles` USE INDEX (idx_title) WHERE `title` LIKE '%Post%' AND `gmt_deleted` IS NULL"
      );

      // unique and merge
      assert.equal(
        Post.find({ title: { $like: '%Post%' } }, { hints: [ new IndexHint('idx_id'), new IndexHint('idx_title'), new IndexHint('idx_title') ] }).toString(),
        "SELECT * FROM `articles` USE INDEX (idx_id,idx_title) WHERE `title` LIKE '%Post%' AND `gmt_deleted` IS NULL"
      );

      // use for
      assert.equal(
        Post.find({ title: { $like: '%Post%' } }, { order: 'id', hints: [ new IndexHint('idx_id', INDEX_HINT_TYPE.USE, INDEX_HINT_USE_TYPE.ORDER_BY), new IndexHint('idx_title'), new IndexHint('idx_title') ] }).toString(),
        "SELECT * FROM `articles` USE INDEX FOR ORDER BY (idx_id) USE INDEX (idx_title) WHERE `title` LIKE '%Post%' AND `gmt_deleted` IS NULL ORDER BY `id`"
      );

      assert.equal(
        Post.find({
          title: { $like: '%Post%' } },
          {
            order: 'id',
            hints: [
              new IndexHint('idx_id', INDEX_HINT_TYPE.FORCE),
              new IndexHint('idx_title', INDEX_HINT_TYPE.FORCE),
              new IndexHint('idx_title', INDEX_HINT_TYPE.FORCE),
              new IndexHint('idx_title', INDEX_HINT_TYPE.FORCE, INDEX_HINT_USE_TYPE.ORDER_BY), // USE INDEX FOR ** ()
              new IndexHint('idx_hle', INDEX_HINT_TYPE.IGNORE),
              new IndexHint('idx_hle1', INDEX_HINT_TYPE.IGNORE),
              new IndexHint('idx_hle', INDEX_HINT_TYPE.IGNORE),
              new IndexHint('idx_hle2', INDEX_HINT_TYPE.USE),
            ]
          }).toString(),
        "SELECT * FROM `articles` FORCE INDEX (idx_id,idx_title) FORCE INDEX FOR ORDER BY (idx_title) IGNORE INDEX (idx_hle,idx_hle1) USE INDEX (idx_hle2) WHERE `title` LIKE '%Post%' AND `gmt_deleted` IS NULL ORDER BY `id`"
      );
    });

    it('update', () => {
      const date = new Date(2017, 11, 12);
      assert.equal(
        Post.update({ title: { $like: '%Post%' } }, { title: 'hello', updatedAt: date }, { hint: new IndexHint('idx_id') }).toString(),
        "UPDATE `articles` USE INDEX (idx_id) SET `title` = 'hello', `gmt_modified` = '2017-12-12 00:00:00.000' WHERE `title` LIKE '%Post%' AND `gmt_deleted` IS NULL"
      );

      assert.equal(
        Post.update({
          title: { $like: '%Post%' }
        },
        { title: 'hello', updatedAt: date },
        { hints: [ new IndexHint('idx_id'), new IndexHint('idx_title'), new IndexHint('idx_title') ] }).toString(),
        "UPDATE `articles` USE INDEX (idx_id,idx_title) SET `title` = 'hello', `gmt_modified` = '2017-12-12 00:00:00.000' WHERE `title` LIKE '%Post%' AND `gmt_deleted` IS NULL"
      );

      assert.equal(
        Post.update({
          title: { $like: '%Post%' }
        },
        { title: 'hello', updatedAt: date },
        { hints: [ new IndexHint('idx_id'), { value: 'idx_title', type: HINT_TYPE.INDEX_HINT }, new IndexHint('idx_title') ] }).toString(),
        "UPDATE `articles` USE INDEX (idx_id,idx_title) SET `title` = 'hello', `gmt_modified` = '2017-12-12 00:00:00.000' WHERE `title` LIKE '%Post%' AND `gmt_deleted` IS NULL"
      );

      assert.equal(
        Post.update({
          title: { $like: '%Post%' }
        },
        { title: 'hello', updatedAt: date },
        { hints: [ new IndexHint('idx_id'), { value: 'idx_title', type: INDEX_HINT_TYPE.USE }, new IndexHint('idx_title') ] }).toString(),
        "UPDATE `articles` USE INDEX (idx_id,idx_title) SET `title` = 'hello', `gmt_modified` = '2017-12-12 00:00:00.000' WHERE `title` LIKE '%Post%' AND `gmt_deleted` IS NULL"
      );

      assert.equal(
        Post.update({
          title: { $like: '%Post%' } },
          { title: 'hello', updatedAt: date },
          {
            hints: [
              new IndexHint('idx_id', INDEX_HINT_TYPE.FORCE),
              new IndexHint('idx_title', INDEX_HINT_TYPE.FORCE), //
              new IndexHint('idx_title', INDEX_HINT_TYPE.FORCE), // unique
              {
                type: INDEX_HINT_TYPE.FORCE,
                value: 'idx_title',
              },
              new IndexHint('idx_hle', INDEX_HINT_TYPE.IGNORE),
              new IndexHint('idx_hle1', INDEX_HINT_TYPE.IGNORE),
              new IndexHint('idx_hle', INDEX_HINT_TYPE.IGNORE),
              new IndexHint('idx_hle2', INDEX_HINT_TYPE.USE),
            ]
          }).toString(),
          "UPDATE `articles` FORCE INDEX (idx_id,idx_title) IGNORE INDEX (idx_hle,idx_hle1) USE INDEX (idx_hle2) SET `title` = 'hello', `gmt_modified` = '2017-12-12 00:00:00.000' WHERE `title` LIKE '%Post%' AND `gmt_deleted` IS NULL"
      );
    });
  });

  it('mixing hint', () => {
    const date = new Date(2017, 11, 12);

    assert.equal(
      Post.update({
        title: { $like: '%Post%' } },
        { title: 'hello', updatedAt: date },
        {
          hints: [
            new IndexHint('idx_id', INDEX_HINT_TYPE.FORCE),
            new IndexHint('idx_title', INDEX_HINT_TYPE.FORCE),
            new IndexHint('idx_title', INDEX_HINT_TYPE.FORCE),
            new IndexHint('idx_hle', INDEX_HINT_TYPE.IGNORE),
            new IndexHint('idx_hle1', INDEX_HINT_TYPE.IGNORE),
            new IndexHint('idx_hle', INDEX_HINT_TYPE.IGNORE),
            new IndexHint('idx_hle2', INDEX_HINT_TYPE.USE),
            new Hint('SET_VAR(foreign_key_checks=OFF)'),
            new Hint('MAX_EXECUTION_TIME(1000)')
          ]
        }).toString(),
        "UPDATE /*+ SET_VAR(foreign_key_checks=OFF) MAX_EXECUTION_TIME(1000) */ `articles` FORCE INDEX (idx_id,idx_title) IGNORE INDEX (idx_hle,idx_hle1) USE INDEX (idx_hle2) SET `title` = 'hello', `gmt_modified` = '2017-12-12 00:00:00.000' WHERE `title` LIKE '%Post%' AND `gmt_deleted` IS NULL"
      );
  });
})



