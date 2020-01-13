'use strict';

const Note = require('../models/note');

describe('=> Data Types', () => {
  it('define attributes', async () => {
    console.log(Note.schema);
    console.log(Note.draftSchema)
    console.log(Note.synchronized);
  });

  it('validate attributes', async () => {

  });
});
