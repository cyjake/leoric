import {
  Attributes, Literal, OperatorCondition,
  BoneOptions, ResultSet, Raw,
  SetOptions, BeforeHooksType, AfterHooksType,
  QueryOptions, OrderOptions, QueryResult, Values as CommonValues,
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
  attributes?: string | Raw | Array<[keyof Extract<CommonValues<InstanceType<T>>, Literal>] | string | Raw> | [keyof Extract<CommonValues<InstanceType<T>>, Literal>];
  offset?: number;
}

type SequelizeUpdateOptions<T extends typeof SequelizeBone> = BaseSequelizeConditions<T> & {
  fields?: Array<[keyof Extract<CommonValues<InstanceType<T>>, Literal>] | string | Raw> | [keyof Extract<CommonValues<InstanceType<T>>, Literal>];
}

interface SequelizeInstanceUpdateOptions<T extends SequelizeBone> extends QueryOptions {
  attributes?: string | Raw | Array<[keyof Extract<CommonValues<T>, Literal>] | string | Raw> | [keyof Extract<CommonValues<T>, Literal>];
  fields?: Array<[keyof Extract<CommonValues<T>, Literal>] | string | Raw> | [keyof Extract<CommonValues<T>, Literal>];
}

interface SequelizeConditions<T extends typeof SequelizeBone> extends BaseSequelizeConditions<T> {
  group?: string | string[] | Raw;
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

type Values<T extends typeof SequelizeBone> = {
  [Property in keyof Extract<InstanceType<T>, Literal>]?: Literal;
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

  static removeAttribute(name: string): void;

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

  static aggregate<T extends typeof SequelizeBone>(this: T, name: string, func: aggregators, options?: SequelizeConditions<T>): Spell<T, number>;

  static build<T extends typeof SequelizeBone>(this: T, values: Values<T>, options?: BoneOptions): InstanceType<T>;

  /**
   * see https://github.com/sequelize/sequelize/blob/a729c4df41fa3a58fbecaf879265d2fb73d80e5f/src/model.js#L2299
   * @param valueSets
   * @param options
   */
  static bulkBuild<T extends typeof SequelizeBone>(this:T, valueSets: Array<Values<T>>, options?: BoneOptions): Array<InstanceType<T>>;

  static count<T extends typeof SequelizeBone>(this: T, name?: string): Spell<T, ResultSet<T> | number>;
  static count<T extends typeof SequelizeBone>(this: T, conditions?: SequelizeConditions<T>): Spell<T, ResultSet<T> | number>;

  static decrement<T extends typeof SequelizeBone>(
    this: T,
    fields: string | Array<string> | { [Property in keyof Extract<InstanceType<T>, Literal>]?: number },
    options?: SequelizeConditions<T>
  ): Spell<T, QueryResult>;

  static increment<T extends typeof SequelizeBone>(
    this: T,
    fields: string | Array<string> | { [Property in keyof Extract<InstanceType<T>, Literal>]?: number },
    options?: SequelizeConditions<T>
  ): Spell<T, QueryResult>;

  static max<T extends typeof SequelizeBone>(this: T, filed: string, options?: SequelizeConditions<T>): Promise<Literal>;
  static min<T extends typeof SequelizeBone>(this: T, filed: string, options?: SequelizeConditions<T>): Promise<Literal>;
  static sum<T extends typeof SequelizeBone>(this: T, filed: string, options?: SequelizeConditions<T>): Promise<Literal>;

  static destroy<T extends typeof SequelizeBone>(this: T, options?: DestroyOptions<T>): Promise<Array<number> | number>;
  static bulkDestroy<T extends typeof SequelizeBone>(this: T, options?: DestroyOptions<T>): Spell<T, number>;

  static findAll<T extends typeof SequelizeBone>(this: T, options?: SequelizeConditions<T>): Spell<T, Collection<InstanceType<T>>>;
  static find<T extends typeof SequelizeBone>(this: T, options?: SequelizeConditions<T>): Spell<T, InstanceType<T> | null>;
  static findAndCountAll<T extends typeof SequelizeBone>(this: T, options?: SequelizeConditions<T>): Promise<{
    rows: Array<typeof SequelizeBone>,
    count: number,
  }>

  static findByPk<T extends typeof SequelizeBone>(this:T, pk: number | bigint | string, options?: Pick<SequelizeConditions<T>, 'paranoid' | 'connection' | 'transaction' |'hint' | 'hints'>): Spell<T, InstanceType<T>>;

  static findOne<T extends typeof SequelizeBone>(this: T, whereConditions: string, ...values: Literal[]): Spell<T, InstanceType<T>>;
  static findOne<T extends typeof SequelizeBone>(this: T, primaryKey: number | number[] | bigint): Spell<T, InstanceType<T>>;
  static findOne<T extends typeof SequelizeBone>(this: T, options?: SequelizeConditions<T>): Spell<T, InstanceType<T>>;

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
  set<T, Key extends keyof T>(this: T, key: Key, value: T[Key]): void;
  get<T, Key extends keyof T>(this: T, key?: Key): T[Key];
  setDataValue<T, Key extends keyof T>(this: T, key: Key, value: T[Key]): void;
  getDataValue<T>(this: T): T;
  getDataValue<T, Key extends keyof T>(this: T, key: Key): T[Key];
  previous(key?: string): Literal | Literal[] | { [key: string]: Literal | Literal[] };
  isSoftDeleted(): boolean;

  increment(field: string | string[] | { [Property in keyof Extract<this, Literal>]?: number }, options?: QueryOptions): Spell<typeof SequelizeBone, QueryResult>;
  decrement(field: string | string[] | { [Property in keyof Extract<this, Literal>]?: number }, options?: QueryOptions): Spell<typeof SequelizeBone, QueryResult>;
  destroy(options?: SequelizeDestroyOptions): Promise<this| number>;
  update<T = this>(this: T, changes?: { [key: string]: Literal } | { [Property in keyof Extract<this, Literal>]?: Literal }, opts?: SequelizeInstanceUpdateOptions<this>): Promise<number>;
}

export const sequelize: (Bone: AbstractBone) => typeof SequelizeBone;
