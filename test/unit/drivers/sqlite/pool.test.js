'use strict';

const { OPEN_READWRITE } = require('sqlite3');

const assert = require('assert').strict;
const Pool = require('../../../../src/drivers/sqlite/pool').default;

describe('=> SQLite driver.pool', function() {
  it('should emit connection', async function() {
    const pool = new Pool({
      database: '/tmp/leoric.sqlite3',
    });
    let result;
    pool.on('connection', function(connection) {
      result = connection;
    });
    assert.equal(await pool.getConnection(), result);
  });

  it('should be able to end connections', async function() {
    const pool = new Pool({
      database: '/tmp/leoric.sqlite3',
    });
    await pool.getConnection();
    await pool.getConnection();
    await pool.getConnection();
    assert.equal(pool.connections.length, 3);
    await assert.doesNotReject(async function() {
      await pool.end();
    });
    assert.equal([...pool.connections].length, 0);
  });

  it('should be able to end specific connection', async function() {
    const pool = new Pool({
      database: '/tmp/leoric.sqlite3',
    });
    const conn1 = await pool.getConnection();
    const conn2 = await pool.getConnection();
    const conn3 = await pool.getConnection();
    assert.equal(pool.connections.length, 3);
    await assert.doesNotReject(async function() {
      await conn2.end();
    });
    await assert.rejects(async function() {
      await conn2.end();
    });
    assert.equal(pool.connections.length, 2);
    assert.ok(pool.connections.includes(conn1));
    assert.ok(pool.connections.includes(conn3));
  });

  it('should not create database file if not specified', async function() {
    await assert.rejects(async () => {
      const pool = new Pool({
        database: '/tmp/tyrael.sqlite3',
        mode: OPEN_READWRITE,
      });
      const connection = await pool.getConnection();
      await connection.query('SELECT 1 + 1 AS result');
    }, /SQLITE_CANTOPEN/i);
  });

  it('should pass on busyTimeout option', async function() {
    const pool = new Pool({
      database: '/tmp/leoric.sqlite3',
      busyTimeout: 5000,
    });
    const connection = await pool.getConnection();
    const { rows: [{ timeout }]} = await connection.query('PRAGMA busy_timeout');
    assert.equal(timeout, 5000);
  });

  it('should release connection back to pool', async function() {
    const pool = new Pool({
      database: '/tmp/leoric.sqlite3',
      trace: true,
      connectionLimit: 2,
    });
    const conn1 = await pool.getConnection();
    const conn2 = await pool.getConnection();
    const conn3Promise = pool.getConnection();
    assert.notEqual(conn1, conn2);
    conn1.release();
    const conn3 = await conn3Promise;
    assert.equal(conn1, conn3);
  });
});
