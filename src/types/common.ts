
import { CommonHintArgs } from '../hint';
import { AbstractDataType, DataType } from '../data_types';
import { AbstractBone } from '../abstract_bone';
import type Spell from '../spell';

export type Literal = null | undefined | boolean | number | bigint | string | Date | Record<string, any> | ArrayBuffer;

// eslint-disable-next-line @typescript-eslint/ban-types
type BaseValidateArgs = boolean | RegExp | Function | Array<Array<Literal>> | string | Array<Literal> | number;

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
  query<T extends typeof AbstractBone>(
    query: string | { sql: string; nestTables?: boolean },
    values?: Array<Literal | Literal[]>,
    spell?: Spell<T>,
  ): Promise<QueryResult>;

  release(): void;
}

export interface Pool {
  getConnection(): Promise<Connection>;
}

export interface QueryOptions {
  validate?: boolean;
  individualHooks?: boolean;
  hooks?: boolean;
  paranoid?: boolean;
  silent?: boolean;
  connection?: Connection;
  hints?: Array<CommonHintArgs>;
  hint?: CommonHintArgs;
  transaction?: Connection | {
    connection: Connection
  } | null;
}

export type BulkCreateOptions = QueryOptions & {
  updateOnDuplicate?: string[] | true;
  fields?: string[];
}

export interface AssociateOptions {
  className: string;
  foreignKey?: string;
  through?: string;
  where?: Record<string, Literal>;
  select?: string[] | ((name: string) => boolean);
  hasMany?: boolean;
  belongsTo?: boolean;
}

export type command = 'select' | 'insert' | 'bulkInsert' | 'update' | 'delete' | 'upsert';

export type ResultSet<T extends typeof AbstractBone> = Array<Values<InstanceType<T>> & Record<string, Literal>>;

export interface ColumnMeta extends ColumnBase {
  dataType?: string;
  datetimePrecision?: string | number | null;
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

export type SetOptions<T extends typeof AbstractBone> = {
  [Property in BoneColumns<T>]: Literal
} | {
  [key: string]: Literal
};

export type WithOptions = {
  [qualifier: string]: { select: string | string[], throughRelation?: string }
}

// Collection is implemented in src/collection.ts which itself imports from this module,
// so we use an ambient declaration here to avoid a circular dependency.
export declare class Collection<T extends AbstractBone> extends Array<T> {
  save(): Promise<T[]>;
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

// eslint-disable-next-line @typescript-eslint/ban-types
type OmitFunctions<T> = { [P in keyof T as T[P] extends Function ? never : P]: T[P]; };

export type NullablePartial<T> = { [P in keyof T]?: T[P] | null };

export type Values<T> = NullablePartial<Omit<OmitFunctions<T>, 'isNewRecord' | 'Model' | 'dataValues'>>;

export type BoneColumns<T extends typeof AbstractBone, Key extends keyof InstanceType<T> = keyof Values<InstanceType<T>>> = Key;

export type InstanceColumns<T = typeof AbstractBone, Key extends keyof T = keyof Values<T>> = Key;

/**
 * Bone.create(values: BoneCreateValues<this>);
 */
export type BoneCreateValues<T extends typeof AbstractBone> = Partial<Values<InstanceType<T>>>;

export type BeforeHooksType = 'beforeCreate' | 'beforeBulkCreate' | 'beforeUpdate' | 'beforeSave' |  'beforeUpsert' | 'beforeRemove';
export type AfterHooksType = 'afterCreate' | 'afterBulkCreate' | 'afterUpdate' | 'afterSave' | 'afterUpsert' | 'afterRemove';

