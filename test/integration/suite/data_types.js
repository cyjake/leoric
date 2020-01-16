'use strict';

const assert = require('assert').strict;
const { Bone } = require('../../..');
const { INTEGER, STRING, DATE, TEXT } = Bone;

const Note = Bone.define('Note', {
  id: INTEGER,
  title: STRING,
  body: TEXT,
  createdAt: DATE,
});

describe('=> Data Types', () => {
  it('define attributes', async () => {
    assert.deepEqual(Note.attributes.title, {
      allowNull: true,
      columnName: 'title',
      dataType: STRING,
      defaultValue: null,
    });
  });

  it('validate attributes', async () => {

  });
});
