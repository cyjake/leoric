'use strict';

const assert = require('assert').strict;
const DataTypes = require('../../../../src/drivers/postgres/data_types').default;

describe('=> Data Types', () => {
  const {
    STRING,
    DATE,
    JSONB,
    VARBINARY, BINARY, BLOB,
    TINYINT, SMALLINT, MEDIUMINT, INTEGER,
  } = DataTypes;

  it('STRING', () => {
    assert.equal(new STRING().dataType, 'varchar');
    assert.equal(new STRING().toSqlString(), 'VARCHAR(255)');
    assert.equal(new STRING(127).toSqlString(), 'VARCHAR(127)');
  });

  it('BINARY', () => {
    assert.equal(new BINARY().toSqlString(), 'BYTEA');
    assert.equal(new BINARY(127).toSqlString(), 'BYTEA');
    assert.equal(new VARBINARY(127).toSqlString(), 'BYTEA');
    assert.equal(new BLOB().toSqlString(), 'BYTEA');
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

  it('INTEGER', () => {
    assert.equal(new TINYINT().toSqlString(), 'SMALLINT');
    assert.equal(new SMALLINT().toSqlString(), 'SMALLINT');
    assert.equal(new MEDIUMINT().toSqlString(), 'INTEGER');
    assert.equal(new INTEGER().toSqlString(), 'INTEGER');
  });
});

