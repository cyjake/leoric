'use strict';


const Logger = require('./src/drivers/abstract/logger');
const Spell = require('./src/spell');
const Bone = require('./src/bone');
const Collection = require('./src/collection');
const { invokable: DataTypes } = require('./src/data_types');
const migrations = require('./src/migrations');
const sequelize = require('./src/adapters/sequelize');
const { heresql } = require('./src/utils/string');
const Hint = require('./src/hint');
const Realm = require('./src/realm');
const Decorators = require('./src/decorators');
const Raw = require('./src/raw');
const { MysqlDriver, PostgresDriver, SqliteDriver, AbstractDriver } = require('./src/drivers');

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

Object.assign(Realm.prototype, migrations, { DataTypes });
Object.assign(Realm, {
  default: Realm,
  connect,
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
  AbstractDriver,
  Raw,
});

module.exports = Realm;
