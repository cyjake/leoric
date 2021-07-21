'use strict';

const assert = require('assert').strict;
const Attribute = require('../../../../src/drivers/mysql/attribute');
const { BOOLEAN } = Attribute.DataTypes;

describe('=> Attribute (mysql)', function() {
  it('should support TINYINT(1)', async function() {
    const attribute=  new Attribute('has_image', {
      type: BOOLEAN,
      defaultValue: false,
    });
    assert.equal(attribute.toSqlString(), '`has_image` TINYINT(1) DEFAULT false');
  });
});