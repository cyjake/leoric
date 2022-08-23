'use strict';

const SqlString = require('sqlstring');
const debug = require('debug')('leoric');

const Logger = require('./logger');
const Attribute = require('./attribute');
const DataTypes = require('../../data_types');
const Spellbook = require('./spellbook');
const { heresql, camelCase } = require('../../utils/string');

/**
 * Migration methods
 * - https://dev.mysql.com/doc/refman/8.0/en/create-table.html
 * - https://dev.mysql.com/doc/refman/8.0/en/alter-table.html
 */

class AbstractDriver {

  // define static properties as this way IDE will prompt
  static Spellbook = Spellbook;
  static Attribute = Attribute;
  static DataTypes = DataTypes;

  constructor(opts = {}) {
    const { logger } = opts;
    this.logger = logger instanceof Logger ? logger : new Logger(logger);
    this.idleTimeout = opts.idleTimeout || 60;
    this.options = opts;
    this.Attribute = this.constructor.Attribute;
    this.DataTypes = this.constructor.DataTypes;
    this.spellbook = new this.constructor.Spellbook();
    this.escape = SqlString.escape;
    this.escapeId = SqlString.escapeId;
  }

  /**
   * query with spell
   * @param {Spell} spell
   * @returns
   */
  async cast(spell) {
    const { sql, values } = this.format(spell);
    const query = { sql, nestTables: spell.command === 'select' };
    return await this.query(query, values, spell);
  }

  /**
   * raw query
   * @param {object|string} query
   * @param {object | array} values
   * @param {object} opts
   */
  async query(query, values, opts) {
    throw new Error('unimplemented!');
  }

  /**
   * disconnect manually
   * @param {Function} callback
   */
  async disconnect(callback) {
    debug('[disconnect] called');
  }

  get dialect() {
    return camelCase(this.constructor.name.replace('Driver', ''));
  }

  /**
   * use spellbook to format spell
   * @param {Spell} spell
   * @returns
   */
  format(spell) {
    return this.spellbook.format(spell);
  }

  async createTable(table, attributes) {
    const { escapeId } = this;
    const chunks = [ `CREATE TABLE ${escapeId(table)}` ];
    const columns = Object.keys(attributes).map(name => {
      const attribute = new this.Attribute(name, attributes[name]);
      return attribute.toSqlString();
    });
    chunks.push(`(${columns.join(', ')})`);
    await this.query(chunks.join(' '));
  }

  async alterTable(table, attributes) {
    const { escapeId } = this;
    const chunks = [ `ALTER TABLE ${escapeId(table)}` ];

    const actions = Object.keys(attributes).map(name => {
      const options = attributes[name];
      // { [columnName]: { remove: true } }
      if (options.remove) return `DROP COLUMN ${escapeId(name)}`;
      const attribute = new this.Attribute(name, options);
      return [
        options.modify ? 'MODIFY COLUMN' : 'ADD COLUMN',
        attribute.toSqlString(),
      ].join(' ');
    });
    chunks.push(actions.join(', '));
    await this.query(chunks.join(' '));
  }

  async describeTable(table) {
    const { database } = this.options;
    const schemaInfo = await this.querySchemaInfo(database, table);
    return schemaInfo[table].reduce(function(result, column) {
      result[column.columnName] = column;
      return result;
    }, {});
  }

  async addColumn(table, name, params) {
    const { escapeId } = this;
    const attribute = new this.Attribute(name, params);
    const sql = heresql(`
      ALTER TABLE ${escapeId(table)}
      ADD COLUMN ${attribute.toSqlString()}
    `);
    await this.query(sql);
  }

  async changeColumn(table, name, params) {
    const { escapeId } = this;
    const attribute = new this.Attribute(name, params);
    const sql = heresql(`
      ALTER TABLE ${escapeId(table)}
      MODIFY COLUMN ${attribute.toSqlString()}
    `);
    await this.query(sql);
  }

  async removeColumn(table, name) {
    const { escapeId } = this;
    const { columnName } = new this.Attribute(name);
    const sql = heresql(`
      ALTER TABLE ${escapeId(table)} DROP COLUMN ${escapeId(columnName)}
    `);
    await this.query(sql);
  }

  async renameColumn(table, name, newName) {
    const { escapeId } = this;
    const { columnName } = new this.Attribute(name);
    const attribute = new this.Attribute(newName);
    const sql = heresql(`
      ALTER TABLE ${escapeId(table)}
      RENAME COLUMN ${escapeId(columnName)} TO ${escapeId(attribute.columnName)}
    `);
    await this.query(sql);
  }

  async renameTable(table, newTable) {
    const { escapeId } = this;
    const sql = heresql(`
      ALTER TABLE ${escapeId(table)} RENAME TO ${escapeId(newTable)}
    `);
    await this.query(sql);
  }

  async dropTable(table) {
    const { escapeId } = this;
    await this.query(`DROP TABLE IF EXISTS ${escapeId(table)}`);
  }

  async truncateTable(table) {
    const { escapeId } = this;
    await this.query(`TRUNCATE TABLE ${escapeId(table)}`);
  }

  async addIndex(table, attributes, opts = {}) {
    const { escapeId } = this;
    const columns = attributes.map(name => new this.Attribute(name).columnName);
    const type = opts.unique ? 'UNIQUE' : opts.type;
    const prefix = type === 'UNIQUE' ? 'uk' : 'idx';
    const { name } = {
      name: [ prefix, table ].concat(columns).join('_'),
      ...opts,
    };

    if (type != null && ![ 'UNIQUE', 'FULLTEXT', 'SPATIAL' ].includes(type)) {
      throw new Error(`Unexpected index type: ${type}`);
    }

    const sql = heresql(`
      CREATE ${type ? `${type} INDEX` : 'INDEX'} ${escapeId(name)}
      ON ${escapeId(table)} (${columns.map(escapeId).join(', ')})
    `);
    await this.query(sql);
  }

  async removeIndex(table, attributes, opts = {}) {
    const { escapeId } = this;
    let name;
    if (Array.isArray(attributes)) {
      const columns = attributes.map(entry => new this.Attribute(entry).columnName);
      const type = opts.unique ? 'UNIQUE' : opts.type;
      const prefix = type === 'UNIQUE' ? 'uk' : 'idx';
      name = [ prefix, table ].concat(columns).join('_');
    } else if (typeof attributes === 'string') {
      name = attributes;
    } else {
      throw new Error(`Unexpected index name: ${attributes}`);
    }

    const sql = this.type === 'mysql'
      ? `DROP INDEX ${escapeId(name)} ON ${escapeId(table)}`
      : `DROP INDEX IF EXISTS ${escapeId(name)}`;
    await this.query(sql);
  }

};

module.exports = AbstractDriver;
