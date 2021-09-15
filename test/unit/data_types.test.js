'use strict';

const assert = require('assert').strict;
const DataTypes = require('../../src/data_types');

describe('=> Data Types', () => {
  const {
    STRING, BOOLEAN, DATE, INTEGER, BIGINT, TEXT, JSON, JSONB, BLOB, BINARY, VARBINARY,
  } = DataTypes;

  it('STRING', () => {
    assert.equal(new STRING().dataType, 'varchar');
    assert.equal(new STRING().toSqlString(), 'VARCHAR(255)');
    assert.equal(new STRING(127).toSqlString(), 'VARCHAR(127)');
  });

  it('BINARY', () => {
    assert.equal(new BINARY(255).toSqlString(), 'BINARY(255)');
    assert.equal(new VARBINARY(255).toSqlString(), 'VARBINARY(255)');
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
    assert.equal(new INTEGER().UNSIGNED.toSqlString(), 'INTEGER UNSIGNED');
    assert.equal(new INTEGER().UNSIGNED.ZEROFILL.toSqlString(), 'INTEGER UNSIGNED ZEROFILL');
  });

  it('BIGINT', () => {
    assert.equal(new BIGINT().dataType, 'bigint');
    assert.equal(new BIGINT().UNSIGNED.toSqlString(), 'BIGINT UNSIGNED');
  });

  it('TEXT', async () => {
    assert.equal(new TEXT().dataType, 'text');
    assert.equal(new TEXT().toSqlString(), 'TEXT');
    assert.equal(new TEXT('tiny').toSqlString(), 'TINYTEXT');
    assert.equal(new TEXT('medium').toSqlString(), 'MEDIUMTEXT');
    assert.equal(new TEXT('long').toSqlString(), 'LONGTEXT');
    // invalid length
    await assert.rejects(async () => new TEXT('error'), /invalid text length: error/);
  });

  it('JSON', () => {
    // JSON type is actually stored as TEXT
    assert.equal(new JSON().dataType, 'text');
    assert.equal(new JSON().toSqlString(), 'TEXT');
  });

  it('JSONB', () => {
    assert.equal(new JSONB().dataType, 'json');
    assert.equal(new JSONB().toSqlString(), 'JSON');
  });

  it('BLOB', async function() {
    assert.equal(new BLOB().dataType, 'blob');
    assert.equal(new BLOB().toSqlString(), 'BLOB');
    assert.equal(new BLOB('tiny').toSqlString(), 'TINYBLOB');
    assert.equal(new BLOB('medium').toSqlString(), 'MEDIUMBLOB');
    assert.equal(new BLOB('long').toSqlString(), 'LONGBLOB');
    // invalid length
    await assert.rejects(async () => new BLOB('error'), /invalid blob length: error/);
  });
});

describe('DataTypes.findType()', () => {
  const { TEXT } = DataTypes;
  it('longtext => TEXT', () => {
    assert.equal(DataTypes.findType('longtext'), TEXT);
  });

  it('binary => BINARY', () => {
    const { BINARY, VARBINARY } = DataTypes;
    assert.equal(DataTypes.findType('binary'), BINARY);
    assert.equal(DataTypes.findType('varbinary'), VARBINARY);
  });

  it('bytea => BINARY', () => {
    const { BINARY } = DataTypes;
    assert.equal(DataTypes.findType('bytea'), BINARY);
  });

  it('blob => BLOB', () => {
    const { BLOB } = DataTypes;
    assert.equal(DataTypes.findType('blob'), BLOB);
  });

  it('unknown type', async () => {
    await assert.rejects(async () => DataTypes.findType('error'), /Unexpected data type error/);
  });
});

describe('DataTypes.invokable', function() {
  const { STRING } = DataTypes.invokable;
  it('should wrap data types to support flexible invoking', async function() {
    assert.equal(STRING(255).toSqlString(), 'VARCHAR(255)');
  });
});
