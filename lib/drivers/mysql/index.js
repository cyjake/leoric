'use strict';

const SqlString = require('sqlstring');
const AbstractDriver = require('../abstract');
const spellbook = require('./spellbook');
const { heresql } = require('../../utils/string');

module.exports = class MysqlDriver extends AbstractDriver {
  /**
   * Create a connection pool
   * @param {string} clientName
   * @param {Object} opts
   * @param {string} opts.host
   * @param {string} opts.port
   * @param {string} opts.user
   * @param {string} opts.password
   * @param {string} opts.appName         - In some RDMS, appName is used as the actual name of the database
   * @param {string} opts.database
   * @param {string} opts.connectionLimit
   */
  constructor(name = 'mysql', opts = {}) {
    if (name !== 'mysql' && name !== 'mysql2') {
      throw new Error(`Unsupported mysql client ${name}`);
    }
    const { host, port, user, password, connectionLimit } = opts;
    // some RDMS use appName to locate the database instead of the actual db, though the table_schema stored in infomation_schema.columns is still the latter one.
    const database = opts.appName || opts.database;
    super(name, opts);
    this.type = 'mysql';
    this.database = database;
    this.pool = require(name).createPool({
      connectionLimit,
      host,
      port,
      user,
      password,
      database,
    });
  }

  get escapeId() {
    return this.pool.escapeId;
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
    const { pool } = this;
    const { connection } = opts;
    const [results, fields] = await new Promise((resolve, reject) => {
      (connection || pool).query(query, values, (err, results, fields) => {
        if (err) {
          reject(err);
        } else {
          resolve([results, fields]);
        }
      });
      this.logger.info(SqlString.format(query.sql || query, values));
    });

    if (fields) {
      return { rows: results, fields };
    } else {
      return results;
    }
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
             column_default, column_key
        FROM information_schema.columns
       WHERE table_schema = ? AND table_name in (?)
       ORDER BY table_name, column_name
    `);

    const { rows } = await this.query(sql, [ database, tables ]);
    const schema = {};

    for (const entry of rows) {
      // make sure the column names are in lower case
      const row = Object.keys(entry).reduce((obj, name) => {
        obj[name.toLowerCase()] = entry[name];
        return obj;
      }, {});
      const tabelName = row.table_name;
      const columns = schema[tabelName] || (schema[tabelName] = []);
      columns.push({
        columnName: row.column_name,
        columnType: row.column_type,
        defaultValue: row.column_default,
        dataType: row.data_type,
        allowNull: row.is_nullable === 'YES',
        primaryKey: row.column_key == 'PRI',
        unique: row.column_key == 'PRI' || row.column_key == 'UNI',
      });
    }

    return schema;
  }

  /**
   * Rename column with SQL that works on older versions of MySQL
   * - https://dev.mysql.com/doc/refman/5.7/en/alter-table.html
   * - https://dev.mysql.com/doc/refman/8.0/en/alter-table.html
   * @param {string} table
   * @param {string} column the old column name
   * @param {string} newColumn the new column name
   */
  async renameColumn(table, column, newColumn) {
    const { database, escapeId, formatColumnDefinition } = this;
    const schemaInfo = await this.querySchemaInfo(database, table);
    const definition = schemaInfo[table].find(entry => entry.columnName == column);

    if (!definition) throw new Error(`Unable to find column ${table}.${column}`);

    const sql = heresql(`
      ALTER TABLE ${escapeId(table)}
      CHANGE COLUMN
        ${escapeId(column)} ${escapeId(newColumn)}
        ${formatColumnDefinition(definition)}
    `);
    await this.query(sql);
  }

  format(spell) {
    return spellbook.format(spell);
  }
};
