'use strict';

const assert = require('assert').strict;
const { findDriver } = require('../../../src/drivers');

describe('drivers/index', function() {
  it('throws on unsupported dialect', function() {
    assert.throws(() => {
      findDriver('mongodb');
    }, /unsupported database/i);
  });
});
