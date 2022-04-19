'use strict';

const MySQLDriver = require('./mysql');
const PostgresDriver = require('./postgres');
const SQLiteDriver = require('./sqlite');
const AbstractDriver = require('./abstract');

function findDriver(dialect) {
  switch (dialect) {
    case 'mysql':
      return MySQLDriver;
    case 'pg':
    case 'postgres':
      return PostgresDriver;
    case 'sqlite':
    case 'sqlite3':
      return SQLiteDriver;
    default:
      throw new Error(`Unsupported database ${dialect}`);
  }
}

module.exports = {
  findDriver,
  MySQLDriver,
  PostgresDriver,
  SQLiteDriver,
  AbstractDriver,
};
