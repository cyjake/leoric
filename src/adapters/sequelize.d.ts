import {
  Attributes, Literal, OperatorCondition,
  BoneOptions, ResultSet, Raw,
  SetOptions, BeforeHooksType, AfterHooksType,
  QueryOptions, OrderOptions, QueryResult, Values as CommonValues, BoneColumns, InstanceColumns, BoneCreateValues,
} from '../types/common';
import { AbstractBone } from '../types/abstract_bone';
import { Spell } from '../spell';

type WhereConditions<T extends typeof SequelizeBone> = {
  [Property in keyof Extract<InstanceType<T>, Literal>]?: Literal | Literal[] | OperatorCondition;
} | {
  [key in '$and' | '$or']?: WhereConditions<T>[];
}

interface SequelizeDestroyOptions extends QueryOptions {
  force?: boolean;
}

interface BaseSequelizeConditions<T extends typeof SequelizeBone> extends QueryOptions {
  where?: WhereConditions<T>;
  order?: OrderOptions<T>;
  limit?: number;
  attributes?: BoneColumns<T> | Array<BoneColumns<T> | string | Raw> | string | Raw;
  offset?: number;
}

type SequelizeUpdateOptions<T extends typeof SequelizeBone> = BaseSequelizeConditions<T> & {
  fields?: BoneColumns<T> | Array<BoneColumns<T> | string | Raw> | string;
}

interface SequelizeInstanceUpdateOptions<T extends SequelizeBone> extends QueryOptions {
  attributes?: [keyof Extract<CommonValues<T>, Literal>] | string | Raw | Array<[keyof Extract<CommonValues<T>, Literal>] | string | Raw>;
  fields?: Array<[keyof Extract<CommonValues<T>, Literal>] | string | Raw> | [keyof Extract<CommonValues<T>, Literal>];
}

interface SequelizeConditions<T extends typeof SequelizeBone> extends BaseSequelizeConditions<T> {
  group?: BoneColumns<T> | BoneColumns<T>[] | Raw | string;
  having?: WhereConditions<T> | string | { [key:string]: Literal | Literal[] } | Raw;
  include?: string | Raw;
}

interface FindOrCreateOptions<T extends typeof SequelizeBone> extends BaseSequelizeConditions<T> {
  defaults?: {
    [Property in keyof Extract<InstanceType<T>, Literal>]?: Literal
  }
}

interface FindOrBuildOptions<T extends typeof SequelizeBone> extends FindOrCreateOptions<T> {
  raw?: boolean;
  isNewRecord?: boolean;
  validate?: boolean;
}

interface DestroyOptions<T extends typeof SequelizeBone> extends SequelizeConditions<T> {
  force?: boolean;
}

type ScopeOptions = {
  override?: boolean
}

type aggregators = 'count' | 'COUNT' | 'average' | 'AVERAGE' | 'minimum' | 'MINIMUM' | 'maximum' | 'MAXIMUM' | 'sum' | 'SUM';

export class Collection<T extends SequelizeBone> extends Array<T> {
  save(): Promise<void>;
  toJSON(): Object[];
  toObject(): Object[];
}

export class SequelizeBone extends AbstractBone {

  static get sequelize(): boolean;

  static get Instance(): SequelizeBone;

  static get rawAttributes(): Attributes;

  static getTableName(): boolean;

  static removeAttribute<T extends typeof SequelizeBone>(this: T, name?: BoneColumns<T>): void;

  /**
   *
   * @static
   * @param {string} name before/after create|destroy|upsert|remove|update
   * @param {string | Function} fnNameOrFun function name or function
   * @param {Function} func hook function
   */
  static addHook(
    name: BeforeHooksType | AfterHooksType | 'beforeDestroy' | 'afterDestroy' | 'beforeBulkDestroy' | 'afterBulkDestroy' | 'beforeBulkUpdate' | 'afterBulkUpdate',
    fnNameOrFun: string | Function,
    func?: Function,
  ): void;

  /**
   * add scope see https://sequelize.org/master/class/lib/model.js~Model.html#static-method-addScope
   * @deprecated scope is not recommended to use
   * @param name
   * @param scope
   * @param opts
   */
  static addScope<T extends typeof SequelizeBone>(this: T, name: string, scope: ((...args: any[]) => SequelizeConditions<T>) | SequelizeConditions<T>, opts?: ScopeOptions): void;

