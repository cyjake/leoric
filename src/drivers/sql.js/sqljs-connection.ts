import type { Database, QueryExecResult } from 'sql.js';

import type { SQLJSConnectionOptions, SQLJSConnectionQueryResult, SQLJSQueryParams } from './interface';

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

function normalizeResult(res: QueryExecResult[]): SQLJSConnectionQueryResult {
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

async function defaultInitSqlJs(options: SQLJSConnectionOptions): Promise<Database> {
  const { default: initSqlJs } = await import('sql.js');
  const SQL = await initSqlJs();

  const { data = null } = options;
  const database = new SQL.Database(data);

  return database;
}

export class SQLJSConnection {
  constructor(private options: SQLJSConnectionOptions) {}

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

  async close() {
    if (!this.database) {
      console.warn('close: database is null');
      return true;
    }

    this.database = undefined;
  }

  async query(params: SQLJSQueryParams) {
    return await this._executeSQL(params);
  }

  async _executeSQL(params: SQLJSQueryParams) {
    if (!this.database) {
      throw new Error('database not opened!');
    }

    const res = this.database.exec(params.query, params.values);
    return normalizeResult(res);
  }
}
