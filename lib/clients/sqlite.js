'use strict'

const debug = require('debug')('leoric')

class Connection {
  constructor({ client, database, mode, pool }) {
    const { Database, OPEN_READWRITE } = require(client)
    this.db = new Database(database, mode || OPEN_READWRITE)
    this.pool = pool
  }

  async query(opts, values) {
    if (typeof opts === 'string') opts = { sql: opts }
    const { sql, nestTables } = opts
    if (values && values.length > 0) {
      debug(sql, values)
    } else {
      debug(sql)
    }

    return /^(?:pragma|select)/i.test(sql)
      ? this.all({ sql, nestTables }, values)
      : this.run(sql, values)
  }

  all(opts, values) {
    return new Promise((resolve, reject) => {
      this.db.all(opts, values, (err, rows, fields) => {
        if (err) reject(err)
        else resolve({ rows, fields })
      })
    })
  }

  run(sql, values) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, values, function Leoric_sqliteRun(err) {
        if (err) reject(err)
        else resolve({ insertId: this.lastID, affectedRows: this.changes })
      })
    })
  }

  release() {
    const { pool } = this

    pool.connections.push(this)
    while (pool.callbacks.length > 0) {
      const callback = pool.callbacks.shift()
      callback()
    }
  }

  Leoric_query(...args) {
    return this.query(...args)
  }
}

class Pool {
  constructor({ client, database, mode }) {
    this.connections = [
      new Connection({ client, database, mode, pool: this })
    ]
    this.callbacks = []
  }

  async query(...args) {
    const connection = await this.getConnection()
    const result = await connection.query(...args)

    connection.release()
    return result
  }

  async getConnection() {
    if (this.connections.length > 0) {
      return this.connections.shift()
    }

    await new Promise((resolve) => {
      this.callbacks.push(resolve)
    })

    return this.getConnection()
  }

  escapeId(identifier) {
    return `"${identifier.replace(/"/g, '""')}"`
  }

  get Leoric_type() {
    return 'sqlite'
  }

  Leoric_query(...args) {
    return this.query(...args)
  }

  Leoric_getConnection(...args) {
    return this.getConnection(...args)
  }
}

function Leoric_sqlite(opts) {
  const { client } = opts
  if (client == 'sqlite3') {
    return new Pool(opts)
  } else {
    throw new Error(`Unsupported sqlite client ${client}`)
  }
}

module.exports = Leoric_sqlite
