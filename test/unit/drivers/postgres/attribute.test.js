'use strict';

const assert = require('assert').strict;
const Attribute = require('../../../../src/drivers/postgres/attribute');
const { BIGINT, INTEGER, DATE } = Attribute.DataTypes;

describe('=> Attribute (postgres)', function() {
  it('should support BIGSERIAL', async function() {
    const attribute=  new Attribute('id', {
      type: BIGINT,
      primaryKey: true,
    });
    assert.equal(attribute.toSqlString(), '"id" BIGSERIAL PRIMARY KEY');
  });

  it('should support SERIAL', async function() {
    const attribute=  new Attribute('id', {
      type: INTEGER,
      primaryKey: true,
    });
    assert.equal(attribute.toSqlString(), '"id" SERIAL PRIMARY KEY');
  });

  it('should support WITH TIME ZONE', async function() {
    const attribute=  new Attribute('createdAt', {
      type: DATE,
    });
    assert.equal(attribute.toSqlString(), '"created_at" TIMESTAMP WITH TIME ZONE');
  });

  it('should support WITHOUT TIME ZONE', async function() {
    const attribute = new Attribute('createdAt', {
      type: DATE(null, false),
    });
    assert.equal(attribute.toSqlString(), '"created_at" TIMESTAMP WITHOUT TIME ZONE');
  });

  it('should support DATE(precision)', async function() {
    const attribute=  new Attribute('updated_at', {
      type: DATE(6),
    });
    assert.equal(attribute.toSqlString(), '"updated_at" TIMESTAMP(6) WITH TIME ZONE');
  });
});
