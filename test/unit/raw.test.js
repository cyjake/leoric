'use strict';

const { Raw } = require('../../src');
const assert = require('assert').strict;

describe('=> Raw', () => {
  describe('constructor()', () => {
    it('should throw if not called with string', async () => {
      assert.throws(() => new Raw({ toSqlString() { return 'foo'; } }));
    });
  });
});
