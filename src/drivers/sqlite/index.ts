import dayjs from 'dayjs';
import { performance } from 'perf_hooks';

import AbstractDriver, { ConnectOptions } from '../abstract';
import Attribute from './attribute';
import DataTypes from './data_types';
import { escapeId, escape, alterTableWithChangeColumn, parseDefaultValue } from './sqlstring';
import Spellbook from './spellbook';
import Pool from './pool';
import { calculateDuration } from '../../utils';
import { heresql } from '../../utils/string';
import { getIndexName } from '../abstract';
import { Literal, QueryOptions, QueryResult } from '../../types/common';
import Connection from './connection';
import { AbstractBone } from '../../abstract_bone';
import Spell from '../../spell';

interface SchemaColumn {
  columnName: string;
  columnType: string;
  dataType: string;
  defaultValue: any;
  allowNull: boolean;
  primaryKey: boolean;
  datetimePrecision: number | null;
}

interface SchemaInfo {
  [table: string]: SchemaColumn[];
}

interface ColumnDefinition {
  [columnName: string]: any;
}

interface IndexResult {
  name: string;
  unique: boolean;
  columns: string[];
}

class SqliteDriver extends AbstractDriver {
  static Spellbook = Spellbook;
  static Attribute = Attribute;
  static DataTypes = DataTypes;

  declare pool: Pool;

  constructor(opts: ConnectOptions) {
    super(opts);
    this.type = 'sqlite';
    this.pool = this.createPool(opts);
    this.Attribute = (this.constructor as typeof SqliteDriver).Attribute as any;
    this.DataTypes = (this.constructor as typeof SqliteDriver).DataTypes as any;

    this.escape = escape as any;
    this.escapeId = escapeId as any;
  }

  createPool(opts: ConnectOptions): Pool {
    return new Pool(opts);
  }

  async getConnection() {
    return await this.pool.getConnection();
  }

  async query<T extends typeof AbstractBone>(
    query: string | { sql: string; nestTables?: boolean },
    values?: Literal[],
    opts: Spell<T> | QueryOptions & { connection?: Connection } = {},
  ): Promise<QueryResult> {
    const connection = opts.connection || await this.getConnection();

    // node-sqlite3 does not support Date as parameterized value
    let processedValues = values;
    if (values && Array.isArray(values)) {
      processedValues = values.map((entry) => {
        if (entry instanceof Date) {
          return dayjs(entry).format('YYYY-MM-DD HH:mm:ss.SSS Z');
        }
        return entry;
      });
    }

    const { logger } = this;
    const logOpts = { ...opts, query };
    const sql = logger.format(query, processedValues, opts);
    const start = performance.now();
    let result: QueryResult;

    try {
      result = await connection.query(query, processedValues, opts);
    } catch (err) {
      logger.logQueryError(err as Error, sql, calculateDuration(start), logOpts);
      throw err;
    } finally {
      if (!opts.connection) (connection as Connection).release();
    }

    logger.tryLogQuery(sql, calculateDuration(start), logOpts, result);
    return result;
  }

  async querySchemaInfo(database: string | null, tables: string | string[]): Promise<SchemaInfo> {
    const tableList = [].concat(tables as any);

    const queries = tableList.map((table) => {
      return this.query(`PRAGMA table_info(${this.escapeId(table)})`);
    });
    const results = await Promise.all(queries);
    const schemaInfo: SchemaInfo = {};
    const rColumnType = /^(\w+)(?:\(([^)]+)\))?/i;
    const rDateType = /(?:date|datetime|timestamp)/i;

    for (let i = 0; i < tableList.length; i++) {
      const table = tableList[i];
      const { rows } = results[i];
      const columns = (rows as any[]).map((row) => {
        const { name, type, notnull, dflt_value, pk } = row;
        const columnType = type.toLowerCase();
        const match = columnType.match(rColumnType);
        const [, dataType, precision] = match || [];
        const primaryKey = pk === 1;

        const result: SchemaColumn = {
          columnName: name,
          columnType,
          defaultValue: parseDefaultValue(dflt_value, type),
          dataType: dataType,
          allowNull: primaryKey ? false : notnull === 0,
          primaryKey,
          datetimePrecision: rDateType.test(dataType) ? parseInt(precision || '0', 10) : null,
        };
        return result;
      });
      if (columns.length > 0) schemaInfo[table] = columns;
    }

