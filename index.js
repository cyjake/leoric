'use strict';

const fs = require('fs').promises;
const path = require('path');

const Logger = require('./src/drivers/abstract/logger');
const Spell = require('./src/spell');
const Bone = require('./src/bone');
const Collection = require('./src/collection');
const DataTypes = require('./src/data_types');
const { findDriver } = require('./src/drivers');
const migrations = require('./src/migrations');
const sequelize = require('./src/adapters/sequelize');
const { camelCase, heresql } = require('./src/utils/string');
const Hint = require('./src/hint');

/**
 * @typedef {Object} RawSql
 * @property {boolean} __raw
 * @property {string} value
 * @property {string} type
 */

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

function initAttributes(model, columns) {
  const attributes = {};

  for (const columnInfo of columns) {
    const { columnName, dataType } = columnInfo;
    const name = columnName == '_id' ? columnName : camelCase(columnName);
    attributes[name] = {
      ...columnInfo,
      type: model.driver.DataTypes.findType(dataType),
    };
  }

  model.init(attributes);
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
    model.describe();
    model.initialize();
  }
}

function createSpine(opts) {
  if (opts.Bone && opts.Bone.prototype instanceof Bone) return opts.Bone;
  if (opts.sequelize) return sequelize(Bone);
  if (opts.subclass !== true) return Bone;
  return class Spine extends Bone {};
}

class Realm {
  constructor(opts = {}) {
    const { client, dialect, database, ...restOpts } = {
      dialect: 'mysql',
      database: opts.db || opts.storage,
      ...opts
    };
    const Spine = createSpine(opts);
    const models = {};

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

    if (models.length > 0) {
      await loadModels(this.Bone, models, this.options);
    }
    this.connected = true;
    return this.Bone;
  }

  async sync() {
    if (!this.connected) await this.connect();
    const { models } = this;

    for (const model of Object.values(models)) {
      await model.sync();
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
    const { rows, fields, ...others } = await this.driver.query(query, values, opts);
    let results = [];
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
      rows: results.length? results : rows,
      fields,
      ...others
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
    return {
      __raw: true,
      value: sql,
      type: 'raw',
    };
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

/**
 * Connect models to database. Need to provide both connect options and models.
 * @alias module:index.connect
 * @param {Object} opts
 * @param {string} opts.client - client name
 * @param {string|Bone[]} opts.models - an array of models
 * @returns {Pool} the connection pool in case we need to perform raw query
 */
const connect = async function connect(opts) {
  opts = { Bone, ...opts };
  if (opts.Bone.driver) throw new Error('connected already');
  const realm = new Realm(opts);
  return await realm.connect();
};

Object.assign(Realm.prototype, migrations, { DataTypes });
Object.assign(Realm, {
  connect,
  Bone,
  Collection,
  DataTypes,
  Logger,
  Spell,
  sequelize,
  heresql,
  ...Hint,
});

module.exports = Realm;
