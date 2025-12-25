'use strict';

const assert = require('assert').strict;
const { default: DataTypes, LENGTH_VARIANTS } = require('../../../../src/data_types');
const { default: AbstractAttribute, findJsType } = require('../../../../src/drivers/abstract/attribute');
const { INTEGER, TEXT } = DataTypes;

class Attribute extends AbstractAttribute {
  static DataTypes = DataTypes;
}

describe('=> Attribute', function() {
  describe('.equals()', function() {
    it('should return true when comparing integer and int', async function() {
      const attribute = new Attribute('price', {
        type: INTEGER,
      });
      assert.ok(attribute.equals({
        dataType: 'int',
        allowNull: true,
        primaryKey: false,
      }));
    });

    it('should be able to handle LONGTEXT', async function() {
      const attribute = new Attribute('content', {
        type: new TEXT(LENGTH_VARIANTS.long),
      });
      assert.ok(attribute.equals({
        dataType: 'longtext',
        allowNull: true,
        primaryKey: false,
     }));
    });
  });

  describe('.toSqlString()', function() {
    it('should throw unimplemented error', async function() {
      const attribute = new Attribute('price', {
        type: INTEGER,
      });
      assert.throws(() => {
        attribute.toSqlString();
      }, /unimplemented/);
    });
  });

  describe('constructor({ underscored })', function() {
    it('should set underscored option', async function() {
      const attribute = new Attribute('createdAt', {
        type: INTEGER,
      }, { underscored: true });
      assert.equal(attribute.columnName, 'created_at');
    });
  });

  describe('findJsType()', function() {
    it('should return Boolean on BOOLEAN type', async function() {
      const jsType = findJsType(DataTypes, new DataTypes.BOOLEAN, 'boolean');
      assert.equal(jsType, Boolean);
      const jsType2 = findJsType(DataTypes, null, 'boolean');
      assert.equal(jsType2, Boolean);
    });

    it('should return JSON on JSON type', async function() {
      const jsType = findJsType(DataTypes, new DataTypes.JSONB, 'json');
      assert.equal(jsType, JSON);
    });
  });
});