  /**
   * @deprecated scope is not recommended to use
   * @param name
   * @param args
   */
  static scope<T extends typeof SequelizeBone>(this: T, name?: (string | ((...args: any[]) => SequelizeConditions<T>) | SequelizeConditions<T> | Array<SequelizeConditions<T>>), ...args: any[]): T;

  static unscoped(): Spell<typeof SequelizeBone>;

  /**
   * @deprecated scope is not recommended to use
   * @param name
   * @param args
   */
  static setScope<T extends typeof SequelizeBone>(this: T, name: (string | ((...args: any[]) => SequelizeConditions<T>) | SequelizeConditions<T> | Array<SequelizeConditions<T>>), ...args: any[]): void;

  static aggregate<T extends typeof SequelizeBone>(this: T, name: BoneColumns<T>, func: aggregators, options?: SequelizeConditions<T>): Spell<T, number>;
  static aggregate<T extends typeof SequelizeBone>(this: T, name: Raw | '*', func: aggregators, options?: SequelizeConditions<T>): Spell<T, number>;

  static build<T extends typeof SequelizeBone>(this: T, values: BoneCreateValues<T>, options?: BoneOptions): InstanceType<T>;

  /**
   * see https://github.com/sequelize/sequelize/blob/a729c4df41fa3a58fbecaf879265d2fb73d80e5f/src/model.js#L2299
   * @param valueSets
   * @param options
   */
  static bulkBuild<T extends typeof SequelizeBone>(this:T, valueSets: Array<BoneCreateValues<T>>, options?: BoneOptions): Array<InstanceType<T>>;

  static count<T extends typeof SequelizeBone>(this: T, name?: BoneColumns<T>): Spell<T, ResultSet<T> | number>;
  static count<T extends typeof SequelizeBone>(this: T, name?: Raw | '*'): Spell<T, ResultSet<T> | number>;
  static count<T extends typeof SequelizeBone>(this: T, conditions?: SequelizeConditions<T>): Spell<T, ResultSet<T> | number>;

  static decrement<T extends typeof SequelizeBone>(
    this: T,
    fields: { [Property in keyof Extract<InstanceType<T>, Literal>]?: number } | string | Array<BoneColumns<T> | string> ,
    options?: SequelizeConditions<T>
  ): Spell<T, QueryResult>;

  static increment<T extends typeof SequelizeBone>(
    this: T,
    fields: { [Property in keyof Extract<InstanceType<T>, Literal>]?: number } | string | Array<BoneColumns<T> | string> ,
    options?: SequelizeConditions<T>
  ): Spell<T, QueryResult>;

  static max<T extends typeof SequelizeBone>(this: T, field: BoneColumns<T>, options?: SequelizeConditions<T>): Promise<Literal>;
  static max<T extends typeof SequelizeBone>(this: T, field: Raw, options?: SequelizeConditions<T>): Promise<Literal>;

  static min<T extends typeof SequelizeBone>(this: T, field: BoneColumns<T>, options?: SequelizeConditions<T>): Promise<Literal>;
  static min<T extends typeof SequelizeBone>(this: T, field: Raw, options?: SequelizeConditions<T>): Promise<Literal>;

  static sum<T extends typeof SequelizeBone>(this: T, field: BoneColumns<T>, options?: SequelizeConditions<T>): Promise<Literal>;
  static sum<T extends typeof SequelizeBone>(this: T, field: Raw, options?: SequelizeConditions<T>): Promise<Literal>;

  static destroy<T extends typeof SequelizeBone>(this: T, options?: DestroyOptions<T>): Promise<Array<number> | number>;
  static bulkDestroy<T extends typeof SequelizeBone>(this: T, options?: DestroyOptions<T>): Spell<T, number>;

  static findAll<T extends typeof SequelizeBone>(this: T, options?: SequelizeConditions<T>): Spell<T, Collection<InstanceType<T>>>;
  static find<T extends typeof SequelizeBone>(this: T, options?: SequelizeConditions<T>): Spell<T, InstanceType<T> | null>;
  static findAndCountAll<T extends typeof SequelizeBone>(this: T, options?: SequelizeConditions<T>): Promise<{
    rows: Array<InstanceType<T>>,
    count: number,
  }>

