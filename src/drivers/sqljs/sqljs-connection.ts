import type { Database, QueryExecResult } from 'sql.js';

import type { SqljsConnectionOptions, SqljsConnectionQueryResult, SqljsQueryQuery, SqljsQueryValues } from './interface';
import type { SpellMeta } from '../../spell';

/**
 * 组装和转换结果
 */
function dataConvert(result: QueryExecResult) {
  if (!result) return result;

  const { columns, values } = result;

  return {
    fields: columns,
    rows: values.map((val) => {
      return columns.reduce((prev, col, index) => {
        prev[col] = val[index];
        return prev;
      }, {});
    }),
  };
}

function normalizeResult(res: QueryExecResult[]): SqljsConnectionQueryResult {
  if (res?.[0]) {
    const hydratedData = dataConvert(res[0]);
    return hydratedData;
  }
  // 空结果
  return {
    rows: [],
    fields: [],
  };
}

// SELECT users.id AS "users:id", ...
// => [ { users: { id, ... } } ]
function nest(rows, fields, spell) {
  const { Model } = spell;
  const { tableAlias } = Model;
  const results: any[] = [];

  for (const row of rows) {
    const result = {};
    const qualified = Object.keys(row).some(entry => entry.includes(':'));
    for (const key in row) {
      const parts = key.split(':');
      const [qualifier, column] = qualified
        ? (parts.length > 1 ? parts : ['', key])
        : [Model.attributeMap.hasOwnProperty(key) ? tableAlias : '', key];
      const obj = result[qualifier] || (result[qualifier] = {});
      obj[column] = row[key];
    }
    results.push(result);
  }

  return { rows: results, fields };
}

async function defaultInitSqlJs(options: SqljsConnectionOptions): Promise<Database> {
  const { default: initSqlJs } = await import('sql.js');
  const SQL = await initSqlJs();

  const { data = null } = options;
  const database = new SQL.Database(data);

  return database;
}

export class SQLJSConnection {
  constructor(private options: SqljsConnectionOptions) {}

  private database: Database | undefined = undefined;

  async getConnection() {
    if (this.database) {
      return this;
    }

    const { initSqlJs = defaultInitSqlJs } = this.options;

    // Create a database
    this.database = await initSqlJs(this.options);

    return this;
  }

  release() {
    // noop
  }

  async close() {
    if (!this.database) {
      console.warn('close: database is null');
      return true;
    }

    this.database = undefined;
  }

  async query(query: string | { sql: string, nestTables?: boolean}, values?: SqljsQueryValues, spell?: SpellMeta) {
    const { sql, nestTables } = typeof query === 'string'
      ? { sql: query, nestTables: false }
      : query;

    if (/^(?:pragma|select)/i.test(sql)) {
      const result = await this._executeSQL(sql, values);
      if (nestTables) return nest(result.rows, result.fields, spell);
      return result;
    }

    return await this._runSQL(sql, values);
  }

  async _runSQL(query: SqljsQueryQuery, values?: SqljsQueryValues) {
    if (!this.database) {
      throw new Error('database not opened!');
    }

    this.database.run(query, values);

    const affectedRows = this.database.getRowsModified();

    // 模拟 node-sqlite3 的行为
    const lastInsertRowRet = await this._executeSQL(
      'SELECT last_insert_rowid() as lastId;',
    );
    const lastId = lastInsertRowRet?.rows?.[0]?.lastId;
    return {
      insertId: lastId,
      affectedRows,
    };
  }

  async _executeSQL(query: SqljsQueryQuery, values?: SqljsQueryValues) {
    if (!this.database) {
      throw new Error('database not opened!');
    }

    const res = this.database.exec(query, values);
    return normalizeResult(res);
  }
}
