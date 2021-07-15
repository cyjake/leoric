'use strict';

const assert = require('assert').strict;
const path = require('path');
const { connect, raw, Bone } = require('../..');
const { checkDefinitions } = require('./helpers');

before(async function() {
  await connect({
    dialect: 'sqlite',
    database: '/tmp/leoric.sqlite3',
    models: path.resolve(__dirname, '../models'),
  });
});

require('./suite/index.test');

describe('=> Table definitions (sqlite)', () => {
  beforeEach(async () => {
    await Bone.driver.dropTable('notes');
  });

  after(async () => {
    await Bone.driver.dropTable('notes');
  });

  it('should be able to create table with INTEGER PRIMARY KEY', async () => {
    const { INTEGER } = Bone.DataTypes;
    class Note extends Bone {}
    Note.init({
      id: { type: INTEGER, primaryKey: true },
      public: { type: INTEGER },
    });

    await Note.sync();
    await checkDefinitions('notes', {
      id: { dataType: 'integer', primaryKey: true },
      public: { dataType: 'integer', primaryKey: false },
    });
  });

  it('should be able to create table with BIGINT(actual: INTEGER) PRIMARY KEY', async () => {
    const { BIGINT, INTEGER } = Bone.DataTypes;
    class Note extends Bone {}
    Note.init({
      id: { type: BIGINT, primaryKey: true },
      public: { type: INTEGER },
    });

    await Note.sync();
    await checkDefinitions('notes', {
      id: { dataType: 'integer', primaryKey: true },
      public: { dataType: 'integer', primaryKey: false },
    });
  });
});

describe('=> upsert', function () {
  const Post = require('../models/post');

  it('upsert', function() {
    assert.equal(
      new Post({ id: 1, title: 'New Post', createdAt: raw('CURRENT_TIMESTAMP()'), updatedAt: raw('CURRENT_TIMESTAMP()') }).upsert().toString(),
      'INSERT INTO "articles" ("id", "title", "gmt_modified") VALUES (1, \'New Post\', CURRENT_TIMESTAMP()) ON CONFLICT ("id") DO UPDATE SET "id"=EXCLUDED."id", "title"=EXCLUDED."title", "gmt_modified"=EXCLUDED."gmt_modified"'
    );
  });
});
