'use strict';

const assert = require('assert').strict;
const Realm = require('../..');
const { connect, Bone, DataTypes } = Realm;

describe('=> Realm', () => {
  it('should export foundational modules', async () => {
    assert.ok(connect);
    assert.ok(Bone);
    assert.ok(DataTypes);
  });

  it('should subclass Bone unless specified by user', async () => {
    const realm = new Realm();
    assert.ok(realm.Bone.prototype instanceof Bone);

    const arda = new Realm({ Bone });
    assert.equal(arda.Bone, Bone);
  });

  it('should subclass with sequelize api if exists opts.dialect', async () => {
    const realm = new Realm({ dialect: 'mysql' });
    const { Bone: Spine } = realm;
    assert.ok(typeof Spine.prototype.setDataValue === 'function');
  });

  it('should rename opts.db to opts.database', async () => {
    const realm = new Realm({ db: 'leoric' });
    assert.equal(realm.options.database, 'leoric');
  });

  it('should rename opts.storage to opts.database', async () => {
    const realm = new Realm({ client: 'sqlite', storage: '/tmp/leoric.sqlite3' });
    assert.equal(realm.options.database, '/tmp/leoric.sqlite3');
  });

  it('should initialize timestamp attribute names', async () => {
    let realm = new Realm();
    assert.equal(realm.options.define.createdAt, 'createdAt');

    realm = new Realm({
      define: { createdAt: 'created_at' },
    });
    assert.equal(realm.options.define.createdAt, 'created_at');
  });

  it('should be able to customize logger with function', async () => {
    const queries = [];
    const realm = new Realm({
      user: 'root',
      database: 'leoric',
      logger(sql) {
        queries.push(sql);
      }
    });
    await realm.connect();
    realm.driver.query('SELECT 1');
    assert.equal(queries[0], 'SELECT 1');
  });

  it('should be able to customize logger with object', async () => {
    const queries = [];
    const realm = new Realm({
      user: 'root',
      database: 'leoric',
      logger: {
        info(sql) {
          queries.push(sql);
        }
      }
    });
    await realm.connect();
    realm.driver.query('SELECT 1');
    assert.equal(queries[0], 'SELECT 1');
  });
});
