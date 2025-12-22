import Debug from 'debug';
import SqlString from 'sqlstring';
import type { Literal, QueryOptions } from '../../types/common';
import { AbstractBone } from '../../types/abstract_bone';
import { Spell } from '../..';

const debug = Debug('leoric');

export interface LoggerOptions {
  hideKeys?: string[];
  logQuery?: (sql: string, duration?: number | string, opts?: Spell<typeof AbstractBone> | QueryOptions) => void;
  logQueryError?: (err: Error, sql: string, duration?: number | string, opts?: Spell<typeof AbstractBone> | QueryOptions) => void;
  logMigration?: (name: string) => void;
}

export default class Logger {
  hideKeys: string[] = [];

  constructor(opts?: LoggerOptions | ((sql: string, duration?: number | string, opts?: Spell<typeof AbstractBone> | QueryOptions) => void)) {
    let options: LoggerOptions | undefined = undefined;
    if (typeof opts === 'function') {
      options = { logQuery: opts };
    } else {
      options = opts;
    }
    Object.assign(this, { hideKeys: [] }, options);
  }

  format(
    query: string | { sql: string },
    values: Literal[] | { [key: string]: Literal } = [],
    opts: QueryOptions | { command?: string; sets?: Record<string, Literal> | Record<string, Literal>[] } = {},
  ) {
    if ('command' in opts && [ 'insert', 'upsert', 'update' ].includes(opts.command || '') && opts.sets && Array.isArray(values)) {
      const { hideKeys } = this;
      const keys = Object.keys(opts.sets);
      values = (values as Literal[]).map((entry, i) => {
        const index = opts.command === 'upsert' ? i % keys.length : i;
        return hideKeys.includes(keys[index]) ? '***' : entry;
      });
    }
    return SqlString.format(typeof query === 'string' ? query : query.sql, values);
  }

  tryLogQuery(...args: any[]) {
    try {
      // @ts-expect-error allow user provided logger signatures
      this.logQuery(...args);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(error);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  logQuery<T extends typeof AbstractBone>(sql: string, duration?: number | string, opts?: Spell<T> | QueryOptions) {
    debug('[query] [%s] %s', duration, sql);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  logQueryError<T extends typeof AbstractBone>(err: Error, sql: string, duration?: number | string, opts?: Spell<T> | QueryOptions) {
    // err is thrown by default hence not logged here
    // eslint-disable-next-line no-console
    console.error('[query] [%s] %s', duration, sql);
  }

  logMigration(name: string, direction: 'up' | 'down') {
    debug('[migration] %s', name, direction);
  }
}
