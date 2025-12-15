'use strict';

const assert = require('assert').strict;
const sinon = require('sinon');
const { Bone, DataTypes } = require('../../../src');
const { checkDefinitions } = require('../helpers');

const { INTEGER, STRING, TEXT } = DataTypes;

describe('=> Table definitions', () => {
  beforeEach(async () => {
    await Bone.driver.dropTable('notes');
    await Bone.driver.dropTable('memos');
  });

  after(async () => {
    await Bone.driver.dropTable('notes');
  });

  it('should be able to create table', async () => {
    await Bone.driver.createTable('notes', {
      title: { type: STRING, allowNull: false },
      body: { type: TEXT },
    });

    await checkDefinitions('notes', {
      title: { dataType: 'varchar', allowNull: false },
      body: { dataType: 'text' },
    });
  });

  it('should be able to create table with unique column', async () => {
    // sqlite PRAGMA table_info can't get columns' constraint type(unique or not)
    if (['sqlite', 'sqljs'].includes(Bone.driver.type)) {
      const querySpy = sinon.spy(Bone.driver, 'query');
      await Bone.driver.createTable('notes', {
        title: { type: STRING, allowNull: false },
        body: { type: TEXT },
        noteIndex: { type: STRING, unique: true, allowNull: false }
      });
      assert.ok(querySpy.args[0][0].includes('"note_index" VARCHAR(255) NOT NULL UNIQUE'));
      Bone.driver.query.restore();
      return;
    }

    await Bone.driver.createTable('notes', {
      title: { type: STRING, allowNull: false },
      body: { type: TEXT },
      noteIndex: { type: STRING, unique: true, allowNull: false }
    });

    await checkDefinitions('notes', {
      title: { dataType: 'varchar', allowNull: false },
      body: { dataType: 'text' },
      note_index: { dataType: 'varchar', allowNull: false, unique: true }
    });
  });

  it('should be able to alter table', async () => {
    await Bone.driver.createTable('notes', {
      title: { type: STRING, allowNull: false },
    });
    await checkDefinitions('notes', { body: null });

    await Bone.driver.alterTable('notes', {
      title: { modify: true, type: STRING, allowNull: true },
      body: { type: TEXT },
    });

    await checkDefinitions('notes', {
      title: { dataType: 'varchar', allowNull: true },
      body: { dataType: 'text' },
    });
  });

  it('should be able to add column', async () => {
    await Bone.driver.createTable('notes', {
      title: { type: STRING, allowNull: false },
    });
    await checkDefinitions('notes', { body: null });

    await Bone.driver.addColumn('notes', 'body', { type: TEXT });
    await checkDefinitions('notes', {
      title: { dataType: 'varchar', allowNull: false },
      body: { dataType: 'text' },
    });
  });

  it('should be able to change column', async () => {
    await Bone.driver.createTable('notes', {
      title: { type: STRING, allowNull: true, defaultValue: '' },
    });

    await Bone.driver.changeColumn('notes', 'title', {
      type: STRING,
      allowNull: false,
    });
    await checkDefinitions('notes', {
      title: { dataType: 'varchar', allowNull: false },
    });
  });

  it('should be able to remove column', async () => {
    await Bone.driver.createTable('notes', {
      title: { type: STRING },
      body: { type: TEXT },
    });

    await Bone.driver.removeColumn('notes', 'title');
    await checkDefinitions('notes', {
      title: null,
      body: { dataType: 'text' },
    });
  });

  it('should be able to rename column', async () => {
    await Bone.driver.createTable('notes', {
      title: { type: STRING },
      body: { type: TEXT },
    });

    await Bone.driver.renameColumn('notes', 'title', 'subject');
    await checkDefinitions('notes', {
      title: null,
      subject: { dataType: 'varchar' },
    });
  });

  it('should be able to rename table', async () => {
    await Bone.driver.createTable('notes', {
      title: { type: STRING },
      body: { type: TEXT },
    });

    await Bone.driver.renameTable('notes', 'memos');
    await checkDefinitions('notes', null);
    await checkDefinitions('memos', {
      title: { dataType: 'varchar' },
      body: { dataType: 'text' },
    });
  });

  it('should be able to drop table', async () => {
    await Bone.driver.createTable('notes', { title: STRING });
    await Bone.driver.dropTable('notes');
    await checkDefinitions('notes', null);
  });

  it('should be able to add and remove index', async () => {
    await Bone.driver.createTable('notes', {
      id: { type: INTEGER },
      userId: { type: INTEGER },
      title: { type: STRING },
    });
    await assert.rejects(async function() {
      await Bone.driver.addIndex('notes', [ 'userId' ], { type: 'UNKNOWN' });
    }, /Unexpected index type/i);
    await Bone.driver.addIndex('notes', [ 'userId', 'title' ]);
    await Bone.driver.removeIndex('notes', [ 'userId', 'title' ]);
    await assert.rejects(async function() {
      await Bone.driver.removeIndex('notes', {});
    }, /Unexpected index name/i);
  });

});

