const Logger = require('./drivers/abstract/logger');
const Spell = require('./spell');
const Bone = require('./bone');
const Collection = require('./collection');
const { invokable: DataTypes, LENGTH_VARIANTS } = require('./data_types');
const { heresql } = require('./utils/string');

const Realm = require('./realm/base');
const AbstractDriver = require('./drivers/abstract');
const { isBone } = require('./utils');

import { ConnectOptions } from './drivers/abstract';

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
export const connect = async function connect(opts: ConnectOptions & { Bone?: typeof Bone }): Promise<InstanceType<typeof Realm>> {
  opts = { Bone, ...opts };
  if (opts.Bone.driver) throw new Error('connected already');
  const realm = new Realm(opts);
  await realm.connect();
  return realm;
};

export const disconnect = async function disconnect(realm: InstanceType<typeof Realm>, ...args: unknown[]) {
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
export * from './adapters/sequelize';
export { heresql };
export * from './hint';
export * from './decorators';
export { AbstractDriver };
export { default as Raw } from './raw';
export { LENGTH_VARIANTS };
export { isBone };

// TODO: missing migrations and MYSQL, PG, SQLITE drivers
