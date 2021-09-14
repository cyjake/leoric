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
});
