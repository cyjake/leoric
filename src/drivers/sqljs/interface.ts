import type { Database } from 'sql.js';

export type SqljsQueryQuery = Parameters<Database['exec']>[0];
export type SqljsQueryValues = Parameters<Database['exec']>[1];

export interface SqljsConnectionQueryResult {
  fields: string[];
  rows: any[];
}

export interface BaseConnectionOptions {
  name: string;
  version?: number;
  logger: any;
}

export interface SqljsConnectionOptions extends BaseConnectionOptions {
  data?: ArrayLike<number> | Buffer | null;
  initSqlJs?: (options: Omit<SqljsConnectionOptions, 'initSqlJs'>) => Promise<Database>;
}
