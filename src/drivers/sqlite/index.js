'use strict';

const strftime = require('strftime');
const { performance } = require('perf_hooks');

const AbstractDriver = require('../abstract');
const Attribute = require('./attribute');
const DataTypes = require('./data_types');
const { escapeId, escape, alterTableWithChangeColumn, parseDefaultValue } = require('./sqlstring');
const Spellbook = require('./spellbook');
const Pool = require('./pool');
const { calculateDuration } = require('../../utils');
const { heresql } = require('../../utils/string');

class SqliteDriver extends AbstractDriver {

  // define static properties as this way IDE will prompt
  static Spellbook = Spellbook;
  static Attribute = Attribute;
  static DataTypes = DataTypes;

  constructor(opts = {}) {
    super(opts);
    this.type = 'sqlite';
    this.pool = this.createPool(opts);
    this.Attribute = this.constructor.Attribute;
    this.DataTypes = this.constructor.DataTypes;
    this.spellbook = new this.constructor.Spellbook();

    this.escape = escape;
    this.escapeId = escapeId;
  }

  createPool(opts) {
    return new Pool(opts);
  }

  async getConnection() {
    return await this.pool.getConnection();
  }

  async query(query, values, opts = {}) {
    const connection = opts.connection || await this.getConnection();

    // node-sqlite3 does not support Date as parameterized value
    if (values) {
      values = values.map(entry => {
        if (entry instanceof Date) {
          return strftime('%Y-%m-%d %H:%M:%S.%L %:z', entry);
        }
        return entry;
      });
    }

    const { logger } = this;
    const sql = logger.format(query, values, opts);
    const start = performance.now();
    let result;

    try {
      result = await connection.query(query, values, opts);
    } catch (err) {
      logger.logQueryError(err, sql, calculateDuration(start), opts);
      throw err;
    } finally {
      if (!opts.connection) connection.release();
    }

    logger.tryLogQuery(sql, calculateDuration(start), opts, result);
    return result;
  }

  async querySchemaInfo(database, tables) {
    tables = [].concat(tables);

    const queries = tables.map(table => {
      return this.query(`PRAGMA table_info(${this.escapeId(table)})`);
    });
    const results = await Promise.all(queries);
    const schemaInfo = {};
    const rColumnType = /^(\w+)(?:\(([^)]+)\))?/i;
    const rDateType = /(?:date|datetime|timestamp)/i;

    for (let i = 0; i < tables.length; i++) {
      const table = tables[i];
      const { rows } = results[i];
      const columns = rows.map(row => {
        const { name, type, notnull, dflt_value, pk } = row;
        const columnType = type.toLowerCase();
        const [, dataType, precision ] = columnType.match(rColumnType);
        const primaryKey = pk === 1;

        const result = {
          columnName: name,
          columnType,
          defaultValue: parseDefaultValue(dflt_value, type),
          dataType: dataType,
          allowNull: primaryKey ? false : notnull == 0,
          primaryKey,
          datetimePrecision: rDateType.test(dataType) ? parseInt(precision, 10) : null,
        };
        return result;
      });
      if (columns.length > 0) schemaInfo[table] = columns;
    }

    return schemaInfo;
  }

  async createTable(table, attributes, opts = {}) {
    const chunks = [ `CREATE TABLE ${escapeId(table)}` ];
    const columns = Object.keys(attributes).map(name => {
      const attribute = new this.constructor.Attribute(name, attributes[name]);
      return attribute.toSqlString();
    });
    chunks.push(`(${columns.join(', ')})`);
    await this.query(chunks.join(' '), [], opts);
  }

  async alterTable(table, changes) {
    const chunks = [ `ALTER TABLE ${escapeId(table)}` ];
    const attributes = Object.keys(changes).map(name => {
      const options = changes[name];
      if (options.remove) return { columnName: name, remove: true };
      return new this.constructor.Attribute(name, changes[name]);
    });

    // SQLite doesn't support altering column attributes with MODIFY COLUMN and adding a PRIMARY KEY column
    if (attributes.some(entry => entry.modify || entry.primaryKey)) {
      await alterTableWithChangeColumn(this, table, attributes);
      return;
    }

    // SQLite can only add one column a time
    // - https://www.sqlite.org/lang_altertable.html
    for (const attribute of attributes) {
      if (attribute.remove) {
        const { columnName } = attribute;
        await this.query(chunks.concat(`DROP COLUMN ${this.escapeId(columnName)}`).join(' '));
      } else {
        await this.query(chunks.concat(`ADD COLUMN ${attribute.toSqlString()}`).join(' '));
      }
    }
  }

  async addColumn(table, name, params) {
    const attribute = new this.constructor.Attribute(name, params);
    const sql = heresql(`
      ALTER TABLE ${escapeId(table)}
      ADD COLUMN ${attribute.toSqlString()}
    `);
    await this.query(sql);
  }

  async changeColumn(table, name, params) {
    const attribute = new this.Attribute(name, params);
    const schemaInfo = await this.querySchemaInfo(null, table);
    const columns = schemaInfo[table];

    for (const entry of columns) {
      if (entry.columnName === attribute.columnName) {
        Object.assign(entry, attribute, { modify: true });
      }
    }

    await this.alterTable(table, columns);
  }

  async removeColumn(table, name) {
    const attribute = new this.Attribute(name);
    attribute.remove = true;
    const changes = [ attribute ];
    await alterTableWithChangeColumn(this, table, changes);
  }

  /**
   * SQLite has only got implicit table truncation.
   * - https://sqlite.org/lang_delete.html#the_truncate_optimization
   */
  async truncateTable(table) {
    await this.query(`DELETE FROM ${escapeId(table)}`);
  }
};

module.exports = SqliteDriver;
