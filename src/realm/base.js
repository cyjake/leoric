'use strict';

const Bone = require('../bone');
const AbstractDriver = require('../drivers/abstract');
const { camelCase } = require('../utils/string');
const sequelize = require('../adapters/sequelize');
const Raw = require('../raw').default;
const { LEGACY_TIMESTAMP_MAP } = require('../constants');
const { rawQuery } = require('../raw');

const SequelizeBone = sequelize(Bone);

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

function createSpine(opts) {
  let Model = Bone;
  if (opts.Bone && opts.Bone.prototype instanceof Bone) {
    Model = opts.Bone;
  } else if (opts.sequelize) {
    Model = SequelizeBone;
  }
  return opts.subclass === true ? class Spine extends Model {} : Model;
}


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
    if (CustomDriver && CustomDriver.prototype instanceof AbstractDriver) {
      return CustomDriver;
    }
    throw new Error('DriverClass must be a subclass of AbstractDriver');
  }

  define(name, attributes, opts = {}, descriptors = {}) {
    const Model = class extends this.Bone {};
    Object.defineProperty(Model, 'name', {
      value: name,
      writable: false,
      enumerable: false,
      configurable: true,
    });
    Model.init(attributes, opts, descriptors);
    this.Bone.models[name] = Model;
    return Model;
  }

  async getModels() {
    return Object.values(this.models);
  }

  async loadModels(models, opts) {
    const { database } = opts;
    const tables = models.map(model => model.physicTable);
    const schemaInfo = await this.driver.querySchemaInfo(database, tables);

    for (const model of models) {
      if (!model.driver) model.driver = this.driver;
      if (!model.options) model.options = this.options;
      if (!model.models) model.models = this.models;
      const columns = schemaInfo[model.physicTable] || schemaInfo[model.table];
      if (!model.attributes) initAttributes(model, columns);
      model.load(columns);
    }

    for (const model of models) {
      model.initialize();
    }
  }

  async connect() {
    let models = await this.getModels();

    for (const model of models) this.Bone.models[model.name] = model;
    // models could be connected already if cached
    models = models.filter(model => model.synchronized == null);

    if (models.length > 0) {
      await this.loadModels(models, this.options);
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

  async query(sql, values, opts = {}) {
    return await rawQuery(this.driver, sql, values, opts);
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
