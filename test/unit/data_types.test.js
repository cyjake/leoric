'use strict';

const assert = require('assert').strict;
const dayjs = require('dayjs');
const { default: DataTypes } = require('../../src/data_types');
const Raw = require('../../src/raw');
const Postgres_DataTypes = require('../../src/drivers/postgres/data_types');
const SQLite_DataTypes = require('../../src/drivers/sqlite/data_types');

describe('=> Data Types', () => {
  const {
    CHAR, STRING, TEXT,
    BOOLEAN,
    DATE, DATEONLY,
    TINYINT, SMALLINT, MEDIUMINT, INTEGER, BIGINT, DECIMAL,
    JSON, JSONB,
    BLOB, BINARY, VARBINARY, VIRTUAL,
  } = DataTypes;

  it('CHAR', () => {
    assert.equal(new CHAR().dataType, 'char');
    assert.equal(new CHAR().toSqlString(), 'CHAR(255)');
    assert.equal(new CHAR(127).toSqlString(), 'CHAR(127)');
  });

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

  it('TINYINT', () => {
    assert.equal(new TINYINT().dataType, 'tinyint');
    assert.equal(new TINYINT(1).toSqlString(), 'TINYINT(1)');
    assert.equal(new TINYINT().UNSIGNED.toSqlString(), 'TINYINT UNSIGNED');
    assert.equal(new TINYINT().UNSIGNED.ZEROFILL.toSqlString(), 'TINYINT UNSIGNED ZEROFILL');
    assert.equal(new TINYINT(1, true, true).toSqlString(), 'TINYINT(1) UNSIGNED ZEROFILL');

  });

  it('SMALLINT', () => {
    assert.equal(new SMALLINT().dataType, 'smallint');
    assert.equal(new SMALLINT(1).toSqlString(), 'SMALLINT(1)');
    assert.equal(new SMALLINT().UNSIGNED.toSqlString(), 'SMALLINT UNSIGNED');
    assert.equal(new SMALLINT().UNSIGNED.ZEROFILL.toSqlString(), 'SMALLINT UNSIGNED ZEROFILL');
    assert.equal(new SMALLINT(1, true, true).toSqlString(), 'SMALLINT(1) UNSIGNED ZEROFILL');

  });

  it('MEDIUMINT', () => {
    assert.equal(new MEDIUMINT().dataType, 'mediumint');
    assert.equal(new MEDIUMINT(1).toSqlString(), 'MEDIUMINT(1)');
    assert.equal(new MEDIUMINT().UNSIGNED.toSqlString(), 'MEDIUMINT UNSIGNED');
    assert.equal(new MEDIUMINT().UNSIGNED.ZEROFILL.toSqlString(), 'MEDIUMINT UNSIGNED ZEROFILL');
    assert.equal(new MEDIUMINT(1, true, true).toSqlString(), 'MEDIUMINT(1) UNSIGNED ZEROFILL');
  });

  it('INTEGER', () => {
    assert.equal(new INTEGER().dataType, 'integer');
    assert.equal(new INTEGER(10).toSqlString(), 'INTEGER(10)');
    assert.equal(new INTEGER().UNSIGNED.toSqlString(), 'INTEGER UNSIGNED');
    assert.equal(new INTEGER().UNSIGNED.ZEROFILL.toSqlString(), 'INTEGER UNSIGNED ZEROFILL');
    assert.equal(new INTEGER(1, true, true).toSqlString(), 'INTEGER(1) UNSIGNED ZEROFILL');
  });

  it('BIGINT', () => {
    assert.equal(new BIGINT().dataType, 'bigint');
    assert.equal(new BIGINT().UNSIGNED.toSqlString(), 'BIGINT UNSIGNED');
    assert.equal(new BIGINT(1, true, true).toSqlString(), 'BIGINT(1) UNSIGNED ZEROFILL');
  });

  it('DECIMAL', () => {
    assert.equal(new DECIMAL().dataType, 'decimal');
    assert.equal(new DECIMAL(5).toSqlString(), 'DECIMAL(5)');
    assert.equal(new DECIMAL(5, 2).UNSIGNED.toSqlString(), 'DECIMAL(5,2) UNSIGNED');
    assert.equal(new DECIMAL().UNSIGNED.toSqlString(), 'DECIMAL UNSIGNED');
    assert.equal(new DECIMAL(5).UNSIGNED.toSqlString(), 'DECIMAL(5) UNSIGNED');
    assert.equal(new DECIMAL(5, 2).UNSIGNED.toSqlString(), 'DECIMAL(5,2) UNSIGNED');
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

  it('VIRTUAL', () => {
    assert.equal(new VIRTUAL().dataType, 'virtual');
    assert.equal(new VIRTUAL().toSqlString(), 'VIRTUAL');
    assert.equal(new VIRTUAL().virtual, true);
  });
});

describe('=> DataTypes type casting', function() {
  const { STRING, BLOB, DATE, DATEONLY, JSON, INTEGER, VIRTUAL } = DataTypes;

  it('INTEGER', async () => {
    assert.equal(new INTEGER().uncast(null), null);
    assert.equal(new INTEGER().uncast(undefined), undefined);
    assert.equal(new INTEGER().uncast('1'), 1);
    assert.equal(new INTEGER().uncast(1), 1);

    await assert.rejects(async () => {
      new Postgres_DataTypes.INTEGER().uncast('yes?');
    }, /Error: invalid integer: yes?/);

    assert.equal(new SQLite_DataTypes.INTEGER().uncast('yes?'), 'yes?');

    await assert.rejects(async () => {
      new INTEGER().uncast('yes?');
    }, /Error: invalid integer: yes?/);

    assert.equal(new INTEGER().uncast('yes?', false), 'yes?');

  });

  it('STRING', async function() {
    assert.equal(new STRING().uncast(null), null);
    assert.equal(new STRING().uncast(undefined), undefined);
    assert.equal(new STRING().uncast(1), '1');
    assert.deepEqual(new STRING().uncast(new Raw(`REPLACE(name, 'Yhorm', 'Leoric')`)), new Raw(`REPLACE(name, 'Yhorm', 'Leoric')`));
  });

  it('DATE', async function() {
    assert.equal(new DATE().uncast(null), null);
    assert.equal(new DATE().uncast(undefined), undefined);

    assert.equal(new DATE().uncast(1625743838518).getTime(), 1625743838518);
    assert.deepEqual(new DATE().uncast('2021-10-15 15:50:02,548'), new Date('2021-10-15 15:50:02.548'));
    assert.deepEqual(new DATE().uncast('2021-10-15 15:50:02.548'), new Date('2021-10-15 15:50:02.548'));
    assert.deepEqual(new DATE().uncast('2021-10-15 15:50:02'), new Date('2021-10-15 15:50:02'));

    const today = new Date();
    const result = new DATE(0).uncast(today);
    if (today.getMilliseconds() > 500) today.setSeconds(today.getSeconds() + 1);
    today.setMilliseconds(0);
    assert.equal(result.getTime(), today.getTime());

    assert.deepEqual(new DATE(1).uncast('2021-10-15T15:50:02.586Z'), new Date('2021-10-15T15:50:02.600Z'));
    assert.deepEqual(new DATE(0).uncast('2021-10-15T15:50:02.586Z'), new Date('2021-10-15T15:50:03.000Z'));

    // raw
    assert.deepEqual(new DATE().uncast(new Raw(`NOW()`)), new Raw(`NOW()`));

    await assert.rejects(async () => {
      new DATE().uncast('yes?');
    }, /Error: invalid date: yes?/);

    assert.deepEqual(new SQLite_DataTypes.DATE().uncast('yes?'), 'yes?');

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
    assert.deepEqual(new DATEONLY().uncast(new Raw(`NOW()`)), new Raw(`NOW()`));

    await assert.rejects(async () => {
      new DATEONLY().uncast('yes?');
    }, /Error: invalid date: yes?/);

    assert.deepEqual(new SQLite_DataTypes.DATEONLY().uncast('yes?'), 'yes?');
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
    assert.deepEqual(new JSON().uncast(new Raw('Yahaha')), new Raw(`Yahaha`));

  });

  it('BLOB', async function() {
    assert.equal(new BLOB().cast(null), null);
    assert.equal(new BLOB().cast(undefined), undefined);
    const buffer = Buffer.from('<!doctype html>');
    assert.equal(new BLOB().cast(buffer), buffer);
    assert.equal(new BLOB().cast(buffer).toString(), '<!doctype html>');
    assert.ok(new BLOB().cast('<!doctype html>') instanceof Buffer);
  });

  it('VIRTUAL', () => {
    assert.equal(new VIRTUAL().cast(null), null);
    assert.equal(new VIRTUAL().cast(undefined), undefined);
    assert.equal(new VIRTUAL().cast(1), 1);
    assert.equal(new VIRTUAL().cast('halo'), 'halo');
  });
});

describe('=> DataTypes.findType()', () => {
  it('char => CHAR', () => {
    const { CHAR } = DataTypes;
    assert.ok(DataTypes.findType('char(255)') instanceof CHAR);
    assert.equal(DataTypes.findType('char(127)').toSqlString(), 'CHAR(127)');
  });

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

  it('integer => INTEGER', () => {
    const { TINYINT, SMALLINT, MEDIUMINT, INTEGER } = DataTypes;
    assert.ok(DataTypes.findType('tinyint') instanceof TINYINT);
    assert.ok(DataTypes.findType('smallint') instanceof SMALLINT);
    assert.ok(DataTypes.findType('mediumint') instanceof MEDIUMINT);
    assert.ok(DataTypes.findType('integer') instanceof INTEGER);
    assert.equal(DataTypes.findType('bigint').toSqlString(), 'BIGINT');
    assert.equal(DataTypes.findType('decimal(5)').toSqlString(), 'DECIMAL(5)');
    assert.equal(DataTypes.findType('decimal(5,2)').toSqlString(), 'DECIMAL(5,2)');
  });

  it('unknown type', async () => {
    await assert.rejects(async () => DataTypes.findType('error'), /Unexpected data type error/);
  });
});

describe('=> DataTypes.invokable', function() {
  const { CHAR, STRING, INTEGER, TEXT, BLOB, BIGINT } = DataTypes.invokable;

  it('should wrap data types to support flexible invoking', async function() {
    assert.equal(CHAR(511).toSqlString(), 'CHAR(511)');
    assert.equal(STRING(255).toSqlString(), 'VARCHAR(255)');
    assert.equal(STRING.toSqlString(), 'VARCHAR(255)');

    // NOT "INTEGER(1)"
    // ref: https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Function/length
    // The length property indicates the number of parameters expected by the function.
    assert.equal(INTEGER.toSqlString(), 'INTEGER');
    assert.equal(INTEGER.UNSIGNED.toSqlString(), 'INTEGER UNSIGNED');
    assert.equal(INTEGER.ZEROFILL.toSqlString(), 'INTEGER ZEROFILL');

    assert.equal(INTEGER(10).UNSIGNED.toSqlString(), 'INTEGER(10) UNSIGNED');
    assert.equal(INTEGER(10).ZEROFILL.toSqlString(), 'INTEGER(10) ZEROFILL');
    assert.equal(INTEGER(10).toSqlString(), 'INTEGER(10)');

    assert.equal(BIGINT.toSqlString(), 'BIGINT');
    assert.equal(BIGINT.UNSIGNED.toSqlString(), 'BIGINT UNSIGNED');
    assert.equal(BIGINT.ZEROFILL.toSqlString(), 'BIGINT ZEROFILL');

    assert.equal(BIGINT(10).UNSIGNED.toSqlString(), 'BIGINT(10) UNSIGNED');
    assert.equal(BIGINT(10).ZEROFILL.toSqlString(), 'BIGINT(10) ZEROFILL');
    assert.equal(BIGINT(10).toSqlString(), 'BIGINT(10)');

    // NOT "0TEXT"
    assert.equal(TEXT.toSqlString(), 'TEXT');
    assert.equal(TEXT('tiny').toSqlString(), 'TINYTEXT');

    assert.equal(BLOB.toSqlString(), 'BLOB');
    assert.equal(BLOB('tiny').toSqlString(), 'TINYBLOB');

  });
});
