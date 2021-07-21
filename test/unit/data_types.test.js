'use strict';

const assert = require('assert').strict;
const DataTypes = require('../../src/data_types');

describe('=> Data Types', () => {
  const {
    STRING, BOOLEAN, DATE, INTEGER, BIGINT, TEXT, JSON, JSONB
  } = DataTypes;

  it('STRING', () => {
    assert.equal(new STRING().dataType, 'varchar');
    assert.equal(new STRING().toSqlString(), 'VARCHAR(255)');
    assert.equal(new STRING(127).toSqlString(), 'VARCHAR(127)');
  });

  it('BOOLEAN', () => {
    assert.equal(new BOOLEAN().dataType, 'boolean');
  });

  it('DATE', () => {
    assert.equal(new DATE().dataType, 'datetime');
    assert.equal(new DATE().toSqlString(), 'DATETIME');
    // This one varies drastically across databases
    assert.equal(new DATE(6).toSqlString(), 'DATETIME(6)');
  });

  it('INTEGER', () => {
    assert.equal(new INTEGER().dataType, 'integer');
    assert.equal(new INTEGER(10).toSqlString(), 'INTEGER(10)');
  });

  it('BIGINT', () => {
    assert.equal(new BIGINT().dataType, 'bigint');
  });

  it('TEXT', () => {
    assert.equal(new TEXT().dataType, 'text');
  });

  it('JSON', () => {
    assert.equal(new JSON().dataType, 'json');
  });

  it('JSONB', () => {
    assert.equal(new JSONB().dataType, 'jsonb');
  });
});

describe('DataTypes.findType()', () => {
  const { TEXT } = DataTypes;
  it('longtext => TEXT', () => {
    assert.equal(DataTypes.findType('longtext'), TEXT);
  });
});

describe('DataTypes.invokable', function() {
  const { STRING } = DataTypes.invokable;
  it('should wrap data types to support flexible invoking', async function() {
    assert.equal(STRING(255).toSqlString(), 'VARCHAR(255)');
  });
});
