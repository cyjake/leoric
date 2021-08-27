'use strict';

const assert = require('assert').strict;
const DataTypes = require('../../../../src/drivers/sqlite/data_types');

describe('=> Data Types', () => {
  const {
    STRING, DATE, BIGINT
  } = DataTypes;

  it('STRING', () => {
    assert.equal(new STRING().dataType, 'varchar');
    assert.equal(new STRING().toSqlString(), 'VARCHAR(255)');
    assert.equal(new STRING(127).toSqlString(), 'VARCHAR(127)');
    assert.equal(new STRING().BINARY.toSqlString(), 'VARCHAR BINARY(255)');
    assert.equal(new STRING(127).BINARY.toSqlString(), 'VARCHAR BINARY(127)');
    assert.equal(new STRING(127).VARBINARY.toSqlString(), 'VARCHAR VARBINARY(127)');
  });

  it('DATE', () => {
    assert.equal(new DATE().dataType, 'datetime');
    assert.equal(new DATE().toSqlString(), 'DATETIME');

  });

  it('BIGINT', () => {
    assert.equal(new BIGINT().dataType, 'integer');
    assert.equal(new BIGINT().toSqlString(), 'INTEGER');
  });
});

