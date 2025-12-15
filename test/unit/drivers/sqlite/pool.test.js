'use strict';

const assert = require('assert').strict;
const Pool = require('../../../../src/drivers/sqlite/pool');

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
    assert.equal(pool.connections.length, 2);
    assert.ok(pool.connections.includes(conn1));
    assert.ok(pool.connections.includes(conn3));
  });
});
