import SqlString from 'sqlstring';
import Debug from 'debug';

import Logger from './logger';
import Attribute, { AttributeParams } from './attribute';
import DataTypes from '../../data_types';
import Spellbook from './spellbook';
import { heresql, camelCase } from '../../utils/string';
import { AbstractBone } from '../../types/abstract_bone';
import { ColumnMeta, Connection, Literal, Pool, QueryOptions, QueryResult, ResultSet } from '../../types/common';
import Spell from '../../spell';

const debug = Debug('leoric');

export function getIndexName(
  table: string,
  attributes: string | string[],
  opts: { unique?: boolean; name?: string; type?: string, Attribute: typeof Attribute },
) {
  if (Array.isArray(attributes)) {
    const columns = attributes.map(entry => new opts.Attribute(entry).columnName);
    const type = opts.unique ? 'UNIQUE' : opts.type;
    const prefix = type === 'UNIQUE' ? 'uk' : 'idx';
    return [ prefix, table ].concat(columns.map(columnName => columnName.replace(/_/g, ''))).join('_');
  }
  if (typeof attributes === 'string') {
    return attributes;
  }
  throw new Error(`Unexpected index name: ${attributes}`);
}

export interface ConnectOptions {
  client?: 'mysql' | 'mysql2' | 'pg' | 'sqlite3' | '@journeyapps/sqlcipher' | string;
  dialect?: 'mysql' | 'postgres' | 'sqlite' | string;
  dialectModulePath?: string;
  host?: string;
  port?: number | string;
  user?: string;
  password?: string;
  database?: string;
  db?: string;
  storage?: string;
  charset?: string;
  models?: (typeof AbstractBone)[] | string;
  subclass?: boolean;
  driver?: typeof AbstractDriver;
  skipCloneValue?: boolean;
  define?: { underscored?: boolean; tableName?: string; hooks?: any  };
  logger?: Logger | {
    logQuery: (sql: string, duration?: string | number) => void,
    logQueryError: (err: Error, sql: string, duration?: string | number) => void,
    logMigration: (name: string) => void
  };
  idleTimeout?: number;
}


/**
 * Migration methods
 * - https://dev.mysql.com/doc/refman/8.0/en/create-table.html
 * - https://dev.mysql.com/doc/refman/8.0/en/alter-table.html
 */

/**
 * Abstract Driver Class
 */
export default class AbstractDriver {

  // define static properties as this way IDE will prompt
  static Spellbook = Spellbook;
  static Attribute = Attribute;
  static DataTypes = DataTypes;

  idleTimeout: number;
  options: ConnectOptions;

  /**
   * The type of driver, currently there are mysql, sqlite, and postgres
   */
  type: 'mysql' | 'sqlite' | 'postgres' | string = 'mysql';

  /**
   * The database current driver is using.
   */
  database = '';

  /**
   * The connection pool of the driver.
   */
  pool: Pool = {} as Pool;

  spellbook: Spellbook;

  logger: Logger;

  DataTypes: typeof DataTypes;

  Attribute: typeof Attribute;

  escape: (v: string) => string;
  escapeId: (v: string) => string;

  constructor(opts: ConnectOptions = {}) {
    const { logger } = opts;
    this.logger = logger instanceof Logger ? logger : new Logger(logger);
    this.idleTimeout = opts.idleTimeout || 60;
    this.options = opts;
    this.Attribute = (this.constructor as typeof AbstractDriver).Attribute;
    this.DataTypes = (this.constructor as typeof AbstractDriver).DataTypes;
    this.spellbook = new (this.constructor as typeof AbstractDriver).Spellbook();
    this.escape = SqlString.escape;
    this.escapeId = SqlString.escapeId;
  }

  /**
   * query with spell
   * @param {Spell} spell
   * @returns
   */
  async cast<T extends typeof AbstractBone>(spell: Spell<T, ResultSet<T> | number | null>): Promise<QueryResult> {
    const { sql, values } = this.format(spell);
    const query = { sql, nestTables: spell.command === 'select' };
    return await this.query(query, values, spell);
  }

