'use strict';

const assert = require('assert').strict;
const Note = require('../models/note');

describe('=> Migrations', () => {
  beforeEach(async () => {
    await Note.driver.dropTable(Note.table);
    Object.defineProperties(Note, {
      schema: { value: {} },
      synchronized: { value: false },
    });
  });

  it('Bone.diff', async () => {
    assert(!Note.synchronized);
    assert.deepEqual(Note.diff, Note.definitions);
  });

  it('Bone.sync()', async () => {
    await Note.sync();
    assert(Note.synchronized);
    assert(Note.schema);
  });
});
