
import { CommonHintsArgs } from '../hint';
import { AbstractDataType, DataType } from '../data_types';
import { AbstractBone } from './abstract_bone';

export type Literal = null | undefined | boolean | number | bigint | string | Date | Record<string, any> | ArrayBuffer;

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

interface TransactionMethodOptions {
  Model: typeof AbstractBone;
}

export interface Connection {
  /**
   * MySQL
   */
  query(
    query: string,
    values?: Array<Literal | Literal[]>,
  ): Promise<QueryResult>;

  query(
    query: string,
    values?: Array<Literal | Literal[]>,
    callback?: (err: Error, result: QueryResult) => void,
  ): void

  begin(opts: TransactionMethodOptions): Promise<void>;

  commit(opts: TransactionMethodOptions): Promise<void>;

  rollback(opts: TransactionMethodOptions): Promise<void>;

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
  } | null;
}

export type BulkCreateOptions = QueryOptions & {
  updateOnDuplicate?: string[] | true;
  fields?: string[];
}

export interface AssociateOptions {
  className?: string;
  foreignKey?: string;
  through?: string;
  where?: Record<string, Literal>;
  select?: string[] | ((name: string) => boolean);
}

export type command = 'select' | 'insert' | 'bulkInsert' | 'update' | 'delete' | 'upsert';

export type ResultSet<T extends typeof AbstractBone> = Array<Values<InstanceType<T>> & Record<string, Literal>>;

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
  [Property in BoneColumns<T>]: Literal
} | { 
  [key: string]: Literal
};

export type WithOptions = {
  [qualifier: string]: { select: string | string[], throughRelation?: string }
}

type OrderSortType = 'desc' | 'asc' | Uppercase<'desc' | 'asc'>;

type OrderOptions<T extends typeof AbstractBone> = {
  [Property in Extract<BoneColumns<T>, Literal>]?: OrderSortType
} | [ BoneColumns<T>, OrderSortType ] 
| Array<BoneColumns<T> | [ BoneColumns<T>, OrderSortType ] | Raw | string | Array<Raw | string>>
| string | Raw;

export class Collection<T extends AbstractBone> extends Array<T> {
  save(): Promise<void>;
  toJSON(): Values<T>[];
  toObject(): Values<T>[];
}

export type WhereConditions<T extends typeof AbstractBone> = {
  [Property in BoneColumns<T>]?: Literal | Literal[] | OperatorCondition;
} | {
  [key in '$and' | '$or']?: WhereConditions<T>[];
}

export type OnConditions<T extends typeof AbstractBone> = {
  [Property in BoneColumns<T>]?: Literal | Literal[] | OperatorCondition ;
} | {
  [key in '$and' | '$or']?: WhereConditions<T>[];
}

// https://stackoverflow.com/a/68077021/179691
export type PickTypeKeys<Obj, Type, T extends keyof Obj = keyof Obj> = ({ [P in keyof Obj]: Obj[P] extends Type ? P : never })[T];

export type NullablePartial<T> = { [P in keyof T]?: T[P] | null };

export type Values<T> = NullablePartial<Omit<T, PickTypeKeys<T, Function> | 'isNewRecord' | 'Model' | 'dataValues'>>;

export type BoneColumns<T extends typeof AbstractBone, Key extends keyof InstanceType<T> = keyof Values<InstanceType<T>>> = Key;

export type InstanceColumns<T = typeof AbstractBone, Key extends keyof T = keyof Values<T>> = Key;

/**
 * Bone.create(values: BoneCreateValues<this>);
 */
export type BoneCreateValues<T extends typeof AbstractBone> = Partial<Values<InstanceType<T>>>;

export type BeforeHooksType = 'beforeCreate' | 'beforeBulkCreate' | 'beforeUpdate' | 'beforeSave' |  'beforeUpsert' | 'beforeRemove';
export type AfterHooksType = 'afterCreate' | 'afterBulkCreate' | 'afterUpdate' | 'afterSave' | 'afterUpsert' | 'afterRemove';

// https://stackoverflow.com/a/67232225/179691
type GeneratorReturnType<T extends Generator> = T extends Generator<any, infer R, any> ? R: never;

/**
 * Plain keyMap type object of a Bone's attributes
 * BoneInstanceValues<user> = { id: number, name: string }
 */
export type BoneInstanceValues<T extends typeof AbstractBone> = Omit<InstanceType<T>, PickTypeKeys<InstanceType<T>, Function> | 'isNewRecord' | 'Model' | 'dataValues'>;
