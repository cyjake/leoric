'use strict';

const assert = require('assert').strict;
const path = require('path');
const strftime = require('strftime');

const { heresql } = require('../../../../src/utils/string');
const SqliteDriver = require('../../../../src/drivers/sqlite');

const { INTEGER, BIGINT, STRING, DATE, BOOLEAN, JSONB } = SqliteDriver.DataTypes;

const options = {
  database: '/tmp/leoric.sqlite3',
};
const driver = new SqliteDriver(options);

describe('=> SQLite driver', () => {

  it('dialect', () => {
    assert.equal(driver.dialect, 'sqlite');
  });

  it('driver.logger.logQuery', async () => {
    const result = [];
    const driver2 = new SqliteDriver({
      ...options,
      logger(sql, duration, opts, res) {
        result.push([ sql, duration, opts, res ]);
      },
    });
    await driver2.query('SELECT 1');
    const [ sql, duration, opts, res ] = result[0];
    assert.equal(sql, 'SELECT 1');
    assert.ok(duration >= 0);
    assert.ok(res);
    assert.ok(opts);
  });

  it('driver.logger.logQueryError', async () => {
    const result = [];
    const driver2 = new SqliteDriver({
      ...options,
      logger: {
        logQueryError(sql, err) {
          result.push([ sql, err ]);
        },
      },
    });
    await assert.rejects(async () => await driver2.query('SELECT x'));
    const [ err, sql ] = result[0];
    assert.equal(sql, 'SELECT x');
    assert.ok(err);
    assert.ok(/no such column/.test(err.message));
  });

  it('driver.querySchemaInfo()', async () => {
    const schemaInfo = await driver.querySchemaInfo(null, 'articles');
    assert.ok(schemaInfo.articles);
    const columns = schemaInfo.articles;
    const props = [
      'columnName', 'columnType', 'dataType',
      'defaultValue',
      'allowNull',
    ];
    for (const column of columns) {
      for (const prop of props) assert.ok(column.hasOwnProperty(prop));
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

  it('driver.createTable(table, definitions)', async () => {
    await driver.dropTable('notes');
    await driver.createTable('notes', {
      id: { type: BIGINT, primaryKey: true, autoIncrement: true },
      public: { type: INTEGER },
      has_image: { type: BOOLEAN, defaultValue: false },
    });
  });

  it('driver.truncateTable(table)', async () => {
    await driver.dropTable('notes');
    await driver.createTable('notes', {
      id: { type: BIGINT, primaryKey: true, autoIncrement: true },
      title: { type: STRING, allowNull: false },
    });
    await driver.query(`INSERT INTO notes (id, title) VALUES (42, 'Untitled')`);
    assert.equal((await driver.query('SELECT count(*) AS count FROM notes')).rows[0].count, 1);
    await driver.truncateTable('notes');
    assert.equal((await driver.query('SELECT count(*) AS count FROM notes')).rows[0].count, 0);
  });

  it('driver.alterTable(table, changes)', async function() {
    await driver.dropTable('notes');
    await driver.createTable('notes', {
      id: { type: BIGINT, primaryKey: true, autoIncrement: true },
      title: { type: STRING, allowNull: false },
    });
    await driver.alterTable('notes', {
      params: { type: JSONB },
    });
    const result = await driver.describeTable('notes');
    assert.deepEqual(result.params, {
      columnName: 'params',
      columnType: 'json',
      dataType: 'json',
      allowNull: true,
      defaultValue: null,
      primaryKey: false,
      datetimePrecision: null,
    });
  });

  it('driver.alterTable(table, changes) should not break table', async function() {
    await driver.dropTable('notes');
    await driver.createTable('notes', {
      id: { type: BIGINT, primaryKey: true, autoIncrement: true },
      title: { type: new STRING(255) },
    });
    await driver.query('INSERT INTO notes (title) VALUES (NULL)');
    await assert.rejects(async function() {
      await driver.alterTable('notes', {
        title: { type: new STRING(127), allowNull: false, modify: true },
      });
    }, /NOT NULL/);
    // should rollback if failed to alter table
    const tableInfo = await driver.describeTable('notes');
    assert.deepEqual(tableInfo.title, {
      columnName: 'title',
      columnType: 'varchar(255)',
      dataType: 'varchar',
      allowNull: true,
      defaultValue: null,
      primaryKey: false,
      datetimePrecision: null,
    });
    const result = await driver.query('SELECT * FROM notes');
    assert.equal(result.rows.length, 1);
  });
});

describe('=> SQLite driver.query()', () => {
  beforeEach(async () => {
    await driver.dropTable('notes');
  });

  it('should handle timestamp correctly', async () => {
    await driver.createTable('notes', { title: STRING, createdAt: DATE });
    const createdAt = new Date();
    await driver.query('INSERT INTO notes (title, created_at) VALUES (?, ?)', [
      'Leah', createdAt,
    ]);
    const {
      rows: [
        { created_at }
      ]
    } = await driver.query(heresql(`
      SELECT datetime(created_at, 'localtime') AS created_at FROM notes
    `));
    assert.equal(created_at, strftime('%Y-%m-%d %H:%M:%S', createdAt));
  });

  it('should handle boolean correctly', async () => {
    await driver.createTable('notes', { title: STRING, isPrivate: BOOLEAN });
    await driver.query('INSERT INTO notes (title, is_private) VALUES (?, ?)', [
      'Leah', true,
    ]);
    const {
      rows: [
        { is_private }
      ]
    } = await driver.query('SELECT is_private FROM notes');
    assert.equal(is_private, 1);
  });

  it('should support async stack trace', async function() {
    await assert.rejects(async function() {
      await driver.query('SELECT * FROM missing');
    }, function(err) {
      assert(err instanceof Error);
      assert(/SQLITE_ERROR: no such table/i.test(err.message));
      return err.stack.includes(path.basename(__filename));
    });
  });
});

describe('=> SQLite driver.pool', function() {
  beforeEach(async () => {
    await driver.dropTable('notes');
  });

  it('should not create connection unless necessary', async function() {
    assert.equal(driver.pool.connections.length, 1);
  });

  it('should create connection if upbound limit not reached', async function() {
    await Promise.all([
      driver.createTable('notes', { title: STRING, isPrivate: BOOLEAN }),
      driver.query('SELECT 2'),
    ]);
    assert.equal(driver.pool.connections.length, 2);
  });

  it('should wait until connection is available', async function() {
    const driver2 = new SqliteDriver({ ...options, connectionLimit: 1 });
    await Promise.all([
      driver2.createTable('notes', { title: STRING, isPrivate: BOOLEAN }),
      driver2.query('SELECT 2'),
    ]);
    assert.equal(driver2.pool.connections.length, 1);
  });
});
