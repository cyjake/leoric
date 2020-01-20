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
    this.logger = logger && logger.info ? logger : { info: debug };
  }

  async createTable(table, definitions) {
    const { escapeId } = this;
    const chunks = [ `CREATE TABLE ${escapeId(table)}` ];
    const columns = Object.keys(definitions).map(name => {
      const definition = definitions[name];
      const columnName = definitions.columnName || snakeCase(name);
      return `${escapeId(columnName)} ${formatColumnDefinition(definition)}`;
    });
    chunks.push(`(${columns.join(', ')})`);
    await this.query(chunks.join(' '));
  }

  async alterTable(table, definitions, changes = definitions) {
    const { escapeId } = this;
    const chunks = [ `ALTER TABLE ${escapeId(table)}` ];
    const actions = Object.keys(changes).map(name => {
      const { exists, columnName, ...definition } = changes[name];
      return [
        exists ? 'MODIFY COLUMN' : 'ADD COLUMN',
        escapeId(columnName || snakeCase(name)),
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
      ALTER TABLE ${escapeId(table)} DROP COLUMN ${escapeId(column)}}
    `);
    await this.query(sql);
  }

  async dropTable(table) {
    const { escapeId } = this;
    await this.query(`DROP TABLE IF EXISTS ${escapeId(table)}`);
  }
};
