'use strict';

const assert = require('assert').strict;
const PostgresDriver = require('../../../../src/drivers/postgres');

const database = 'leoric';
const options = {
  host: process.env.POSTGRES_HOST || 'localhost',
  port: process.env.POSTGRES_PORT,
  user: process.env.POSTGRES_USER || process.env.USER,
  password: process.env.POSTGRES_PASSWORD || '',
  database,
};
const driver = new PostgresDriver(options);

describe('=> PostgreSQL driver', () => {

  it('dialect', () => {
    assert.equal(driver.dialect, 'postgres');
  });

  it('driver.logger.logQuery', async () => {
    const result = [];
    const driver2 = new PostgresDriver({
      ...options,
      logger(sql, duration, opts, res) {
        result.push([ sql, duration, opts, res ]);
      },
    });
    await driver2.query('SELECT ?, ? FROM users WHERE email = ? AND status = ?', ['id', 'nickname', 'yhorm@giant.com', 1]);
    const [ sql, duration, opts, res ] = result[0];
    assert.equal(sql, "SELECT 'id', 'nickname' FROM users WHERE email = 'yhorm@giant.com' AND status = 1");
    assert.ok(duration >= 0);
    assert.ok(res);
    assert.ok(opts);
    assert.equal(opts.query, 'SELECT ?, ? FROM users WHERE email = ? AND status = ?');
  });

  it('driver.logger.logQueryError', async () => {
    const result = [];
    const driver2 = new PostgresDriver({
      ...options,
      logger: {
        logQueryError(err, sql, duration, opts) {
          result.push([ err, sql, duration, opts ]);
        },
      },
    });
    await assert.rejects(async () => await driver2.query('SELECT x, ? FROM users WHERE email = ? AND status = ?', ['nickname', 'yhorm@giant.com', 1]));
    const [ err, sql, duration, opts ] = result[0];
    assert.equal(sql, "SELECT x, 'nickname' FROM users WHERE email = 'yhorm@giant.com' AND status = 1");
    assert.ok(duration >= 0);
    assert.ok(err);
    assert.ok(/column "x" does not exist/.test(err.message));
    assert.ok(opts);
    assert.equal(opts.query, 'SELECT x, ? FROM users WHERE email = ? AND status = ?');
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
    const columnMap = columns.reduce((result, column) => {
      result[column.columnName] = column;
      return result;
    }, {});
    assert.equal(columnMap.title.columnType, 'varchar(1000)');
    assert.equal(columnMap.is_private.columnType, 'boolean');

    assert.equal(columnMap.gmt_create.datetimePrecision, 3);
    assert.equal(columnMap.gmt_modified.datetimePrecision, 3);
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
