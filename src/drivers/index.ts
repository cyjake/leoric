
import MysqlDriver from './mysql';
import PostgresDriver from './postgres';
import SqliteDriver from './sqlite';
import SqljsDriver from './sqljs';
import AbstractDriver from './abstract';

function findDriver(dialect: string): typeof AbstractDriver {
  switch (dialect) {
    case 'mysql':
      return MysqlDriver as unknown as typeof AbstractDriver;
    case 'pg':
    case 'postgres':
      return PostgresDriver as unknown as typeof AbstractDriver;
    case 'sqlite':
    case 'sqlite3':
      return SqliteDriver as unknown as typeof AbstractDriver;
    default:
      throw new Error(`Unsupported database ${dialect}`);
  }
}

export {
  findDriver,
  MysqlDriver,
  PostgresDriver,
  SqliteDriver,
  SqljsDriver,
  AbstractDriver,
};
