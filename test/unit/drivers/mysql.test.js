'use strict';

const assert = require('assert').strict;
const MysqlDriver = require('../../../lib/drivers/mysql');

const database = 'leoric';
const options = {
  host: 'localhost',
  port: process.env.MYSQL_PORT,
  user: 'root',
  database,
};
const driver = new MysqlDriver(options);

describe('=> MySQL driver', () => {
  it('driver.logger.logQuery', async () => {
    const result = [];
    const driver2 = new MysqlDriver({
      ...options,
      logger(sql, duration) {
        result.push([ sql, duration ]);
      },
    });
    await driver2.query('SELECT 1');
    const [ sql, duration ] = result[0];
    assert.equal(sql, 'SELECT 1');
    assert.ok(duration > 0);
  });

  it('driver.logger.logQueryError', async () => {
    const result = [];
    const driver2 = new MysqlDriver({
      ...options,
      logger: {
        logQueryError(sql, err) {
          result.push([ sql, err ]);
        },
      },
    });
    await assert.rejects(async () => await driver2.query('SELECT x'));
    const [ sql, err ] = result[0];
    assert.equal(sql, 'SELECT x');
    assert.ok(err);
    assert.ok(/ER_BAD_FIELD_ERROR/.test(err.message));
  });

  it('driver.querySchemaInfo()', async () => {
    const schemaInfo = await driver.querySchemaInfo(database, 'articles');
    assert.ok(schemaInfo.articles);
    const columns = schemaInfo.articles;
    const props = [
      'columnName', 'columnType', 'dataType', 'defaultValue', 'allowNull',
      'primaryKey', 'unique',
    ];
    for (const column of columns) {
      for (const prop of props) assert.ok(column.hasOwnProperty(prop));
    }
    const definition = columns.find(entry => entry.columnName === 'id');
    assert.equal(definition.primaryKey, true);
    assert.equal(definition.unique, true);
  });
});
