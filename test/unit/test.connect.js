'use strict';

const assert = require('assert').strict;
const path = require('path');
const { connect, Bone } = require('../..');

describe('connect', function() {
  beforeEach(() => {
    Bone.driver = null;
  });

  it('rejects unsupported database', async function() {
    await assert.rejects(async () => {
      await connect({ client: 'sqlite', models: `${__dirname}/models` });
    }, /unsupported database/i);
  });

  it('connect models passed in opts.models', async function() {
    const Book = require('./models/book');
    await connect({
      user: 'root',
      database: 'leoric',
      models: [ Book ],
    });
    assert(Book.synchronized);
    assert(Object.keys(Book.attributes).length > 0);
  });

  it('connect models in the directory specified by opts.models', async () => {
    await connect({
      user: 'root',
      database: 'leoric',
      models: path.join(__dirname, 'models'),
    });
    const User = require('./models/user');
    assert(User.synchronized);
  });

  it('rejects duplicated connect', async function() {
    await connect({ user: 'root', database: 'leoric' });
    await assert.rejects(async () => {
      await connect({ user: 'root', database: 'leoric' });
    }, /connected already/i);
  });
});
