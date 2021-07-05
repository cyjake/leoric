'use strict';

const assert = require('assert').strict;
const { Bone, DataTypes, connect } = require('../..');

const { BIGINT, STRING, DATE } = DataTypes;

describe('=> Bone.init()', function() {
  it('should be able to initialize attributes', async function() {
    class User extends Bone {}
    User.init({ name: STRING });
    assert.ok(User.attributes.name);
  });

  it('should leave table name undefined if not specified', async function() {
    class User extends Bone {}
    User.init({ name: STRING });
    assert.equal(User.table, undefined);
  });

  it('should be able to override table name', async function() {
    class User extends Bone {}
    User.init({ name: STRING }, { tableName: 'people' });
    assert.ok(User.attributes.name);
    assert.equal(User.table, 'people');
  });
});

describe('=> Bone.normalize(attributes)', function() {
  it('should append primary key if no primary key were found', async function() {
    const attributes = {};
    Bone.normalize(attributes);
    assert.ok(attributes.id);
    assert.ok(attributes.id.primaryKey);
    assert.equal(attributes.id.type.toSqlString(), 'BIGINT');
  });

  it('should not append primary key if primary key exists', async function() {
    const attributes = {
      iid: { type: BIGINT, primaryKey: true },
    };
    Bone.normalize(attributes);
    assert.equal(attributes.iid.primaryKey, true);
    assert.equal(attributes.id, undefined);
  });

  it('should rename legacy timestamps', async function() {
    const attributes = {
      gmtCreate: DATE,
      gmtModified: DATE,
      gmtDeleted: DATE,
    };
    Bone.normalize(attributes);
    assert.ok(attributes.createdAt);
    assert.ok(attributes.updatedAt);
    assert.ok(attributes.deletedAt);
    assert.equal(attributes.gmtCreate, undefined);
    assert.equal(attributes.gmtModified, undefined);
    assert.equal(attributes.gmtDeleted, undefined);
  });
});

describe('=> Bone.load()', function() {
  beforeEach(async function() {
    await connect({
      port: process.env.MYSQL_PORT,
      user: 'root',
      database: 'leoric',
    });
  });

  afterEach(function() {
    Bone.driver = null;
  });

  it('should make sure attributes are initialized before load', async function() {
    class User extends Bone {
      static attributes = {
        name: STRING,
      }
    }
    User.load([
      { columnName: 'id', columnType: 'bigint', dataType: 'bigint', primaryKey: true },
      { columnName: 'name', columnType: 'varchar', dataType: 'varchar' },
    ]);
    assert.ok(User.attributes);
    assert.equal(User.table, 'users');
    assert.equal(User.primaryKey, 'id');
  });

  it('should mark timestamps', async function() {
    class User extends Bone {
      static attributes = {
        createdAt: DATE,
        updatedAt: DATE,
        deletedAt: DATE,
      }
    }
    User.load([
      { columnName: 'id', columnType: 'bigint', dataType: 'bigint', primaryKey: true },
      { columnName: 'created_at', columnType: 'timestamp', dataType: 'timestamp' },
      { columnName: 'updated_at', columnType: 'timestamp', dataType: 'timestamp' },
      { columnName: 'deleted_at', columnType: 'timestamp', dataType: 'timestamp' },
    ]);
    assert.ok(User.timestamps);
    assert.equal(User.timestamps.createdAt, 'createdAt');
    assert.equal(User.timestamps.updatedAt, 'updatedAt');
    assert.equal(User.timestamps.deletedAt, 'deletedAt');
  });

  it('should mark primaryKey', async function() {
    class User extends Bone {
      static attributes = {
        ssn: { type: STRING, primaryKey: true },
      }
    }
    User.load([
      { columnName: 'ssn', columnType: 'varchar', dataType: 'varchar', primaryKey: true },
    ]);
    assert.equal(User.primaryKey, 'ssn');
    assert.equal(User.primaryColumn, 'ssn');
  });
});
