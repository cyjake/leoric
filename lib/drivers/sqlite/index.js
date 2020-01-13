'use strict';

const sqlite = require('sqlite3');
const SqlString = require('sqlstring');
const debug = require('debug')('leoric');
const spellbook = require('./spellbook');

// SELECT users.id AS "users:id", ...
// => [ { users: { id, ... } } ]
function nest(rows, fields, spell) {
  const { aliasName } = spell.Model;
  const results = [];

  for (const row of rows) {
    const result = {};
    for (const key in row) {
      const qualified = Object.keys(row).some(entry => entry.includes(':'));
      const parts = key.split(':');
      const [qualifier, column] = qualified
        ? (parts.length > 1 ? parts : ['', key])
        : [aliasName, key];
      const obj = result[qualifier] || (result[qualifier] = {});
      obj[column] = row[key];
    }
    results.push(result);
  }

  return { rows: results, fields };
}

class Connection {
  constructor({ database, mode }) {
    const { Database, OPEN_READWRITE } = sqlite;
    this.database = new Database(database, mode || OPEN_READWRITE);
  }

  async query(query, values, spell) {
    const { sql, nestTables } = query.sql ? query : { sql: query };
    let i = 0;
    debug(sql.replace(/\?/g, () => SqlString.escape(values[i++])));

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

module.exports = class SqliteDriver {
  constructor(name = 'sqlite3', opts = {}) {
    if (name !== 'sqlite3') {
      throw new Error(`Unsupported sqlite client ${name}`);
    }
    this.type = 'sqlite';
    this.connections = [ new Connection(opts) ];
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
    const queries = tables.map(table => {
      return this.query(`PRAGMA table_info(${this.escapeId(table)})`);
    });
    const results = await Promise.all(queries);
    const schema = {};
    for (let i = 0; i < tables.length; i++) {
      const table = tables[i];
      const { rows } = results[i];
      const columns = rows.map(({ name, type, notnull, dflt_value, pk }) => {
        return {
          columnName: name,
          defaultValue: dflt_value,
          dataType: type,
          allowNull: notnull == 1,
        };
      });
      schema[table] = columns;
    }
    return schema;
  }

  format(spell) {
    return spellbook.format(spell);
  }
};
