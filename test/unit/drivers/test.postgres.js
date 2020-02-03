'use strict';

const assert = require('assert').strict;
const PostgresDriver = require('../../../lib/drivers/postgres');

const database = 'leoric';
const driver = new PostgresDriver('postgres', {
  host: process.env.POSTGRES_HOST || 'localhost',
  port: process.env.POSTGRES_PORT,
  user: process.env.POSTGRES_USER || process.env.USER,
  database,
});

describe('=> PostgreSQL driver', () => {
  it('driver.querySchemaInfo()', async () => {
    const schemaInfo = await driver.querySchemaInfo(database, 'articles');
    assert.ok(schemaInfo.articles);
    const columns = schemaInfo.articles;
    const props = [
      'columnName', 'columnType', 'dataType', 'defaultValue', 'allowNull',
    ];
    for (const column of columns) {
      for (const prop of props) assert.ok(column.hasOwnProperty(prop));
      assert.equal(column.primaryKey, column.columnName === 'id');
    }
  });
});
