'use strict';

/**
 * Entry module
 * @module
 */
const Bone = require('./lib/bone');
const Collection = require('./lib/collection');
const { snakeCase } = require('./lib/utils/string');

const fs = require('fs').promises;
const path = require('path');

function findDriver(name) {
  switch (name) {
    case 'mysql':
    case 'mysql2':
      return require('./lib/drivers/mysql');
    case 'pg':
      return require('./lib/drivers/pg');
    case 'sqlite3':
      return require('./lib/drivers/sqlite');
    default:
      throw new Error(`Unsupported database ${name}`);
  }
}

async function findModels(dir) {
  if (!dir || typeof dir !== 'string') {
    throw new Error(`Unexpected dir (${dir})`);
  }
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const models = [];

  for (const entry of entries) {
    if (entry.isFile()) {
      const model = require(path.join(dir, entry.name));
      if (model.prototype instanceof Bone) models.push(model);
    }
  }

  return models;
}

async function initModels(Model, models, opts) {
  const { database } = opts;
  const tables = models.map(model => model.physicTable);
  const schemaInfo = await Model.driver.querySchemaInfo(database, tables);

  for (const model of models) {
    model.init(schemaInfo[model.physicTable]);
    Model[model.name] = model;
  }

  for (const model of models) {
    model.describe();
  }
}

/**
 * Connect models to database. Need to provide both the settings of the connection and the models, or the path of the models, to connect.
 * @alias module:index.connect
 * @param {Object} opts
 * @param {string} opts.client - client name
 * @param {string|Bone[]} opts.models - an array of models
 * @returns {Pool} the connection pool in case we need to perform raw query
 */
const connect = async function connect(opts = {}) {
  const { client, models: dir, define, Model, ...restOpts } = {
    Model: Bone,
    client: 'mysql',
    database: opts.db,
    ...opts,
    define: { underscored: false, ...opts.define },
  };

  if (Model.driver) throw new Error('connected already');

  Model.driver = new (findDriver(client))(client, restOpts);
  Model.defineConfig = define;

  if (define.underscored) {
    Model.timestamps = Object.keys(Model.timestamps).reduce((result, name) => {
      result[name] = snakeCase(name);
      return result;
    }, {});
  }

  if (dir) {
    const models = Array.isArray(dir) ? dir : (await findModels(dir));
    await initModels(Model, models, restOpts);
  }

  return Model;
};

module.exports = { connect, Bone, Collection };
