'use strict';

const debug = require('debug')('leoric');
const SqlString = require('sqlstring');
const { heresql, snakeCase } = require('../../utils/string');

function formatColumnDefinition(definition) {
  const { type, allowNull, defaultValue, primaryKey } = definition;
  const chunks = [ type.toSqlString() ];

  if (primaryKey) chunks.push('PRIMARY KEY');

  if (definition.autoIncrement) chunks.push('AUTO INCREMENT');

  if (!primaryKey && allowNull != null) {
    chunks.push(allowNull ? 'NULL' : 'NOT NULL');
  }

  if (defaultValue != null) {
    chunks.push(`DEFAULT ${SqlString.escape(defaultValue)}`);
  }

  return chunks.join(' ');
}

/**
 * Migration methods
 * - https://dev.mysql.com/doc/refman/8.0/en/create-table.html
 * - https://dev.mysql.com/doc/refman/8.0/en/alter-table.html
 */

module.exports = class AbstractDriver {
  constructor(name, opts = {}) {
    const { logger } = opts;
    if (logger != null && typeof logger === 'object') {
      this.logger = logger;
    } else if (typeof logger === 'function') {
      this.logger = { info: logger, debug };
    } else {
      this.logger = { info: debug, debug };
    }
  }

  getDefinitions(attributes) {
    if (Array.isArray(attributes)) return attributes;

    return Object.keys(attributes).map(name => {
      return { name, columnName: snakeCase(name), ...attributes[name] };
    });
  }

  async createTable(table, attributes) {
    const { escapeId } = this;
    const definitions = this.getDefinitions(attributes);
    const chunks = [ `CREATE TABLE ${escapeId(table)}` ];
    const columns = definitions.map(definition => {
      const { columnName } = definition;
      return `${escapeId(columnName)} ${formatColumnDefinition(definition)}`;
    });
    chunks.push(`(${columns.join(', ')})`);
    await this.query(chunks.join(' '));
  }

  async alterTable(table, attributes) {
    const { escapeId } = this;
    const chunks = [ `ALTER TABLE ${escapeId(table)}` ];
    const definitions = this.getDefinitions(attributes);
    const actions = definitions.map(definition => {
      const { modify, columnName } = definition;
      return [
        modify ? 'MODIFY COLUMN' : 'ADD COLUMN',
        escapeId(columnName),
        formatColumnDefinition(definition),
      ].join(' ');
    });
    chunks.push(actions.join(', '));
    await this.query(chunks.join(' '));
  }

  async addColumn(table, column, definition) {
    const { escapeId } = this;
    const sql = heresql(`
      ALTER TABLE ${escapeId(table)}
      ADD COLUMN ${escapeId(column)} ${formatColumnDefinition(definition)}
    `);
    await this.query(sql);
  }

  async changeColumn(table, column, definition) {
    const { escapeId } = this;
    const sql = heresql(`
      ALTER TABLE ${escapeId(table)}
      MODIFY COLUMN ${escapeId(column)} ${formatColumnDefinition(definition)}
    `);
    await this.query(sql);
  }

  async removeColumn(table, column) {
    const { escapeId } = this;
    const sql = heresql(`
      ALTER TABLE ${escapeId(table)} DROP COLUMN ${escapeId(column)}
    `);
    await this.query(sql);
  }

  async renameColumn(table, column, newColumn) {
    const { escapeId } = this;
    const sql = heresql(`
      ALTER TABLE ${escapeId(table)}
      RENAME COLUMN ${escapeId(column)} TO ${escapeId(newColumn)}
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
};
