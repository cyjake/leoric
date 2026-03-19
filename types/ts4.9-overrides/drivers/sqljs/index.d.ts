import SqliteDriver from '../sqlite';
import { SqljsConnectionOptions, SqljsQueryValues } from './interface';
import { SpellMeta } from '../../spell';
import Logger from '../abstract/logger';
import { Literal, QueryOptions } from '../../types/common';
import { AbstractBone } from '../../abstract_bone';
import Spell from '../../spell';
import Connection from '../sqlite/connection';
interface DriverOptions extends Omit<SqljsConnectionOptions, 'name'> {
  database: string;
}
export default class SqljsDriver extends SqliteDriver {
  constructor(opts: DriverOptions);
  type: string;
  logger: Logger;
  pool: any;
  createPool(opts: DriverOptions): any;
  getConnection(): Promise<any>;
  query<T extends typeof AbstractBone>(
    query: string | { sql: string; nestTables?: boolean },
    values?: Literal[],
    opts?: Spell<T> | QueryOptions & { connection?: Connection } | SpellMeta | SqljsQueryValues
  ): Promise<any>;
}
export {};
