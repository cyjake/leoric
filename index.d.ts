import { Schema } from "inspector";

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

type SpellFactory = (spell: Spell) => Promise<null | number | Collection<Bone> | ResultSet>;

type OrderOptions = { [name: string]: 'desc' | 'asc' };

type SetOptions = { [key: string]: Literal };

type WithOptions = {
  [qualifier: string]: { select: string[], throughRelation: string }
}

declare class Spell {
  constructor(Model: Bone, factory: SpellFactory, opts: SpellOptions);

  select(...names: string[]): Spell & Promise<Bone>;
  insert(opts: SetOptions): Spell & Promise<number>;
  update(opts: SetOptions): Spell & Promise<number>;
  upsert(opts: SetOptions): Spell & Promise<number>;
  delete(): Spell & Promise<number>;

  from(table: string | Spell): Spell & Promise<Bone>;

  with(opts: WithOptions): Spell & Promise<Bone>;
  with(...qualifiers: string[]): Spell & Promise<Bone>;

  join(Model: Bone, onConditions: string, ...values: Literal[]): Spell & Promise<Bone>;
  join(Model: Bone, onConditions: WhereConditions): Spell & Promise<Bone>;

  where(conditions: string, ...values: Literal[]): Spell & Promise<Bone>;
  where(conditions: WhereConditions): Spell & Promise<Bone>;

  orWhere(conditions: string, ...values: Literal[]): Spell & Promise<Bone>;
  orWhere(conditions: WhereConditions): Spell & Promise<Bone>;

  group(...names: string[]): Spell & Promise<ResultSet>;

  having(conditions: string, ...values: Literal[]): Spell & Promise<ResultSet>;
  having(conditions: WhereConditions): Spell & Promise<ResultSet>;

  orHaving(conditions: string, ...values: Literal[]): Spell & Promise<ResultSet>;
  orHaving(conditions: WhereConditions): Spell & Promise<ResultSet>;

  order(name: string, order?: 'desc' | 'asc'): Spell & Promise<Bone>;
  order(opts: OrderOptions): Spell & Promise<Bone>;

  offset(skip: number): Spell & Promise<Bone>;
  limit(skip: number): Spell & Promise<Bone>;

  count(name?: string): Spell & Promise<ResultSet>;
  average(name?: string): Spell & Promise<ResultSet>;
  minimum(name?: string): Spell & Promise<ResultSet>;
  maximum(name?: string): Spell & Promise<ResultSet>;
  sum(name?: string): Spell & Promise<ResultSet>;

  batch(size?: number): AsyncIterable<Bone>;

  toSqlString(): string;
  toString(): string;
}

type Pool = Object;

type Literal = null | boolean | number | string | Date

type OperatorCondition = {
  [key in '$eq' | '$ne']?: Literal;
} & {
  [key in '$in' | '$nin' | '$notIn']?: Literal[] | Set<Literal>;
} & {
  [key in '$like' | '$notLike']?: Literal[];
} & {
  [key in '$gt' | '$gte' | '$lt' | '$lte']?: number;
} & {
  [key in '$between' | '$notBetween']?: [number, number] | [Date, Date];
};

interface WhereConditions {
  [key: string]: Literal | Literal[] | OperatorCondition;
}

interface Attributes {
  [key: string]: Literal;
}

interface AttributeMeta {
  column: string,
  columnType: string,
  isNullable: boolean,
  type: boolean | number | string | Date | JSON;
}

interface RelateOptions {
  className?: string;
  foreignKey?: string;
}

type ResultSet = Attributes[] | { [qualifier: string]: Attributes }[]

declare class Collection<Bone> extends Array<Bone> {
  save(): Promise<void>;
  toJSON(): Object[];
  toObject(): Object[];
}

type Query = Spell & Promise<Collection<Bone>>;

declare class Bone {
  /**
   * The connection pool of the specified client, with few `Leoric_` prefixed methods extended to eliminate client differences.
   */
  static pool: Pool;

