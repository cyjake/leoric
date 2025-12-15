import Logger from './drivers/abstract/logger';
import Spell from './spell';
import Bone from './bone';
import Collection from './collection';
import { invokable as DataTypes, LENGTH_VARIANTS } from './data_types';
import { heresql } from './utils/string';

import Realm from './realm/base';
import AbstractDriver from './drivers/abstract';
import { isBone } from './utils';

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
export async function connect(opts: ConnectOptions & { Bone?: typeof Bone }): Promise<InstanceType<typeof Realm>> {
  opts = { Bone, ...opts };
  if (opts.Bone?.driver) throw new Error('connected already');
  const realm = new Realm(opts);
  await realm.connect();
  return realm;
}

export  async function disconnect(realm: InstanceType<typeof Realm>, callback: () => Promise<void>): Promise<void> {
  if (realm instanceof Realm && realm.connected) {
    return await realm.disconnect(callback);
  }
}

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
