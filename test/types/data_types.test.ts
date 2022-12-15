import { strict as assert } from 'assert';
import Realm, { DataTypes, LENGTH_VARIANTS } from '../..';

describe('=> Data types (TypeScript)', function() {
  const { STRING, TEXT, BLOB, INTEGER, BIGINT, DATE, BOOLEAN, BINARY, VARBINARY, VIRTUAL, JSON, JSONB, DECIMAL } = DataTypes;

  it('realm.Bone.DataTypes', async function() {
    const realm = new Realm({
      dialect: 'sqlite',
      database: '/tmp/leoric.sqlite3',
    });
    // should be mixed with dialect overrides
    assert.notEqual(realm.Bone.DataTypes, DataTypes);
  })

  it('STRING', async function() {
    assert.equal(STRING(255).toSqlString(), 'VARCHAR(255)');
    assert.equal(new STRING(255).toSqlString(), 'VARCHAR(255)');
    // default 255
    assert.equal(STRING.toSqlString(), 'VARCHAR(255)');
  });

  it('INTEGER', async function() {
    assert.equal(INTEGER(255).toSqlString(), 'INTEGER(255)');
    assert.equal(new INTEGER(255).toSqlString(), 'INTEGER(255)');
    assert.equal(INTEGER(255).UNSIGNED.toSqlString(), 'INTEGER(255) UNSIGNED');
    assert.equal(new INTEGER(255).UNSIGNED.toSqlString(), 'INTEGER(255) UNSIGNED');
    assert.equal(INTEGER(255).ZEROFILL.toSqlString(), 'INTEGER(255) ZEROFILL');
    assert.equal(new INTEGER(255).ZEROFILL.toSqlString(), 'INTEGER(255) ZEROFILL');

    assert.equal(INTEGER.toSqlString(), 'INTEGER');
    assert.equal(INTEGER.UNSIGNED.toSqlString(), 'INTEGER UNSIGNED');
    assert.equal(INTEGER.ZEROFILL.toSqlString(), 'INTEGER ZEROFILL');

    assert.equal(INTEGER(255).toSqlString(), 'INTEGER(255)');
    assert.equal(INTEGER(255).UNSIGNED.toSqlString(), 'INTEGER(255) UNSIGNED');
    assert.equal(INTEGER(255).ZEROFILL.toSqlString(), 'INTEGER(255) ZEROFILL');
  });

  it('BIGINT', async function() {
    assert.equal(BIGINT(255).toSqlString(), 'BIGINT(255)');
    assert.equal(new BIGINT(255).toSqlString(), 'BIGINT(255)');
    assert.equal(BIGINT(255).UNSIGNED.toSqlString(), 'BIGINT(255) UNSIGNED');
    assert.equal(new BIGINT(255).UNSIGNED.toSqlString(), 'BIGINT(255) UNSIGNED');
    assert.equal(BIGINT(255).ZEROFILL.toSqlString(), 'BIGINT(255) ZEROFILL');
    assert.equal(new BIGINT(255).ZEROFILL.toSqlString(), 'BIGINT(255) ZEROFILL');

    assert.equal(BIGINT.toSqlString(), 'BIGINT');
    assert.equal((new BIGINT).toSqlString(), 'BIGINT');
    assert.equal(BIGINT.UNSIGNED.toSqlString(), 'BIGINT UNSIGNED');

    assert.equal(BIGINT.ZEROFILL.toSqlString(), 'BIGINT ZEROFILL');
    assert.equal(BIGINT(255).toSqlString(), 'BIGINT(255)');
    assert.equal(BIGINT(255).UNSIGNED.toSqlString(), 'BIGINT(255) UNSIGNED');
    assert.equal(BIGINT(255).ZEROFILL.toSqlString(), 'BIGINT(255) ZEROFILL');
  });

  it('TEXT', async function() {
    assert.equal(TEXT(LENGTH_VARIANTS.long).toSqlString(), 'LONGTEXT');
    assert.equal(TEXT.toSqlString(), 'TEXT');
    assert.equal(new TEXT(LENGTH_VARIANTS.long).toSqlString(), 'LONGTEXT');
    assert.equal((new TEXT).toSqlString(), 'TEXT');
    assert.equal(new TEXT(LENGTH_VARIANTS.tiny).toSqlString(), 'TINYTEXT');
    assert.equal(new TEXT(LENGTH_VARIANTS.medium).toSqlString(), 'MEDIUMTEXT');
  });

  it('BLOB', async function() {
    assert.equal(BLOB(LENGTH_VARIANTS.medium).toSqlString(), 'MEDIUMBLOB');
    assert.equal(new BLOB(LENGTH_VARIANTS.medium).toSqlString(), 'MEDIUMBLOB');
    assert.equal(BLOB.toSqlString(), 'BLOB');
    assert.equal((new BLOB).toSqlString(), 'BLOB');
  });

  it('DATE', () => {
    assert.equal(DATE.toSqlString(), 'DATETIME');
    assert.equal((new DATE).toSqlString(), 'DATETIME');
    assert.equal(DATE(3).toSqlString(), 'DATETIME(3)');
    assert.equal(new DATE(3).toSqlString(), 'DATETIME(3)');

  });

  it('BOOLEAN', () => {
    assert.equal(BOOLEAN.toSqlString(), 'BOOLEAN');
    assert.equal((new BOOLEAN).toSqlString(), 'BOOLEAN');
  })

  it('BINARY', () => {
    // default 255
    assert.equal(BINARY.toSqlString(), 'BINARY(255)');
    assert.equal((new BINARY).toSqlString(), 'BINARY(255)');
    assert.equal(BINARY(3).toSqlString(), 'BINARY(3)');
    assert.equal(new BINARY(3).toSqlString(), 'BINARY(3)');
  });

  it('VARBINARY', () => {
    // default 255
    assert.equal(VARBINARY.toSqlString(), 'VARBINARY(255)');
    assert.equal((new VARBINARY).toSqlString(), 'VARBINARY(255)');
    assert.equal(VARBINARY(3).toSqlString(), 'VARBINARY(3)');
    assert.equal(new VARBINARY(3).toSqlString(), 'VARBINARY(3)');
  });

  it('VIRTUAL', () => {
    assert.equal(VIRTUAL.toSqlString(), 'VIRTUAL');
    assert.equal((new VIRTUAL).toSqlString(), 'VIRTUAL');
  });

  it('JSON', () => {
    assert.equal(JSON.toSqlString(), 'TEXT');
    assert.equal((new JSON).toSqlString(), 'TEXT');
  });

  it('JSONB', () => {
    assert.equal(JSONB.toSqlString(), 'JSON');
    assert.equal((new JSONB).toSqlString(), 'JSON');
  });

  it('DECIMAL', () => {
    assert.equal(DECIMAL.toSqlString(), 'DECIMAL');
    assert.equal(DECIMAL(10).toSqlString(), 'DECIMAL(10)');
    assert.equal(new DECIMAL(10).toSqlString(), 'DECIMAL(10)');

    assert.equal(DECIMAL.UNSIGNED.toSqlString(), 'DECIMAL UNSIGNED');
    assert.equal(DECIMAL(10).UNSIGNED.toSqlString(), 'DECIMAL(10) UNSIGNED');
    assert.equal(new DECIMAL(10).UNSIGNED.toSqlString(), 'DECIMAL(10) UNSIGNED');

    assert.equal(DECIMAL.ZEROFILL.toSqlString(), 'DECIMAL ZEROFILL');
    assert.equal(DECIMAL(10).ZEROFILL.toSqlString(), 'DECIMAL(10) ZEROFILL');
    assert.equal(new DECIMAL(10).ZEROFILL.toSqlString(), 'DECIMAL(10) ZEROFILL');
  })
});
