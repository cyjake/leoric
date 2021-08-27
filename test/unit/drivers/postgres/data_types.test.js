'use strict';

const assert = require('assert').strict;
const DataTypes = require('../../../../src/drivers/postgres/data_types');

describe('=> Data Types', () => {
  const {
    STRING, DATE, JSONB
  } = DataTypes;

  it('STRING', () => {
    assert.equal(new STRING().dataType, 'varchar');
    assert.equal(new STRING().toSqlString(), 'VARCHAR(255)');
    assert.equal(new STRING(127).toSqlString(), 'VARCHAR(127)');
    assert.equal(new STRING(255).BINARY.toSqlString(), 'BYTEA');
    assert.equal(new STRING(255).VARBINARY.toSqlString(), 'BYTEA');
  });

  it('DATE', () => {
    assert.equal(new DATE().dataType, 'timestamp');
    assert.equal(new DATE().toSqlString(), 'TIMESTAMP WITH TIME ZONE');
    // This one varies drastically across databases
    assert.equal(new DATE(6).toSqlString(), 'TIMESTAMP(6) WITH TIME ZONE');

    assert.equal(new DATE(6, false).toSqlString(), 'TIMESTAMP(6) WITHOUT TIME ZONE');

  });

  it('JSONB', () => {
    assert.equal(new JSONB().dataType, 'jsonb');
    assert.equal(new JSONB().toSqlString(), 'JSONB');
  });
});