  static findByPk<T extends typeof SequelizeBone>(this:T, pk: number | bigint | string, options?: Pick<SequelizeConditions<T>, 'paranoid' | 'connection' | 'transaction' |'hint' | 'hints'>): Spell<T, InstanceType<T>>;

  static findOne<T extends typeof SequelizeBone>(this: T, options?: SequelizeConditions<T>): Spell<T, InstanceType<T>>;
  static findOne<T extends typeof SequelizeBone>(this: T, whereConditions: string, ...values: Literal[]): Spell<T, InstanceType<T>>;
  static findOne<T extends typeof SequelizeBone>(this: T, primaryKey: number | number[] | bigint): Spell<T, InstanceType<T>>;

  static findCreateFind<T extends typeof SequelizeBone>(this: T, options: FindOrCreateOptions<T>): Promise<InstanceType<T>>;
  static findOrBuild<T extends typeof SequelizeBone>(this: T, options: FindOrBuildOptions<T>): Promise<[InstanceType<T>, boolean]>;
  static findOrCreate<T extends typeof SequelizeBone>(this: T, options: FindOrBuildOptions<T>): Promise<[InstanceType<T>, boolean]>;

  static restore<T extends typeof SequelizeBone>(this: T, options: BaseSequelizeConditions<T>): Spell<T, number>;

  static update<T extends typeof SequelizeBone>(this: T, values: SetOptions<T>, options: SequelizeUpdateOptions<T>): Promise<number>;
  static bulkUpdate<T extends typeof SequelizeBone>(this: T, values: SetOptions<T>, options: SequelizeUpdateOptions<T>): Spell<T, number>;

  /**
   * An alias of instance constructor. Some legacy code access model name from instance with `this.Model.name`.
   */
  get Model(): typeof SequelizeBone;
  get dataValues(): { [key: string]: Literal };

  where(): { [key: string]:  number | bigint | string };
  set<T, Key extends keyof CommonValues<T>>(this: T, key: Key, value: T[Key]): void;
  set<T, Key extends keyof T>(this: T, key: Key, value: T[Key]): void;

  get<T, Key extends keyof CommonValues<T>>(this: T, key?: Key): T[Key];
  get<T, Key extends keyof T>(this: T, key?: Key): T[Key];

  setDataValue<T, Key extends keyof CommonValues<T>>(this: T, key: Key, value: T[Key]): void;
  setDataValue<T, Key extends keyof T>(this: T, key: Key, value: T[Key]): void;

  getDataValue<T>(this: T): T;
  getDataValue<T, Key extends keyof CommonValues<T>>(this: T, key: Key): T[Key];
  getDataValue<T, Key extends keyof T>(this: T, key: Key): T[Key];

  previous<T, Key extends keyof CommonValues<T>>(this: T, key?: Key): Literal | Literal[] | { [Property in keyof Extract<this, Literal>]?: Literal | Literal[] };
  previous<T, Key extends keyof T>(this: T, key?: Key): Literal | Literal[] | { [Property in keyof Extract<this, Literal>]?: Literal | Literal[] };

  isSoftDeleted(): boolean;

  increment(field: InstanceColumns<this> | Array<InstanceColumns<this>> | { [Property in keyof Extract<this, Literal>]?: number }, options?: QueryOptions): Spell<typeof SequelizeBone, QueryResult>;
  increment(field: string | Raw | Array<string | Raw>, options?: QueryOptions): Spell<typeof SequelizeBone, QueryResult>;
  decrement(field: InstanceColumns<this> | Array<InstanceColumns<this>> | { [Property in keyof Extract<this, Literal>]?: number }, options?: QueryOptions): Spell<typeof SequelizeBone, QueryResult>;
  decrement(field: string | Raw | Array<string | Raw> , options?: QueryOptions): Spell<typeof SequelizeBone, QueryResult>;
  destroy<T>(this: T, options?: SequelizeDestroyOptions): Promise<T | number>;
  update<T = this>(this: T, changes?: { [Property in keyof Extract<this, Literal>]?: Literal }, opts?: SequelizeInstanceUpdateOptions<this>): Promise<number>;
  update<T = this>(this: T, changes?: { [key: string]: Literal }, opts?: SequelizeInstanceUpdateOptions<this>): Promise<number>;

}

export const sequelize: (Bone: AbstractBone) => typeof SequelizeBone;
