'use strict';

const strftime = require('strftime');

const schema = require('./schema');
const spellbook = require('./spellbook');
const AbstractDriver = require('../abstract');
const sqlite = require('sqlite3');

// SELECT users.id AS "users:id", ...
// => [ { users: { id, ... } } ]
function nest(rows, fields, spell) {
  const { Model } = spell;
  const { aliasName } = Model;
  const results = [];

  for (const row of rows) {
    const result = {};
    const qualified = Object.keys(row).some(entry => entry.includes(':'));
    for (const key in row) {
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

class Connection {
  constructor({ database, mode, logger }) {
    const { Database, OPEN_READWRITE, OPEN_CREATE } = sqlite;
    if (mode == null) mode = OPEN_READWRITE | OPEN_CREATE;
    this.database = new Database(database, mode);
    this.logger = logger;
  }

  async query(query, values, spell) {
    const { sql, nestTables } = query.sql ? query : { sql: query };

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

class SqliteDriver extends AbstractDriver {
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

    // node-sqlite3 does not support Date as parameterized value
    if (values) {
      values = values.map(entry => {
        if (entry instanceof Date) {
          return strftime('%Y-%m-%d %H:%M:%S.%L %:z', entry);
        }
        return entry;
      });
    }

    try {
      const { logger } = this;
      logger.logQuery(logger.format(query, values, opts));
      return await connection.query(query, values, opts);
    } finally {
      if (!opts.connection) connection.release();
    }
  }

  format(spell) {
    return spellbook.format(spell);
  }
};

Object.assign(SqliteDriver.prototype, schema);

module.exports = SqliteDriver;
