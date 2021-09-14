'use strict';

const assert = require('assert').strict;

const { Bone, DataTypes } = require('../../..');
const { INTEGER, STRING, DATE, TEXT, BOOLEAN, JSON, JSONB } = DataTypes;


describe('=> Data types', () => {
  class Note extends Bone {
    static attributes = {
      id: { type: INTEGER, primaryKey: true },
      title: STRING,
      body: TEXT,
      isPrivate: BOOLEAN,
      createdAt: DATE,
      updatedAt: DATE,
      publishedAt: DATE(6),
    }
  };
  before(async () => {
    await Note.driver.dropTable('notes');
    await Note.sync();
  });

  beforeEach(async () => {
    await Note.remove({});
  });

  after(async () => {
    await Note.driver.dropTable('notes');
  });

  it('STRING', async () => {
    const { title } = Note.attributes;
    assert.equal(title.allowNull, true);
    assert.equal(title.columnName, 'title');
    assert.equal(title.dataType, 'varchar');
    assert.equal(title.jsType, String);
    assert.ok(title.type instanceof STRING);
    assert.equal(title.defaultValue, null);
  });

  it('DATE', async () => {
    const createdAt = new Date();
    // DATE without precision
    createdAt.setMilliseconds(0);
    await Note.create({ title: 'Leah', createdAt });
    const note  = await Note.first;
    assert.deepEqual(note.createdAt, createdAt);

    const now = new Date();
    await note.update({ publishedAt: now });
    assert.deepEqual(note.publishedAt, now);
  });

  it('BOOLEAN', async () => {
    const note = await Note.create({ title: 'Cain', isPrivate: false });
    assert.equal(note.isPrivate, false);
    const foundNote = await Note.first;
    assert.equal(foundNote.isPrivate, false);
  });
});


describe('=> Data types - JSON', () => {
  class Note extends Bone {
    static attributes = {
      id: { type: INTEGER, primaryKey: true },
      title: STRING,
      body: TEXT,
      isPrivate: BOOLEAN,
      createdAt: DATE,
      updatedAt: DATE,
      publishedAt: DATE(6),
      meta: JSON,
      metab: JSONB,
    }
  }

  beforeEach(async () => {
    await Note.driver.dropTable('notes');
  });

  afterEach(async () => {
    await Note.driver.dropTable('notes');
  });

  it('=> init', async () => {
    await Note.sync();
    await Note.create({ title: 'Leah',  meta: { foo: 1, baz: 'baz' }, metab: { foo: 2, baz: 'baz1' } });
    const foundNote = await Note.first;
    const { meta, metab } = Note.attributes;
    assert.equal(meta.dataType, 'text');
    // jsType is JSON class
    assert.equal(meta.jsType, global.JSON);
    assert.ok(meta.type instanceof JSON);

    // dataType varies in different databases
    // assert.equal(metab.dataType, 'jsonb');
    assert.equal(metab.jsType, global.JSON);
    assert.ok(metab.type instanceof JSONB);

    assert.deepEqual(foundNote.meta, { foo: 1, baz: 'baz' });
    assert.deepEqual(foundNote.metab, { foo: 2, baz: 'baz1' });
  });
});


describe('=> Data types - BINARY', () => {
  let Note, BINARY, VARBINARY, BLOB;
  before(async () => {
    BINARY = Bone.driver.DataTypes.BINARY;
    VARBINARY = Bone.driver.DataTypes.VARBINARY;
    BLOB = Bone.driver.DataTypes.BLOB;
    class NoteClass extends Bone {
      static table = 'notes';
      static attributes = {
        id: { type: INTEGER, primaryKey: true },
        title: STRING,
        body: TEXT,
        isPrivate: BOOLEAN,
        createdAt: DATE,
        updatedAt: DATE,
        publishedAt: DATE(6),
        meta: BINARY,
        metab: VARBINARY,
        metac: BLOB
      }
    }
    Note = NoteClass;
  });

  beforeEach(async () => {
    (Note && await Note.driver.dropTable('notes'));
  });

  afterEach(async () => {
    (Note && await Note.driver.dropTable('notes'));
  });

  it('=> init', async () => {

    const metaData = Buffer.from('meta');
    const metabData = Buffer.from('metab');
    const metacData = Buffer.from('metac');
    await Note.sync();
    await Note.create({ title: 'Leah',  meta: metaData, metab: metabData, metac: metacData });
    const foundNote = await Note.first;
    const { meta, metab, metac } = Note.attributes;
    if (Note.driver.type === 'postgres') {
      assert.equal(meta.dataType, 'bytea');
      assert.equal(metab.dataType, 'bytea');
      assert.equal(metac.dataType, 'bytea');
    } else {
      assert.equal(meta.dataType, 'binary');
      assert.equal(metab.dataType, 'varbinary');
      assert.equal(metac.dataType, 'blob');
    }

    // jsType is JSON class
    assert.equal(meta.jsType, Buffer);
    assert.ok(meta.type instanceof BINARY);
    assert.equal(metab.jsType, Buffer);
    assert.ok(metab.type instanceof VARBINARY);
    assert.equal(meta.jsType, Buffer);
    assert.ok(metac.type instanceof BLOB);

    if (Note.driver.type === 'mysql') {
      // mysql binary types are fixed length，will be filled with \x00 
      assert.deepEqual(foundNote.meta.subarray(0, 4), metaData);
      assert.deepEqual(foundNote.metab.subarray(0, 5), metabData);
    } else {
      assert.equal(foundNote.meta.toString(), 'meta');
      assert.equal(foundNote.metab.toString(), 'metab');
    }
    assert.equal(foundNote.metac.toString(), 'metac');
  });
});
