'use strict';

const { heresql } = require('../../utils/string');

module.exports = {
  async createTable(table, attributes) {
    const { escapeId, Attribute } = this;
    const chunks = [ `CREATE TABLE ${escapeId(table)}` ];
    const columns = Object.keys(attributes).map(name => {
      const attribute = new Attribute(name, attributes[name]);
      return attribute.toSqlString();
    });
    chunks.push(`(${columns.join(', ')})`);
    await this.query(chunks.join(' '));
  },

  async alterTable(table, attributes) {
    const { escapeId, Attribute } = this;
    const chunks = [ `ALTER TABLE ${escapeId(table)}` ];

    const actions = Object.keys(attributes).map(name => {
      const attribute = new Attribute(name, attributes[name]);
      return [
        attribute.modify ? 'MODIFY COLUMN' : 'ADD COLUMN',
        attribute.toSqlString(),
      ].join(' ');
    });
    chunks.push(actions.join(', '));
    await this.query(chunks.join(' '));
  },

  async addColumn(table, name, params) {
    const { escapeId, Attribute } = this;
    const attribute = new Attribute(name, params);
    const sql = heresql(`
      ALTER TABLE ${escapeId(table)}
      ADD COLUMN ${attribute.toSqlString()}
    `);
    await this.query(sql);
  },

  async changeColumn(table, name, params) {
    const { escapeId, Attribute } = this;
    const attribute = new Attribute(name, params);
    const sql = heresql(`
      ALTER TABLE ${escapeId(table)}
      MODIFY COLUMN ${attribute.toSqlString()}
    `);
    await this.query(sql);
  },

  async removeColumn(table, name) {
    const { escapeId, Attribute } = this;
    const { columnName } = new Attribute(name);
    const sql = heresql(`
      ALTER TABLE ${escapeId(table)} DROP COLUMN ${escapeId(columnName)}
    `);
    await this.query(sql);
  },

  async renameColumn(table, name, newName) {
    const { escapeId, Attribute } = this;
    const { columnName } = new Attribute(name);
    const attribute = new Attribute(newName);
    const sql = heresql(`
      ALTER TABLE ${escapeId(table)}
      RENAME COLUMN ${escapeId(columnName)} TO ${escapeId(attribute.columnName)}
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

  /**
   *
   * @param {string} table
   * @param {Object[]} records
   * @param {Object} opts
   * @param {Object} opts.attributes
   * @param {Object} opts.returning
   */
  async bulkInsert(table, records, opts = {}) {
    const { escapeId, Attribute } = this;
    // merge records to get the big picture of involved attributes
    const involved = records.reduce((result, entry) => {
      return Object.assign(result, entry);
    }, {});
    const attributes = opts.attributes
      ? Object.keys(involved).map(name => opts.attributes[name])
      : Object.keys(involved).map(name => new Attribute(name));
    const columns = attributes.map(entry => escapeId(entry.columnName));

    const values = [];
    const placeholders = [];
    for (const entry of records) {
      for (const attribute of attributes) {
        values.push(entry[attribute.name]);
      }
      placeholders.push(`(${new Array(attributes.length).fill('?').join(',')})`);
    }

    let returning;
    if (opts.returning === true) returning = columns;
    if (Array.isArray(opts.returning)) {
      returning = opts.returning.map(escapeId);
    }

    let sql = heresql(`
      INSERT INTO ${escapeId(table)} (${columns.join(', ')})
      VALUES ${placeholders.join(', ')}
    `);
    if (returning) sql = `${sql} RETURNING ${returning.join(', ')}`;

    return await this.query(sql, values);
  }
};
