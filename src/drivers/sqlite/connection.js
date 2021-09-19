'use strict';

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
  constructor({ client, database: databasePath, mode, pool, busyTimeout }) {
    const { Database, OPEN_READWRITE, OPEN_CREATE } = client;
    if (mode == null) mode = OPEN_READWRITE | OPEN_CREATE;
    const database = new Database(databasePath, mode);
    // SQLITE_BUSY
    // - https://www.sqlite.org/rescode.html#busy
    // - https://www.sqlite.org/c3ref/busy_timeout.html
    // - https://github.com/mapbox/node-sqlite3/wiki/API#databaseconfigureoption-value
    if (busyTimeout > 0) database.configure('busyTimeout', busyTimeout);
    this.database = database;
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
      this.database.all(sql, values, function Leoric_all(err, rows, fields) {
        if (err) {
          reject(err);
        } else {
          resolve({ rows, fields });
        }
      });
    });
  }

  run(sql, values) {
    return new Promise((resolve, reject) => {
      this.database.run(sql, values, function Leoric_run(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ insertId: this.lastID, affectedRows: this.changes });
        }
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
    await this.close();
  }

  async close() {
    return await new Promise((resolve, reject) => {
      this.database.close(function Leoric_end(err) {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }
}

module.exports = Connection;
