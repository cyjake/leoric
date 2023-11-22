import DataTypes, { DataType, AbstractDataType, LENGTH_VARIANTS } from './data_types';
import Bone from './bone';
import { ConnectOptions, AbstractDriver } from './drivers';
import { QueryOptions, GeneratorReturnType, AttributeMeta, Connection, Literal, ColumnMeta, AfterHooksType, BeforeHooksType } from './types/common';
import Raw from './raw';

export {
  LENGTH_VARIANTS as LENGTH_VARIANTS,
  DataTypes, Bone
};

export * from './decorators';
export * from './drivers';
export * from './adapters/sequelize';
export * from './hint';
export * from './types/common';
export * from './spell';

interface InitOptions {
  underscored?: boolean;
  tableName?: string;
  hooks?: {
    [key in BeforeHooksType ]: (options: QueryOptions) => Promise<void>
  } | {
    [key in AfterHooksType ]: (instance: Bone, result: object) => Promise<void>
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
  options: ConnectOptions;

  constructor(options: ConnectOptions);

  connect(): Promise<Bone>;

  /**
   * disconnect manually
   * @param callback
   */
  disconnect(callback?: () => Promise<void>): Promise<boolean | void>;

  define(
    name: string,
    attributes: Record<string, AbstractDataType<DataType> | AttributeMeta>,
    options?: InitOptions,
    descriptors?: Record<string, PropertyDescriptor>,
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
export function disconnect(realm: Realm, callback?: () => Promise<void>): Promise<boolean | void>;

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
