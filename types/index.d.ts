import DataType from './data_types';

export { DataType as DataTypes };
export * from '../src/decorators';

type DataTypes<T> = {
  [Property in keyof T as Exclude<Property, "toSqlString">]: T[Property]
}

interface ExprIdentifier {
  type: 'id';
  value: string;
  qualifiers?: string[]
}

interface ExprFunc {
  type: 'func';
  name: string;
  args: (ExprLiteral | ExprIdentifier)[];
}

interface ExprLiteral {
  type: 'literal';
  value: Literal;
}

interface ExprBinaryOperator {
  type: 'op';
  name: string;
  args: [ExprIdentifier, ExprLiteral, ExprLiteral];
}

interface ExprTernaryOperator {
  type: 'op';
  name: 'between' | 'not between';
  args: [ExprIdentifier, ExprLiteral, ExprLiteral];
}

type ExprOperator = ExprBinaryOperator | ExprTernaryOperator;

interface SpellOptions {
  command?: string;
  columns: Object[];
  table: ExprIdentifier;
  whereConditions: ExprOperator[];
  groups: (ExprIdentifier | ExprFunc)[];
  orders: (ExprIdentifier | ExprFunc)[];
  havingCondtions: ExprOperator[];
  joins: Object;
  skip: number;
  scopes: Function[];
  subqueryIndex: number;
  rowCount: 0;
}

type OrderOptions = { [name: string]: 'desc' | 'asc' };

type SetOptions = { [key: string]: Literal };

type WithOptions = {
  [qualifier: string]: { select: string | string[], throughRelation?: string }
}

export class Spell<T extends typeof Bone, U = InstanceType<T> | Collection<InstanceType<T>> | ResultSet | number | null> extends Promise<U> {
  constructor(Model: T, opts: SpellOptions);

  select(...names: Array<string | RawSql> | Array<(name: string) => boolean>): Spell<T, U>;
  insert(opts: SetOptions): Spell<T, QueryResult>;
  update(opts: SetOptions): Spell<T, QueryResult>;
  upsert(opts: SetOptions): Spell<T, QueryResult>;
  delete(): Spell<T, QueryResult>;

  from(table: string | Spell<T>): Spell<T, U>;

  with(opts: WithOptions): Spell<T, U>;
  with(...qualifiers: string[]): Spell<T, U>;

  join<V extends typeof Bone>(Model: V, onConditions: string, ...values: Literal[]): Spell<T, U>;
  join<V extends typeof Bone>(Model: V, onConditions: WhereConditions<T>): Spell<T, U>;

  $where(conditions: WhereConditions<T>): this;
  $where(conditions: string, ...values: Literal[]): this;
  where(conditions: WhereConditions<T>): Spell<T, U>;
  where(conditions: string, ...values: Literal[]): Spell<T, U>;

  orWhere(conditions: WhereConditions<T>): Spell<T, U>;
  orWhere(conditions: string, ...values: Literal[]): Spell<T, U>;

  group(...names: Array<string | RawSql>): Spell<T, ResultSet>;

  having(conditions: string, ...values: Literal[]): Spell<T, ResultSet>;
  having(conditions: WhereConditions<T>): Spell<T, ResultSet>;

  orHaving(conditions: string, ...values: Literal[]): Spell<T, ResultSet>;
  orHaving(conditions: WhereConditions<T>): Spell<T, ResultSet>;

  order(name: string, order?: 'desc' | 'asc'): Spell<T, U>;
  order(opts: OrderOptions): Spell<T, U>;

  offset(skip: number): Spell<T, U>;
  limit(skip: number): Spell<T, U>;

  count(name?: string): Spell<T, Extract<U, ResultSet | number>>;
  average(name?: string): Spell<T, Extract<U, ResultSet | number>>;
  minimum(name?: string): Spell<T, Extract<U, ResultSet | number>>;
  maximum(name?: string): Spell<T, Extract<U, ResultSet | number>>;
  sum(name?: string): Spell<T, Extract<U, ResultSet | number>>;

  batch(size?: number): AsyncIterable<T>;

  increment(name: string, by?: number, options?: QueryOptions): Spell<T, QueryResult>;
  decrement(name: string, by?: number, options?: QueryOptions): Spell<T, QueryResult>;

  toSqlString(): string;
  toString(): string;
}

type Literal = null | undefined | boolean | number | bigint | string | Date | object | ArrayBuffer;

