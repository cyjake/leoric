'use strict';

const assert = require('assert').strict;
const strftime = require('strftime');

const { DataTypes } = require('../../..');
const { heresql } = require('../../../lib/utils/string');
const SqliteDriver = require('../../../lib/drivers/sqlite');

const { INTEGER, STRING, DATE, BOOLEAN } = DataTypes;

const options = {
  database: '/tmp/leoric.sqlite3',
};
const driver = new SqliteDriver(options);

describe('=> SQLite driver', () => {
  it('driver.logger.logQuery', async () => {
    const result = [];
    const driver2 = new SqliteDriver({
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
    const driver2 = new SqliteDriver({
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
    assert.ok(/no such column/.test(err.message));
  });

  it('driver.querySchemaInfo()', async () => {
    const schemaInfo = await driver.querySchemaInfo(null, 'articles');
    assert.ok(schemaInfo.articles);
    const columns = schemaInfo.articles;
    const props = [
      'columnName', 'columnType', 'dataType', 'defaultValue', 'allowNull',
    ];
    for (const column of columns) {
      for (const prop of props) assert.ok(column.hasOwnProperty(prop));
    }
  });

  it('driver.createTable(table, definitions)', async () => {
    await driver.dropTable('notes');
    await driver.createTable('notes', {
      id: { type: INTEGER, primaryKey: true, autoIncrement: true },
      public: { type: INTEGER },
    });
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
});
