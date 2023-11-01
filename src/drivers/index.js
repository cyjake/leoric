'use strict';

const MysqlDriver = require('./mysql');
const PostgresDriver = require('./postgres');
const SqliteDriver = require('./sqlite');
const { default: SqljsDriver } = require('./sqljs');
const AbstractDriver = require('./abstract');

function findDriver(dialect) {
  switch (dialect) {
    case 'mysql':
      return MysqlDriver;
    case 'pg':
    case 'postgres':
      return PostgresDriver;
    case 'sqlite':
    case 'sqlite3':
      return SqliteDriver;
    default:
      throw new Error(`Unsupported database ${dialect}`);
  }
}

module.exports = {
  findDriver,
  MysqlDriver,
  PostgresDriver,
  SqliteDriver,
  SqljsDriver,
  AbstractDriver,
};