  /**
   * raw query
   */
  async query(
    query: string | { sql: string, nestTables?: boolean},
    values?: Literal[] | { [key: string]: Literal },
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    opts: QueryOptions & { command?: string } = {},
  ): Promise<QueryResult> {
    throw new Error('unimplemented!');
  }

  async getConnection(): Promise<Connection> {
    throw new Error('unimplemented!');
  }

  /**
   * disconnect manually
   * @param {Function} callback
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async disconnect(callback?: () => Promise<void>): Promise<void> {
    debug('[disconnect] called');
  }

  get dialect(): 'mysql' | 'sqlite' | 'postgres' | string {
    return camelCase(this.constructor.name.replace('Driver', ''));
  }

  /**
   * use spellbook to format spell
   * @param {Spell} spell
   * @returns
   */
  format<T extends typeof AbstractBone>(spell: Spell<T, ResultSet<T> | number | null>) {
    return this.spellbook.format(spell);
  }

  /**
   * create table
   * @param tabe table name
   * @param attributes attributes
   */
  async createTable(table: string, attributes: Record<string, AttributeParams>) {
    const { escapeId } = this;
    const chunks = [ `CREATE TABLE ${escapeId(table)}` ];
    const columns = Object.keys(attributes).map(name => {
      const attribute = new this.Attribute(name, attributes[name]);
      return attribute.toSqlString();
    });
    chunks.push(`(${columns.join(', ')})`);
    await this.query(chunks.join(' '));
  }

