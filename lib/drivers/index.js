'use strict';

function findDriver(name) {
  switch (name) {
    case 'mysql':
    case 'mysql2':
      return require('./mysql');
    case 'pg':
    case 'postgres':
      return require('./postgres');
    case 'sqlite':
    case 'sqlite3':
      return require('./sqlite');
    default:
      throw new Error(`Unsupported database ${name}`);
  }
}

module.exports = { findDriver };
