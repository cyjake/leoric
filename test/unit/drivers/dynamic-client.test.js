'use strict';

const assert = require('assert').strict;
const path = require('path');
const { MysqlDriver, PostgresDriver } = require('../../../src/drivers');
const SqlitePool = require('../../../src/drivers/sqlite/pool').default;

const clientPath = path.resolve(__dirname, '../../fixtures/dynamic-client.js');
const client = require(clientPath);

describe('=> dynamically loaded database clients', function() {
  beforeEach(function() {
    client.reset();
  });

  it('should lazily load a configured SQLite client once', async function() {
    const pool = new SqlitePool({ client: clientPath, database: ':memory:' });
    assert.equal(pool.client, undefined);

    await Promise.all([ pool.getConnection(), pool.getConnection() ]);

    assert.equal(pool.client, client);
    assert.equal(client.verboseCalls, 1);
    await pool.end();
  });

  it('should lazily create a configured MySQL pool once', async function() {
    const driver = new MysqlDriver({ client: clientPath });
    assert.deepEqual(driver.pool, {});

    await Promise.all([ driver.getConnection(), driver.getConnection() ]);

    assert.equal(client.createPoolCalls, 1);
    assert.equal(driver.pool.options.connectionLimit, undefined);
    assert.equal(driver.escape("O'Reilly"), "'O\\'Reilly'");
  });

  it('should lazily create a configured PostgreSQL pool once', async function() {
    const driver = new PostgresDriver({ client: clientPath });
    assert.deepEqual(driver.pool, {});

    await Promise.all([ driver.getConnection(), driver.getConnection() ]);

    assert.equal(client.postgresPoolCalls, 1);
  });
});
