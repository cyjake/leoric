'use strict';

const assert = require('assert').strict;
const path = require('path');
const { connect, Bone, DataTypes } = require('../..');

describe('connect', function() {
  beforeEach(() => {
    Bone.driver = null;
  });

  it('rejects unsupported database', async function() {
    await assert.rejects(async () => {
      await connect({ dialect: 'mongodb', models: `${__dirname}/models` });
    }, /unsupported database/i);
  });

  it('rejects duplicated connect', async function() {
    await connect({
      port: process.env.MYSQL_PORT,
      user: 'root',
      database: 'leoric',
    });
    await assert.rejects(async () => {
      await connect({
        port: process.env.MYSQL_PORT,
        user: 'root',
        database: 'leoric',
      });
    }, /connected already/i);
  });

  it('connect with specified Bone', async function() {
    const Spine = await connect({ Bone: class extends Bone {} });
    assert.ok(Spine.prototype instanceof Bone);
    assert.ok(Spine.models);
  });

  it('connect models passed in opts.models', async function() {
    const { STRING } = DataTypes;
    class Book extends Bone {};
    Book.init({
      name: { type: STRING, allowNull: false },
    });
    await connect({
      port: process.env.MYSQL_PORT,
      user: 'root',
      database: 'leoric',
      models: [ Book ],
    });
    assert(Book.synchronized);
    assert(Object.keys(Book.attributes).length > 0);
  });

  it('initialize model attributes if not defined in model itself', async () => {
    const Book = require('../models/book');
    await connect({
      port: process.env.MYSQL_PORT,
      user: 'root',
      database: 'leoric',
      models: [ Book ],
    });
    assert(Book.synchronized);
    assert(Object.keys(Book.attributes).length > 0);
  });

  it('connect models in the directory specified by opts.models', async () => {
    await connect({
      port: process.env.MYSQL_PORT,
      user: 'root',
      database: 'leoric',
      models: path.resolve(__dirname, '../models'),
    });
    const User = require('../models/user');
    assert(User.synchronized);
  });
});
