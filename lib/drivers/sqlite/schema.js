'use strict';

const debug = require('debug')('leoric');
const SqlString = require('sqlstring');

const { parseExpr } = require('../../expr');
const { heresql } = require('../../utils/string');
const schema = require('../abstract/schema');
const Definition = require('./definition');

/**
 * Schema altering commands other than RENAME COLUMN or ADD COLUMN
 * - https://www.sqlite.org/lang_altertable.html
 * @param {string} table
 * @param {Object} definitions the changed definitions
 */
async function alterTableWithChangeColumn(driver, table, changes) {
  const { escapeId } = driver;
  const schemaInfo = await driver.querySchemaInfo(null, table);
  const columns = schemaInfo[table];

  const changeMap = changes.reduce((result, entry) => {
    result[entry.columnName] = entry;
    return result;
  }, {});

  const newDefinitions = [];
  for (const definition of columns) {
    const { columnName } = definition;
    const change = changeMap[columnName];
    if (!change || !change.remove) {
      newDefinitions.push(Object.assign(definition, change));
    }
  }

  for (const definition of changes) {
    if (!definition.modify && !definition.remove) {
      newDefinitions.push(definition);
    }
  }

  const newColumns = [];
  for (const definition of newDefinitions) {
    const { columnName, defaultValue } = definition;
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
    await driver.createTable(newTable, newDefinitions, { connection });
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

  Definition,

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
      const definition = new Definition(name, attributes[name]);
      const { columnName } = definition;
      return `${escapeId(columnName)} ${definition.toSqlString()}`;
    });
    chunks.push(`(${columns.join(', ')})`);
    await this.query(chunks.join(' '), [], opts);
  },

  async alterTable(table, changes) {
    const { escapeId } = this;
    const chunks = [ `ALTER TABLE ${escapeId(table)}` ];
    const definitions = Object.keys(changes).map(name => {
      return new Definition(name, changes[name]);
    });

    // SQLite doesn't support altering column definitions with MODIFY COLUMN
    if (definitions.some(entry => entry.modify)) {
      await alterTableWithChangeColumn(this, table, definitions);
      return;
    }

    const actions = definitions.map(definition => {
      return [
        'ADD COLUMN',
        escapeId(definition.columnName),
        definition.toSqlString(),
      ].join(' ');
    });
    chunks.push(actions.join(', '));
    await this.query(chunks.join(' '));
  },

  async addColumn(table, name, params) {
    const { escapeId } = this;
    const definition = new Definition(name, params);
    const { columnName } = definition;
    const sql = heresql(`
      ALTER TABLE ${escapeId(table)}
      ADD COLUMN ${escapeId(columnName)} ${definition.toSqlString()}
    `);
    await this.query(sql);
  },

  async changeColumn(table, name, params) {
    const definition = new Definition(name, params);
    const schema = await this.querySchemaInfo(null, table);
    const columns = schema[table];

    for (const entry of columns) {
      if (entry.columnName === definition.columnName) {
        Object.assign(entry, definition, { modify: true });
      }
    }

    await this.alterTable(table, columns);
  },

  async removeColumn(table, name) {
    const changes = [
      { columnName: name, remove: true },
    ];
    await alterTableWithChangeColumn(this, table, changes);
  },
};
