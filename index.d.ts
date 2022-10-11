import DataTypes, { DataType, AbstractDataType, LENGTH_VARIANTS } from './src/data_types';
import { 
  Hint, IndexHint, HintInterface,
  INDEX_HINT_SCOPE_TYPE, INDEX_HINT_SCOPE, INDEX_HINT_TYPE
} from './src/hint';
import {
  Literal, Validator,
  Connection, QueryOptions,
  Raw, ColumnMeta, AttributeMeta,
  BeforeHooksType, AfterHooksType, Collection,
  GeneratorReturnType,
} from './src/types/common';
import { SpellMeta, Spell, SpellBookFormatResult } from './src/spell';
import Bone from './src/bone';
import { ConnectOptions, AbstractDriver } from './src/drivers';

export { 
  LENGTH_VARIANTS as LENGTH_VARIANTS,
  DataTypes, Literal, Validator, Connection,
  Hint, IndexHint, HintInterface, INDEX_HINT_SCOPE_TYPE, INDEX_HINT_SCOPE, INDEX_HINT_TYPE,
  Bone, Raw, Collection,
  SpellMeta, Spell, ColumnMeta, AttributeMeta, SpellBookFormatResult
};

export * from './src/decorators';
export * from './src/drivers';
export * from './src/adapters/sequelize';

interface InitOptions {
  underscored?: boolean;
  tableName?: string;
  hooks?: {
    [key in BeforeHooksType ]: (options: QueryOptions) => Promise<void>
  } | {
    [key in AfterHooksType ]: (instance: Bone, result: Object) => Promise<void>
  };
}

interface SyncOptions {
  force?: boolean;
  alter?: boolean;
}

interface RawQueryOptions {
  replacements?: { [key:string]: Literal | Literal[] };
  connection?: Connection;
}

export default class Realm {
  Bone: typeof Bone;
  DataTypes: typeof DataTypes;
  driver: AbstractDriver;
  models: Record<string, typeof Bone>;
  connected?: boolean;

  constructor(options: ConnectOptions);

  connect(): Promise<Bone>;

  /**
   * disconnect manually
   * @param callback
   */
  disconnect(callback?: Function): Promise<boolean | void>;

  define(
    name: string,
    attributes: Record<string, AbstractDataType<DataType> | AttributeMeta>,
    options?: InitOptions,
    descriptors?: Record<string, Function>,
  ): typeof Bone;

  raw(sql: string): Raw;

  escape(value: Literal): string;

  query<T>(sql: string, values?: Array<Literal>, options?: RawQueryOptions & { model?: T }): Promise<{ rows: T extends typeof Bone ? InstanceType<T>[] : Record<string, Literal>[], fields?: Record<string, ColumnMeta>[], affectedRows?: number }>;

  transaction<T extends (options: { connection: Connection }) => Generator>(callback: T): Promise<GeneratorReturnType<ReturnType<T>>>;
  transaction<T extends (options: { connection: Connection }) => Promise<any>>(callback: T): Promise<ReturnType<T>>;

  sync(options?: SyncOptions): Promise<void>;
}

/**
 * Connect models to database.
 * @example
 * connect({
 *   host: 'localhost',
 *   user: 'root',
 *   database: 'leoric',
 *   models: path.join(__dirname, 'models')
 * })
 */
export function connect(opts: ConnectOptions): Promise<Realm>;
export function disconnect(realm: Realm, callback?: Function): Promise<boolean | void>;

/**
 * Check if cls is subclass of Bone
 * @param cls 
 */
export function isBone(cls: any): boolean;

/**
 * Concatenate multiline SQL into oneline
 * @example
 * heresql(`
 *   SELECT *
 *     FROM users
 *    WHERE age >= 35
 * `)
 * @param text 
 */
export function heresql(text): string;
