
import { CommonHintsArgs } from '../hint';
import { AbstractDataType, DataType } from '../data_types';
import { AbstractBone } from './abstract_bone';

export type Literal = null | undefined | boolean | number | bigint | string | Date | object | ArrayBuffer;

type BaseValidateArgs = boolean | RegExp | Function | Array<Array<Literal>> | string | Array<Literal>;

export type Validator = BaseValidateArgs | {
  args?: BaseValidateArgs,
  msg?: string;
};

export interface ColumnBase {
  allowNull?: boolean;
  defaultValue?: Literal;
  primaryKey?: boolean;
  comment?: string;
  unique?: boolean;
  columnName?: string;
  columnType?: string;
  autoIncrement?: boolean;
}

export interface QueryResult {
  insertId?: number;
  affectedRows?: number;
  rows?: Array<Record<string, Literal>>,
  fields?: Array<{ table: string, name: string }>,
}

export interface Connection {
  /**
   * MySQL
   */
  query(
    query: string,
    values: Array<Literal | Literal[]>,
  ): Promise<QueryResult>;
}

export declare class Pool {
  getConnection(): Connection;
}

export interface QueryOptions {
  validate?: boolean;
  individualHooks?: boolean;
  hooks?: boolean;
  paranoid?: boolean;
  silent?: boolean;
  connection?: Connection;
  hints?: Array<CommonHintsArgs>;
  hint?: CommonHintsArgs;
  transaction?: Connection | {
    connection: Connection
  };
}

export type BulkCreateOptions = QueryOptions & {
  updateOnDuplicate?: string[];
  fields?: string[];
}

export interface AssociateOptions {
  className?: string;
  foreignKey?: string;
  through?: string;
  where?: Record<string, Literal>;
}

export type command = 'select' | 'insert' | 'bulkInsert' | 'update' | 'delete' | 'upsert';

export type ResultSet = {
  [key: string]: Literal
};

export interface ColumnMeta extends ColumnBase {
  dataType?: string;
  datetimePrecision?: string;
}

export interface AttributeMeta extends ColumnMeta {
  jsType?: Literal;
  type: AbstractDataType<DataType>;
  virtual?: boolean,
  toSqlString?: () => string;
  validate?: {
    [key: string]: Validator;
  }
}

export interface Attributes { [key: string]: AbstractDataType<DataType> | AttributeMeta }

export type OperatorCondition = {
  [key in '$eq' | '$ne']?: Literal;
} & {
  [key in '$in' | '$nin' | '$notIn']?: Literal[] | Set<Literal>;
} & {
  [key in '$like' | '$notLike']?: string;
} & {
  [key in '$gt' | '$gte' | '$lt' | '$lte']?: number;
} & {
  [key in '$between' | '$notBetween']?: [number, number] | [Date, Date];
};

export type BoneOptions = {
  isNewRecord?: boolean;
}

export declare class Attribute {
  /**
   * attribute name
   */
  name: string;
  /**
   * primaryKey tag
   */
  primaryKey: boolean;
  allowNull: boolean;
  /**
   * attribute column name in table
   */
  columnName: string;
  columnType: string;
  type: typeof DataType;
  defaultValue: Literal;
  dataType: string;
  jsType: Literal;
  virtual: boolean;

  equals(columnInfo: ColumnMeta): boolean;
  cast(value: Literal): Literal;
  uncast(value: Literal): Literal;
}

export class Raw {
  constructor(value: string);
  value: string;
  type: 'raw';
}

export type SetOptions<T extends typeof AbstractBone> = { 
  [key: string]: Literal
} | {
  [Property in keyof Extract<InstanceType<T>, Literal>]: Literal
};

export type WithOptions = {
  [qualifier: string]: { select: string | string[], throughRelation?: string }
}

type OrderOptions<T extends typeof AbstractBone> = { 
  [Property in keyof Extract<InstanceType<T>, Literal>]: 'desc' | 'asc'
} | { [name: string]: 'desc' | 'asc' } | Array<string | string[] | Raw> | string | Raw;

export class Collection<T extends AbstractBone> extends Array<T> {
  save(): Promise<void>;
  toJSON(): InstanceValues<T>[];
  toObject(): InstanceValues<T>[];
}

export type WhereConditions<T extends typeof AbstractBone> = {
  [Property in keyof Extract<InstanceType<T>, Literal>]?: Literal | Literal[] | OperatorCondition;
} | {
  [key in '$and' | '$or']?: WhereConditions<T>[];
}

export type Values<T extends typeof AbstractBone> = {
  [Property in keyof Extract<InstanceType<T>, Literal>]?: Literal;
}

export type InstanceValues<T> = {
  [Property in keyof Extract<T, Literal>]?: Extract<T, Literal>[Property]
}

export type BeforeHooksType = 'beforeCreate' | 'beforeBulkCreate' | 'beforeUpdate' | 'beforeSave' |  'beforeUpsert' | 'beforeRemove';
export type AfterHooksType = 'afterCreate' | 'afterBulkCreate' | 'afterUpdate' | 'afterSave' | 'afterUpsert' | 'afterRemove';
