import { strict as assert } from 'assert';
import Realm, { Bone, DataTypes } from '../..';

describe('=> Data types (TypeScript)', function() {
  const { STRING, TEXT, BLOB } = DataTypes;

  it('Bone.DataTypes', async function() {
    assert.equal(Bone.DataTypes, DataTypes);
  });

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
  });

  it('TEXT', async function() {
    assert.equal(TEXT('long').toSqlString(), 'LONGTEXT');
  });

  it('BLOB', async function() {
    assert.equal(BLOB('medium').toSqlString(), 'MEDIUMBLOB');
  });
});
