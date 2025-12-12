'use strict';

const assert = require('assert').strict;
const { default: DataTypes, LENGTH_VARIANTS } = require('../../../../src/data_types');
const { default: AbstractAttribute } = require('../../../../src/drivers/abstract/attribute');
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
});
