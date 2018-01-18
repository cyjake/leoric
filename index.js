'use strict'

/**
 * Entry module
 * @module
 */
const Bone = require('./lib/bone')
const Collection = require('./lib/collection')

const fs = require('fs')
const path = require('path')

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
 * - https://www.postgresql.org/docs/current/static/infoschema-columns.html
 *
 * @param {Pool}    pool
 * @param {string}  database
 * @param {Object}  schema
 */
async function schemaInfo(pool, database, tables) {
  const [results] = await new Promise((resolve, reject) => {
    pool.query(
      'SELECT table_name, column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_schema = ? AND table_name in (?)',
      [database, tables],
      function(err, results, fields) {
        if (err) reject(err)
        else resolve([results, fields])
      }
    )
  })
  const schema = {}
  for (const result of results) {
    const { table_name, column_name, data_type, is_nullable, column_default } = result
    const columns = schema[table_name] || (schema[table_name.toLocaleLowerCase()] = [])
    columns.push({
      name: column_name.toLocaleLowerCase(),
      type: data_type,
      isNullable: is_nullable,
      default: column_default
    })
  }
  return schema
}

async function tableInfo(pool, tables) {
  const queries = tables.map(table => {
    return new Promise((resolve, reject) => {
      pool.query(`PRAGMA table_info(${pool.escapeId(table)})`, (err, rows, fields) => {
        if (err) reject(err)
        else resolve([rows, fields])
      })
    })
  })
  const results = await Promise.all(queries)
  const schema = {}
  for (let i = 0; i < tables.length; i++) {
    const table = tables[i]
    const [rows] = results[i]
    const columns = rows.map(({ name, type, notnull, dflt_value, pk }) => {
      return { name, type, isNullable: notnull == 1, default: dflt_value }
    })
    schema[table] = columns
  }
  return schema
}

function findClient(name) {
  switch (name) {
    case 'mysql':
    case 'mysql2':
      return require('./lib/clients/mysql')
    case 'pg':
      return require('./lib/clients/pg')
    case 'sqlite3':
      return require('./lib/clients/sqlite')
    default:
      throw new Error(`Unsupported database ${name}`)
  }
}

/**
 * Connect models to database. Need to provide both the settings of the connection and the models, or the path of the models, to connect.
 * @alias module:index.connect
 * @param {Object} opts
 * @param {string} opts.client - client name
 * @param {string|Bone[]} opts.models - an array of models
 * @param {Object} opts.
 * @returns {Pool} the connection pool in case we need to perform raw query
 */
const connect = async function Jorma_connect(opts) {
  if (Bone.pool) return
  opts = Object.assign({ client: 'mysql', database: opts.db }, opts)
  const { client, database } = opts
  const pool = findClient(client)(opts)
  const models = typeof opts.models == 'string'
    ? (await readdir(opts.models)).map(entry => require(path.join(opts.models, entry)))
    : opts.models

  if (!(models && models.length > 0)) throw new Error('Unable to find any models')

  Bone.pool = pool
  Collection.pool = pool
  const query = client.includes('sqlite')
    ? tableInfo(pool, models.map(model => model.table))
    : schemaInfo(pool, database, models.map(model => model.table))
  const schema = await query
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
