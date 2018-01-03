'use strict'

/**
 * Entry module
 * @module
 */
const Bone = require('./lib/bone')
const Collection = require('./lib/collection')

const fs = require('fs')
const mysql = require('mysql')
const path = require('path')

/**
 * Create a connection pool
 * @param {Object} opts
 * @param {string} opts.host
 * @param {string} opts.port
 * @param {string} opts.user
 * @param {string} opts.password
 * @param {string} opts.appName         - In some RDMS, appName is used as the name of the database
 * @param {string} opts.db
 * @param {string} opts.connectionLimit
 * @returns {Pool} the connection pool
 */
function createPool({ host, port, user, password, appName, db, connectionLimit }) {
  if (!host) {
    throw new Error('Please config sql server first.')
  }

  const pool = mysql.createPool({
    connectionLimit,
    host,
    port,
    user,
    password,
    // some RDMS use appName to locate the database instead of the actual db, though the table_schema stored in infomation_schema.columns is still the latter one.
    database: appName || db
  })

  return pool
}

function readdir(path, opts = {}) {
  return new Promise((resolve, reject) => {
    fs.readdir(path, opts, function(err, entries) {
      if (err) reject(err)
      else resolve(entries)
    })
  })
}

/**
 * Fetch column infomations from schema database
 *
 * - https://dev.mysql.com/doc/refman/5.7/en/columns-table.html
 *
 * @param {Pool}    pool
 * @param {string}  db
 * @param {Array}   tables
 */
function columnInfo(pool, db, tables) {
  return new Promise((resolve, reject) => {
    pool.query(
      'SELECT table_name, column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_schema = ? AND table_name in (?)',
      [db, tables],
      function(err, results, fields) {
        if (err) reject(err)
        else resolve([results, fields])
      }
    )
  })
}

/**
 * Connect models to database. Need to provide both the settings of the connection and the models, or the path of the models, to connect.
 * @alias module:index.connect
 * @param {Object} opts        - connect options
 * @param {string} opts.path   - path of the models
 * @param {string} opts.models - an array of models
 * @returns {Pool} the connection pool in case we need to perform raw query
 */
const connect = async function Jorma_connect(opts) {
  if (Bone.pool) return

  const models = opts.path
    ? (await readdir(opts.path)).map(entry => require(path.join(opts.path, entry)))
    : opts.models

  if (!(models && models.length > 0)) {
    throw new Error('Unable to find any models')
  }

  const pool = createPool(opts)

  Bone.pool = pool
  Collection.pool = pool
  const [results] = await columnInfo(pool, opts.db, models.map(m => m.table))
  const schema = {}

  for (const result of results) {
    const { table_name, column_name, data_type, is_nullable, column_default } = result
    const columns = schema[table_name] || (schema[table_name] = [])
    columns.push({
      name: column_name,
      type: data_type,
      isNullable: is_nullable,
      default: column_default
    })
  }

  for (const Model of models) {
    Model.describeTable(schema[Model.table])
  }
  Bone.models = models

  for (const Model of Bone.models) {
    Model.describe()
  }

  return pool
}


module.exports = { connect, Bone, Collection }
