'use strict';

const assert = require('assert').strict;
const DataTypes = require('../../../../src/drivers/sqlite/data_types').default;

describe('=> Data Types', () => {
  const {
    STRING, DATE, BIGINT, BINARY, VARBINARY,
  } = DataTypes;

  it('STRING', () => {
    assert.equal(new STRING().dataType, 'varchar');
    assert.equal(new STRING().toSqlString(), 'VARCHAR(255)');
    assert.equal(new STRING(127).toSqlString(), 'VARCHAR(127)');

  });

  it('BINARY', () => {
    assert.equal(new BINARY().toSqlString(), 'VARCHAR BINARY(255)');
    assert.equal(new BINARY(127).toSqlString(), 'VARCHAR BINARY(127)');
    assert.equal(new VARBINARY(127).toSqlString(), 'VARCHAR VARBINARY(127)');
    assert.equal(new VARBINARY(0).toSqlString(), 'VARCHAR VARBINARY');
    assert.equal(new BINARY(0).toSqlString(), 'VARCHAR BINARY');
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

