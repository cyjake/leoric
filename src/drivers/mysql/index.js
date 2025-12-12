'use strict';

const { performance } = require('perf_hooks');

const AbstractDriver = require('../abstract').default;
const Attribute = require('./attribute');
const DataTypes = require('./data_types');
const Spellbook = require('./spellbook');
const { calculateDuration } = require('../../utils');
const { heresql } = require('../../utils/string');

class MysqlDriver extends AbstractDriver {

  // define static properties as this way IDE will prompt
  static Spellbook = Spellbook;
  static Attribute = Attribute;
  static DataTypes = DataTypes;

  /**
   * Create a connection pool
   * @param {Object} opts
   * @param {string} opts.host
   * @param {string} opts.port
   * @param {string} opts.user
   * @param {string} opts.password
   * @param {string} opts.appName         - In some RDMS, appName is used as the actual name of the database
   * @param {string} opts.database
   * @param {string} opts.connectionLimit
   * @param {number} opts.connectTimeout  - The milliseconds before a timeout occurs during the initial connection to the MySQL server. (Default: `10000`)
   * @param {string} opts.charset
   * @param {boolean} opts.stringifyObjects  - stringify object value in dataValues
   * @param {string} opts.client
   */
  constructor(opts = {}) {
    super(opts);
    this.type = 'mysql';
    this.pool = this.createPool(opts);
    this.Attribute = this.constructor.Attribute;
    this.DataTypes = this.constructor.DataTypes;
    this.spellbook = new this.constructor.Spellbook();

    this.escape = this.pool.escape.bind(this.pool);
    this.escapeId = this.pool.escapeId;
  }

  createPool(opts) {
    // some RDMS use appName to locate the database instead of the actual db, though the table_schema stored in infomation_schema.columns is still the latter one.
    const database = opts.appName || opts.database;
    const client = opts.client || 'mysql';
    const {
      host,
      port,
      user,
      password,
      connectTimeout,
      connectionLimit,
      charset,
      stringifyObjects = true,
      decimalNumbers = true,
      supportBigNumbers = true,
      bigNumberStrings,
    } = opts;

    if (client !== 'mysql' && client !== 'mysql2') {
      console.warn(`[leoric] mysql client "${client}" not tested`);
    }

    return require(client).createPool({
      connectionLimit,
      connectTimeout,
      host,
      port,
      user,
      password,
      database,
      charset,
      stringifyObjects,
      decimalNumbers,
      supportBigNumbers,
      bigNumberStrings,
    });
  }

  getConnection() {
    return new Promise((resolve, reject) => {
      this.pool.getConnection((err, connection) => {
        if (err) {
          reject(err);
        } else {
          resolve(connection);
        }
      });
    });
  }

  async query(query, values, opts = {}) {
    const { logger } = this;
    const connection = opts.connection || await this.getConnection();
    const promise = new Promise((resolve, reject) => {
      connection.query(query, values, (err, results, fields) => {
        if (err) {
          reject(err);
        } else {
          resolve([ results, fields ]);
        }
      });
    });
    const sql = logger.format(query, values, opts);
    const logOpts = { ...opts, query };
    const start = performance.now();
    let result;

    try {
      result = await promise;
    } catch (err) {
      logger.logQueryError(err, sql, calculateDuration(start), logOpts);
      throw err;
    } finally {
      if (!opts.connection) connection.release();
    }

    const [ results, fields ] = result;
    logger.tryLogQuery(sql, calculateDuration(start), logOpts, results);
    if (fields) return { rows: results, fields };
    return results;
  }


  /**
 * Fetch columns of give tables from database
 * - https://dev.mysql.com/doc/mysql-infoschema-excerpt/5.6/en/columns-table.html
 * @param {string} database
 * @param {string|string[]} tables
 */
  async querySchemaInfo(database, tables) {
    tables = [].concat(tables);
    const sql = heresql(`
      SELECT table_name, column_name, column_type, data_type, is_nullable,
            column_default, column_key, column_comment,
            datetime_precision
        FROM information_schema.columns
      WHERE table_schema = ? AND table_name in (?)
      ORDER BY table_name, column_name
    `);

    const { rows } = await this.query(sql, [ database, tables ]);
    const schemaInfo = {};

    for (const entry of rows) {
      // make sure the column names are in lower case
      const row = Object.keys(entry).reduce((obj, name) => {
        obj[name.toLowerCase()] = entry[name];
        return obj;
      }, {});
      const tabelName = row.table_name;
      const columns = schemaInfo[tabelName] || (schemaInfo[tabelName] = []);
      columns.push({
        columnName: row.column_name,
        columnType: row.column_type,
        comment: row.column_comment,
        defaultValue: row.column_default,
        dataType: row.data_type,
        allowNull: row.is_nullable === 'YES',
        primaryKey: row.column_key == 'PRI',
        unique: row.column_key == 'PRI' || row.column_key == 'UNI',
        datetimePrecision: row.datetime_precision,
      });
    }

    return schemaInfo;
  }

  /**
   * Rename column with SQL that works on older versions of MySQL
   * - https://dev.mysql.com/doc/refman/5.7/en/alter-table.html
   * - https://dev.mysql.com/doc/refman/8.0/en/alter-table.html
   * @param {string} table
   * @param {string} column the old column name
   * @param {string} newColumn the new column name
   */
  async renameColumn(table, name, newName) {
    const { escapeId } = this;
    const { database } = this.options;
    const { columnName } = new this.Attribute(name);
    const schemaInfo = await this.querySchemaInfo(database, table);
    const { columnName: _, ...columnInfo } = schemaInfo[table].find(entry => {
      return entry.columnName == columnName;
    });

    if (!columnInfo) {
      throw new Error(`Unable to find column ${table}.${columnName}`);
    }

    const attribute = new this.Attribute(newName, columnInfo);
    const sql = heresql(`
      ALTER TABLE ${escapeId(table)}
      CHANGE COLUMN ${escapeId(columnName)} ${attribute.toSqlString()}
    `);
    await this.query(sql);
  }

  async describeTable(table) {
    const { escapeId } = this;
    const { rows } = await this.query(`DESCRIBE ${escapeId(table)}`);
    const result = {};
    for (const row of rows) {
      result[row.Field] = {
        columnName: row.Field,
        columnType: row.Type,
        allowNull: row.Null === 'YES',
        defaultValue: row.Default,
        autoIncrement: row.Extra === 'auto_increment',
      };
    }
    return result;
  }
}

module.exports = MysqlDriver;
