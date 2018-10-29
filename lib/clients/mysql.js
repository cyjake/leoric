'use strict'

/**
 * Create a connection pool
 * @param {Object} opts
 * @param {string} opts.client
 * @param {string} opts.host
 * @param {string} opts.port
 * @param {string} opts.user
 * @param {string} opts.password
 * @param {string} opts.appName         - In some RDMS, appName is used as the name of the database
 * @param {string} opts.database
 * @param {string} opts.connectionLimit
 * @returns {Pool} the connection pool
 */
function Leoric_mysql({ client, host, port, user, password, appName, database, connectionLimit }) {
  if (client != 'mysql' && client != 'mysql2') {
    throw new Error(`Unsupported mysql client ${client}`)
  }
  return require(client).createPool({
    connectionLimit,
    host,
    port,
    user,
    password,
    // some RDMS use appName to locate the database instead of the actual db, though the table_schema stored in infomation_schema.columns is still the latter one.
    database: appName || database
  })
}

module.exports = Leoric_mysql
