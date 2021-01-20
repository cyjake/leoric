'use strict';

const assert = require('assert').strict;
const dayjs = require('dayjs');
const AbstractDriver = require('../../../../lib/drivers/abstract');

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
});
