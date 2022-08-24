'use strict';

const assert = require('assert').strict;
const Attribute = require('../../../../src/drivers/mysql/attribute');
const { BOOLEAN, DATE, JSONB, STRING } = Attribute.DataTypes;

describe('=> Attribute (mysql)', function() {
  it('should support TINYINT(1)', async function() {
    const attribute = new Attribute('has_image', {
      type: BOOLEAN,
      defaultValue: false,
    });
    assert.equal(attribute.toSqlString(), '`has_image` TINYINT(1) DEFAULT false');
  });

  it('should support JSON binary', async function() {
    const attribute = new Attribute('params', { type: JSONB });
    assert.equal(attribute.toSqlString(), '`params` JSON');
  });

  it('should normalize attribute defaultValue', async function() {
    const attribute = new Attribute('createdAt', {
      type: DATE,
      defaultValue: 'CURRENT_TIMESTAMP',
    });
    assert.equal(attribute.defaultValue, null);
  });

  it('should support COMMENT', async function() {
    const attribute = new Attribute('createdAt', {
      type: DATE,
      comment: '创建时间'
    });
    assert.equal(attribute.toSqlString(), "`created_at` DATETIME COMMENT '创建时间'");
  });

  it('UNIQUE should work', async function() {
    const attribute = new Attribute('isbn', {
      type: STRING,
      allowNull: false,
      unique: true,
    });
    assert.equal(attribute.toSqlString(), '`isbn` VARCHAR(255) NOT NULL UNIQUE');
  });

});
