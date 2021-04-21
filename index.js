'use strict';

const fs = require('fs').promises;
const path = require('path');

const Bone = require('./lib/bone');
const Collection = require('./lib/collection');
const DataTypes = require('./lib/data_types');
const { findDriver } = require('./lib/drivers');
const migrations = require('./lib/migrations');
const sequelize = require('./lib/adapters/sequelize');
const { camelCase } = require('./lib/utils/string');
const Hint = require('./lib/hint');

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

const LEGACY_TIMESTAMP_MAP = {
  gmtCreate: 'createdAt',
  gmtModified: 'updatedAt',
  gmtDeleted: 'deletedAt',
};

function initAttributes(model, columns) {
  const attributes = {};

  for (const columnInfo of columns) {
    const { columnName, dataType } = columnInfo;
    const name = columnName == '_id' ? columnName : camelCase(columnName);
    attributes[ LEGACY_TIMESTAMP_MAP[name] || name ] = {
      ...columnInfo,
      type: model.driver.DataTypes.findType(dataType),
    };
  }

  model.init(attributes);
}

async function loadModels(Bone, models, opts) {
  const { database } = opts;
  const tables = models.map(model => model.physicTable);
  const schemaInfo = await Bone.driver.querySchemaInfo(database, tables);

  for (const model of models) {
    const columns = schemaInfo[model.physicTable];
    if (!model.attributes) initAttributes(model, columns);
    model.load(columns);
    Bone.models[model.name] = model;
  }

  for (const model of models) {
    model.describe();
  }
}

function createSpine(opts) {
  if (opts.Bone) return opts.Bone;
  if (opts.sequelize) return sequelize(Bone);
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

    // test/integration/suite/migrations.js currently depends on this behavior
    const driver = opts.driver || new (findDriver(dialect))({
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
    const { Bone } = this;
    const Model = class extends Bone {
      // export Model: instance.Model.name
      get Model() {
        return Model;
      }
      // export Model: class.Model.name
      static get Model() {
        return Model;
      }
    };
    Object.defineProperty(Model, 'name', { value: name });
    Model.init(attributes, opts, descriptors);
    Bone.models[name] = Model;
    return Model;
  }

  async connect() {
    const { Bone } = this;
    const { models: dir } = this.options;

    let models;
    if (dir) {
      models = Array.isArray(dir) ? dir : (await findModels(dir));
    } else {
      models = Object.values(this.models);
    }

    if (models.length > 0) await loadModels(Bone, models, this.options);
    this.connected = true;
    return Bone;
  }

  async sync() {
    if (!this.connected) await this.connect();
    const { models } = this;

    for (const model of Object.values(models)) {
      await model.sync();
    }
  }

  query(query, values, opts = {}) {
    return this.driver.query(query, values, opts);
  }

  async transaction(callback) {
    return await this.Bone.transaction(callback);
  }

  /**
   * raw sql object
   * @static
   * @param {string} sql
   * @returns {
   *  __raw: boolean,
   *  value: string,
   *  type: 'raw'
   * }
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
   * @returns
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
const connect = async function connect(opts = {}) {
  opts = { Bone, ...opts };
  const { Bone: Spine } = opts;
  if (Spine.driver) throw new Error('connected already');
  const realm = new Realm(opts);
  return await realm.connect();
};

Object.assign(Realm.prototype, migrations, { DataTypes });
Object.assign(Realm, { connect, Bone, Collection, DataTypes, sequelize, ...Hint });

module.exports = Realm;
