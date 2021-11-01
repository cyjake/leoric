'use strict';

const assert = require('assert').strict;
const { Bone, DataTypes, connect } = require('../..');

const { BIGINT, STRING, DATE } = DataTypes;

describe('=> Bone', function() {
  before(async function() {
    Bone.driver = null;
    await connect({
      port: process.env.MYSQL_PORT,
      user: 'root',
      database: 'leoric',
    });
  });

  after(function() {
    Bone.driver = null;
  });

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

  describe('=> Bone.load()', function() {
    it('should append primary key if no primary key were found', async function() {
      class User extends Bone {
        static attributes = {};
      }
      await User.load([
        { columnName: 'id', columnType: 'bigint', dataType: 'bigint', primaryKey: true },
      ]);
      assert.ok(User.attributes.id);
      assert.ok(User.attributes.id.primaryKey);
      assert.equal(User.attributes.id.type.toSqlString(), 'BIGINT');
    });

    it('should not append primary key if primary key exists', async function() {
      class User extends Bone {
        static attributes = {
          iid: { type: BIGINT, primaryKey: true },
        }
      };
      await User.load([
        { columnName: 'iid', columnType: 'bigint', dataType: 'bigint', primaryKey: true },
      ]);
      assert.equal(User.attributes.iid.primaryKey, true);
      assert.equal(User.attributes.id, undefined);
    });

    it('should rename legacy timestamps', async function() {
      class User extends Bone {
        static attributes = {
          gmtCreate: DATE,
          gmtModified: DATE,
          gmtDeleted: DATE,
        }
      };
      await User.load([
        { columnName: 'id', columnType: 'bigint', dataType: 'bigint', primaryKey: true },
        { columnName: 'created_at', columnType: 'timestamp', dataType: 'timestamp' },
        { columnName: 'updated_at', columnType: 'timestamp', dataType: 'timestamp' },
        { columnName: 'deleted_at', columnType: 'timestamp', dataType: 'timestamp' },
      ]);
      assert.ok(User.attributes.createdAt);
      assert.ok(User.attributes.updatedAt);
      assert.ok(User.attributes.deletedAt);
      assert.equal(User.attributes.gmtCreate, undefined);
      assert.equal(User.attributes.gmtModified, undefined);
      assert.equal(User.attributes.gmtDeleted, undefined);
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

    it('should mark timestamps if undescored', async function() {
      class Spine extends Bone {}
      Spine.options = { underscored: true };
      class User extends Bone {
        static attributes = {
          created_at: DATE,
          updated_at: DATE,
          deleted_at: DATE,
        }
      }
      User.load([
        { columnName: 'id', columnType: 'bigint', dataType: 'bigint', primaryKey: true },
        { columnName: 'created_at', columnType: 'timestamp', dataType: 'timestamp' },
        { columnName: 'updated_at', columnType: 'timestamp', dataType: 'timestamp' },
        { columnName: 'deleted_at', columnType: 'timestamp', dataType: 'timestamp' },
      ]);
      assert.ok(User.timestamps);
      assert.equal(User.timestamps.createdAt, 'created_at');
      assert.equal(User.timestamps.updatedAt, 'updated_at');
      assert.equal(User.timestamps.deletedAt, 'deleted_at');
    });

    it('should skip timestamps if not actually defined', async function() {
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
      ]);
      assert.ok(User.timestamps.createdAt);
      assert.equal(User.timestamps.updatedAt, undefined);
      assert.equal(User.timestamps.deletedAt, undefined);
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

  describe('=> Bone.loadAttribute()', function() {
    it('should make the loaded attribute enumerable', async function() {
      class User extends Bone {}
      User.loadAttribute('foo');
      assert.ok(Object.getOwnPropertyDescriptor(User.prototype, 'foo').enumerable);
    });

    it('should make sure both getter and setter exist', async function() {
      class User extends Bone {
        get foo() {
          return this.attribute('foo');
        }
      }
      User.loadAttribute('foo');
      assert.ok(Object.getOwnPropertyDescriptor(User.prototype, 'foo').enumerable);
      assert.ok(Object.getOwnPropertyDescriptor(User.prototype, 'foo').set);
    });
  });

  describe('=> Bone.renameAttribute()', function() {
    it('should make the renamed attribute enumerable', async function() {
      class User extends Bone {
        static attributes = {
          foo: { type: STRING },
        }
      }
      User.load([
        { columnName: 'foo', columnType: 'varchar', dataType: 'varchar' },
      ]);
      User.renameAttribute('foo', 'bar');
      assert.ok(Object.getOwnPropertyDescriptor(User.prototype, 'bar').enumerable);
    });

    it('should still be enumerable event if there were getter', async function() {
      class User extends Bone {
        static attributes = {
          foo: { type: STRING },
        }
        get bar() {
          return this.attribute('bar');
        }
      }
      User.load([
        { columnName: 'foo', columnType: 'varchar', dataType: 'varchar' },
      ]);
      User.renameAttribute('foo', 'bar');
      assert.ok(Object.getOwnPropertyDescriptor(User.prototype, 'bar').enumerable);
      assert.doesNotThrow(function() {
        const user = new User();
        user.bar = 1;
        assert.equal(user.bar, 1);
      }, /TypeError: Cannot set property bar/);
    });
  });

  describe('=> Bone.alias()', function() {
    it('should be able to find attribute name by column name', async function() {
      class Post extends Bone {}
      Post.init({ authorId: BIGINT });
      Post.load([
        { columnName: 'author_id', columnType: 'bigint', dataType: 'bigint' },
      ]);
      assert.equal(Post.alias('author_id'), 'authorId');
      assert.equal(Post.alias('comment_count'), 'comment_count');
    });

    it('should be able to translate the whole object', async function() {
      class Post extends Bone {}
      Post.init({ authorId: BIGINT });
      Post.load([
        { columnName: 'author_id', columnType: 'bigint', dataType: 'bigint' },
      ]);
      assert.deepEqual(
        Post.alias({ author_id: 42, comment_count: 1 }),
        { authorId: 42, comment_count: 1 }
      );
    });
  });
});
