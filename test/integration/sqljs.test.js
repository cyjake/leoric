'use strict';

const assert = require('assert').strict;
const path = require('path');
const fs = require('fs').promises;
const sinon = require('sinon');

const { raw, Bone } = require('../..');
const Realm = require('../../src/realm/base');
const { checkDefinitions } = require('./helpers');
const { default: SqljsDriver } = require('../../src/drivers/sqljs');

async function migrate(dbDriver) {
  let content = await fs.readFile(path.resolve(__dirname, '../dumpfile.sql'), 'utf-8');
  content = content
    .replace(/bigint\(\d+\) AUTO_INCREMENT/ig, 'INTEGER')
    .replace(/tinyint\(1\) DEFAULT 0/ig, 'boolean DEFAULT false');
  await dbDriver.query(content);
}

before(async function() {
  const modelDir = path.resolve(__dirname, '../models');
  const files = await fs.readdir(modelDir);
  const models = files
    .filter(file => path.extname(file) === '.js')
    .map(file => {
      const model = require(path.resolve(modelDir, file));
      return model?.default || model;
    });

  const realm = new Realm({
    database: 'sqljs',
    driver: SqljsDriver,
    models,
  });
  // migrate
  await migrate(realm.driver);
  await realm.connect();
});

require('./suite/index.test');

describe('=> Table definitions (sqljs)', () => {
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

describe('=> upsert (sqljs)', function () {
  const Post = require('../models/post');
  const User = require('../models/user');

  it('upsert', function() {
    assert.equal(
      new Post({ id: 1, title: 'New Post', createdAt: raw('CURRENT_TIMESTAMP()'), updatedAt: raw('CURRENT_TIMESTAMP()') }).upsert().toString(),
      `INSERT INTO "articles" ("id", "title", "is_private", "word_count", "gmt_create", "gmt_modified") VALUES (1, 'New Post', false, 0, CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP()) ON CONFLICT ("id") DO UPDATE SET "id"=EXCLUDED."id", "title"=EXCLUDED."title", "is_private"=EXCLUDED."is_private", "word_count"=EXCLUDED."word_count", "gmt_modified"=EXCLUDED."gmt_modified"`
    );
    const date = new Date(2017, 11, 12);
    const fakeDate = date.getTime();
    sinon.useFakeTimers(fakeDate);
    assert.equal(
      new Post({ id: 1, title: 'New Post', createdAt: date, updatedAt: date }).upsert().toString(),
      `INSERT INTO "articles" ("id", "title", "is_private", "word_count", "gmt_create", "gmt_modified") VALUES (1, 'New Post', false, 0, '2017-12-12 00:00:00.000', '2017-12-12 00:00:00.000') ON CONFLICT ("id") DO UPDATE SET "id"=EXCLUDED."id", "title"=EXCLUDED."title", "is_private"=EXCLUDED."is_private", "word_count"=EXCLUDED."word_count", "gmt_modified"=EXCLUDED."gmt_modified"`
    );
    assert.equal(
      new Post({ title: 'New Post', createdAt: date, updatedAt: date }).upsert().toString(),
      `INSERT INTO "articles" ("title", "is_private", "word_count", "gmt_create", "gmt_modified") VALUES ('New Post', false, 0, '2017-12-12 00:00:00.000', '2017-12-12 00:00:00.000') ON CONFLICT ("id") DO UPDATE SET "title"=EXCLUDED."title", "is_private"=EXCLUDED."is_private", "word_count"=EXCLUDED."word_count", "gmt_modified"=EXCLUDED."gmt_modified"`
    );
    // default set createdAt
    assert.equal(
      new Post({ id: 1, title: 'New Post' }).upsert().toString(),
      `INSERT INTO "articles" ("id", "title", "is_private", "word_count", "gmt_create", "gmt_modified") VALUES (1, 'New Post', false, 0, '2017-12-12 00:00:00.000', '2017-12-12 00:00:00.000') ON CONFLICT ("id") DO UPDATE SET "id"=EXCLUDED."id", "title"=EXCLUDED."title", "is_private"=EXCLUDED."is_private", "word_count"=EXCLUDED."word_count", "gmt_modified"=EXCLUDED."gmt_modified"`
    );

    assert.equal(
      Post.upsert({ title: 'New Post' }).toSqlString(),
      `INSERT INTO "articles" ("title", "is_private", "word_count", "gmt_create", "gmt_modified") VALUES ('New Post', false, 0, '2017-12-12 00:00:00.000', '2017-12-12 00:00:00.000') ON CONFLICT ("id") DO UPDATE SET "title"=EXCLUDED."title", "is_private"=EXCLUDED."is_private", "word_count"=EXCLUDED."word_count", "gmt_modified"=EXCLUDED."gmt_modified"`
    );

    assert.equal(
      Post.upsert({ title: 'New Post', id: 1 }).toSqlString(),
      `INSERT INTO "articles" ("id", "title", "is_private", "word_count", "gmt_create", "gmt_modified") VALUES (1, 'New Post', false, 0, '2017-12-12 00:00:00.000', '2017-12-12 00:00:00.000') ON CONFLICT ("id") DO UPDATE SET "id"=EXCLUDED."id", "title"=EXCLUDED."title", "is_private"=EXCLUDED."is_private", "word_count"=EXCLUDED."word_count", "gmt_modified"=EXCLUDED."gmt_modified"`
    );

    assert.equal(
      User.upsert({ email: 'dk@souls.com', nickname: 'Yhorm' }).toSqlString(),
      `INSERT INTO "users" ("email", "nickname", "status", "level", "gmt_create") VALUES ('dk@souls.com', 'Yhorm', 1, 1, '2017-12-12 00:00:00.000') ON CONFLICT ("email") DO UPDATE SET "email"=EXCLUDED."email", "nickname"=EXCLUDED."nickname", "status"=EXCLUDED."status", "level"=EXCLUDED."level"`
    );

    assert.equal(
      User.upsert({ email: 'dk@souls.com', nickname: 'Yhorm', id: 1 }).toSqlString(),
      `INSERT INTO "users" ("id", "email", "nickname", "status", "level", "gmt_create") VALUES (1, 'dk@souls.com', 'Yhorm', 1, 1, '2017-12-12 00:00:00.000') ON CONFLICT ("id") DO UPDATE SET "id"=EXCLUDED."id", "email"=EXCLUDED."email", "nickname"=EXCLUDED."nickname", "status"=EXCLUDED."status", "level"=EXCLUDED."level"`
    );
  });
});
