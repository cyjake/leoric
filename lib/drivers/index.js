'use strict';

function findDriver(dialect) {
  switch (dialect) {
    case 'mysql':
      return require('./mysql');
    case 'pg':
    case 'postgres':
      return require('./postgres');
    case 'sqlite':
    case 'sqlite3':
      return require('./sqlite');
    default:
      throw new Error(`Unsupported database ${dialect}`);
  }
}

module.exports = { findDriver };
