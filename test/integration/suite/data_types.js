'use strict';

const assert = require('assert').strict;

const { Bone, DataTypes } = require('../../..');
const { INTEGER, STRING, DATE, TEXT, BOOLEAN } = DataTypes;

class Note extends Bone {};
Note.init({
  id: { type: INTEGER, primaryKey: true },
  title: STRING,
  body: TEXT,
  isPrivate: BOOLEAN,
  createdAt: DATE,
  updatedAt: DATE,
  publishedAt: DATE(6),
});

describe('=> Data types', () => {
  before(async () => {
    await Note.driver.dropTable('notes');
    await Note.sync();
  });

  beforeEach(async () => {
    await Note.remove({});
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
