'use strict';

const EventEmitter = require('events');
const strftime = require('strftime');

const AbstractDriver = require('../abstract');
const Attribute = require('./attribute');
const DataTypes = require('./data_types');
const { escapeId, escape } = require('./sqlstring');
const schema = require('./schema');
const spellbook = require('./spellbook');

// SELECT users.id AS "users:id", ...
// => [ { users: { id, ... } } ]
function nest(rows, fields, spell) {
  const { Model } = spell;
  const { tableAlias } = Model;
  const results = [];

  for (const row of rows) {
    const result = {};
    const qualified = Object.keys(row).some(entry => entry.includes(':'));
    for (const key in row) {
      const parts = key.split(':');
      const [qualifier, column] = qualified
        ? (parts.length > 1 ? parts : ['', key])
        : [Model.attributeMap.hasOwnProperty(key) ? tableAlias : '', key];
      const obj = result[qualifier] || (result[qualifier] = {});
      obj[column] = row[key];
    }
    results.push(result);
  }

  return { rows: results, fields };
}

class Connection {
  constructor({ client, database, mode, pool }) {
    const { Database, OPEN_READWRITE, OPEN_CREATE } = client;
    if (mode == null) mode = OPEN_READWRITE | OPEN_CREATE;
    this.database = new Database(database, mode);
    this.pool = pool;
  }

  async query(query, values, spell) {
    const { sql, nestTables } = query.sql ? query : { sql: query };

    if (/^(?:pragma|select)/i.test(sql)) {
      const result = await this.all(sql, values);
      if (nestTables) return nest(result.rows, result.fields, spell);
      return result;
    }
    return await this.run(sql, values);
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

  release() {
    this.pool.releaseConnection(this);
  }

  async end() {
    const { connections } = this.pool;
    const index = connections.indexOf(this);
    if (index >= 0) connections.splice(index, 1);

    return await new Promise((resolve, reject) => {
      this.database.close(function(err) {
        if (err) reject(err);
        resolve();
      });
    });
  }
}

class Pool extends EventEmitter {
  constructor(opts) {
    super(opts);
    this.options = {
      connectionLimit: 10,
      ...opts,
      client: opts.client || 'sqlite3',
    };
    this.client = require(this.options.client);
    this.connections = [];
    this.queue = [];
  }

  async getConnection() {
    const { connections, queue, client, options } = this;
    for (const connection of connections) {
      if (connection.idle) {
        connection.idle = false;
        this.emit('acquire', connection);
        return connection;
      }
    }
    if (connections.length < options.connectionLimit) {
      const connection = new Connection({ ...options, client, pool: this });
      connections.push(connection);
      this.emit('acquire', connection);
      return connection;
    }
    await new Promise(resolve => queue.push(resolve));
    return await this.getConnection();
  }

  releaseConnection(connection) {
    connection.idle = true;
    this.emit('release', connection);

    const { queue } = this;
    while (queue.length > 0) {
      const task = queue.shift();
      task();
    }
  }
}

class SqliteDriver extends AbstractDriver {
  constructor(opts = {}) {
    super(opts);
    this.type = 'sqlite';
    this.pool = this.createPool(opts);
  }

  createPool(opts) {
    return new Pool(opts);
  }

  async getConnection() {
    return await this.pool.getConnection();
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

    const { logger } = this;
    const sql = logger.format(query, values, opts);
    const start = Date.now();
    let result;

    try {
      result = await connection.query(query, values, opts);
    } catch (err) {
      logger.logQueryError(sql, err, Date.now() - start, opts);
      throw err;
    } finally {
      if (!opts.connection) connection.release();
    }

    logger.logQuery(sql, Date.now() - start, opts);
    return result;
  }

  format(spell) {
    return spellbook.format(spell);
  }
};

Object.assign(SqliteDriver.prototype, {
  ...schema,
  Attribute,
  DataTypes,
  escape,
  escapeId,
});

module.exports = SqliteDriver;
