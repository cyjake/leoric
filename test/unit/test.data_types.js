'use strict';

const assert = require('assert').strict;
const DataTypes = require('../../lib/data_types');

describe('=> Data Types', () => {
  it('STRING', () => {
    const { STRING } = DataTypes;
    assert.equal(STRING.type, 'varchar');
  });
});
