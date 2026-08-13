'use strict';

const assert = require('assert').strict;
const { EventEmitter } = require('events');
const path = require('path');
const sinon = require('sinon');
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

  it('should apply SQLite connection limit while client is loading', async function() {
    const pool = new SqlitePool({ client: clientPath, connectionLimit: 1, database: ':memory:' });
    const firstPromise = pool.getConnection();
    const secondPromise = pool.getConnection();
    const first = await firstPromise;
    first.release();
    const second = await secondPromise;

    assert.equal(pool.connections.length, 1);
    assert.equal(second, first);
    await pool.end();
  });

  it('should lazily create a configured MySQL pool once', async function() {
    const driver = new MysqlDriver({ client: clientPath, idleTimeout: 30000 });
    assert.deepEqual(driver.pool, {});

    await Promise.all([ driver.getConnection(), driver.getConnection() ]);

    assert.equal(client.createPoolCalls, 1);
    assert.equal(driver.pool.options.connectionLimit, undefined);
    assert.equal(driver.pool.options.idleTimeout, 30000);
    assert.equal(driver.escape("O'Reilly"), "'O\\'Reilly'");
  });

  it('should destroy only connections that remain idle past idleTimeout', async function() {
    const clock = sinon.useFakeTimers();
    const pool = new EventEmitter();
    pool._freeConnections = [];
    const connection = {
      destroy: sinon.spy(),
      release() {
        pool._freeConnections.push(connection);
        pool.emit('release', connection);
      },
    };
    pool.getConnection = function(callback) {
      const index = pool._freeConnections.indexOf(connection);
      if (index >= 0) {
        pool._freeConnections.splice(index, 1);
        setImmediate(() => {
          pool.emit('acquire', connection);
          callback(null, connection);
        });
      } else {
        pool.emit('acquire', connection);
        callback(null, connection);
      }
    };

    const driver = new MysqlDriver({ idleTimeout: 1000 });
    driver.createPool = async () => pool;

    try {
      const acquired = await driver.getConnection();
      acquired.release();
      await clock.tickAsync(500);

      const reacquired = driver.getConnection();
      await clock.tickAsync(500);
      assert.equal(connection.destroy.callCount, 0);
      await reacquired;
      await clock.tickAsync(1000);
      assert.equal(connection.destroy.callCount, 0);

      acquired.release();
      await clock.tickAsync(999);
      assert.equal(connection.destroy.callCount, 0);
      await clock.tickAsync(1);
      assert.equal(connection.destroy.callCount, 1);
    } finally {
      clock.restore();
    }
  });

  it('should lazily create a configured PostgreSQL pool once', async function() {
    const driver = new PostgresDriver({ client: clientPath });
    assert.deepEqual(driver.pool, {});

    await Promise.all([ driver.getConnection(), driver.getConnection() ]);

    assert.equal(client.postgresPoolCalls, 1);
  });
});
