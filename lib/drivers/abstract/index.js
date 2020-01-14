'use strict';

const SqlString = require('sqlstring');
const { heresql } = require('../../utils/string');

function formatColumnDefinition({ dataType, allowNull, defaultValue }) {
  const chunks = [ dataType.toSqlString() ];

  if (allowNull != null) {
    chunks.push(allowNull ? 'NULL' : 'NOT NULL');
  }

  if (defaultValue != null) {
    chunks.push(`DEFAULT ${SqlString.escape(defaultValue)}`);
  }

  return chunks.join(' ');
}

module.exports = class AbstractDriver {
  // https://dev.mysql.com/doc/refman/8.0/en/create-table.html
  async createTable(table, definitions) {
    const { escapeId } = this;
    const chunks = [ `CREATE TABLE ${escapeId(table)}` ];
    const columns = Object.keys(definitions).map(name => {
      const definition = definitions[name];
      const { columnName } = definition;
      return `${escapeId(columnName)} ${formatColumnDefinition(definition)}`;
    });
    chunks.push(`(${columns.join(', ')})`);
    await this.query(chunks.join(' '));
  }

  // https://dev.mysql.com/doc/refman/8.0/en/alter-table.html
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
      CHANGE COLUMN ${escapeId(column)} ${formatColumnDefinition(definition)}
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