  /**
   * The connected models structured as `{ [model.name]: model }`, e.g. `Bone.model.Post => Post`
   */
  static model: { [key: string]: Bone };

  /**
   * The table name of current model, which needs to be specified by the model subclass.
   */
  static table: string;

  /**
   * The plural model name in camelCase, e.g. `Post => posts`
   */
  static aliasName: string;

  /**
   * The primary key of current model, defaults to `id`.
   */
  static primaryKey: string;

  /**
   * The attribute names of current model, which is converted from field names of the table in camelCase.
   */
  static attributes: string[];

  /**
   * The schema info of current model.
   */
  static schema: { [key: string]: AttributeMeta };

  /**
   * If the table consists of multiple partition tables then a sharding key is needed to perform actual query. The sharding key can be specified through overridding this property, which will then be used to check the query before it hits database.
   */
  static shardingKey: string;

  /**
   * If the table name is just an alias and the schema info can only be fetched by one of its partition table names, physic tables should be specified.
   */
  static physicTables: string[];

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

  static hasOne(name: string, opts?: RelateOptions): void;
  static hasMany(name: string, opts?: RelateOptions): void;
  static belongsTo(name: string, opts?: RelateOptions): void;

  /**
   * INSERT rows
   * @example
   * Bone.create({ foo: 1, bar: 'baz' })
   */
  static create(attributes: Attributes): Promise<Bone>;

  /**
   * SELECT rows
   * @example
   * Bone.find('foo = ?', 1)
   * Bone.find({ foo: { $eq: 1 } })
   */
  static find(whereConditions: string, ...values: Literal[]): Query;
  static find(whereConditions: WhereConditions): Query;
  static find(): Query;

  /**
   * SELECT all rows. In production, when the table is at large, it is not recommended to access records in this way. To iterate over all records, {@link Bone.batch} shall be considered as the better alternative. For tables with soft delete enabled, which means they've got `deletedAt` attribute, use {@link Bone.unscoped} to discard the default scope.
   */
  static all: Query;

  /**
   * Discard all the applied scopes.
   * @example
   * Bone.all.unscoped  // includes soft deleted rows
   */
  static unscoped: Query;

  /**
   * SELECT rows LIMIT 1. Besides limiting the results to one rows, the type of the return value is different from {@link Bone.find} too. If no results were found, {@link Bone.findOne} returns null. If results were found, it returns the found record instead of wrapping them as a collection.
   * @example
   * Bone.findOne('foo = ?', 1)
   * Bone.findOne({ foo: { $eq: 1 } })
   */
  static findOne(whereConditions: string, ...values: Literal[]): Spell & Promise<Bone | null>;
  static findOne(whereConditions: WhereConditions): Spell & Promise<Bone | null>;
  static findOne(): Spell & Promise<Bone | null>;

  /**
   * SELECT rows OFFSET index LIMIT 1
   * @example
   * Bone.get(8)
   * Bone.find({ foo: { $gt: 1 } }).get(42)
   */
  static get(index: number): Spell & Promise<Bone | null>;

  /**
   * SELECT rows ORDER BY id ASC LIMIT 1
   */
  static first: Spell & Promise<Bone | null>;

  /**
   * SELECT rows ORDER BY id DESC LIMIT 1
   */
  static last: Spell & Promise<Bone | null>;

  /**
   * Short of `Bone.find().with(...names)`
   * @example
   * Post.include('author', 'comments').where('posts.id = ?', 1)
   */
  static include(...names: string[]) : Query;

  /**
   * Whitelist SELECT fields by names or filter function
   * @example
   * Bone.select('foo')
   * Bone.select('foo, bar')
   * Bone.select('foo', 'bar')
   * Bone.select('MONTH(date), foo + 1')
   * Bone.select(name => name !== foo)
   */
  static select(...names: string[]): Query;
  static select(filter: (name: string) => boolean): Query;

