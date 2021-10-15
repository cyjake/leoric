'use strict';

const assert = require('assert').strict;
const { Logger } = require('../../../..');
const AbstractDriver = require('../../../../src/drivers/abstract');

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
