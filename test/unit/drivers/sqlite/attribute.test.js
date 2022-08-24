'use strict';

const assert = require('assert').strict;
const Attribute = require('../../../../src/drivers/sqlite/attribute');
const { BIGINT, DATE, STRING, INTEGER } = Attribute.DataTypes;

describe('=> Attribute (sqlite)', function() {
  it('should support DATETIME', async function() {
    const attribute=  new Attribute('createdAt', {
      type: DATE,
    });
    assert.equal(attribute.toSqlString(), '"created_at" DATETIME');
  });

  it('should support BIGINT', async function() {
    const attribute=  new Attribute('id', {
      type: BIGINT,
      primaryKey: true,
    });
    assert.equal(attribute.toSqlString(), '"id" INTEGER PRIMARY KEY');
  });

  it('UNIQUE should work', async function() {
    const attribute = new Attribute('isbn', {
      type: STRING,
      allowNull: false,
      unique: true,
    });
    assert.equal(attribute.toSqlString(), '"isbn" VARCHAR(255) NOT NULL UNIQUE');
  });

  it('invokable type should work', async function() {
    const attribute = new Attribute('isbn', {
      type: new STRING(60),
    });
    assert.equal(attribute.toSqlString(), '"isbn" VARCHAR(60)');

    const attribute1 = new Attribute('idd', {
      type: new INTEGER(2).UNSIGNED,
    });
    assert.equal(attribute1.toSqlString(), '"idd" INTEGER(2) UNSIGNED');
  });
});
