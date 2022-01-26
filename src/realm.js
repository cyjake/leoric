'use strict';

const fs = require('fs').promises;
const path = require('path');

const Bone = require('./bone');
const { findDriver } = require('./drivers');
const { camelCase } = require('./utils/string');
const sequelize = require('./adapters/sequelize');
const Raw = require('./raw');
const { LEGACY_TIMESTAMP_MAP } = require('./constants');

/**
 *
 * @typedef {Object} QueryResult
 * @property {Array} rows
 * @property {Array} fields
 */

/**
 * find models in directory
 * @param {string} dir
 * @returns {Array.<Bone>}
 */
async function findModels(dir) {
  if (!dir || typeof dir !== 'string') {
    throw new Error(`Unexpected models dir (${dir})`);
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

/**
 * construct model attributes entirely from column definitions
 * @param {Bone} model
 * @param {Array<string, Object>} columns column definitions
 */
function initAttributes(model, columns) {
  const attributes = {};

  for (const columnInfo of columns) {
    const { columnName, columnType, defaultValue, ...restInfo } = columnInfo;
    const name = columnName === '_id' ? columnName : camelCase(columnName);
    // leave out defaultValue to let database take over the default
    attributes[name] = {
      ...restInfo,
      columnName,
      type: model.driver.DataTypes.findType(columnType),
    };
  }

  for (const name in LEGACY_TIMESTAMP_MAP) {
    const newName = LEGACY_TIMESTAMP_MAP[name];
    if (attributes.hasOwnProperty(name) && !attributes.hasOwnProperty(newName)) {
      attributes[newName] = attributes[name];
      delete attributes[name];
    }
  }

  model.init(attributes, { timestamps: false });
}

async function loadModels(Spine, models, opts) {
  const { database } = opts;
  const tables = models.map(model => model.physicTable);
  const schemaInfo = await Spine.driver.querySchemaInfo(database, tables);

  for (const model of models) {
    const columns = schemaInfo[model.physicTable];
    if (!model.attributes) initAttributes(model, columns);
    model.load(columns);
    Spine.models[model.name] = model;
  }

  for (const model of models) {
    model.initialize();
  }
}

function createSpine(opts) {
  if (opts.Bone && opts.Bone.prototype instanceof Bone) return opts.Bone;
  if (opts.sequelize) return sequelize(Bone);
  if (opts.subclass !== true) return Bone;
  return class Spine extends Bone {};
}

const rReplacementKey = /\s:(\w+)\b/g;

class Realm {
  constructor(opts = {}) {
    const { client, dialect, database, ...restOpts } = {
      dialect: 'mysql',
      database: opts.db || opts.storage,
      ...opts
    };
    const Spine = createSpine(opts);
    const models = {};

    if (Array.isArray(opts.models)) {
      for (const model of opts.models) models[model.name] = model;
    }

    const driver = new (findDriver(dialect))({
      client,
      database,
      ...restOpts
    });

    const options = {
      client,
      dialect,
      database,
      ...restOpts,
      define: { underscored: true, ...opts.define },
    };

    this.Bone = Spine;
    this.models = Spine.models = models;
    this.driver = Spine.driver = driver;
    this.options = Spine.options = options;
  }

  define(name, attributes, opts = {}, descriptors = {}) {
    const Model = class extends this.Bone {
      static name = name;
    };
    Model.init(attributes, opts, descriptors);
    this.Bone.models[name] = Model;
    return Model;
  }

  async connect() {
    const { models: dir } = this.options;

    let models;
    if (dir) {
      models = Array.isArray(dir) ? dir : (await findModels(dir));
    } else {
      models = Object.values(this.models);
    }

    // models could be connected already if cached
    models = models.filter(model => !model.synchronized);

    if (models.length > 0) {
      await loadModels(this.Bone, models, this.options);
    }
    this.connected = true;
    return this.Bone;
  }

  async sync(options) {
    if (!this.connected) await this.connect();
    const { models } = this;

    for (const model of Object.values(models)) {
      await model.sync(options);
    }
  }

  /**
   * raw query
   * @param {string} query
   * @param {Array<any>} values
   * @param {Connection} opts.connection specific connection of this query, may used in a transaction
   * @param {Bone} opts.model target model to inject values
   * @returns {QueryResult}
   * @memberof Realm
   */
  async query(query, values, opts = {}) {
    if (values && typeof values === 'object' && !Array.isArray(values)) {
      if ('replacements' in values) {
        const { model, connection } = values;
        opts.replacements = values.replacements;
        if (model) opts.model = model;
        if (connection) opts.connection = connection;
      } else {
        opts.replacements = values;
      }
      values = [];
    }

    const replacements = opts.replacements || {};
    query = query.replace(rReplacementKey, function replacer(m, key) {
      if (!replacements.hasOwnProperty(key)) {
        throw new Error(`unable to replace: ${key}`);
      }
      values.push(replacements[key]);
      return '?';
    });

    const { rows, ...restRes } = await this.driver.query(query, values, opts);
    const results = [];

    if (rows && rows.length && opts.model && opts.model.prototype instanceof this.Bone) {
      const { attributeMap } = opts.model;

      for (const data of rows) {
        const instance = opts.model.instantiate(data);
        for (const key in data) {
          if (!attributeMap.hasOwnProperty(key)) instance[key] = data[key];
        }
        results.push(instance);
      }
    }

    return {
      rows: results.length > 0 ? results : rows,
      ...restRes
    };
  }

  async transaction(callback) {
    return await this.Bone.transaction(callback);
  }

  /**
   * raw sql object
   * @static
   * @param {string} sql
   * @returns {RawSql}
   * @memberof Realm
   */
  static raw(sql) {
    if (typeof sql !== 'string') {
      throw new TypeError('sql must be a string');
    }
    return new Raw(sql);
  }

  // instance.raw
  raw(sql) {
    return Realm.raw(sql);
  }

  /**
   * escape value
   * @param {string} value
   * @returns {string} escaped value
   * @memberof Realm
   */
  escape(value) {
    return this.driver.escape(value);
  }
}

module.exports = Realm;
