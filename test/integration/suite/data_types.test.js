'use strict';

const assert = require('assert').strict;
const strftime = require('strftime');

const { Bone, DataTypes } = require('../../..');
const { INTEGER, STRING, DATE, DATEONLY, TEXT, BOOLEAN, JSON, JSONB } = DataTypes;


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

  before(async () => {
    await Note.driver.dropTable('notes');
    await Note.sync();
  });

  it('=> init', async () => {
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

  it('=> type casting', async function() {
    const note = await Note.create({ meta: {} });
    assert.deepEqual(note.meta, {});
    await note.reload();
    assert.deepEqual(note.meta, {});

    const note2 = await Note.create({ meta: [] });
    assert.deepEqual(note2.meta, []);
    await note2.reload();
    assert.deepEqual(note2.meta, []);

    const note3 = await Note.create({ meta: [ 1, 2, 3 ] });
    assert.deepEqual(note3.meta, [ 1, 2, 3 ]);
    await note3.reload();
    assert.deepEqual(note3.meta, [ 1, 2, 3 ]);
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
    if (Note) await Note.driver.dropTable('notes');
  });

  afterEach(async () => {
    if (Note) await Note.driver.dropTable('notes');
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

describe('=> Data Types - INTEGER', function() {
  class Note extends Bone {
    static attributes = {
      word_count: INTEGER,
    }
  }

  before(async function() {
    await Note.driver.dropTable('notes');
    await Note.sync();
  });

  it('type casting', async function() {
    const note = await Note.create({ word_count: '800' });
    await note.reload();
    assert.equal(note.word_count, 800);

    const note2 = await Note.findOne({ word_count: '800' });
    assert.equal(note2.word_count, 800);

    const result = await Note.where({ word_count: [ 800, null ] });
    assert.equal(result.length, 1);
    assert.deepEqual(result.toJSON(), [ note2.toJSON() ]);

    await assert.rejects(async function() {
      await Note.where({ word_count: [ 'foo' ] });
    }, /invalid integer/i);
  });
});

describe('=> Data types - DATE', function() {
  class Note extends Bone {
    static attributes = {
      createdAt: DATE(6),
      updatedAt: DATE(6),
    }
  }

  before(async function() {
    await Note.driver.dropTable('notes');
    await Note.sync();
  });

  it('type casting', async function() {
    const date = new Date('2021-10-15T08:38:43.877Z');
    const note = await Note.create({ createdAt: date, updatedAt: date });
    await note.reload();
    assert.equal(note.createdAt.toISOString(), '2021-10-15T08:38:43.877Z');

    await assert.doesNotReject(async function() {
      const result = await Note.where({ createdAt: date });
      assert.equal(result.length, 1);
    });

    await assert.doesNotReject(async function() {
      const result = await Note.where({ createdAt: '2021-10-15 08:38:43,877' });
      assert.equal(result.length, 1);
    });

    // MySQL throws on invalid date string in SELECT, others neglect.
    await assert.rejects(async function() {
      const result = await Note.where({ createdAt: 'invalid date' });
      assert.equal(result.length, 0);
    }, /invalid date/i);

    // SQLite neglects invalid date string in INSERT, others throw.
    await assert.rejects(async function() {
      const note2 = await Note.create({ createdAt: 'invalid date' });
      await note2.reload();
      assert.equal(note2.createdAt, null);
    }, /invalid date/i);
  });
});

describe('=> Data types - DATEONLY', function() {
  class Note extends Bone {
    static attributes = {
      createdAt: DATEONLY,
    }
  }

  before(async function() {
    await Note.driver.dropTable('notes');
    await Note.sync();
  });

  it('type casting', async function() {
    const date = new Date('2021-10-15T08:38:43.877Z');
    const note = await Note.create({ createdAt: date });
    await note.reload();
    assert.equal(strftime('%Y-%m-%d', note.createdAt), '2021-10-15');

    await assert.doesNotReject(async function() {
      const result = await Note.where({ createdAt: date });
      assert.equal(result.length, 1);
    });

    await assert.doesNotReject(async function() {
      const result = await Note.where({ createdAt: '2021-10-15 08:38:43,877' });
      assert.equal(result.length, 1);
    });

    // MySQL throws on invalid date string in SELECT, others neglect.
    await assert.rejects(async function() {
      const result = await Note.where({ createdAt: 'invalid date' });
      assert.equal(result.length, 0);
    }, /invalid date/i);

    // SQLite neglects invalid date string in INSERT, others throw.
    await assert.rejects(async function() {
      const note2 = await Note.create({ createdAt: 'invalid date' });
      await note2.reload();
      assert.equal(note2.createdAt, null);
    }, /invalid date/i);
  });
});
