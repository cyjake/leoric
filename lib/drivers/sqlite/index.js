'use strict';

const SqlString = require('sqlstring');

const spellbook = require('./spellbook');
const AbstractDriver = require('../abstract');
const { heresql } = require('../../utils/string');
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
  const dataType = definition.dataType || type.toSqlString();
  // int => integer
  // - https://www.sqlite.org/datatype3.html
  const chunks = [ dataType.replace(/^INT\b/i, 'INTEGER') ];

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
        if (err) reject(new Error(err.stack));
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

  async createTable(table, attributes, opts = {}) {
    const { escapeId } = this;
    const definitions = this.getDefinitions(attributes);
    const chunks = [ `CREATE TABLE ${escapeId(table)}` ];
    const columns = definitions.map(definition => {
      const { columnName } = definition;
      return `${escapeId(columnName)} ${formatColumnDefinition(definition)}`;
    });
    chunks.push(`(${columns.join(', ')})`);
    await this.query(chunks.join(' '), [], opts);
  }

  /**
   * Schema altering commands other than RENAME COLUMN or ADD COLUMN
   * - https://www.sqlite.org/lang_altertable.html
   * @param {string} table
   * @param {Object} definitions the changed definitions
   */
  async alterTableWithChangeColumn(table, changes) {
    const { escapeId } = this;
    const schemaInfo = await this.querySchemaInfo(null, table);
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
      if (definition.modify == null && definition.remove == null) {
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

    const connection = await this.getConnection();
    await connection.query('BEGIN');
    try {
      const newTable = `new_${table}`;
      await this.createTable(newTable, newDefinitions, { connection });
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

  async alterTable(table, changes) {
    const { escapeId } = this;
    const chunks = [ `ALTER TABLE ${escapeId(table)}` ];
    const definitions = this.getDefinitions(changes);

    // SQLite doesn't support altering column definitions with MODIFY COLUMN
    if (definitions.some(entry => entry.modify)) {
      await this.alterTableWithChangeColumn(table, definitions);
      return;
    }

    const actions = definitions.map(definition => {
      return [
        'ADD COLUMN',
        escapeId(definition.columnName),
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
    const definitions = schema[table];

    for (const entry of definitions) {
      if (entry.columnName === column) {
        Object.assign(entry, definition, { modify: true });
      }
    }

    await this.alterTable(table, definitions);
  }

  async removeColumn(table, column) {
    const changes = [
      { columnName: column, remove: true },
    ];
    await this.alterTableWithChangeColumn(table, changes);
  }

  format(spell) {
    return spellbook.format(spell);
  }
};
