'use strict';

// Mirror test to satisfy requested path
const assert = require('assert').strict;
const { findDriver } = require('../../../src/drivers');

describe('driver/index (alias)', function() {
  it('throws on unsupported dialect', function() {
    assert.throws(() => {
      findDriver('mongodb');
    }, /unsupported database/i);
  });
});
