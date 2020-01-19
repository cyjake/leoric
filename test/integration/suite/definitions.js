'use strict';

const assert = require('assert').strict;
const { Bone, DataTypes } = require('../../..');
const { checkDefinitions } = require('../helpers');

const { INTEGER, STRING, TEXT } = DataTypes;

describe('=> Table definitions', () => {
  beforeEach(async () => {
    await Bone.driver.dropTable('notes');
  });

  it('should be able to create table', async () => {
    await Bone.driver.createTable('notes', {
      title: { dataType: STRING, allowNull: false },
      body: { dataType: TEXT },
    });

    await checkDefinitions('notes', {
      title: { dataType: 'varchar', allowNull: false },
      body: { dataType: 'text' },
    });
  });

  it('should be able to alter table', async () => {
    await Bone.driver.createTable('notes', {
      title: { dataType: STRING, allowNull: false },
    });
    await checkDefinitions('notes', { body: null });

    await Bone.driver.alterTable('notes', {
      title: { exists: true, dataType: STRING, allowNull: true },
      body: { dataType: TEXT },
    });

    await checkDefinitions('notes', {
      title: { dataType: 'varchar', allowNull: true },
      body: { dataType: 'text' },
    });
  });

  it('should be able to add column', async () => {
    await Bone.driver.createTable('notes', {
      title: { dataType: STRING, allowNull: false },
    });
    await checkDefinitions('notes', { body: null });

    await Bone.driver.addColumn('notes', 'body', { dataType: TEXT });
    await checkDefinitions('notes', {
      title: { dataType: 'varchar', allowNull: false },
      body: { dataType: 'text' },
    });
  });

  it('should be able to change column', async () => {
    await Bone.driver.createTable('notes', {
      title: { dataType: STRING, allowNull: false },
    });

    await Bone.driver.changeColumn('notes', 'title', {
      dataType: STRING,
      allowNull: true
    });
    await checkDefinitions('notes', {
      title: { dataType: 'varchar', allowNull: true },
    });
  });
});

describe('=> Bone.sync()', () => {
  beforeEach(async () => {
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

  it('should add column if not exists', async () => {
    await Bone.driver.createTable('notes', {
      title: { dataType: STRING, allowNull: false },
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

  it('should change column if modified', async () => {
    // modify column not ready yet
    if (Bone.driver.type === 'sqlite') return;

    await Bone.driver.createTable('notes', {
      title: { dataType: STRING, allowNull: false },
      body: { dataType: STRING },
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
    await Bone.driver.query('CREATE TABLE IF NOT EXISTS temp (foo VARCHAR(255))');
  });

  it('should be able to drop table', async () => {
    class Temp extends Bone {};
    Temp.init({
      id: INTEGER,
      foo: STRING,
    }, { tableName: 'temp' });

    await checkDefinitions('temp', {
      foo: { dataType: 'varchar'},
    });

    await Temp.drop();
    await checkDefinitions('temp', null);
  });
});