type OperatorCondition = {
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

type WhereConditions<T extends typeof Bone> = {
  [Property in keyof Extract<InstanceType<T>, Literal>]?: Literal | Literal[] | OperatorCondition;
}

type Values<T extends typeof Bone> = {
  [Property in keyof Extract<InstanceType<T>, Literal>]?: Literal;
}

type InstanceValues<T> = {
  [Property in keyof Extract<T, Literal>]?: Extract<T, Literal>[Property]
}

export interface AttributeMeta {
  columnName?: string;
  columnType?: string;
  allowNull?: boolean;
  defaultValue?: Literal;
  primaryKey?: boolean;
  dataType?: string;
  jsType?: Literal;
  type: DataType;
  toSqlString: () => string;
}

interface RelateOptions {
  className?: string;
  foreignKey?: string;
}

interface QueryOptions {
  validate?: boolean;
  individualHooks?: boolean;
  hooks?: boolean;
  paranoid?: boolean;
  silent?: boolean;
}

interface QueryResult {
  insertId?: number;
  affectedRows?: number;
  rows?: Array<Record<string, Literal>>,
  fields?: Array<{ table: string, name: string }>,
}

interface Connection {
  /**
   * MySQL
   */
  query(
    query: string,
    values: Array<Literal | Literal[]>,
  ): Promise<QueryResult>;
}

declare class Pool {
  getConnection(): Connection;
}

declare class Driver {
  /**
   * The type of driver, currently there are mysql, sqlite, and postgres
   */
  type: string;

  /**
   * The database current driver is using.
   */
  database: string;

  /**
   * The connection pool of the driver.
   */
  pool: Pool;

  /**
   * Grab a connection and query the database
   */
  query(sql: string, values?: Array<Literal | Literal[]>): Promise<QueryResult>;
}

type ResultSet = {
  [key: string]: Literal
};

export class Collection<T extends Bone> extends Array<T> {
  save(): Promise<void>;
  toJSON(): Object[];
  toObject(): Object[];
}

export class Bone {
  static DataTypes: DataType;

  /**
   * get the connection pool of the driver
   */
  static pool: Pool;

  /**
   * The driver that powers the model
   */
  static driver: Driver;

  /**
   * The connected models structured as `{ [model.name]: model }`, e.g. `Bone.model.Post => Post`
   */
  static models: { [key: string]: typeof Bone };

  /**
   * The table name of the model, which needs to be specified by the model subclass.
   */
  static table: string;

  /**
   * The plural model name in camelCase, e.g. `Post => posts`
   */
  static tableAlias: string;

  /**
   * The primary key of the model, defaults to `id`.
   */
  static primaryKey: string;

  /**
   * The primary column of the table, defaults to `id`. This is {@link Bone.primaryKey} in snake case.
   */
  static primaryColumn: string;

  /**
   * The attribute definitions of the model.
   */
  static attributes: { [key: string]: DataTypes<DataType> | AttributeMeta };

  /**
   * The schema info of current model.
   */
  static columns: Array<AttributeMeta>;

  /**
   * If the table consists of multiple partition tables then a sharding key is needed to perform actual query. The sharding key can be specified through overridding this property, which will then be used to check the query before it hits database.
   */
  static shardingKey: string;

  /**
   * If the table name is just an alias and the schema info can only be fetched by one of its partition table names, physic tables should be specified.
   */
  static physicTables: string[];

  /**
   * restore rows
   * @example
   * Bone.restore({ title: 'aaa' })
   * Bone.restore({ title: 'aaa' }, { hooks: false })
   * @param conditions query conditions
   * @param opts query options
   */
  static restore<T extends typeof Bone>(this: T, conditions: Object, opts?: QueryOptions): Spell<T, number>;

  /**
   * Override attribute metadata
   * @example
   * Bone.attribute('foo', { type: JSON })
   */
  static attribute(name: string, meta: AttributeMeta): void;

  /**
   * Rename attribute
   * @example
   * Bone.renameAttribute('foo', 'bar')
   */
  static renameAttribute(originalName: string, newName: string): void;

  static alias(name: string): string;
  static alias(data: Record<string, Literal>): Record<string, Literal>;

  static hasOne(name: string, opts?: RelateOptions): void;
  static hasMany(name: string, opts?: RelateOptions): void;
  static belongsTo(name: string, opts?: RelateOptions): void;

  /**
   * INSERT rows
   * @example
   * Bone.create({ foo: 1, bar: 'baz' })
   */
  static create<T extends typeof Bone>(this: T, values: Values<T>, options?: QueryOptions): Promise<InstanceType<T>>;

  /**
   * INSERT or UPDATE rows
   * @example
   * Bone.upsert(values, { hooks: false })
   * @param values values
   * @param opt query options
   */
  static upsert<T extends typeof Bone>(this: T, values: Object, options?: QueryOptions): Spell<T, number>;

  /**
   * Batch INSERT
   */
  static bulkCreate<T extends typeof Bone>(this: T, records: Array<Record<string, Literal>>, options?: QueryOptions): Promise<Array<InstanceType<T>>>;

  /**
   * SELECT rows
   * @example
   * Bone.find('foo = ?', 1)
   * Bone.find({ foo: { $eq: 1 } })
   */
  static find<T extends typeof Bone>(this: T, whereConditions: WhereConditions<T>): Spell<T, Collection<InstanceType<T>>>;
  static find<T extends typeof Bone>(this: T, whereConditions: string, ...values: Literal[]): Spell<T, Collection<InstanceType<T>>>;
  static find<T extends typeof Bone>(this: T, ): Spell<T, Collection<InstanceType<T>>>;

  /**
   * SELECT all rows. In production, when the table is at large, it is not recommended to access records in this way. To iterate over all records, {@link Bone.batch} shall be considered as the better alternative. For tables with soft delete enabled, which means they've got `deletedAt` attribute, use {@link Bone.unscoped} to discard the default scope.
   */
  static all: Spell<typeof Bone, Collection<Bone>>;

  /**
   * Discard all the applied scopes.
   * @example
   * Bone.all.unscoped  // includes soft deleted rows
   */
  static unscoped: Spell<typeof Bone>;

  /**
   * SELECT rows LIMIT 1. Besides limiting the results to one rows, the type of the return value is different from {@link Bone.find} too. If no results were found, {@link Bone.findOne} returns null. If results were found, it returns the found record instead of wrapping them as a collection.
   * @example
   * Bone.findOne('foo = ?', 1)
   * Bone.findOne({ foo: { $eq: 1 } })
   */
  static findOne<T extends typeof Bone>(this: T, whereConditions: WhereConditions<T>): Spell<T, InstanceType<T> | null>;
  static findOne<T extends typeof Bone>(this: T, whereConditions: string, ...values: Literal[]): Spell<T, InstanceType<T> | null>;
  static findOne<T extends typeof Bone>(this: T, ): Spell<T, InstanceType<T> | null>;

  /**
   * SELECT rows OFFSET index LIMIT 1
   * @example
   * Bone.get(8)
   * Bone.find({ foo: { $gt: 1 } }).get(42)
   */
  static get<T extends typeof Bone>(this: T, index: number): Spell<T, InstanceType<T> | null>;

  /**
   * SELECT rows ORDER BY id ASC LIMIT 1
   */
  static first: Spell<typeof Bone, Bone | null>;

  /**
   * SELECT rows ORDER BY id DESC LIMIT 1
   */
  static last: Spell<typeof Bone, Bone | null>;

  /**
   * Short of `Bone.find().with(...names)`
   * @example
   * Post.include('author', 'comments').where('posts.id = ?', 1)
   */
  static include<T extends typeof Bone>(this: T, ...names: string[]) : Spell<T>;

  /**
   * Whitelist SELECT fields by names or filter function
   * @example
   * Bone.select('foo')
   * Bone.select('foo, bar')
   * Bone.select('foo', 'bar')
   * Bone.select('MONTH(date), foo + 1')
   * Bone.select(name => name !== foo)
   */
  static select<T extends typeof Bone>(this: T, ...names: string[]): Spell<T>;
  static select<T extends typeof Bone>(this: T, filter: (name: string) => boolean): Spell<T>;

  /**
   * JOIN arbitrary models with given ON conditions
   * @example
   * Bone.join(Muscle, 'bones.id == muscles.boneId')
   */
  static join<T extends typeof Bone>(this: T, Model: Bone, onConditions: string, ...values: Literal[]): Spell<T, Collection<InstanceType<T>>>;
  static join<T extends typeof Bone>(this: T, Model: Bone, onConditions: WhereConditions<T>): Spell<T, Collection<InstanceType<T>>>;

  /**
   * Set WHERE conditions
   * @example
   * Bone.where('foo = ?', 1)
   * Bone.where({ foo: { $eq: 1 } })
   */
  static where<T extends typeof Bone>(this: T, whereConditions: string, ...values: Literal[]): Spell<T, Collection<InstanceType<T>>>;
  static where<T extends typeof Bone>(this: T, whereConditions: WhereConditions<T>): Spell<T, Collection<InstanceType<T>>>;

  /**
   * Set GROUP fields
   * @example
   * Bone.group('foo')
   * Bone.group('MONTH(createdAt)')
   */
  static group<T extends typeof Bone>(this: T, ...names: string[]): Spell<T, ResultSet>;

  /**
   * Set ORDER fields
   * @example
   * Bone.order('foo')
   * Bone.order('foo', 'desc')
   * Bone.order({ foo: 'desc' })
   */
  static order<T extends typeof Bone>(this: T, name: string, order?: 'desc' | 'asc'): Spell<T>;
  static order<T extends typeof Bone>(this: T, opts: OrderOptions): Spell<T>;

  static count<T extends typeof Bone>(this: T, name?: string): Spell<T, ResultSet | number>;
  static average<T extends typeof Bone>(this: T, name?: string): Spell<T, ResultSet | number>;
  static minimum<T extends typeof Bone>(this: T, name?: string): Spell<T, ResultSet | number>;
  static maximum<T extends typeof Bone>(this: T, name?: string): Spell<T, ResultSet | number>;
  static sum<T extends typeof Bone>(this: T, name?: string): Spell<T, ResultSet | number>;

  /**
   * UPDATE rows.
   */
  static update<T extends typeof Bone>(this: T, whereConditions: WhereConditions<T>, values?: Object, opts?: QueryOptions): Spell<T, number>;

  /**
   * Remove rows. If soft delete is applied, an UPDATE query is performed instead of DELETing records directly. Set `forceDelete` to true to force a `DELETE` query.
   */
  static remove<T extends typeof Bone>(this: T, whereConditions: WhereConditions<T>, forceDelete?: boolean, opt?: QueryOptions): Spell<T, number>;

  /**
   * Grabs a connection and starts a transaction process. Both GeneratorFunction and AsyncFunction are acceptable. If GeneratorFunction is used, the connection of the transaction process will be passed around automatically.
   * @example
   * Bone.transaction(function* () {
   *   const bone = yield Bone.create({ foo: 1 })
   *   yield Muscle.create({ boneId: bone.id, bar: 1 })
   * });
   */
  static transaction(callback: GeneratorFunction): Promise<void>;
  static transaction(callback: (connection: Connection) => Promise<void>): Promise<void>;

  /**
   * DROP the table
   */
  static drop(): Promise<void>;

  /**
   * TRUNCATE table to clear records.
   */
  static truncate(): Promise<void>;

  static sync(options: SyncOptions): Promise<void>;

  static initialize(): void;

  constructor(values: { [key: string]: Literal });

  /**
   * @example
   * bone.attribute('foo');     // => 1
   * bone.attribute('foo', 2);  // => bone
   */
  attribute(name: string, value: Literal): void;
  attribute(name: string): Literal;

  /**
   * Get the original attribute value.
   * @example
   * bone.attributeWas('foo')  // => 1
   */
  attributeWas(name: string): Literal;

  /**
   * See if attribute has been changed or not.
   * @deprecated {@link Bone#changed} is preferred
   * @example
   * bone.attributeChanged('foo')
   */
  attributeChanged(name: string): boolean;

  /**
   * Get changed attributes or check if given attribute is changed or not
   */
  changed(name: string): boolean;
  changed(): Array<string> | false;

  /**
   * Get attribute changes
   */
  changes(name: string): Record<string, [ Literal, Literal ]>;
  changes(): Record<string, [ Literal, Literal ]>;

  /**
   * See if attribute was changed previously or not.
   */
  previousChanged(name: string): boolean;
  previousChanged(): Array<string>;

  previousChanges(name: string): boolean;
  previousChanges(): Array<string>;

  /**
   * Persist changes of current record to database. If current record has never been saved before, an INSERT query is performed. If the primary key was set and is not changed since, an UPDATE query is performed. If the primary key is changed, an INSERT ... UPDATE query is performed instead.
   *
   * If `affectedRows` is needed, consider using the corresponding methods directly.
   * @example
   * new Bone({ foo: 1 }).save()                   // => INSERT
   * new Bone({ foo: 1, id: 1 }).save()            // => INSERT ... UPDATE
   * (await Bone.fist).attribute('foo', 2).save()  // => UPDATE
   * new Bone({ foo: 1, id: 1 }).save({ hooks: false })            // => INSERT ... UPDATE
   */
  save(opts?: QueryOptions): Promise<this>;

  /**
   * Remove current record. If `deletedAt` attribute exists, then instead of DELETing records from database directly, the records will have their `deletedAt` attribute UPDATEd instead. To force `DELETE`, no matter the existence of `deletedAt` attribute, pass `true` as the argument.
   * @example
   * bone.remove()      // => UPDATE ... SET deleted_at = now() WHERE ...
   * bone.remove(true)  // => DELETE FROM ... WHERE ...
   * bone.remove(true, { hooks: false })
   */
  remove(forceDelete?: boolean): Promise<number>;
  remove(forceDelete?: boolean, opts?: QueryOptions): Promise<number>;

  /**
   * update or insert record.
   * @example
   * bone.upsert() // INERT ... VALUES ON DUPLICATE KEY UPDATE ...
   * bone.upsert({ hooks: false })
   * @param opts queryOptions
   */
  upsert(opts?: QueryOptions): Promise<number>;

  /**
   * update rows
   * @param changes data changes
   * @param opts query options
   */
  update(changes: Object, opts?: QueryOptions): Promise<number>;

  /**
   * create instance
   * @param opts query options
   */
  create(opts?: QueryOptions): Promise<this>;

  /**
   * reload instance
   */
  reload(): Promise<this>;

  /**
   * restore data
   * @param opts query options
   */
  restore(opts?: QueryOptions): Promise<this>;

  /**
   * Gets called when `JSON.stringify(instance)` is invoked.
   * {@link Bone#toJSON} might be called on descents of Bone that does not have attributes defined on them directly, hence for..in is preferred.
   * - https://developer.mozilla.org/en-US/docs/Web/JavaScript/Enumerability_and_ownership_of_properties
   * @example
   * const post = await Post.first
   * post.toJSON()  // => { id: 1, ... }
   * @return {Object}
   */
  toJSON(): InstanceValues<this>;

  /**
   * This is the loyal twin of {@link Bone#toJSON} because when generating the result object, the raw values of attributes are used, instead of the values returned by custom getters (if any).
   * {@link Bone#toObject} might be called on descents of Bone that does not have attributes defined on them directly, hence for..in is preferred.
   * - https://developer.mozilla.org/en-US/docs/Web/JavaScript/Enumerability_and_ownership_of_properties
   * @example
   * const post = await Post.first
   * post.toObject()  // => { id: 1, ... }
   * @return {Object}
   */
  toObject(): InstanceValues<this>;
}

export interface ConnectOptions {
  client?: 'mysql' | 'mysql2' | 'pg' | 'sqlite3' | '@journeyapps/sqlcipher';
  dialect?: 'mysql' | 'postgres' | 'sqlite';
  host?: string;
  port?: number | string;
  user?: string;
  password?: string;
  database: string;
  charset?: string;
  models?: string | (typeof Bone)[];
  subclass?: boolean;
}

interface InitOptions {
  underscored?: boolean;
  tableName?: string;
  hooks?: {
    [key in 'beforeCreate' | 'beforeBulkCreate' | 'beforeUpdate' | 'beforeSave' |  'beforeUpsert' | 'beforeRemove' ]: (options: QueryOptions) => Promise<void>
  } | {
    [key in 'afterCreate' | 'afterBulkCreate' | 'afterUpdate' | 'afterSave' | 'afterUpsert' | 'afterRemove' ]: (instance: Bone, result: Object) => Promise<void>
  };
}

interface SyncOptions {
  force?: boolean;
  alter?: boolean;
}

type RawSql = {
  __raw: true,
  value: string,
  type: 'raw',
};

interface RawQueryOptions {
  replacements?: { [key:string]: Literal | Literal[] };
  model: Bone;
  connection: Connection;
}

export default class Realm {
  Bone: typeof Bone;
  DataTypes: typeof DataType;
  driver: Driver;
  models: Record<string, Bone>;

  constructor(options: ConnectOptions);

  define(
    name: string,
    attributes: Record<string, DataTypes<DataType> | AttributeMeta>,
    options?: InitOptions,
    descriptors?: Record<string, Function>,
  ): typeof Bone;

  raw(sql: string): RawSql;

  escape(value: Literal): string;

  query(sql: string, values?: Array<Literal>, options?: RawQueryOptions): ResultSet;

  transaction(callback: GeneratorFunction): Promise<void>;
  transaction(callback: (connection: Connection) => Promise<void>): Promise<void>;

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
