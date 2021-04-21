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

  /**
   * @param {Object} opts.attributes
   * @param {Array | boolean} updateOnDuplicate enable 'ON DUPLICATE KEY UPDATE'/'ON CONFLICT DO UPDATE SET' or not
   * @param {Array | string} opts.uniqueKeys uniqueKeys ON CONFLICT (uniqueKeys) only available in Postgres and SQLite
   */
  updateOnDuplicate(opts = {}) {
    if (!opts.updateOnDuplicate) return null;
    const { escapeId } = this;

    let uniqueKeys = [];
    let updateKeys = [];

    const { attributes } = opts;

    if (opts.uniqueKeys) {
      if (Array.isArray(opts.uniqueKeys) && opts.uniqueKeys.length) {
        for (const field of opts.uniqueKeys) {
          const attribute = escapeId(field);
          uniqueKeys.push(attribute);
        }
      } else {
        uniqueKeys.push(escapeId(opts.uniqueKeys));
      }
    } else {
      // conflict_target must be unique
      // get all unique keys
      if (attributes) {
        for (const key in attributes) {
          const att = attributes[key];
          // use the first unique key
          if (att.unique) {
            uniqueKeys.push(escapeId(att.columnName));
            break;
          }
        }
      }
      const { primaryKey } = opts;
      if (!uniqueKeys.length) uniqueKeys.push(escapeId(primaryKey));
      // default use id as primary key
      if (!uniqueKeys.length) uniqueKeys.push(escapeId('id'));
    }

    if (Array.isArray(opts.updateOnDuplicate) && opts.updateOnDuplicate.length) {
      for (const field of opts.updateOnDuplicate) {
        const attribute = escapeId(field);
        updateKeys.push(`${attribute}=EXCLUDED.${attribute}`);
      }
    } else {
      for (const attribute of attributes) {
        updateKeys.push(`${attribute.columnName}=EXCLUDED.${attribute.columnName}`);
      }
    }
    return `ON CONFLICT (${uniqueKeys.join(',')}) DO UPDATE SET ${updateKeys.join(',')}`;
  },

  /**
   *
   * updateOnDuplicate
   * see https://dev.mysql.com/doc/refman/8.0/en/insert-on-duplicate.html
   * see https://www.postgresql.org/docs/9.5/sql-insert.html
   * see https://www.sqlite.org/lang_UPSERT.html
   * @param {string} table
   * @param {Object[]} records
   * @param {Object} opts
   * @param {Object} opts.attributes
   * @param {Object} opts.returning
   * @param {Array | boolean} updateOnDuplicate enable 'ON DUPLICATE KEY UPDATE'/'ON CONFLICT DO UPDATE SET' or not
   * @param {Array | string} uniqueKeys ON CONFLICT (uniqueKeys) only available in Postgres and SQLite
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
        const { name, jsType } = attribute;
        values.push(this.uncast(entry[name], jsType));
      }
      placeholders.push(`(${new Array(attributes.length).fill('?').join(',')})`);
    }

    let returning;
    if (opts.returning === true) returning = columns;
    if (Array.isArray(opts.returning)) {
      returning = opts.returning.map(escapeId);
    }

    const onDuplicate = this.updateOnDuplicate({
      ...opts,
      attributes,
    });

    let sql = heresql(`
      INSERT INTO ${escapeId(table)} (${columns.join(', ')})
      VALUES ${placeholders.join(', ')}
    `);
    if (onDuplicate) sql = `${sql} ${onDuplicate}`;
    if (returning) sql = `${sql} RETURNING ${returning.join(', ')}`;
    return await this.query(sql, values, { ...opts, command: 'bulkInsert' });
  }
};
