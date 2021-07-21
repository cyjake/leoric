'use strict';

const assert = require('assert').strict;
const PostgresDriver = require('../../../../src/drivers/postgres');

const database = 'leoric';
const options = {
  host: process.env.POSTGRES_HOST || 'localhost',
  port: process.env.POSTGRES_PORT,
  user: process.env.POSTGRES_USER || process.env.USER,
  database,
};
const driver = new PostgresDriver(options);

describe('=> PostgreSQL driver', () => {
  it('driver.logger.logQuery', async () => {
    const result = [];
    const driver2 = new PostgresDriver({
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
    const driver2 = new PostgresDriver({
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
    assert.ok(/column "x" does not exist/.test(err.message));
  });

  it('driver.querySchemaInfo()', async () => {
    const schemaInfo = await driver.querySchemaInfo(database, 'articles');
    assert.ok(schemaInfo.articles);
    const columns = schemaInfo.articles;
    const props = [
      'columnName', 'columnType', 'dataType',
      // 'defaultValue',
      'allowNull',
    ];
    for (const column of columns) {
      for (const prop of props) assert.ok(column.hasOwnProperty(prop));
      assert.equal(column.primaryKey, column.columnName === 'id');
    }
  });

  it('driver.querySchemaInfo() after init with primaryKey', async () => {
    const { BIGINT, STRING, TEXT } = driver.DataTypes;
    await driver.dropTable('notes');
    await driver.createTable('notes', {
      id: { type: BIGINT, allowNull: false, primaryKey: true },
      title: { type: STRING, allowNull: false },
      body: { type: TEXT },
    });
    const schemaInfo = await driver.querySchemaInfo(database, 'notes');
    assert.ok(schemaInfo.notes);
    const columns = schemaInfo.notes;
    const props = [
      'columnName', 'columnType', 'dataType',
      // 'defaultValue',
      'allowNull',
    ];
    for (const column of columns) {
      for (const prop of props) assert.ok(column.hasOwnProperty(prop));
      assert.equal(column.primaryKey, column.columnName === 'id');
    }
  });

  it('driver.truncateTable()', async () => {
    const { BIGINT, STRING } = driver.DataTypes;
    await driver.dropTable('notes');
    await driver.createTable('notes', {
      id: { type: BIGINT, allowNull: false, primaryKey: true },
      title: { type: STRING, allowNull: false },
    });
    await driver.query(`INSERT INTO notes (title) VALUES ('Untitled')`);
    // postgres client doesn't convert data types by default
    assert.equal((await driver.query('SELECT count(*) FROM notes')).rows[0].count, '1');
    await driver.truncateTable('notes');
    assert.equal((await driver.query('SELECT count(*) FROM notes')).rows[0].count, '0');
    await driver.query(`INSERT INTO notes (title) VALUES ('Untitled')`);
    assert.equal((await driver.query('SELECT id FROM notes')).rows[0].id, '2');
  });

  it('driver.truncateTable(table, { restartIdentity: true })', async () => {
    const { BIGINT, STRING } = driver.DataTypes;
    await driver.dropTable('notes');
    await driver.createTable('notes', {
      id: { type: BIGINT, allowNull: false, primaryKey: true },
      title: { type: STRING, allowNull: false },
    });
    await driver.query(`INSERT INTO notes (title) VALUES ('Untitled')`);
    assert.equal((await driver.query('SELECT count(*) FROM notes')).rows[0].count, '1');
    await driver.truncateTable('notes', { restartIdentity: true });
    assert.equal((await driver.query('SELECT count(*) FROM notes')).rows[0].count, '0');
    await driver.query(`INSERT INTO notes (title) VALUES ('Untitled')`);
    assert.equal((await driver.query('SELECT id FROM notes')).rows[0].id, '1');
  });
});