describe('=> Bone.sync()', () => {
  beforeEach(async () => {
    await Bone.driver.dropTable('notes');
  });

  it('should create table if not exist', async () => {
    class Note extends Bone {};
    Note.init({
      title: { type: STRING, comment: '标题' },
      body: TEXT,
    });
    assert(!Note.synchronized);

    await Note.sync();
    assert(Note.synchronized);
    assert.equal(Note.table, 'notes');
    await checkDefinitions('notes', {
      title: {
        dataType: 'varchar',
        comment: Bone.driver.type === 'mysql' ? '标题' : undefined,
      },
    });
  });

  it('should not add column if table already exist', async () => {
    await Bone.driver.createTable('notes', {
      title: { type: STRING, allowNull: false },
    });
    class Note extends Bone {};
    Note.init({ title: STRING, body: TEXT });
    assert(!Note.synchronized);

    await Note.sync();
    assert(!Note.synchronized);
    assert.deepEqual(Object.keys(await Note.describe()), ['title']);
  });

  it('should add column with force', async () => {
    await Bone.driver.createTable('notes', {
      title: { type: STRING, allowNull: false },
    });
    class Note extends Bone {};
    Note.init({ title: STRING, body: TEXT });
    assert(!Note.synchronized);

    await Note.sync({ force: true });
    assert(Note.synchronized);
    await checkDefinitions('notes', {
      title: { dataType: 'varchar', allowNull: true },
      body: { dataType: 'text' },
    });
  });

  it('should not add multiple columns if table already exist', async () => {
    await Bone.driver.createTable('notes', {
      title: STRING,
    });
    class Note extends Bone {};
    Note.init({
      title: STRING,
      body: TEXT,
      bodyDraft: TEXT,
    });
    assert(!Note.synchronized);

    await Note.sync();
    assert(!Note.synchronized);
    assert.deepEqual(Object.keys(await Note.describe()), ['title']);
  });

  it('should add multiple column with force', async () => {
    await Bone.driver.createTable('notes', {
      title: { type: STRING, allowNull: false },
    });
    class Note extends Bone {};
    Note.init({
      title: STRING,
      body: TEXT,
      bodyDraft: TEXT,
    });

    assert(!Note.synchronized);

    await Note.sync({ force: true });
    assert(Note.synchronized);
    await checkDefinitions('notes', {
      title: { dataType: 'varchar' },
      body: { dataType: 'text' },
      body_draft: { dataType: 'text' },
    });
  });

  it('should change column if modified with alter', async () => {
    await Bone.driver.createTable('notes', {
      title: { type: STRING, allowNull: false },
      body: { type: STRING },
    });
    class Note extends Bone {};
    Note.init({ title: STRING, body: TEXT });
    assert(!Note.synchronized);

    await Note.sync({ alter: true });
    assert(Note.synchronized);
    await checkDefinitions('notes', {
      body: { dataType: 'text' },
    });
  });

  it('should drop column if removed with alter', async () => {
    await Bone.driver.createTable('notes', {
      title: { type: STRING, allowNull: false },
      body: { type: STRING },
      summary: { type: STRING },
    });
    class Note extends Bone {};
    Note.init({ title: STRING, body: TEXT });
    assert(!Note.synchronized);
    await Note.sync({ alter: true });
    assert(Note.synchronized);
    await checkDefinitions('notes', {
      title: { dataType: 'varchar', allowNull: true },
      body: { dataType: 'text' },
      summary: null,
    });
  });
});

