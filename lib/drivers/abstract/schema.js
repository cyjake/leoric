'use strict';

const { heresql } = require('../../utils/string');

module.exports = {
  async createTable(table, attributes) {
    const { escapeId, Definition } = this;
    const chunks = [ `CREATE TABLE ${escapeId(table)}` ];
    const columns = Object.keys(attributes).map(name => {
      const definition = new Definition(name, attributes[name]);
      const { columnName } = definition;
      return `${escapeId(columnName)} ${definition.toSqlString()}`;
    });
    chunks.push(`(${columns.join(', ')})`);
    await this.query(chunks.join(' '));
  },

  async alterTable(table, attributes) {
    const { escapeId, Definition } = this;
    const chunks = [ `ALTER TABLE ${escapeId(table)}` ];

    const actions = Object.keys(attributes).map(name => {
      const definition = new Definition(name, attributes[name]);
      const { modify, columnName } = definition;
      return [
        modify ? 'MODIFY COLUMN' : 'ADD COLUMN',
        escapeId(columnName),
        definition.toSqlString(),
      ].join(' ');
    });
    chunks.push(actions.join(', '));
    await this.query(chunks.join(' '));
  },

  async addColumn(table, name, params) {
    const { escapeId, Definition } = this;
    const definition = new Definition(name, params);
    const { columnName } = definition;
    const sql = heresql(`
      ALTER TABLE ${escapeId(table)}
      ADD COLUMN ${escapeId(columnName)} ${definition.toSqlString()}
    `);
    await this.query(sql);
  },

  async changeColumn(table, name, params) {
    const { escapeId, Definition } = this;
    const definition = new Definition(name, params);
    const { columnName } = definition;
    const sql = heresql(`
      ALTER TABLE ${escapeId(table)}
      MODIFY COLUMN ${escapeId(columnName)} ${definition.toSqlString()}
    `);
    await this.query(sql);
  },

  async removeColumn(table, column) {
    const { escapeId } = this;
    const sql = heresql(`
      ALTER TABLE ${escapeId(table)} DROP COLUMN ${escapeId(column)}
    `);
    await this.query(sql);
  },

  async renameColumn(table, column, newColumn) {
    const { escapeId } = this;
    const sql = heresql(`
      ALTER TABLE ${escapeId(table)}
      RENAME COLUMN ${escapeId(column)} TO ${escapeId(newColumn)}
    `);
    await this.query(sql);
  },

  async renameTable(table, newTable) {
    const { escapeId } = this;
    const sql = heresql(`
      ALTER TABLE ${escapeId(table)} RENAME TO ${escapeId(newTable)}
    `);
    await this.query(sql);
  },

  async dropTable(table) {
    const { escapeId } = this;
    await this.query(`DROP TABLE IF EXISTS ${escapeId(table)}`);
  },
};
