'use strict';

const SqlString = require('sqlstring');
const debug = require('debug')('leoric');

const spellbook = require('./spellbook');
const AbstractDriver = require('../abstract');
const { heresql, camelCase, snakeCase } = require('../../utils/string');
const sqlite = require('sqlite3');

// SELECT users.id AS "users:id", ...
// => [ { users: { id, ... } } ]
function nest(rows, fields, spell) {
  const { Model } = spell;
  const { aliasName } = Model;
  const results = [];

  for (const row of rows) {
    const result = {};
    for (const key in row) {
      const qualified = Object.keys(row).some(entry => entry.includes(':'));
      const parts = key.split(':');
      const [qualifier, column] = qualified
        ? (parts.length > 1 ? parts : ['', key])
        : [Model.attributeMap.hasOwnProperty(key) ? aliasName : '', key];
      const obj = result[qualifier] || (result[qualifier] = {});
      obj[column] = row[key];
    }
    results.push(result);
  }

  return { rows: results, fields };
}

function formatColumnDefinition(definition) {
  const { type, allowNull, defaultValue, primaryKey } = definition;
  // int => integer
  // - https://www.sqlite.org/datatype3.html
  const chunks = [ type.toSqlString().replace(/^INT\b/, 'INTEGER') ];

  if (primaryKey) chunks.push('PRIMARY KEY');

  // https://www.cyj.me/programming/2018/01/11/programming-leoric-ii/
  if (definition.autoIncrement) chunks.push('AUTOINCREMENT');

  if (!primaryKey && allowNull != null) {
    chunks.push(allowNull ? 'NULL' : 'NOT NULL');
  }

  if (defaultValue != null) {
    chunks.push(`DEFAULT ${SqlString.escape(defaultValue)}`);
  }

  return chunks.join(' ');
}

class Connection {
  constructor({ database, mode, logger }) {
    const { Database, OPEN_READWRITE, OPEN_CREATE } = sqlite;
    if (mode == null) mode = OPEN_READWRITE | OPEN_CREATE;
    this.database = new Database(database, mode);
    this.logger = logger;
  }

  async query(query, values, spell) {
    const { sql, nestTables } = query.sql ? query : { sql: query };
    let i = 0;
    this.logger.info(sql.replace(/\?/g, () => SqlString.escape(values[i++])));

    if (/^(?:pragma|select)/i.test(sql)) {
      const result = await this.all(sql, values);
      if (nestTables) return nest(result.rows, result.fields, spell);
      return result;
    } else {
      return await this.run(sql, values);
    }
  }

  all(sql, values) {
    return new Promise((resolve, reject) => {
      this.database.all(sql, values, (err, rows, fields) => {
        if (err) reject(err);
        else resolve({ rows, fields });
      });
    });
  }

  run(sql, values) {
    return new Promise((resolve, reject) => {
      this.database.run(sql, values, function Leoric_sqliteRun(err) {
        if (err) reject(err);
        else resolve({ insertId: this.lastID, affectedRows: this.changes });
      });
    });
  }
}

module.exports = class SqliteDriver extends AbstractDriver {
  constructor(name = 'sqlite', opts = {}) {
    super(name, opts);
    const { logger } = this;
    this.type = 'sqlite';
    this.connections = [ new Connection({ ...opts, logger }) ];
    this.callbacks = [];
  }

  escapeId(identifier) {
    return `"${identifier.replace(/"/g, '""')}"`;
  }

  async getConnection() {
    const { connections, callbacks } = this;

    if (connections.length > 0) {
      const connection = connections.shift();
      return Object.assign(connection, {
        release() {
          connections.push(connection);
          while (callbacks.length > 0) {
            const callback = callbacks.shift();
            callback();
          }
        },
      });
    }

    await new Promise((resolve) => {
      callbacks.push(resolve);
    });

    return this.getConnection();
  }

  async query(query, values, opts = {}) {
    const connection = opts.connection || await this.getConnection();
    let result;
    try {
      result = await connection.query(query, values, opts);
    } finally {
      if (!opts.connection) connection.release();
    }
    return result;
  }

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
        const result = {
          columnName: name,
          columnType,
          defaultValue: dflt_value,
          dataType: columnType.split('(')[0],
          allowNull: notnull == 0,
        };
        if (pk === 1) result.primaryKey = true;
        return result;
      });
      if (columns.length > 0) schema[table] = columns;
    }

    return schema;
  }

  async createTable(table, definitions, opts = {}) {
    const { escapeId } = this;
    const chunks = [ `CREATE TABLE ${escapeId(table)}` ];
    const columns = Object.keys(definitions).map(name => {
      const definition = definitions[name];
      const columnName = definitions.columnName || snakeCase(name);
      return `${escapeId(columnName)} ${formatColumnDefinition(definition)}`;
    });
    chunks.push(`(${columns.join(', ')})`);
    await this.query(chunks.join(' '), [], opts);
  }

  /**
   * Schema altering commands other than RENAME COLUMN or ADD COLUMN
   * - https://www.sqlite.org/lang_altertable.html
   * @param {string} table
   * @param {Object} changes the changed column definitions
   * @param {Object} definitions the complete and new column definitions
   */
  async alterTableWithChangeColumn(table, definitions, changes) {
    const { escapeId } = this;
    const columns = [];
    for (const name in definitions) {
      const change = changes[name];
      const definition = { columnName: snakeCase(name), ...definitions[name] };
      if (!change || change.exists) {
        columns.push(escapeId(definition.columnName));
      } else {
        columns.push(SqlString.escape(definition.defaultValue));
      }
    }

    const connection = await this.getConnection();
    await connection.query('BEGIN');
    try {
      const newTable = `new_${table}`;
      await this.createTable(newTable, definitions, { connection });
      await connection.query(heresql(`
        INSERT INTO ${escapeId(newTable)}
        SELECT ${columns.join(', ')}
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

  async alterTable(table, definitions, changes = definitions) {
    const { escapeId } = this;
    const chunks = [ `ALTER TABLE ${escapeId(table)}` ];

    // SQLite doesn't support altering column definitions with MODIFY COLUMN
    if (Object.values(changes).some(entry => entry.exists)) {
      await this.alterTableWithChangeColumn(table, definitions, changes);
      return;
    }

    const actions = Object.keys(changes).map(name => {
      const { columnName, ...definition } = changes[name];
      return [
        'ADD COLUMN',
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
    const schema = await this.querySchemaInfo(null, table);
    const columns = schema[table];
    const definitions = columns.reduce((result, entry) => {
      const { columnName } = entry;
      result[camelCase(columnName)] = entry;
      return result;
    }, {});
    const name = camelCase(column);

    definitions[name] = definition;
    await this.alterTable(table, definitions, {
      [name]: { ...definition, exists: definitions.hasOwnProperty(name) },
    });
  }

  format(spell) {
    return spellbook.format(spell);
  }
};
