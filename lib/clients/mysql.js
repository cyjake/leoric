'use strict'

const debug = require('debug')('leoric')
const SqlString = require('sqlstring')

const Leoric_connection = {
  async Leoric_query(opts, values) {
    if (typeof opts === 'string') opts = { sql: opts }
    const { sql, nestTables } = opts
    const [results, fields] = await new Promise((resolve, reject) => {
      this.query({ sql, nestTables}, values, (err, results, fields) => {
        if (err) {
          reject(err)
        } else {
          resolve([results, fields])
        }
      })
      debug(SqlString.format(sql, values))
    })

    if (fields) {
      return { rows: results, fields }
    } else {
      return results
    }
  }
}

/**
 * Create a connection pool
 * @param {Object} opts
 * @param {string} opts.client
 * @param {string} opts.host
 * @param {string} opts.port
 * @param {string} opts.user
 * @param {string} opts.password
 * @param {string} opts.appName         - In some RDMS, appName is used as the actual name of the database
 * @param {string} opts.database
 * @param {string} opts.connectionLimit
 * @returns {Pool} the connection pool
 */
function Leoric_mysql(opts) {
  const {
    client, host, port, user, password, appName, database, charset, connectionLimit,
  } = { client: 'mysql', ...opts }

  if (!/^mysql2?$/.test(client)) {
    throw new Error(`Unsupported mysql client ${client}`)
  }

  const pool = require(client).createPool({
    connectionLimit,
    host,
    port,
    user,
    password,
    // some RDMS use appName to locate the database instead of the actual db, though the table_schema stored in infomation_schema.columns is still the latter one.
    database: appName || database,
    charset,
  })

  return Object.assign(pool, {
    Leoric_type: 'mysql',
    Leoric_getConnection() {
      return new Promise((resolve, reject) => {
        pool.getConnection((err, connection) => {
          if (err) reject(err)
          else resolve(Object.assign(connection, Leoric_connection))
        })
      })
    }
  }, Leoric_connection)
}

module.exports = Leoric_mysql
