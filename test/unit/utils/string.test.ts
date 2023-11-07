
import { strict as assert } from 'assert';
import { heresql } from '../../../src';

describe('=> heresql', function() {
  it('should accept function comment', function() {
    assert.equal(heresql(function() {
      /*
      SELECT 1,
             2,
             now()
      */
    }), 'SELECT 1, 2, now()');
  });

  it('should accept template literal', function() {
    assert.equal(heresql(`
      SELECT 1,
             2,
             now()
    `), 'SELECT 1, 2, now()');
  });
});
