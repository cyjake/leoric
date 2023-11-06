'use strict';

const assert = require('assert').strict;
const { connect, Bone, DataTypes } = require('../../src');

describe('connect', function() {
  beforeEach(() => {
    Bone.driver = null;
  });

  it('should work without define attributes clearly', async function() {
    class Book extends Bone {}
    await connect({
      port: process.env.MYSQL_PORT,
      user: 'root',
      database: 'leoric',
      Bone: Bone,
      models: [ Book ],
    });
    assert.equal(Book.timestamps.createdAt, 'createdAt');
    assert.equal(Book.attributes.createdAt.columnName, 'gmt_create');
    assert.equal(Book.timestamps.updatedAt, 'updatedAt');
    assert.equal(Book.attributes.updatedAt.columnName, 'gmt_modified');
    assert.equal(Book.timestamps.deletedAt, 'deletedAt');
    assert.equal(Book.attributes.deletedAt.columnName, 'gmt_deleted');

  });

  it('should work with define attributes clearly', async function() {
    const { STRING, BIGINT, DECIMAL, DATE } = DataTypes;
    class Book extends Bone {
      static attributes = {
        isbn: { type: BIGINT, primaryKey: true },
        name: { type: STRING, allowNull: false },
        price: { type: DECIMAL(10, 3), allowNull: false },
        createdAt: { type: DATE },
        updatedAt: { type: DATE },
        deletedAt: { type: DATE },
      };
    }
    await connect({
      port: process.env.MYSQL_PORT,
      user: 'root',
      database: 'leoric',
      models: [ Book ],
    });
    assert.equal(Book.timestamps.createdAt, 'createdAt');
    assert.equal(Book.attributes.createdAt.columnName, 'gmt_create');
    assert.equal(Book.timestamps.updatedAt, 'updatedAt');
    assert.equal(Book.attributes.updatedAt.columnName, 'gmt_modified');
    assert.equal(Book.timestamps.deletedAt, 'deletedAt');
    assert.equal(Book.attributes.deletedAt.columnName, 'gmt_deleted');
  });

  it('should work with snake case', async function() {
    const { STRING, BIGINT, DECIMAL, DATE } = DataTypes;
    class Book extends Bone {
      static attributes = {
        isbn: { type: BIGINT, primaryKey: true },
        name: { type: STRING, allowNull: false },
        price: { type: DECIMAL(10, 3), allowNull: false },
        created_at: { type: DATE },
        updated_at: { type: DATE },
        deleted_at: { type: DATE },
      };
    }
    await connect({
      port: process.env.MYSQL_PORT,
      user: 'root',
      database: 'leoric',
      models: [ Book ],
    });
    assert.equal(Book.timestamps.createdAt, 'created_at');
    assert.equal(Book.attributes.created_at.columnName, 'gmt_create');
    assert.equal(Book.timestamps.updatedAt, 'updated_at');
    assert.equal(Book.attributes.updated_at.columnName, 'gmt_modified');
    assert.equal(Book.timestamps.deletedAt, 'deleted_at');
    assert.equal(Book.attributes.deleted_at.columnName, 'gmt_deleted');
  });


  it('should work with mixed case', async function() {
    const { STRING, BIGINT, DECIMAL, DATE } = DataTypes;
    class Book extends Bone {
      static attributes = {
        isbn: { type: BIGINT, primaryKey: true },
        name: { type: STRING, allowNull: false },
        price: { type: DECIMAL(10, 3), allowNull: false },
        created_at: { type: DATE },
        updatedAt: { type: DATE },
        deleted_at: { type: DATE },
      };
    }
    await connect({
      port: process.env.MYSQL_PORT,
      user: 'root',
      database: 'leoric',
      models: [ Book ],
    });
    assert.equal(Book.timestamps.createdAt, 'created_at');
    assert.equal(Book.attributes.created_at.columnName, 'gmt_create');
    assert.equal(Book.timestamps.updatedAt, 'updatedAt');
    assert.equal(Book.attributes.updatedAt.columnName, 'gmt_modified');
    assert.equal(Book.timestamps.deletedAt, 'deleted_at');
    assert.equal(Book.attributes.deleted_at.columnName, 'gmt_deleted');
  });

});
