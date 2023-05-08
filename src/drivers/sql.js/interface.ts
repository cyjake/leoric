import type { Database } from 'sql.js';

export interface SQLJSQueryParams {
  query: Parameters<Database['exec']>[0];
  values?: Parameters<Database['exec']>[1];
}

export interface SQLJSConnectionQueryResult {
  fields: string[];
  rows: any[];
}

export interface BaseConnectionOptions {
  name: string;
  version: number;
  logger: any;
}

export interface SQLJSConnectionOptions extends BaseConnectionOptions {
  data?: ArrayLike<number> | Buffer | null;
  initSqlJs?: (options: Omit<SQLJSConnectionOptions, 'initSqlJs'>) => Promise<Database>;
}
