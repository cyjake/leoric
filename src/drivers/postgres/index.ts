import { performance } from 'perf_hooks';

import AbstractDriver, { getIndexName, ConnectOptions } from '../abstract';
import Attribute from './attribute';
import DataTypes from './data_types';
import {
  escape, escapeId, formatAddColumn,
  formatAlterColumns, formatDropColumn,
  cast, nest, parameterize,
} from './sqlstring';

import Spellbook from './spellbook';
import { calculateDuration } from '../../utils';
import { heresql } from '../../utils/string';
// import type Spell from '../../spell';

class PostgresDriver extends AbstractDriver {
  static Spellbook = Spellbook;
  static Attribute = Attribute;
  static DataTypes = DataTypes;

  constructor(opts: ConnectOptions) {
    super(opts);
    this.type = 'postgres';
    this.pool = this.createPool(opts);
    this.Attribute = (this.constructor as typeof PostgresDriver).Attribute;
    this.DataTypes = (this.constructor as typeof PostgresDriver).DataTypes;
    this.spellbook = new (this.constructor as typeof PostgresDriver).Spellbook();

    this.escape = escape;
    this.escapeId = escapeId;
  }

  createPool(opts: any) {
    const { host, port, user, password, database } = opts;
    require('./type_parser');
    const { Pool } = require('pg');
    return new Pool({ host, port, user, password, database });
  }

  async getConnection() {
    // pg Pool supports connect() with callback or promise; cast to any for TS
    return await (this.pool as any).connect();
  }

  async query(query: any, values?: any, spell: any = {}) {
    const { sql, nestTables } = typeof query === 'string' ? { sql: query } : query;
    const { text } = parameterize(sql, values);
    const { logger } = this;
    const connection = spell.connection || await this.getConnection();
    const command = sql.slice(0, sql.indexOf(' ')).toLowerCase();

    const tryQuery = async (...args: any[]): Promise<any> => {
      const logOpts = { ...spell, query: sql };
      const formatted = logger.format(sql, values, spell);
      const start = performance.now();
      let result: any;

      try {
        result = await (connection as any).query(...args);
      } catch (err) {
        logger.logQueryError(err as Error, formatted, calculateDuration(start), logOpts);
        throw err;
      } finally {
        if (!spell.connection) connection.release();
      }

      logger.tryLogQuery(formatted, calculateDuration(start), logOpts, result);
      return result;
    };

    switch (command) {
      case 'select': {
        if (nestTables) {
          const { rows, fields } = await tryQuery({ text, rowMode: 'array' }, values);
          return nest(rows, fields, spell);
        }
        return await tryQuery(text, values);
      }
      case 'insert': {
        const result = await tryQuery({ text, values });
        const { rowCount, fields } = result;
        const rows = result.rows.map((entry: any) => {
          const row: any = {};
          for (const field of fields) {
            row[field.name] = cast(entry[field.name], field);
          }
          return row;
        });
        let insertId: any;
        const { primaryColumn } = spell.Model || {};
        if (primaryColumn) insertId = rows[0][primaryColumn];
        return { ...result, insertId, affectedRows: rowCount, rows };
      }
      case 'update':
      case 'delete': {
        const { rowCount: affectedRows } = await tryQuery(text, values);
        return { affectedRows };
      }
      default:
        return await tryQuery(text, values);
    }
  }

  async querySchemaInfo(database: string, tables: string | string[]) {
    const tableList = ([] as string[]).concat(tables);
    const text = heresql(`
      SELECT columns.*,
             constraints.constraint_type
        FROM information_schema.columns AS columns
   LEFT JOIN information_schema.key_column_usage AS usage
          ON columns.table_catalog = usage.table_catalog
         AND columns.table_name = usage.table_name
         AND columns.column_name = usage.column_name
   LEFT JOIN information_schema.table_constraints AS constraints
          ON usage.constraint_name = constraints.constraint_name
       WHERE columns.table_catalog = $1 AND columns.table_name = ANY($2)
    ORDER BY columns.ordinal_position ASC
    `);

    const { pool } = this as any;
    const { rows } = await pool.query(text, [database, tableList]);
    const schemaInfo: any = {};

    for (const row of rows as any[]) {
      const tableName = row.table_name;
      const columns = schemaInfo[tableName] || (schemaInfo[tableName] = []);
      const { character_maximum_length: length } = row;
      let { data_type: dataType } = row;

      if (dataType === 'character varying') dataType = 'varchar';
      if (dataType === 'timestamp without time zone') dataType = 'timestamp';

      let columnDefault = row.column_default;
      if (/^NULL::/i.test(columnDefault)) columnDefault = null;
      if (dataType === 'boolean') columnDefault = columnDefault === 'true';

      const primaryKey = row.constraint_type === 'PRIMARY KEY';
      const precision = row.datetime_precision;

      columns.push({
        columnName: row.column_name,
        columnType: length > 0 ? `${dataType}(${length})` : dataType,
        defaultValue: primaryKey ? null : columnDefault,
        dataType,
        allowNull: row.is_nullable !== 'NO',
        primaryKey,
        unique: row.constraint_type === 'UNIQUE',
        datetimePrecision: precision === 6 ? null : precision,
      });
    }

    return schemaInfo;
  }

  async alterTable(table: string, changes: Record<string, any>) {
    const chunks = [ `ALTER TABLE ${escapeId(table)}` ];
    const actions = Object.keys(changes).map(name => {
      const options = (changes as any)[name];
      if (options.remove) return formatDropColumn(this, name);
      const attribute = new (this as any).Attribute(name, options);
      const { columnName } = attribute;
      return attribute.modify
        ? formatAlterColumns(this, columnName, attribute).join(', ')
        : formatAddColumn(this, columnName, attribute);
    });
    chunks.push(actions.join(', '));
    await this.query(chunks.join(' '));
  }

  async changeColumn(table: string, column: string, params: any) {
    const attribute = new (this as any).Attribute(column, params);
    const { columnName } = attribute;
    const alterColumns = formatAlterColumns(this, columnName, attribute);
    const sql = heresql(`ALTER TABLE ${escapeId(table)} ${alterColumns.join(', ')}`);
    await this.query(sql);
  }

  async truncateTable(table: string, opts: { restartIdentity?: boolean } = {}) {
    const chunks = [ `TRUNCATE TABLE ${escapeId(table)}` ];
    if (opts.restartIdentity) chunks.push('RESTART IDENTITY');
    await this.query(chunks.join(' '));
  }

  async showIndexes(table: string, attributes?: string[] | string, opts: any = {}) {
    const chunks = [`SELECT * FROM pg_indexes WHERE tablename = ${escape(table)}`];
    if (attributes) {
      const name = getIndexName(table, attributes as any, { ...opts, Attribute: (this as any).Attribute });
      chunks.push(`AND indexname = ${escape(name)}`);
    }
    const { rows } = await this.query(chunks.join(' ')) as any;
    if (!rows) return [] as any[];
    const indexes: any[] = [];
    for (const row of rows) {
      const match = row.indexdef.match(/\((.+)\)/);
      const columns = match ? match[1].split(',').map((s: string) => s.trim().replace(/"/g, '')) : [];
      const unique = /UNIQUE/.test(row.indexdef);
      indexes.push({
        name: row.indexname,
        columns,
        unique,
      });
    }
    return indexes;
  }
}

export default PostgresDriver;
