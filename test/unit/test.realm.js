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

  it('should subclass with sequelize api if opts.sequelize', async () => {
    const realm = new Realm({ sequelize: true });
    const { Bone: Spine } = realm;
    assert.ok(typeof Spine.prototype.setDataValue === 'function');
  });

  it('should rename opts.db to opts.database', async () => {
    const realm = new Realm({ db: 'leoric' });
    assert.equal(realm.options.database, 'leoric');
  });

  it('should rename opts.storage to opts.database', async () => {
    const realm = new Realm({ dialect: 'sqlite', storage: '/tmp/leoric.sqlite3' });
    assert.equal(realm.options.database, '/tmp/leoric.sqlite3');
  });

  it('should be able to customize logger with function', async () => {
    const queries = [];
    const realm = new Realm({
      port: process.env.MYSQL_PORT,
      user: 'root',
      database: 'leoric',
      logger(sql) {
        queries.push(sql);
      }
    });
    await realm.connect();
    await realm.driver.query('SELECT 1');
    assert.equal(queries[0], 'SELECT 1');
  });

  it('should be able to customize logger with object', async () => {
    const queries = [];
    const realm = new Realm({
      port: process.env.MYSQL_PORT,
      user: 'root',
      database: 'leoric',
      logger: {
        logQuery(sql) {
          queries.push(sql);
        }
      }
    });
    await realm.connect();
    await realm.driver.query('SELECT 1');
    assert.equal(queries[0], 'SELECT 1');
  });

  it('realm.query should work', async () => {
    const queries = [];
    const realm = new Realm({
      port: process.env.MYSQL_PORT,
      user: 'root',
      database: 'leoric',
      logger: {
        logQuery(sql) {
          queries.push(sql);
        }
      }
    });
    await realm.connect();
    await realm.query('SELECT 1');
    assert.equal(queries[0], 'SELECT 1');
  });

  it('realm.transaction generator callback should work', async () => {
    const queries = [];
    const realm = new Realm({
      port: process.env.MYSQL_PORT,
      user: 'root',
      database: 'leoric',
      logger: {
        logQuery(sql) {
          queries.push(sql);
        }
      },
    });
    await realm.connect();
    // clean all prev data in users
    await realm.query('TRUNCATE TABLE users');
    assert.rejects(async () => {
      await realm.transaction(function *() {
        yield realm.query(`INSERT INTO
        users (gmt_create, email, nickname)
        VALUES (?, ?, ?)`, [
          new Date(),
          'lighting@valhalla.ne',
          'Thor',
        ]);
        yield realm.query(`INSERT INTO
        users (gmt_create, email, nickname)
        VALUES (?, ?, ?)`,[
          new Date(),
          'lighting@valhalla.ne',
          'Thor',
        ]);
      }, `Error: ER_DUP_ENTRY: Duplicate entry 'lighting@valhalla.ne' for key 'users.email'`); // rollback
    });
    const { rows } = await realm.query('SELECT * FROM users');
    assert(rows.length === 0);
  });

  it('realm.transaction async callback should work', async () => {
    const queries = [];
    const realm = new Realm({
      port: process.env.MYSQL_PORT,
      user: 'root',
      database: 'leoric',
      logger: {
        logQuery(sql) {
          queries.push(sql);
        }
      },
    });
    await realm.connect();
    // clean all prev data in users
    await realm.query('TRUNCATE TABLE users');
    assert.rejects(async () => {
      await realm.transaction(async () => {
        await realm.query(`INSERT INTO
        users (gmt_create, email, nickname)
        VALUES (?, ?, ?)`, [
          new Date(),
          'lighting@valhalla.ne',
          'Thor',
        ]);
        await realm.query(`INSERT INTO
        users (gmt_create, email, nickname)
        VALUES (?, ?, ?)`,[
          new Date(),
          'lighting@valhalla.ne',
          'Thor',
        ]);
      }, `Error: ER_DUP_ENTRY: Duplicate entry 'lighting@valhalla.ne' for key 'users.email'`); // rollback
    });
    const { rows } = await realm.query('SELECT * FROM users');
    assert(rows.length === 0);
  });
});
