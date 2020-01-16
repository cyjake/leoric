'use strict';

/**
 * Entry module
 * @module
 */
const Bone = require('./lib/bone');
const Collection = require('./lib/collection');
const connect = require('./lib/connect');
const DataTypes = require('./lib/data_types');
const migrations = require('./lib/migrations');

class Realm {
  constructor(opts) {
    // setup the default model to cope with legacy api
    this.Model = Bone;
    this.options = {
      client: 'mysql',
      database: opts.db,
      ...opts,
      define: { underscored: false, ...opts.define },
    };
  }

  get driver() {
    const { driver } = this.Model;
    if (!driver) throw new Error('database not connected yet');
    return driver;
  }

  async connect() {
    const Model = await connect(this.options);
    this.Model = Model;
    return Model;
  }
}

Object.assign(Realm.prototype, { ...migrations, DataTypes });
Object.assign(Realm, { connect, Bone, Collection, DataTypes });

module.exports = Realm;
