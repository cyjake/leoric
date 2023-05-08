'use strict';

const Logger = require('./src/drivers/abstract/logger');
const Spell = require('./src/spell');
const Bone = require('./src/bone');
const Collection = require('./src/collection');
const { invokable: DataTypes, LENGTH_VARIANTS } = require('./src/data_types');
const sequelize = require('./src/adapters/sequelize');
const { heresql } = require('./src/utils/string');

const Realm = require('./src/realm/base');
const AbstractDriver = require('./src/drivers/abstract');
const { isBone } = require('./src/utils');

/**
 * @typedef {Object} RawSql
 * @property {boolean} __raw
 * @property {string} value
 * @property {string} type
 */


/**
 * Connect models to database. Need to provide both connect options and models.
 * @alias module:index.connect
 * @param {Object} opts
 * @param {string} opts.client - client name
 * @param {string|Bone[]} opts.models - an array of models
 * @returns {Pool} the connection pool in case we need to perform raw query
 */
export const connect = async function connect(opts) {
  opts = { Bone, ...opts };
  if (opts.Bone.driver) throw new Error('connected already');
  const realm = new Realm(opts);
  await realm.connect();
  return realm;
};

export const disconnect = async function disconnect(realm, ...args) {
  if (realm instanceof Realm && realm.connected) {
    return await realm.disconnect(...args);
  }
};

Object.assign(Realm.prototype, { DataTypes });
export default Realm;

export { Bone };
export { Collection };
export { DataTypes };
export { Logger };
export { Spell };
export { sequelize };
export { heresql };
export * from './src/hint';
export * from './src/decorators';
export { AbstractDriver };
export { default as Raw } from './src/raw';
export { LENGTH_VARIANTS };
export { isBone };

// TODO: missing migrations and MYSQL, PG, SQLITE drivers