    return schemaInfo;
  }

  async createTable(
    table: string,
    attributes: ColumnDefinition,
    opts: QueryOptions & { connection?: Connection } = {},
  ): Promise<void> {
    const chunks = [`CREATE TABLE ${escapeId(table)}`];
    const columns = Object.keys(attributes).map((name) => {
      const attribute = new (this.constructor as typeof SqliteDriver).Attribute(name, attributes[name]);
      return attribute.toSqlString();
    });
    chunks.push(`(${columns.join(', ')})`);
    await this.query(chunks.join(' '), [], opts);
  }

  async alterTable(table: string, changes: ColumnDefinition): Promise<void> {
    const chunks = [`ALTER TABLE ${escapeId(table)}`];
    const attributes = Object.keys(changes).map((name) => {
      const options = changes[name];
      if (options.remove) return { columnName: name, remove: true };
      return new (this.constructor as typeof SqliteDriver).Attribute(name, changes[name]);
    });

    // SQLite doesn't support altering column attributes with MODIFY COLUMN and adding a PRIMARY KEY column
    if (attributes.some((entry: any) => entry.modify || entry.primaryKey)) {
      await alterTableWithChangeColumn(this, table, attributes);
      return;
    }

    // SQLite can only add one column a time
    // - https://www.sqlite.org/lang_altertable.html
    for (const attribute of attributes) {
      if ((attribute as any).remove) {
        const { columnName } = attribute as any;
        await this.query(chunks.concat(`DROP COLUMN ${this.escapeId(columnName)}`).join(' '));
      } else {
        await this.query(chunks.concat(`ADD COLUMN ${(attribute as any).toSqlString()}`).join(' '));
      }
    }
  }

  async addColumn(table: string, name: string, params: any): Promise<void> {
    const attribute = new (this.constructor as typeof SqliteDriver).Attribute(name, params);
    const sql = heresql(`
      ALTER TABLE ${escapeId(table)}
      ADD COLUMN ${attribute.toSqlString()}
    `);
    await this.query(sql);
  }

  async changeColumn(table: string, name: string, params: any): Promise<void> {
    const attribute = new this.Attribute(name, params);
    const schemaInfo = await this.querySchemaInfo(null, table);
    const columns = schemaInfo[table];

    for (const entry of columns) {
      if (entry.columnName === attribute.columnName) {
        Object.assign(entry, attribute, { modify: true });
      }
    }

    await this.alterTable(table, columns as ColumnDefinition);
  }

  async removeColumn(table: string, name: string): Promise<void> {
    const attribute = new this.Attribute(name);
    (attribute as any).remove = true;
    const changes = [attribute];
    await alterTableWithChangeColumn(this, table, changes);
  }

  /**
   * SQLite has only got implicit table truncation.
   * - https://sqlite.org/lang_delete.html#the_truncate_optimization
   */
  async truncateTable(table: string): Promise<void> {
    await this.query(`DELETE FROM ${escapeId(table)}`);
  }

  async showIndexes(table: string, attributes: string[], opts: any = {}): Promise<IndexResult[]> {
    const { rows } = await this.query(`PRAGMA index_list(${this.escapeId(table)})`) as any;
    if (!rows || rows.length === 0) return [];
    const name = getIndexName(table, attributes, { ...opts, Attribute: this.Attribute });
    const indexes: IndexResult[] = [];
    for (const row of rows) {
      if (row.name !== name) continue;
      const indexInfo = (await this.query(`PRAGMA index_info(${this.escapeId(name)})`)) as any;
      const columns = indexInfo.rows.map((entry: any) => entry.name);
      indexes.push({
        name,
        unique: row.unique === 1,
        columns,
      });
    }
    return indexes;
  }
}

export default SqliteDriver;
