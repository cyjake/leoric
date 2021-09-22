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

  it('connect with subclass', async function() {
    const { Bone: Spine } = await connect({ subclass: true });
    assert.ok(Spine.prototype instanceof Bone);
    assert.ok(Spine.models);
    assert.equal(Bone.driver, null);
  });

  it('connect with custom Bone', async function() {
    class Spine extends Bone {}
    class Book extends Spine {}
    await connect({
      port: process.env.MYSQL_PORT,
      user: 'root',
      database: 'leoric',
      Bone: Spine,
      models: [ Book ],
    });
    assert.equal(Bone.driver, null);
    assert.equal(Book.driver, Spine.driver);
    assert.ok(Spine.driver);
    assert.ok(Book.synchronized);
  });

  it('connect models passed in opts.models (init with primaryKey)', async function() {
    const { STRING, BIGINT } = DataTypes;
    class Book extends Bone {
      static attributes = {
        isbn: { type: BIGINT, primaryKey: true },
        name: { type: STRING, allowNull: false },
      }
    }
    await connect({
      port: process.env.MYSQL_PORT,
      user: 'root',
      database: 'leoric',
      models: [ Book ],
    });
    assert(Book.synchronized);
    assert(Book.primaryKey === 'isbn');
    assert(Book.primaryColumn === 'isbn');
    assert(Object.keys(Book.attributes).length > 0);
  });

  it('connect models passed in opts.models (define class with primaryKey)', async function() {
    const { STRING } = DataTypes;
    class Book extends Bone {
      static primaryKey = 'isbn';
      static attributes = {
        name: { type: STRING, allowNull: false },
      };
    }
    await connect({
      port: process.env.MYSQL_PORT,
      user: 'root',
      database: 'leoric',
      models: [ Book ],
    });
    assert(Book.synchronized);
    assert(Book.primaryKey === 'isbn');
    assert(Book.primaryColumn === 'isbn');
    assert(Object.keys(Book.attributes).length > 0);
  });

  it('initialize model attributes if not defined in model itself', async () => {
    class Book extends Bone {}
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
    const user = await User.create({ email: 'hello@hh.com', nickname: 'testy', meta: { foo: 1, bar: 'baz'} });
    assert(user.email === 'hello@hh.com');
    assert(user.meta.foo === 1);
  });

  it('should call customized initialize code in model', async function() {
    let initialized;
    class User extends Bone {
      static initialize() {
        initialized = true;
      }
    }
    await connect({
      port: process.env.MYSQL_PORT,
      user: 'root',
      database: 'leoric',
      models: [ User ],
    });
    assert(initialized);
  });
});
