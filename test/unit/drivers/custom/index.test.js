'use strict';

const assert = require('assert').strict;
const SQLiteDriver = require('../../../../src/drivers/sqlite');

const database = 'leoric';
const options = {
  database: '/tmp/leoric.sqlite3',
};

class MySpellBook extends SQLiteDriver.Spellbook {
  format(spell) {
    for (const scope of spell.scopes) scope(spell);
    switch (spell.command) {
      case 'insert':
      case 'bulkInsert':
        return this.formatInsert(spell);
      case 'select':
        return this.formatSelect(spell);
      case 'update':
        return this.formatUpdate(spell);
      case 'delete':
        return this.formatDelete(spell);
      case 'upsert':
        return this.formatUpsert(spell);
      default:
        throw new Error(`Unsupported SQL command ${spell.command}`);
    }
  }
};

class CustomDriver extends SQLiteDriver {

  static Spellbook = MySpellBook;

  get driverName () {
    return 'myCustomDriver';
  }
}


describe('custom driver', () => {
  it('should work with constructor', async () => {
    const myCustomDriver = new CustomDriver(options);
    assert.equal(myCustomDriver.driverName, 'myCustomDriver');
    assert.equal(CustomDriver.isLeoricDriver(), true);
    const tables = await myCustomDriver.querySchemaInfo('leoric', [ 'users' ]);
    assert(tables.users);
  });

  it('driver.logger.logQuery', async () => {
    const result = [];
    const driver2 = new CustomDriver({
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
    const driver2 = new CustomDriver({
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
    assert.ok(/no such column: x/.test(err.message));
  });

  it('driver.querySchemaInfo()', async () => {
    const driver = new CustomDriver(options);
    const schemaInfo = await driver.querySchemaInfo(database, 'articles');
    assert.ok(schemaInfo.articles);
    const columns = schemaInfo.articles;
    const props = [
      'columnName', 'columnType', 'dataType',
      'defaultValue',
      'allowNull',
      'primaryKey',
      'datetimePrecision',
    ];
    for (const column of columns) {
      for (const prop of props) assert.ok(column.hasOwnProperty(prop));
    }
    let columnInfo = columns.find(entry => entry.columnName === 'id');
    assert.equal(columnInfo.primaryKey, true);

    columnInfo = columns.find(entry => entry.columnName === 'gmt_create');
    assert.equal(columnInfo.datetimePrecision, 3);
  });

  it('driver.truncateTable(table)', async () => {
    const driver = new CustomDriver(options);
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

  it('driver.query()', async function() {
    const driver = new CustomDriver(options);
    const { affectedRows, insertId } = await driver.query('INSERT INTO articles (title) VALUES ("Leah")');
    assert.ok(insertId);
    assert.equal(affectedRows, 1);
  });

});


