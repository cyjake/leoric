'use strict';

const debug = require('debug')('leoric');
const SqlString = require('sqlstring');
const spellbook = require('./spellbook');

function singleLine(text) {
  return text.trim().split('\n').map(line => line.trim()).join(' ');
}

module.exports = class MysqlDialect {
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
    const { host, port, user, password, appName, database, connectionLimit } = opts;

    this.type = 'mysql';
    this.pool = require(name).createPool({
      connectionLimit,
      host,
      port,
      user,
      password,
      // some RDMS use appName to locate the database instead of the actual db, though the table_schema stored in infomation_schema.columns is still the latter one.
      database: appName || database
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
      debug(SqlString.format(query.sql || query, values));
    });

    if (fields) {
      return { rows: results, fields };
    } else {
      return results;
    }
  }

  async querySchemaInfo(database, tables) {
    const sql = singleLine(`
      SELECT table_name, column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
       WHERE table_schema = ? AND table_name in (?)
    `);

    const rows = await new Promise((resolve, reject) => {
      this.pool.query(sql, [ database, tables ], (err, results, fields) => {
        if (err) {
          reject(err);
        } else {
          resolve(results);
        }
      });
    });
    const schema = {};

    for (const row of rows) {
      const tabelName = row.TABLE_NAME;
      const columns = schema[tabelName] || (schema[tabelName] = []);
      columns.push({
        columnName: row.COLUMN_NAME,
        columnDefault: row.COLUMN_DEFAULT,
        dataType: row.DATA_TYPE,
        isNullable: row.IS_NULLABLE,
      });
    }

    return schema;
  }

  format(spell) {
    return spellbook.format(spell);
  }
};
