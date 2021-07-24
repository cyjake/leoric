'use strict';

const assert = require('assert').strict;
const Attribute = require('../../../../src/drivers/mysql/attribute');
const { BOOLEAN, JSONB } = Attribute.DataTypes;

describe('=> Attribute (mysql)', function() {
  it('should support TINYINT(1)', async function() {
    const attribute=  new Attribute('has_image', {
      type: BOOLEAN,
      defaultValue: false,
    });
    assert.equal(attribute.toSqlString(), '`has_image` TINYINT(1) DEFAULT false');
  });

  it('should support JSON binary', async function() {
    const attribute = new Attribute('params', { type: JSONB });
    assert.equal(attribute.toSqlString(), '`params` JSON');
  });
});
