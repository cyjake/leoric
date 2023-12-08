'use strict';


const Logger = require('./drivers/abstract/logger');
const Spell = require('./spell');
const Bone = require('./bone');
const Collection = require('./collection');
const { invokable: DataTypes, LENGTH_VARIANTS } = require('./data_types');
const migrations = require('./migrations');
const sequelize = require('./adapters/sequelize');
const { heresql } = require('./utils/string');
const Hint = require('./hint');
const Realm = require('./realm');
const Decorators = require('./decorators');
const Raw = require('./raw').default;
const { MysqlDriver, PostgresDriver, SqliteDriver, SqljsDriver, AbstractDriver } = require('./drivers');
const { isBone } = require('./utils');
const { hookNames } = require('./setup_hooks');

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
const connect = async function connect(opts) {
  opts = { Bone, ...opts };
  if (opts.Bone.driver) throw new Error('connected already');
  const realm = new Realm(opts);
  await realm.connect();
  return realm;
};

const disconnect = async function disconnect(realm, ...args) {
  if (realm instanceof Realm && realm.connected) {
    return await realm.disconnect(...args);
  }
};

Object.assign(Realm.prototype, migrations, { DataTypes });
Object.assign(Realm, {
  default: Realm,
  connect,
  disconnect,
  Bone,
  Collection,
  DataTypes,
  Logger,
  Spell,
  sequelize,
  heresql,
  ...Hint,
  ...Decorators,
  MysqlDriver,
  PostgresDriver,
  SqliteDriver,
  SqljsDriver,
  AbstractDriver,
  Raw,
  LENGTH_VARIANTS,
  isBone,
  hookNames,
});

module.exports = Realm;
