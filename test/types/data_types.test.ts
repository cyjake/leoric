import { strict as assert } from 'assert';
import Realm, { Bone, DataTypes } from '../..';

describe('=> Data types (TypeScript)', function() {
  const { STRING, TEXT, BLOB, INTEGER, BIGINT, DATE, BOOLEAN, BINARY, VARBINARY, VIRTUAL, JSON, JSONB } = DataTypes;

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
    // default 255
    assert.equal(STRING.toSqlString(), 'VARCHAR(255)');
  });

  it('INTEGER', async function() {
    assert.equal(INTEGER(255).toSqlString(), 'INTEGER(255)');
    assert.equal(INTEGER(255).UNSIGNED.toSqlString(), 'INTEGER(255) UNSIGNED');
    assert.equal(INTEGER(255).ZEROFILL.toSqlString(), 'INTEGER(255) ZEROFILL');

    assert.equal(INTEGER.toSqlString(), 'INTEGER');
    assert.equal(INTEGER.UNSIGNED.toSqlString(), 'INTEGER UNSIGNED');
    assert.equal(INTEGER.ZEROFILL.toSqlString(), 'INTEGER ZEROFILL');

    assert.equal(INTEGER(255).toSqlString(), 'INTEGER(255)');
    assert.equal(INTEGER(255).UNSIGNED.toSqlString(), 'INTEGER(255) UNSIGNED');
    assert.equal(INTEGER(255).ZEROFILL.toSqlString(), 'INTEGER(255) ZEROFILL');
  });

  it('BIGINT', async function() {
    assert.equal(BIGINT(255).toSqlString(), 'BIGINT(255)');
    assert.equal(BIGINT(255).UNSIGNED.toSqlString(), 'BIGINT(255) UNSIGNED');
    assert.equal(BIGINT(255).ZEROFILL.toSqlString(), 'BIGINT(255) ZEROFILL');

    assert.equal(BIGINT.toSqlString(), 'BIGINT');
    assert.equal(BIGINT.UNSIGNED.toSqlString(), 'BIGINT UNSIGNED');

    assert.equal(BIGINT.ZEROFILL.toSqlString(), 'BIGINT ZEROFILL');
    assert.equal(BIGINT(255).toSqlString(), 'BIGINT(255)');
    assert.equal(BIGINT(255).UNSIGNED.toSqlString(), 'BIGINT(255) UNSIGNED');
    assert.equal(BIGINT(255).ZEROFILL.toSqlString(), 'BIGINT(255) ZEROFILL');
  });

  it('TEXT', async function() {
    assert.equal(TEXT('long').toSqlString(), 'LONGTEXT');
    assert.equal(TEXT.toSqlString(), 'TEXT');
  });

  it('BLOB', async function() {
    assert.equal(BLOB('medium').toSqlString(), 'MEDIUMBLOB');
    assert.equal(BLOB.toSqlString(), 'BLOB');
  });

  it('DATE', () => {
    assert.equal(DATE.toSqlString(), 'DATETIME');
    assert.equal(DATE(3).toSqlString(), 'DATETIME(3)');
  });

  it('BOOLEAN', () => {
    assert.equal(BOOLEAN.toSqlString(), 'BOOLEAN');
  })

  it('BINARY', () => {
    // default 255
    assert.equal(BINARY.toSqlString(), 'BINARY(255)');
    assert.equal(BINARY(3).toSqlString(), 'BINARY(3)');
  });

  it('VARBINARY', () => {
    // default 255
    assert.equal(VARBINARY.toSqlString(), 'VARBINARY(255)');
    assert.equal(VARBINARY(3).toSqlString(), 'VARBINARY(3)');
  });

  it('VIRTUAL', () => {
    // default 255
    assert.equal(VIRTUAL.toSqlString(), 'VIRTUAL');
  });

  it('JSON', () => {
    // default 255
    assert.equal(JSON.toSqlString(), 'TEXT');
  });

  it('JSONB', () => {
    // default 255
    assert.equal(JSONB.toSqlString(), 'JSON');
  });
});
