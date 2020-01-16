'use strict';

const Bone = require('./bone');
const { snakeCase } = require('./utils/string');
const { findDriver } = require('./drivers');

const fs = require('fs').promises;
const path = require('path');

async function findModels(dir) {
  if (!dir || typeof dir !== 'string') {
    throw new Error(`Unexpected dir (${dir})`);
  }
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const models = [];

  for (const entry of entries) {
    const extname = path.extname(entry.name);
    if (entry.isFile() && ['.js', '.mjs'].includes(extname)) {
      const model = require(path.join(dir, entry.name));
      if (model.prototype instanceof Bone) models.push(model);
    }
  }

  return models;
}

async function loadModels(Model, models, opts) {
  const { database } = opts;
  const tables = models.map(model => model.tableName);
  const schemaInfo = await Model.driver.querySchemaInfo(database, tables);

  for (const model of models) {
    model.load(schemaInfo[model.tableName]);
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
  Model.options = { client, define, ...restOpts };

  if (define.underscored) {
    Model.timestamps = Object.keys(Model.timestamps).reduce((result, name) => {
      result[name] = snakeCase(name);
      return result;
    }, {});
  }

  if (dir) {
    const models = Array.isArray(dir) ? dir : (await findModels(dir));
    await loadModels(Model, models, restOpts);
  }

  return Model;
};

module.exports = connect;
