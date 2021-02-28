'use strict';

const assert = require('assert').strict;
const DataTypes = require('../../lib/data_types');
const {
  STRING, BOOLEAN, DATE, INTEGER, BIGINT, TEXT, JSON, JSONB
} = DataTypes;

describe('=> Data Types', () => {
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

describe('findType()', () => {
  it('longtext => TEXT', () => {
    assert.strictEqual(DataTypes.findType('longtext'), TEXT);
  });
});
