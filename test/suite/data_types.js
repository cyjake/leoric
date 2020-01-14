'use strict';

const assert = require('assert').strict;
const Note = require('../models/note');

const { STRING } = Note;

describe('=> Data Types', () => {
  it('define attributes', async () => {
    assert.deepEqual(Note.definitions.title, {
      allowNull: true,
      columnName: 'title',
      dataType: STRING,
      defaultValue: null,
    });
  });

  it('validate attributes', async () => {

  });
});
