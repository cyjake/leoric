'use strict';

const debug = require('debug')('leoric');
const SqlString = require('sqlstring');

const { parseExpr } = require('../../expr');
const { heresql } = require('../../utils/string');
const schema = require('../abstract/schema');
const Attribute = require('./attribute');

/**
 * Schema altering commands other than RENAME COLUMN or ADD COLUMN
 * - https://www.sqlite.org/lang_altertable.html
 * @param {string} table
 * @param {Object} attributes the changed attributes
 */
async function alterTableWithChangeColumn(driver, table, changes) {
  const { escapeId } = driver;
  const schemaInfo = await driver.querySchemaInfo(null, table);
  const columns = schemaInfo[table];

  const changeMap = changes.reduce((result, entry) => {
    result[entry.columnName] = entry;
    return result;
  }, {});

  const newAttributes = [];
  for (const column of columns) {
    const { columnName } = column;
    const change = changeMap[columnName];
    if (!change || !change.remove) {
      newAttributes.push(Object.assign(column, change));
    }
  }

  for (const attribute of changes) {
    if (!attribute.modify && !attribute.remove) {
      newAttributes.push(attribute);
    }
  }

  const newColumns = [];
  for (const attribute of newAttributes) {
    const { columnName, defaultValue } = attribute;
    const change = changeMap[columnName];
    if (!change || change.modify) {
      newColumns.push(escapeId(columnName));
    } else {
      newColumns.push(SqlString.escape(defaultValue));
    }
  }

  const connection = await driver.getConnection();
  await connection.query('BEGIN');
  try {
    const newTable = `new_${table}`;
    await driver.createTable(newTable, newAttributes, { connection });
    await connection.query(heresql(`
      INSERT INTO ${escapeId(newTable)}
      SELECT ${newColumns.join(', ')}
      FROM ${escapeId(table)}
    `));
    await connection.query(`DROP TABLE ${escapeId(table)}`);
    await connection.query(heresql(`
      ALTER TABLE ${escapeId(newTable)}
      RENAME TO ${escapeId(table)}
    `));
    await connection.query('COMMIT');
  } catch (err) {
    await connection.query('ROLLBACK');
    throw err;
  } finally {
    await connection.release();
  }
}

function parseDefaultValue(text) {
  if (typeof text !== 'string') return text;

  try {
    const ast = parseExpr(text);
    if (ast.type === 'literal') {
      return ast.value;
    }
  } catch (err) {
    debug('[parseDefaultValue] [%s] %s', text, err.stack);
  }

  return text;
}

module.exports = {
  ...schema,

  async querySchemaInfo(database, tables) {
    tables = [].concat(tables);

    const queries = tables.map(table => {
      return this.query(`PRAGMA table_info(${this.escapeId(table)})`);
    });
    const results = await Promise.all(queries);
    const schema = {};
    for (let i = 0; i < tables.length; i++) {
      const table = tables[i];
      const { rows } = results[i];
      const columns = rows.map(({ name, type, notnull, dflt_value, pk }) => {
        const columnType = type.toLowerCase();
        const primaryKey = pk === 1;
        const result = {
          columnName: name,
          columnType,
          defaultValue: parseDefaultValue(dflt_value),
          dataType: columnType.split('(')[0],
          allowNull: primaryKey ? false : notnull == 0,
          primaryKey,
        };
        return result;
      });
      if (columns.length > 0) schema[table] = columns;
    }

    return schema;
  },

  async createTable(table, attributes, opts = {}) {
    const { escapeId } = this;
    const chunks = [ `CREATE TABLE ${escapeId(table)}` ];
    const columns = Object.keys(attributes).map(name => {
      const attribute = new Attribute(name, attributes[name]);
      return attribute.toSqlString();
    });
    chunks.push(`(${columns.join(', ')})`);
    await this.query(chunks.join(' '), [], opts);
  },

  async alterTable(table, changes) {
    const { escapeId } = this;
    const chunks = [ `ALTER TABLE ${escapeId(table)}` ];
    const attributes = Object.keys(changes).map(name => {
      return new Attribute(name, changes[name]);
    });

    // SQLite doesn't support altering column attributes with MODIFY COLUMN
    if (attributes.some(entry => entry.modify)) {
      await alterTableWithChangeColumn(this, table, attributes);
      return;
    }

    const actions = attributes.map(attribute => {
      return `ADD COLUMN ${attribute.toSqlString()}`;
    });
    chunks.push(actions.join(', '));
    await this.query(chunks.join(' '));
  },

  async addColumn(table, name, params) {
    const { escapeId } = this;
    const attribute = new Attribute(name, params);
    const sql = heresql(`
      ALTER TABLE ${escapeId(table)}
      ADD COLUMN ${attribute.toSqlString()}
    `);
    await this.query(sql);
  },

  async changeColumn(table, name, params) {
    const attribute = new Attribute(name, params);
    const schema = await this.querySchemaInfo(null, table);
    const columns = schema[table];

    for (const entry of columns) {
      if (entry.columnName === attribute.columnName) {
        Object.assign(entry, attribute, { modify: true });
      }
    }

    await this.alterTable(table, columns);
  },

  async removeColumn(table, name) {
    const attribute = new Attribute(name);
    attribute.remove = true;
    const changes = [ attribute ];
    await alterTableWithChangeColumn(this, table, changes);
  },
};
