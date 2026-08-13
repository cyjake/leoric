'use strict';

const assert = require('assert').strict;
const { Logger, AbstractDriver } = require('../../../../src');

describe('=> AbstractDriver#logger', function() {
  it('should create logger by default', async function() {
    const driver = new AbstractDriver();
    assert.ok(driver.logger);
    assert.ok(driver.logger instanceof Logger);
  });

  it('should accept custom logger', async function() {
    class CustomLogger extends Logger {};
    const driver = new AbstractDriver({ logger: new CustomLogger });
    assert.ok(driver.logger);
    assert.ok(driver.logger instanceof CustomLogger);
  });

  it('should not throw error use tryLogQuery', async () => {
    const driver = new AbstractDriver({
      logger(sql, duration) {
        throw new Error('logQuery error');
      },
    });
    assert.ok(driver.logger);
    assert.ok(driver.logger instanceof Logger);
    assert.throws(() => {
      driver.logger.logQuery('xx');
    }, /logQuery error/i);
    assert.doesNotThrow(() => driver.logger.tryLogQuery('xx'));
  });
});

describe('=> AbstractDriver#query', function() {
  it('should throw error when calling query method', async function() {
    const driver = new AbstractDriver();
    await assert.rejects(async () => {
      await driver.query('SELECT 1');
    }, /unimplemented/i);
  });
});

describe('=> AbstractDriver#getConnection', function() {
  it('should throw error when calling getConnection method', async function() {
    const driver = new AbstractDriver();
    await assert.rejects(async () => {
      await driver.getConnection();
    }, /unimplemented/i);
  });
});

describe('=> AbstractDriver index names', function() {
  it('should honor explicit names', function() {
    const driver = new AbstractDriver();
    assert.equal(driver.getIndexName('users', ['email'], { name: 'users_email_lookup' }), 'users_email_lookup');
  });

  it('should generate normal and unique names from resolved columns', function() {
    const driver = new AbstractDriver();
    assert.equal(driver.getIndexName('users', ['organizationId'], { columnNames: ['organization_id'] }), 'idx_users_organizationid');
    assert.equal(driver.getIndexName('users', ['email'], { unique: true }), 'uk_users_email');
    assert.equal(driver.getIndexName('users', ['email'], { type: 'UNIQUE' }), 'uk_users_email');
  });
});

describe('=> AbstractDriver#querySchemaInfo', function() {
  it('should throw error when calling querySchemaInfo method', async function() {
    const driver = new AbstractDriver();
    await assert.rejects(async () => {
      await driver.querySchemaInfo('users');
    }, /unimplemented/i);
  });
});
