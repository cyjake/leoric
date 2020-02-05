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
    // milliseconds in different databases is a long story, just datetime for now
    createdAt.setMilliseconds(0);
    await Note.create({ title: 'Leah', createdAt });
    const note  = await Note.first;
    assert.deepEqual(note.createdAt, createdAt);
  });

  it('BOOLEAN', async () => {
    await Note.create({ title: 'Cain', isPrivate: false });
    const note = await Note.first;
    assert.equal(note.isPrivate, false);
  });

  it('validate attributes', async () => {

  });
});
