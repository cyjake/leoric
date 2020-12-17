'use strict';

const assert = require('assert').strict;
const { Bone, DataTypes } = require('../../..');
const { checkDefinitions } = require('../helpers');

const { INTEGER, STRING, TEXT, BIGINT } = DataTypes;

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
      defaultValue: null,
    });
    await checkDefinitions('notes', {
      title: { dataType: 'varchar', allowNull: false, defaultValue: null },
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
      id: { type: BIGINT },
      userId: { type: INTEGER },
      title: { type: STRING },
    });
    await Bone.driver.addIndex('notes', [ 'userId', 'title' ]);
    await Bone.driver.removeIndex('notes', [ 'userId', 'title' ]);
  });
});

describe('=> Bone.sync()', () => {
  beforeEach(async () => {
    await Bone.driver.dropTable('notes');
  });

  after(async () => {
    await Bone.driver.dropTable('notes');
  });

  it('should create table if not exists', async () => {
    class Note extends Bone {};
    Note.init({ title: STRING, body: TEXT });
    assert.equal(Note.table, 'notes');
    assert(!Note.synchronized);

    await Note.sync();
    assert(Note.synchronized);
    await checkDefinitions('notes', {
      title: { dataType: 'varchar' },
    });
  });

  it.only('should add column if not exists', async () => {
    await Bone.driver.createTable('notes', {
      title: { type: STRING, allowNull: false },
    });
    class Note extends Bone {};
    Note.init({ title: STRING, body: TEXT });
    assert(!Note.synchronized);

    await Note.sync();
    assert(Note.synchronized);
    await checkDefinitions('notes', {
      title: { dataType: 'varchar', allowNull: true },
      body: { dataType: 'text' },
    });
  });

  it.only('should add multiple columns if not exist', async () => {
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
    assert(Note.synchronized);
    await checkDefinitions('notes', {
      title: { dataType: 'varchar' },
      body: { dataType: 'text' },
      body_draft: { dataType: 'text' },
    });
  });

  it('should change column if modified', async () => {
    await Bone.driver.createTable('notes', {
      title: { type: STRING, allowNull: false },
      body: { type: STRING },
    });
    class Note extends Bone {};
    Note.init({ title: STRING, body: TEXT });
    assert(!Note.synchronized);

    await Note.sync();
    assert(Note.synchronized);
    await checkDefinitions('notes', {
      body: { dataType: 'text' },
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
