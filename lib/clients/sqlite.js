'use strict'

const pool = {
  escapeId(identifier) {
    return `"${identifier.replace(/"/g, '""')}"`
  }
}

function createPool({ client, database, mode }) {
  const { Database, OPEN_READWRITE } = require(client)
  const promise = new Promise((resolve, reject) => {
    const db = new Database(database, mode || OPEN_READWRITE, err => {
      if (err) reject(err)
      else resolve(db)
    })
  })

  return Object.assign({
    client,
    query(opts, ...args) {
      const sql = typeof opts == 'string' ? opts : opts.sql
      if (/^pragma/i.test(sql)) {
        promise.then(db => db.all(sql, ...args))
      }
      else if (/^select/i.test(sql)) {
        promise.then(db => db.all({ sql, rowMode: opts.nestTables ? 'nest' : 'object' }, ...args))
      }
      else {
        const callback = args.pop()
        promise.then(db => db.run(sql, ...args, function Leoric_sqlite_run(err) {
          if (err) {
            callback(err)
          } else {
            callback(null, { insertId: this.lastID, affectedRows: this.changes })
          }
        }))
      }
    }
  }, pool)
}

function Leoric_sqlite(opts) {
  const { client } = opts
  if (client == 'sqlite3') {
    return createPool(opts)
  } else {
    throw new Error(`Unsupported sqlite client ${client}`)
  }
}

module.exports = Leoric_sqlite
