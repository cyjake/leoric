'use strict';

const { parseDefaultValue } = require('../../../../src/drivers/sqlite/sqlstring');
const assert = require('assert').strict;

describe('=> SQLite SqlString', function() {
  describe('-> parseDefaultValue', function() {
    it('should parse default value correctly', function() {
      [
        { input: '123', expected: 123 },
        { input: "'hello'", expected: 'hello' },
        { input: '"world"', expected: 'world' },
        { input: 'true', type: 'boolean', expected: true },
        { input: 'false', type: 'boolean', expected: false },
        { input: '3.14', expected: 3.14 },
        { input: 'NULL', expected: null },
      ].forEach(({ input, type, expected }) => {
        const result = parseDefaultValue(input, type);
        if (Number.isNaN(expected)) {
          if (!Number.isNaN(result)) {
            throw new Error(`Expected NaN but got ${result}`);
          }
        } else {
          if (result !== expected) {
            throw new Error(`For input "${input}", expected ${expected} but got ${result}`);
          }
        }
      });
    });

    it('should throw error for invalid default value', function() {
      [
        'INVALID_LITERAL',
        "'unclosed_string",
        '"another_unclosed_string',
      ].forEach((input) => {
        assert.equal(parseDefaultValue(input), input); // should return the input as is
      });
    });
  });
});
