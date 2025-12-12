import Logger from './drivers/abstract/logger';
import Spell from './spell';
import Bone from './bone';
import Collection from './collection';
import { invokable as DataTypes, LENGTH_VARIANTS } from './data_types';
import migrations from './migrations';
import sequelize from './adapters/sequelize';
import { heresql } from './utils/string';
import Realm from './realm';
import { default as Raw, raw } from './raw';
import { isBone } from './utils';
import { hookNames } from './setup_hooks';

import * as decorators from './decorators';
import * as drivers from './drivers';
import * as hints from './hint';
import { ConnectOptions } from './drivers/abstract';

export * from './decorators';
export * from './drivers';
export * from './hint';
export { default as sequelize, SequelizeBone } from './adapters/sequelize';

export type * from './types/common';
export * from './spell';
export { hookNames } from './setup_hooks';

/**
 * Connect models to database. Need to provide both connect options and models.
 * @alias module:index.connect
 * @param {Object} opts
 * @param {string} opts.client - client name
 * @param {string|Bone[]} opts.models - an array of models
 * @returns {Pool} the connection pool in case we need to perform raw query
 * @example
 * connect({
 *   host: 'localhost',
 *   user: 'root',
 *   database: 'leoric',
 *   models: path.join(__dirname, 'models')
 * })
 */
export async function connect(opts: ConnectOptions & { Bone?: typeof Bone }): Promise<Realm> {
  const options = { Bone, ...opts };
  if (options.Bone.driver) throw new Error('connected already');
  const realm = new Realm(options);
  await realm.connect();
  return realm;
}

export async function disconnect(realm: Realm, callback?: () => Promise<void>) {
  if (realm instanceof Realm && realm.connected) {
    return await realm.disconnect(callback);
  }
}

Object.assign(Realm.prototype, migrations);
Object.assign(Realm, {
  connect,
  disconnect,
  Bone,
  Collection,
  DataTypes,
  Logger,
  Spell,
  sequelize,
  heresql,
  ...decorators,
  ...drivers,
  ...hints,
  Raw,
  raw,
  LENGTH_VARIANTS,
  isBone,
  hookNames,
  default: Realm,
});

module.exports = Realm;

export default Realm;

export {
  Bone,
  Collection,
  DataTypes,
  LENGTH_VARIANTS,
  Logger,
  Spell,
  heresql,
  Raw,
  raw,
};
