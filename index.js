'use strict';

/**
 * Entry module
 * @module
 */
const Bone = require('./lib/bone');
const Collection = require('./lib/collection');
const connect = require('./lib/connect');
const DataTypes =require('./lib/data_types');
const migrations = require('./lib/migrations');
const sequelize = require('./lib/adapters/sequelize');

class Realm {
  constructor(opts = {}) {
    const { client, dialect, database, Bone: Osteon, ...restOpts } = {
      client: opts.dialect || 'mysql',
      database: opts.db || opts.storage,
      Bone: class Spine extends Bone {},
      ...opts
    };
    const Spine = dialect ? sequelize(Osteon) : Osteon;

    this.Bone = Spine;
    this.models = Spine.models = {};
    this.options = Spine.options = {
      client,
      dialect,
      database,
      ...restOpts,
      define: { underscored: true, ...opts.define },
    };

    const { define } = this.options;
    for (const prop of [ 'createdAt', 'updatedAt', 'deletedAt' ]) {
      if (!define.hasOwnProperty(prop)) define[prop] = prop;
    }
  }

  get driver() {
    const { driver } = this.Bone;
    if (!driver) throw new Error('database not connected yet');
    return driver;
  }

  define(name, attributes, opts = {}) {
    const { Bone } = this;
    const Model = class extends Bone {};
    Object.defineProperty(Model, 'name', { value: name });
    Model.init(attributes, opts);
    Bone.models[name] = Model;
    return Model;
  }

  async connect() {
    await connect({ ...this.options, Bone: this.Bone });
  }

  async sync() {
    const { Bone } = this;
    if (!Bone.driver) await this.connect();

    for (const model of Object.values(Bone.models)) {
      await model.sync();
    }
  }
}

Object.assign(Realm.prototype, migrations, { DataTypes });
Object.assign(Realm, { connect, Bone, Collection, DataTypes, sequelize });

module.exports = Realm;
