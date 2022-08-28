import { Spellbook, SpellMeta, Spell } from '../spell';
import { DataType, AbstractDataType } from '../data_types';
import { Attribute, Pool, ResultSet, Literal, QueryResult, AttributeMeta, ColumnMeta } from '../types/common';
import { AbstractBone } from '../types/bone';

export interface ConnectOptions {
  client?: 'mysql' | 'mysql2' | 'pg' | 'sqlite3' | '@journeyapps/sqlcipher';
  dialect?: 'mysql' | 'postgres' | 'sqlite';
  host?: string;
  port?: number | string;
  user?: string;
  password?: string;
  database: string;
  charset?: string;
  models?: string | (typeof AbstractBone)[];
  subclass?: boolean;
  driver?: typeof AbstractDriver;
}

export class AbstractDriver {

  static Spellbook: typeof Spellbook;
  static DataType: typeof DataType;
  static Attribute: typeof Attribute;

  /**
   * The type of driver, currently there are mysql, sqlite, and postgres
   */
  type: string;

  /**
   * The database current driver is using.
   */
  database: string;

  /**
   * The connection pool of the driver.
   */
  pool: Pool;

  /**
   * The SQL dialect
   */
  dialect: string;

  spellbook: Spellbook;

  DataType: DataType;

  Attribute: Attribute;

  constructor(options: ConnectOptions);

  escape: (v: string) => string;
  escapeId: (v: string) => string;

  /**
   * Grab a connection and query the database
   */
  query(sql: string | { sql: string, nestTables?: boolean}, values?: Array<Literal | Literal[]>, opts?: SpellMeta): Promise<QueryResult>;

  /**
   * disconnect manually
   * @param callback
   */
  disconnect(callback?: Function): Promise<boolean | void>;

  /**
   * query with spell
   * @param spell
   */
  cast(spell: Spell<typeof AbstractBone, ResultSet | number | null>): Promise<QueryResult>;

  /**
   * format spell
   * @param spell SpellMeta
   */
  format(spell: SpellMeta): any;

  /**
   * create table
   * @param tabe table name
   * @param attributes attributes
   */
  createTable(tabe: string, attributes: { [key: string]: AbstractDataType<DataType> | AttributeMeta }): Promise<void>;

  /**
   * alter table
   * @param tabe table name
   * @param attributes alter attributes
   */
  alterTable(tabe: string, attributes: { [key: string]: AbstractDataType<DataType> | AttributeMeta }): Promise<void>;

  /**
   * describe table
   * @param table table name
   */
  describeTable(table: string): Promise<{ [key: string]: ColumnMeta }>;

  /**
   * query table schemas
   * @param database database name
   * @param table table name or table name array
   */
  querySchemaInfo(database: string, table: string | string[]): Promise<{ [key: string] : { [key: string]: ColumnMeta }[]}>;

  /**
   * add column to table
   * @param table table name
   * @param name column name
   * @param params column meta info
   */
  addColumn(table: string, name: string, params: ColumnMeta): Promise<void>;

  /**
   * change column meta in table
   * @param table table name
   * @param name column name
   * @param params column meta info
   */
  changeColumn(table: string, name: string, params: ColumnMeta): Promise<void>;

  /**
   * remove column in table
   * @param table table name
   * @param name column name
   */
  removeColumn(table: string, name: string): Promise<void>;

  /**
   * rename column in table
   * @param table table name
   * @param name column name
   * @param newName new column name
   */
  renameColumn(table: string, name: string, newName: string): Promise<void>;

  /**
   * rename table
   * @param table table name
   * @param newTable new table name
   */
  renameTable(table: string, newTable: string): Promise<void>;

  /**
   * drop table
   * @param table table name
   */
  dropTable(table: string): Promise<void>;

  /**
   * truncate table
   * @param table table name
   */
  truncateTable(table: string): Promise<void>;

  /**
   * add index in table
   * @param table table name
   * @param attributes attributes name
   * @param opts
   */
  addIndex(table: string, attributes: string[], opts?: { unique?: boolean, type?: string }): Promise<void>;

  /**
   * remove index in table
   * @param table string
   * @param attributes attributes name
   * @param opts
   */
  removeIndex(table: string, attributes: string[], opts?: { unique?: boolean, type?: string }): Promise<void>;

}

export class MysqlDriver extends AbstractDriver {
  type: 'mysql';
  dialect: 'mysql';
}

export class PostgresDriver extends AbstractDriver {
  type: 'postgres';
  dialect: 'postgres';
}

export class SqliteDriver extends AbstractDriver {
  type: 'sqlite';
  dialect: 'sqlite';
}
