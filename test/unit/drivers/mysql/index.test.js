'use strict';

const assert = require('assert').strict;
const MysqlDriver = require('../../../../src/drivers/mysql');

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
    assert.ok(duration >= 0);
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
      'columnName', 'columnType', 'dataType',
      // 'defaultValue',
      'allowNull',
      'primaryKey', 'unique',
    ];
    for (const column of columns) {
      for (const prop of props) assert.ok(column.hasOwnProperty(prop));
    }
    const definition = columns.find(entry => entry.columnName === 'id');
    assert.equal(definition.primaryKey, true);
    assert.equal(definition.unique, true);
  });

  it('driver.truncateTable(table)', async () => {
    const { BIGINT, STRING } = driver.DataTypes;
    await driver.dropTable('notes');
    await driver.createTable('notes', {
      id: { type: BIGINT, primaryKey: true, autoIncrement: true },
      title: { type: STRING, allowNull: false },
    });
    await driver.query('INSERT INTO notes (id, title) VALUES (42, \'Untitled\')');
    assert.equal((await driver.query('SELECT count(*) AS count FROM notes')).rows[0].count, 1);
    await driver.truncateTable('notes');
    assert.equal((await driver.query('SELECT count(*) AS count FROM notes')).rows[0].count, 0);
  });

  it('driver.recycleConnections()', async function() {
    const driver2 = new MysqlDriver({
      ...options,
      idleTimeout: 0.01,
    });
    let released;
    driver2.pool.on('release', function() {
      released = true;
    });
    const connection = await driver2.getConnection();
    await new Promise(function(resolve, reject) {
      connection.query('SELECT 1', function(err, row) {
        if (err) reject(err);
        resolve({ row });
      });
    });
    assert.ok(!released);
    await new Promise(resolve => setTimeout(resolve, 30));
    assert.ok(released);
    await assert.rejects(async function() {
      await new Promise(function(resolve, reject) {
        connection.query('SELECT 1', function(err, row) {
          if (err) reject(err);
          resolve({ row });
        });
      });
    }, /Error: Cannot enqueue Query after being destroyed./);
  });
});
