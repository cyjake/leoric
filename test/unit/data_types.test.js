'use strict';

const assert = require('assert').strict;
const dayjs = require('dayjs');
const DataTypes = require('../../src/data_types');

describe('=> Data Types', () => {
  const {
    STRING, BOOLEAN, DATE, DATEONLY, INTEGER, BIGINT, TEXT, JSON, JSONB, BLOB, BINARY, VARBINARY,
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

  it('DATEONLY', () => {
    assert.equal(new DATEONLY().dataType, 'date');
    assert.equal(new DATEONLY().toSqlString(), 'DATE');
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

describe('=> DataTypes type casting', function() {
  const { STRING, BLOB, DATE, DATEONLY, JSON } = DataTypes;

  it('STRING', async function() {
    assert.equal(new STRING().uncast(null), null);
    assert.equal(new STRING().uncast(undefined), undefined);
    assert.equal(new STRING().uncast(1), '1');
  });

  it('DATE', async function() {
    assert.equal(new DATE().uncast(null), null);
    assert.equal(new DATE().uncast(undefined), undefined);

    assert.equal(new DATE().uncast(1625743838518).getTime(), 1625743838518);
    assert.deepEqual(new DATE().uncast('2021-10-15 15:50:02,548'), new Date('2021-10-15T15:50:02.548Z'));
    assert.deepEqual(new DATE().uncast('2021-10-15 15:50:02.548'), new Date('2021-10-15T15:50:02.548Z'));
    assert.deepEqual(new DATE().uncast('2021-10-15 15:50:02'), new Date('2021-10-15 15:50:02'));

    const today = new Date();
    const result = new DATE(0).uncast(today);
    if (today.getMilliseconds() > 500) today.setSeconds(today.getSeconds() + 1);
    today.setMilliseconds(0);
    assert.equal(result.getTime(), today.getTime());

    assert.deepEqual(new DATE(1).uncast('2021-10-15T15:50:02.586Z'), new Date('2021-10-15T15:50:02.600Z'));
    assert.deepEqual(new DATE(0).uncast('2021-10-15T15:50:02.586Z'), new Date('2021-10-15T15:50:03.000Z'));
  });

  it('DATE toDate()', async function() {
    const today = new Date();
    const result = new DATE(0).uncast(dayjs(today));
    if (today.getMilliseconds() > 500) today.setSeconds(today.getSeconds() + 1);
    today.setMilliseconds(0);
    assert.equal(result.getTime(), today.getTime());
  });

  it('DATEONLY', async function() {
    assert.equal(new DATEONLY().uncast(null), null);
    assert.equal(new DATEONLY().uncast(undefined), undefined);
    const today = new Date();
    const result = new DATEONLY().uncast(today);
    today.setMilliseconds(0);
    today.setSeconds(0);
    today.setMinutes(0);
    today.setHours(0);
    assert.equal(result.getTime(), today.getTime());
  });

  it('DATEONLY toDate()', async function() {
    const today = new Date();
    const result = new DATEONLY().uncast(dayjs(today));
    today.setMilliseconds(0);
    today.setSeconds(0);
    today.setMinutes(0);
    today.setHours(0);
    assert.equal(result.getTime(), today.getTime());
  });

  it('JSON', async function() {
    assert.equal(new JSON().cast(null), null);
    assert.equal(new JSON().cast(undefined), undefined);
    assert.deepEqual(new JSON().cast('{"a":1}'), { a: 1 });
    assert.deepEqual(new JSON().cast({ a: 1 }), { a: 1 });
    assert.equal(new JSON().cast('foo'), 'foo');

    assert.equal(new JSON().uncast(null), null);
    assert.equal(new JSON().uncast(undefined), undefined);
    assert.equal(new JSON().uncast({ a: 2 }), '{"a":2}');
  });

  it('BLOB', async function() {
    assert.equal(new BLOB().cast(null), null);
    assert.equal(new BLOB().cast(undefined), undefined);
    const buffer = Buffer.from('<!doctype html>');
    assert.equal(new BLOB().cast(buffer), buffer);
    assert.equal(new BLOB().cast(buffer).toString(), '<!doctype html>');
    assert.ok(new BLOB().cast('<!doctype html>') instanceof Buffer);
  });
});

describe('=> DataTypes.findType()', () => {
  it('varchar => STRING', () => {
    const { STRING } = DataTypes;
    assert.ok(DataTypes.findType('varchar(255)') instanceof STRING);
    assert.equal(DataTypes.findType('varchar(255)').toSqlString(), 'VARCHAR(255)');
  });

  it('longtext => TEXT', () => {
    const { TEXT } = DataTypes;
    assert.ok(DataTypes.findType('longtext') instanceof TEXT);
    assert.ok(DataTypes.findType('mediumtext') instanceof TEXT);
    assert.ok(DataTypes.findType('text') instanceof TEXT);
    assert.equal(DataTypes.findType('longtext').toSqlString(), 'LONGTEXT');
  });

  it('binary => BINARY', () => {
    const { BINARY, VARBINARY } = DataTypes;
    assert.ok(DataTypes.findType('binary') instanceof BINARY);
    assert.ok(DataTypes.findType('varbinary') instanceof VARBINARY);
  });

  it('bytea => BINARY', () => {
    const { BINARY } = DataTypes;
    assert.ok(DataTypes.findType('bytea') instanceof BINARY);
  });

  it('blob => BLOB', () => {
    const { BLOB } = DataTypes;
    assert.ok(DataTypes.findType('longblob') instanceof BLOB);
    assert.ok(DataTypes.findType('mediumblob') instanceof BLOB);
    assert.ok(DataTypes.findType('blob') instanceof BLOB);
    assert.ok(DataTypes.findType('tinyblob') instanceof BLOB);
    assert.equal(DataTypes.findType('mediumblob').toSqlString(), 'MEDIUMBLOB');
  });

  it('unknown type', async () => {
    await assert.rejects(async () => DataTypes.findType('error'), /Unexpected data type error/);
  });
});

describe('=> DataTypes.invokable', function() {
  const { STRING } = DataTypes.invokable;

  it('should wrap data types to support flexible invoking', async function() {
    assert.equal(STRING(255).toSqlString(), 'VARCHAR(255)');
  });
});
