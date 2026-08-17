import { performance } from 'perf_hooks';

import AbstractDriver, { ConnectOptions } from '../abstract';
import Attribute from './attribute';
import DataTypes from './data_types';
import Spellbook from './spellbook';
import { calculateDuration } from '../../utils';
import { heresql } from '../../utils/string';
import { Literal, QueryOptions, QueryResult } from '../../types/common';

interface SchemaColumn {
  columnName: string;
  columnType: string;
  comment?: string;
  defaultValue: Literal;
  dataType: string;
  allowNull: boolean;
  primaryKey: boolean;
  unique: boolean;
  datetimePrecision: number | null;
}

type SchemaInfo = Record<string, SchemaColumn[]>;

type MysqlPool = any;
type MysqlConnection = any;
type MysqlOptions = ConnectOptions & {
  client?: string;
  appName?: string;
  connectionLimit?: number;
  connectTimeout?: number;
  charset?: string;
  stringifyObjects?: boolean;
  decimalNumbers?: boolean;
  supportBigNumbers?: boolean;
  bigNumberStrings?: boolean;
};

type Timer = ReturnType<typeof setTimeout>;

function includesConnection(connections: any, connection: MysqlConnection): boolean {
  if (!connections) return false;
  if (Array.isArray(connections)) return connections.includes(connection);
  if (typeof connections.get === 'function') {
    for (let index = 0; index < connections.length; index++) {
      if (connections.get(index) === connection) return true;
    }
  }
  return false;
}

class MysqlDriver extends AbstractDriver {
  static Spellbook = Spellbook;
  static Attribute = Attribute;
  static DataTypes = DataTypes;

  declare pool: MysqlPool;
  private poolPromise?: Promise<MysqlPool>;

  constructor(opts: MysqlOptions) {
    super(opts);
    this.type = 'mysql';
    this.Attribute = (this.constructor as typeof MysqlDriver).Attribute;
    this.DataTypes = (this.constructor as typeof MysqlDriver).DataTypes;
    this.spellbook = new (this.constructor as typeof MysqlDriver).Spellbook();
  }

  async createPool(opts: MysqlOptions): Promise<MysqlPool> {
    const database = opts.appName || opts.database;
    const client = opts.client || 'mysql';
    const {
      host,
      port,
      user,
      password,
      connectTimeout,
      connectionLimit,
      idleTimeout,
      charset,
      stringifyObjects = true,
      decimalNumbers = true,
      supportBigNumbers = true,
      bigNumberStrings,
    } = opts;

    if (client !== 'mysql' && client !== 'mysql2') {
      console.warn(`[leoric] mysql client "${client}" not tested`);
    }

    const module = await import(client);
    const mysql = module.default ?? module;
    return mysql.createPool({
      connectionLimit,
      idleTimeout,
      connectTimeout,
      host,
      port,
      user,
      password,
      database,
      charset,
      stringifyObjects,
      decimalNumbers,
      supportBigNumbers,
      bigNumberStrings,
    });
  }

  private async getPool(): Promise<MysqlPool> {
    if (!this.poolPromise) {
      this.poolPromise = this.createPool(this.options as MysqlOptions).then((pool) => {
        this.pool = pool;
        this.recycleIdleConnections(pool, (this.options as MysqlOptions).idleTimeout);
        return pool;
      });
    }

    try {
      return await this.poolPromise;
    } catch (error) {
      this.poolPromise = undefined;
      throw error;
    }
  }

  private recycleIdleConnections(pool: MysqlPool, idleTimeout?: number): void {
    if (!Number.isFinite(idleTimeout) || Number(idleTimeout) <= 0 || typeof pool.on !== 'function') return;
    const timeout = Number(idleTimeout);

    const timers = new WeakMap<MysqlConnection, Timer>();
    const clearTimer = (connection: MysqlConnection) => {
      const timer = timers.get(connection);
      if (timer) clearTimeout(timer);
      timers.delete(connection);
    };

    pool.on('acquire', clearTimer);
    pool.on('release', (connection: MysqlConnection) => {
      clearTimer(connection);
      const timer = setTimeout(() => {
        timers.delete(connection);
        if (includesConnection(pool._freeConnections, connection)) connection.destroy();
      }, timeout);
      timer.unref();
      timers.set(connection, timer);
    });
  }

