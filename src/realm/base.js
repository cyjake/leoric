'use strict';

const Bone = require('../bone');
const AbstractDriver = require('../drivers/abstract');
const { camelCase } = require('../utils/string');
const { isBone } = require('../utils');
const sequelize = require('../adapters/sequelize');
const Raw = require('../raw').default;
const { LEGACY_TIMESTAMP_MAP } = require('../constants');
const assert = require('assert');

const SequelizeBone = sequelize(Bone);

/**
 *
 * @typedef {Object} QueryResult
 * @property {Array} rows
 * @property {Array} fields
 */

/**
 * construct model attributes entirely from column definitions
 * @param {Bone} model
 * @param {Array<string, Object>} columns column definitions
 */
function initAttributes(model, columns) {
  const attributes = {};

  for (const columnInfo of columns) {
    const { columnName, columnType, ...restInfo } = columnInfo;
    const name = columnName === '_id' ? columnName : camelCase(columnName);
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
    // assign driver if model's driver not exist
    if (!model.driver) model.driver = Spine.driver;
    // assign options if model's options not exist
    if (!model.options) model.options = Spine.options;
    const columns = schemaInfo[model.physicTable] || schemaInfo[model.table];
    if (!model.attributes) initAttributes(model, columns);
    model.load(columns);
  }

  for (const model of models) {
    model.initialize();
  }
}

function createSpine(opts) {
  let Model = Bone;
  if (opts.Bone && opts.Bone.prototype instanceof Bone) {
    Model = opts.Bone;
  } else if (opts.sequelize) {
    Model = SequelizeBone;
  }
  return opts.subclass === true ? class Spine extends Model {} : Model;
}

const rReplacementKey = /\s:(\w+)\b/g;

class BaseRealm {
  constructor(opts = {}) {
    const {
      dialect = 'mysql',
      dialectModulePath,
      client = dialectModulePath,
      database = opts.db || opts.storage,
      driver: CustomDriver,
      ...restOpts
    } = opts;
    const Spine = createSpine(opts);
    const models = {};

    if (Array.isArray(opts.models)) {
      for (const model of opts.models) models[model.name] = model;
    }

    const DriverClass = this.getDriverClass(CustomDriver, dialect);

    const driver = new DriverClass({
      client,
      database,
      ...restOpts,
    });

    const options = {
      client,
      dialect: driver.dialect,
      database,
      driver: DriverClass,
      ...restOpts,
      define: { underscored: true, ...opts.define },
    };

    this.Bone = Spine;
    this.models = Spine.models = models;
    this.driver = Spine.driver = driver;
    this.options = Spine.options = options;
  }

  getDriverClass(CustomDriver, dialect) {
    assert(CustomDriver && CustomDriver.prototype instanceof AbstractDriver, 'DriverClass must be a subclass of AbstractDriver');
    return CustomDriver;
  }

  define(name, attributes, opts = {}, descriptors = {}) {
    const Model = class extends this.Bone {
      static name = name;
    };
    Model.init(attributes, opts, descriptors);
    this.Bone.models[name] = Model;
    return Model;
  }

  async getModels() {
    return Object.values(this.models);
  }

  async connect() {
    let models = await this.getModels();

    for (const model of models) this.Bone.models[model.name] = model;
    // models could be connected already if cached
    models = models.filter(model => model.synchronized == null);

    if (models.length > 0) {
      await loadModels(this.Bone, models, this.options);
    }
    this.connected = true;
    return this.Bone;
  }

  async disconnect(callback) {
    if (this.connected && this.driver) {
      return await this.driver.disconnect(callback);
    }
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
      return ' ?';
    });

    const { rows, ...restRes } = await this.driver.query(query, values, opts);
    const results = [];

    if (rows && rows.length && opts.model && isBone(opts.model)) {
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
      ...restRes,
      rows: results.length > 0 ? results : rows,
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
    return BaseRealm.raw(sql);
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

  static SequelizeBone = SequelizeBone;
}

module.exports = BaseRealm;
