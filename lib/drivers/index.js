'use strict';

function findDriver(client) {
  switch (client) {
    case 'mysql':
    case 'mysql2':
      return require('./mysql');
    case 'pg':
    case 'postgres':
      return require('./postgres');
    case '@journeyapps/sqlcipher':
    case 'sqlite3':
      return require('./sqlite');
    default:
      throw new Error(`Unsupported database ${client}`);
  }
}

module.exports = { findDriver };