  async getConnection(): Promise<MysqlConnection> {
    const pool = await this.getPool();
    return new Promise((resolve, reject) => {
      pool.getConnection((err: Error | null, connection: MysqlConnection) => {
        if (err) {
          reject(err);
        } else {
          resolve(connection);
        }
      });
    });
  }

  async query(
    query: string | { sql: string; nestedTables?: boolean },
    values?: Literal[],
    opts: QueryOptions & { connection?: MysqlConnection } = {},
  ): Promise<QueryResult> {
    const { logger } = this;
    const connection = opts.connection || await this.getConnection();
    const promise = new Promise<[QueryResult['rows'], QueryResult['fields']]>((resolve, reject) => {
      connection.query(query, values, (err: Error | null, results: any, fields: any) => {
        if (err) {
          reject(err);
        } else {
          resolve([ results, fields ]);
        }
      });
    });
    const sql = logger.format(query, values, opts);
    const logOpts = { ...opts, query };
    const start = performance.now();
    let result;

    try {
      result = await promise;
    } catch (err) {
      logger.logQueryError(err as Error, sql, calculateDuration(start), logOpts);
      throw err;
    } finally {
      if (!opts.connection) connection.release();
    }

    const [ results, fields ] = result;
    logger.tryLogQuery(sql, calculateDuration(start), logOpts, results);
    if (fields) return { rows: results, fields };
    return results as { insertId?: number; affectedRows?: number; };
  }

  async querySchemaInfo(database: string, tables: string | string[]): Promise<SchemaInfo> {
    const tableList = ([] as string[]).concat(tables);
    const sql = heresql(`
      SELECT table_name, column_name, column_type, data_type, is_nullable,
            column_default, column_key, column_comment,
            datetime_precision
        FROM information_schema.columns
      WHERE table_schema = ? AND table_name in (?)
      ORDER BY table_name, column_name
    `);

    const { rows } = await this.query(sql, [ database, tableList ]);
    const schemaInfo: SchemaInfo = {};

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    for (const entry of rows!) {
      const row = Object.keys(entry).reduce<Record<string, any>>((obj, name) => {
        obj[name.toLowerCase()] = entry[name];
        return obj;
      }, {});
      const tableName = row.table_name;
      const columns = schemaInfo[tableName] || (schemaInfo[tableName] = []);
      columns.push({
        columnName: row.column_name,
        columnType: row.column_type,
        comment: row.column_comment,
        defaultValue: row.column_default,
        dataType: row.data_type,
        allowNull: row.is_nullable === 'YES',
        primaryKey: row.column_key == 'PRI',
        unique: row.column_key == 'PRI' || row.column_key == 'UNI',
        datetimePrecision: row.datetime_precision,
      });
    }

    return schemaInfo;
  }

  async renameColumn(table: string, name: string, newName: string): Promise<void> {
    const { escapeId } = this;
    const { database } = this.options;
    const { columnName } = new this.Attribute(name);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const schemaInfo = await this.querySchemaInfo(database!, table);
    const { columnName: originColumnName, ...columnInfo } = schemaInfo[table].find(entry => {
      return entry.columnName == columnName;
    }) || {};

    if (!originColumnName) {
      throw new Error(`Unable to find column ${table}.${columnName}`);
    }

    const attribute = new this.Attribute(newName, { ...columnInfo });
    const sql = heresql(`
      ALTER TABLE ${escapeId(table)}
      CHANGE COLUMN ${escapeId(columnName)} ${attribute.toSqlString()}
    `);
    await this.query(sql);
  }

  async describeTable(table: string): Promise<Record<string, any>> {
    const { escapeId } = this;
    const { rows } = await this.query(`DESCRIBE ${escapeId(table)}`) as any;
    const result: Record<string, any> = {};
    for (const row of rows) {
      result[row.Field] = {
        columnName: row.Field,
        columnType: row.Type,
        allowNull: row.Null === 'YES',
        defaultValue: row.Default,
        autoIncrement: row.Extra === 'auto_increment',
      };
    }
    return result;
  }
}

export default MysqlDriver;
