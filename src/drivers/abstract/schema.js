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

  async describeTable(table) {
    const { database } = this.options;
    const schemaInfo = await this.querySchemaInfo(database, table);
    return schemaInfo[table].reduce(function(result, column) {
      result[column.columnName] = column;
      return result;
    }, {});
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

  async truncateTable(table) {
    const { escapeId } = this;
    await this.query(`TRUNCATE TABLE ${escapeId(table)}`);
  },

  async addIndex(table, attributes, opts = {}) {
    const { escapeId, Attribute } = this;
    const columns = attributes.map(name => new Attribute(name).columnName);
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
  },

  async removeIndex(table, attributes, opts = {}) {
    const { escapeId, Attribute } = this;
    let name;
    if (Array.isArray(attributes)) {
      const columns = attributes.map(entry => new Attribute(entry).columnName);
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
  },

};