describe('=> Bone.drop()', () => {
  beforeEach(async () => {
    await Bone.driver.dropTable('temp');
  });

  it('should be able to drop table', async () => {
    class Temp extends Bone {};
    Temp.init({
      id: INTEGER,
      foo: STRING,
    }, { tableName: 'temp' });

    await Temp.sync();
    await checkDefinitions('temp', {
      foo: { dataType: 'varchar'},
    });

    await Temp.drop();
    await checkDefinitions('temp', null);
  });
});

describe('=> Bone.truncate()', () => {
  beforeEach(async () => {
    await Bone.driver.dropTable('temp');
  });

  it('should be able to drop table', async () => {
    class Temp extends Bone {};
    Temp.init({
      id: INTEGER,
      foo: STRING,
    }, { tableName: 'temp' });

    await Temp.sync();
    assert.equal(await Temp.count(), 0);

    await Temp.create({ foo: 'bazinga' });
    assert.equal(await Temp.count(), 1);

    await Temp.truncate();
    assert.equal(await Temp.count(), 0);
  });
});

describe('=> Bone.describe()', function() {
  beforeEach(async function() {
    await Bone.driver.dropTable('temp');
  });

  it('should be able to get table description', async function() {
    class Temp extends Bone {};
    Temp.init({
      id: INTEGER,
      foo: STRING,
    }, { tableName: 'temp' });

    await Temp.sync();
    const result = await Temp.describe();
    assert.deepEqual(Object.keys(result), [ 'id', 'foo', 'created_at', 'updated_at' ]);
  });
});

describe('=> Table indexes', function() {
  let driver;
  before(async function() {
    driver = Bone.driver;
    await driver.removeIndex('articles', 'idx_articles_authorid').catch(() => {});
    await driver.removeIndex('articles', [ 'author_id', 'gmt_create' ]).catch(() => {});
    await driver.removeIndex('users', `uk_users_email`).catch(() => {});
  });

  it('driver.addIndex()', async function() {
    await driver.addIndex('articles', ['author_id']);
    const results = await driver.showIndexes('articles', 'idx_articles_authorid');
    assert.equal(results.length, 1);
    assert.equal(results[0].name, 'idx_articles_authorid');
    assert.deepEqual(results[0].columns, ['author_id']);
  });

  it('driver.addIndeex(table, attributes, { unique: true })', async function() {
    await driver.addIndex('users', ['email'], { unique: true });
    try {
      const results = await driver.showIndexes('users', 'uk_users_email');
    console.log(results);
      assert.equal(results.length, 1);
      assert.equal(results[0].name, 'uk_users_email');
      assert.equal(results[0].unique, true);
      assert.deepEqual(results[0].columns, ['email']);
    } finally {
      await driver.removeIndex('users', 'uk_users_email').catch(() => {});
    }
  });

  it('driver.addIndeex(table, attributes, { type: "UNIQUE" })', async function() {
    await driver.addIndex('users', ['email'], { type: 'UNIQUE' });
    try {
      const results = await driver.showIndexes('users', 'uk_users_email');
      assert.equal(results.length, 1);
      assert.equal(results[0].name, 'uk_users_email');
      assert.equal(results[0].unique, true);
      assert.deepEqual(results[0].columns, ['email']);
    } finally {
      await driver.removeIndex('users', 'uk_users_email').catch(() => {});
    }
  });
  it('driver.removeIndex()', async function() {
    await driver.removeIndex('articles', 'idx_articles_authorid');
  });

  it('driver.removeIndex("table", ["column1", "column2"])', async function() {
    await driver.addIndex('articles', ['author_id', 'gmt_create']);
    let results = await driver.showIndexes('articles', ['author_id', 'gmt_create']);
    assert.equal(results.length, 1);
    assert.equal(results[0].name, 'idx_articles_authorid_gmtcreate');
    assert.deepEqual(results[0].columns, ['author_id', 'gmt_create']);
    await driver.removeIndex('articles', ['author_id', 'gmt_create']);
    results = await driver.showIndexes('articles', ['author_id', 'gmt_create']);
    assert.equal(results.length, 0);
  });
});