  /**
   * JOIN arbitrary models with given ON conditions
   * @example
   * Bone.join(Muscle, 'bones.id == muscles.boneId')
   */
  static join(Model: Bone, onConditions: string, ...values: Literal[]): Query;
  static join(Model: Bone, onConditions: WhereConditions): Query;

  /**
   * Set WHERE conditions
   * @example
   * Bone.where('foo = ?', 1)
   * Bone.where({ foo: { $eq: 1 } })
   */
  static where(whereConditions: string, ...values: Literal[]): Query;
  static where(whereConditions: WhereConditions): Query;

  /**
   * Set GROUP fields
   * @example
   * Bone.group('foo')
   * Bone.group('MONTH(createdAt)')
   */
  static group(...names: string[]): Spell & Promise<ResultSet>;

  /**
   * Set ORDER fields
   * @example
   * Bone.order('foo')
   * Bone.order('foo', 'desc')
   * Bone.order({ foo: 'desc' })
   */
  static order(name: string, order?: 'desc' | 'asc'): Query;
  static order(opts: OrderOptions): Query;

  static count(name?: string): Spell & Promise<ResultSet>;
  static average(name?: string): Spell & Promise<ResultSet>;
  static minimum(name?: string): Spell & Promise<ResultSet>;
  static maximum(name?: string): Spell & Promise<ResultSet>;
  static sum(name?: string): Spell & Promise<ResultSet>;

  /**
   * UPDATE rows.
   */
  static update(whereConditions: WhereConditions): Spell & Promise<number>;

  /**
   * Remove rows. If soft delete is applied, an UPDATE query is performed instead of DELETing records directly. Set `forceDelete` to true to force a `DELETE` query.
   */
  static remove(whereConditions: WhereConditions, forceDelete?: boolean): Spell & Promise<number>;

  /**
   * Grabs a connection and starts a transaction process. Notice that `GeneratorFunction` is expected instead of other function types because Leoric needs to interfere the asynchronous process within that function by passing the grabbed connection around before the queries are actually performed.
   * @example
   * Bone.transaction(function* () {
   *   const bone = yield Bone.create({ foo: 1 })
   *   yield Muscle.create({ boneId: bone.id, bar: 1 })
   * })
   */
  static transaction(callback: GeneratorFunction): Promise<void>;

  constructor(attributes: Attributes);

  /**
   * Get or set attribute value. Getting the value of unset attribute gives an error.
   * @example
   * bone.attribute('foo')     // => 1
   * bone.attribute('foo', 2)  // => bone
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
   * @example
   * bone.attributeChanged('foo')
   */
  attributeChanged(name: string): boolean;

  /**
   * Persist changes of current record to database. If current record has never been saved before, an INSERT query is performed. If the primary key was set and is not changed since, an UPDATE query is performed. If the primary key is changed, an INSERT ... UPDATE query is performed instead.
   *
   * If `affectedRows` is needed, consider using the corresponding methods directly.
   * @example
   * new Bone({ foo: 1 }).save()                   // => INSERT
   * new Bone({ foo: 1, id: 1 }).save()            // => INSERT ... UPDATE
   * (await Bone.fist).attribute('foo', 2).save()  // => UPDATE
   */
  save(): Promise<this>;

  /**
   * Remove current record. If `deletedAt` attribute exists, then instead of DELETing records from database directly, the records will have their `deletedAt` attribute UPDATEd instead. To force `DELETE`, no matter the existence of `deletedAt` attribute, pass `true` as the argument.
   * @example
   * bone.remove()      // => UPDATE ... SET deleted_at = now() WHERE ...
   * bone.remove(true)  // => DELETE FROM ... WHERE ...
   */
  remove(forceDelete?: boolean): number;
}

interface ConnectOptions {
  client?: 'mysql' | 'mysql2' | 'postgres';
  host: string;
  user: string;
  database: string;
  models: string | Bone[];
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
export function connect(opts: ConnectOptions): Promise<Pool>;
