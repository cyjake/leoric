'use strict';

const assert = require('assert').strict;
const dayjs = require('dayjs');
const { Logger } = require('../../../..');
const AbstractDriver = require('../../../../src/drivers/abstract');

describe('=> AbstractDriver', function() {
  let driver;

  beforeEach(function() {
    driver = new AbstractDriver();
  });

  it('driver.cast(value, type)', async function() {
    const json = driver.cast('{"test":1}', JSON);
    assert.deepEqual(json, { test: 1 });

    const string = driver.cast('string', String);
    assert.equal(string, 'string');
  });

  it('driver.uncast(value, type)', async function() {
    const json = driver.uncast({ test: 1 }, JSON);
    assert.equal(typeof json, 'string');
    assert.equal(json, '{"test":1}');

    const string = driver.uncast('string', String);
    assert.equal(string, 'string');
  });

  it('driver.uncast(dayjs, Date)', async function() {
    const date = driver.uncast(dayjs(), Date);
    assert.ok(date instanceof Date);
  });

  it('driver.uncast(Date.now(), Date)', async function() {
    const date = driver.uncast(1625743838518, Date);
    assert.ok(date instanceof Date);
    assert.equal(date.getFullYear(), 2021);
  });
});

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
});
