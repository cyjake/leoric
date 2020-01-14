'use strict';

const assert = require('assert').strict;
const { connect } = require('..');

describe('connect', function() {
  it('rejects unsupported database', async function() {
    await assert.rejects(async () => {
      await connect({ client: 'sqlite', models: `${__dirname}/models` });
    }, /unsupported database/i);
  });

  it('connect models passed in opts.models', async function() {
    await connect({
      user: 'root',
      database: 'leoric',
      models: `${__dirname}/models`
    });
    const Book = require('./models/book');
    assert(Object.keys(Book.schema).length > 0);
  });

  it('rejects duplicated connect', async function() {
    await assert.rejects(async () => {
      await connect({ user: 'root', database: 'leoric' });
    }, /connected already/i);
  });
});
