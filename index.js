'use strict'

/**
 * Entry module
 * @module
 */
const Bone = require('./lib/bone')
const Collection = require('./lib/collection')

const fs = require('fs').promises
const path = require('path')

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
  const sql = pool.Leoric_type == 'pg'
    ? 'SELECT table_name, column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_catalog = ? AND table_name = ANY (?)'
    : 'SELECT table_name, column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_schema = ? AND table_name in (?)'
  const values = [database, tables]
  const { rows } = await pool.Leoric_query(sql, values)
  const schema = {}

  for (const row of rows) {
    const name = row.TABLE_NAME || row.table_name
    const columns = schema[name] || (schema[name] = [])
    columns.push({
      name: row.COLUMN_NAME || row.column_name,
      type: row.DATA_TYPE || row.data_type,
      isNullable: row.IS_NULLABLE || row.is_nullable,
      default: row.COLUMN_DEFAULT || row.column_default
    })
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
    default:
      throw new Error(`Unsupported database ${name}`)
  }
}

async function requireModels(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  const models = []

  for (const entry of entries) {
    if (entry.isFile()) {
      const model = require(path.join(dir, entry.name))
      if (model.prototype instanceof Bone) models.push(model)
    }
  }

  return models
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
const connect = async function Leoric_connect(opts) {
  if (Bone.pool) return
  opts = Object.assign({ client: 'mysql', database: opts.db }, opts)
  const { client, database } = opts
  const pool = findClient(client)(opts)
  const dir = opts.model || opts.models
  const models = Array.isArray(dir) ? dir : (await requireModels(dir))

  if (models.length <= 0) throw new Error('Unable to find any models')

  Bone.pool = pool
  Collection.pool = pool

  const schema = await schemaInfo(pool, database, models.map(model => model.physicTable))
  for (const Model of models) {
    Model.describeTable(schema[Model.physicTable])
  }
  Bone.models = models

  for (const Model of Bone.models) {
    Model.describe()
  }

  return pool
}


module.exports = { connect, Bone, Collection }