  /**
   * alter table
   * @param tabe table name
   * @param attributes alter attributes
   */
  async alterTable(table: string, attributes: Record<string, any>) {
    const { escapeId } = this;
    const chunks = [ `ALTER TABLE ${escapeId(table)}` ];

    const actions = Object.keys(attributes).map(name => {
      const options = attributes[name];
      // { [columnName]: { remove: true } }
      if (options.remove) return `DROP COLUMN ${escapeId(name)}`;
      const attribute = new this.Attribute(name, options);
      return [
        options.modify ? 'MODIFY COLUMN' : 'ADD COLUMN',
        attribute.toSqlString(),
      ].join(' ');
    });
    chunks.push(actions.join(', '));
    await this.query(chunks.join(' '));
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  querySchemaInfo(database: string, table: string | string[]): Promise<Record<string, Array<ColumnMeta & { columnName: string }>>> {
    throw new Error('unimplemented!');
  }

  /**
   * describe table
   * @param table table name
   */
  async describeTable(table: string) {
    const { database } = this.options;
    const schemaInfo = await this.querySchemaInfo(database || '', table);
    return schemaInfo[table].reduce(function(result: Record<string, ColumnMeta>, column: { columnName: string }) {
      result[column.columnName] = column;
      return result;
    }, {});
  }

  /**
   * add column to table
   * @param table table name
   * @param name column name
   * @param params column meta info
   */
  async addColumn(table: string, name: string, params: ColumnMeta) {
    const { escapeId } = this;
    const attribute = new this.Attribute(name, params);
    const sql = heresql(`
      ALTER TABLE ${escapeId(table)}
      ADD COLUMN ${attribute.toSqlString()}
    `);
    await this.query(sql);
  }

  /**
   * change column meta in table
   * @param table table name
   * @param name column name
   * @param params column meta info
   */
  async changeColumn(table: string, name: string, params: ColumnMeta) {
    const { escapeId } = this;
    const attribute = new this.Attribute(name, params);
    const sql = heresql(`
      ALTER TABLE ${escapeId(table)}
      MODIFY COLUMN ${attribute.toSqlString()}
    `);
    await this.query(sql);
  }

  /**
   * remove column in table
   * @param table table name
   * @param name column name
   */
  async removeColumn(table: string, name: string) {
    const { escapeId } = this;
    const { columnName } = new this.Attribute(name);
    const sql = heresql(`
      ALTER TABLE ${escapeId(table)} DROP COLUMN ${escapeId(columnName)}
    `);
    await this.query(sql);
  }

  /**
   * rename column in table
   * @param table table name
   * @param name column name
   * @param newName new column name
   */
  async renameColumn(table: string, name: string, newName: string) {
    const { escapeId } = this;
    const { columnName } = new this.Attribute(name);
    const attribute = new this.Attribute(newName);
    const sql = heresql(`
      ALTER TABLE ${escapeId(table)}
      RENAME COLUMN ${escapeId(columnName)} TO ${escapeId(attribute.columnName)}
    `);
    await this.query(sql);
  }

  /**
   * rename table
   * @param table table name
   * @param newTable new table name
   */
  async renameTable(table: string, newTable: string) {
    const { escapeId } = this;
    const sql = heresql(`
      ALTER TABLE ${escapeId(table)} RENAME TO ${escapeId(newTable)}
    `);
    await this.query(sql);
  }

  /**
   * drop table
   * @param table table name
   */
  async dropTable(table: string) {
    const { escapeId } = this;
    await this.query(`DROP TABLE IF EXISTS ${escapeId(table)}`);
  }

  /**
   * truncate table
   * @param table table name
   */
  async truncateTable(table: string) {
    const { escapeId } = this;
    await this.query(`TRUNCATE TABLE ${escapeId(table)}`);
  }

  /**
   * show indexes in table
   * @param table table name
   */
  async showIndexes(
    table: string,
    attributes?: string | string[],
    opts: { unique?: boolean; name?: string; type?: string } = {},
  ) {
    const { escape, escapeId } = this;
    const chunks = [`SHOW INDEX FROM ${escapeId(table)}`];
    if (attributes) {
      const name = getIndexName(table, attributes, { ...opts, Attribute: this.Attribute });
      chunks.push(`WHERE Key_name = ${escape(name)}`);
    }
    const { rows } = await this.query(chunks.join(' '));
    if (!rows) return [];
    const indexes: { name: string; columns: string[]; unique: boolean; }[] = [];
    for (const row of rows) {
      const idx = indexes.find(entry => entry.name === row.Key_name);
      if (idx) {
        idx.columns.push(row.Column_name as string);
      } else {
        indexes.push({
          name: row.Key_name as string,
          columns: [ row.Column_name as string ],
          unique: row.Non_unique === 0,
        });
      }
    }
    return indexes;
  }

  /**
   * add index in table
   * @param table table name
   * @param attributes attributes name
   * @param opts
   */
  async addIndex(table: string, attributes: string[], opts: { unique?: boolean; name?: string; type?: string } = {}) {
    const { escapeId } = this;
    const columns = attributes.map(name => new this.Attribute(name).columnName);
    const type = opts.unique ? 'UNIQUE' : opts.type;
    const name = getIndexName(table, attributes, { ...opts, Attribute: this.Attribute });

    if (type != null && ![ 'UNIQUE', 'FULLTEXT', 'SPATIAL' ].includes(type)) {
      throw new Error(`Unexpected index type: ${type}`);
    }

    const sql = heresql(`
      CREATE ${type ? `${type} INDEX` : 'INDEX'} ${escapeId(name)}
      ON ${escapeId(table)} (${columns.map(columnName => escapeId(columnName)).join(', ')})
    `);
    await this.query(sql);
  }

  /**
   * remove index in table
   * @param table string
   * @param attributes attributes name
   * @param opts
   */
  async removeIndex(table: string, attributes: string | string[], opts: { unique?: boolean; name?: string; type?: string } = {}) {
    const { escapeId } = this;
    const name = getIndexName(table, attributes, { Attribute: this.Attribute, ...opts });
    const sql = this.type === 'mysql'
      ? `DROP INDEX ${escapeId(name)} ON ${escapeId(table)}`
      : `DROP INDEX IF EXISTS ${escapeId(name)}`;
    await this.query(sql);
  }

  async rollback(opts: { connection?: Connection}) {
    const connection = opts.connection || await this.getConnection();
    return await this.query('ROLLBACK', [], { command: 'ROLLBACK', ...opts, connection });
  }

  async commit(opts: { connection?: Connection}) {
    const connection = opts.connection || await this.getConnection();

    return await this.query('COMMIT', [], { command: 'COMMIT', ...opts, connection });
  }

  async begin(opts: { connection?: Connection}) {
    const connection = opts.connection || await this.getConnection();
    return await this.query('BEGIN', [], { command: 'BEGIN', ...opts, connection });
  }
}
