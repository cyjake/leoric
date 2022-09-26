import DataTypes, { AbstractDataType, DataType } from "../data_types";
import { 
  Pool, Literal, WhereConditions,
  Collection, ResultSet, OrderOptions,
  QueryOptions, AttributeMeta, AssociateOptions, Values, Connection, BulkCreateOptions, 
  GeneratorReturnType,
} from './common';
import { AbstractDriver } from '../drivers';
import { Spell } from '../spell';

interface SyncOptions {
  force?: boolean;
  alter?: boolean;
}

interface TransactionOptions {
  connection: Connection;
}

export class AbstractBone {
  static DataTypes: typeof DataTypes;

  /**
   * get the connection pool of the driver
   */
  static pool: Pool;

  /**
   * The driver that powers the model
   */
  static driver: AbstractDriver;

  /**
   * The connected models structured as `{ [model.name]: model }`, e.g. `Bone.model.Post => Post`
   */
  static models: { [key: string]: typeof AbstractBone };

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
  static attributes: { [key: string]: AbstractDataType<DataType> | AttributeMeta };

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

  isNewRecord: boolean;

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
  static unalias(name: string): string;

  static hasOne(name: string, opts?: AssociateOptions): void;
  static hasMany(name: string, opts?: AssociateOptions): void;
  static belongsTo(name: string, opts?: AssociateOptions): void;

  /**
   * INSERT rows
   * @example
   * Bone.create({ foo: 1, bar: 'baz' })
   */
  static create<T extends typeof AbstractBone>(this: T, values: Values<InstanceType<T>> & Record<string, any>, options?: QueryOptions): Promise<InstanceType<T>>;

  /**
   * INSERT or UPDATE rows
   * @example
   * Bone.upsert(values, { hooks: false })
   * @param values values
   * @param opt query options
   */
  static upsert<T extends typeof AbstractBone>(this: T, values: Object, options?: QueryOptions): Spell<T, number>;

  /**
   * Batch INSERT
   */
  static bulkCreate<T extends typeof AbstractBone>(this: T, records: Array<Record<string, Literal>>, options?: BulkCreateOptions): Promise<Array<InstanceType<T>>>;

  /**
   * SELECT all rows. In production, when the table is at large, it is not recommended to access records in this way. To iterate over all records, {@link Bone.batch} shall be considered as the better alternative. For tables with soft delete enabled, which means they've got `deletedAt` attribute, use {@link Bone.unscoped} to discard the default scope.
   */
  static all: Spell<typeof AbstractBone, Collection<AbstractBone>>;

  /**
   * SELECT rows OFFSET index LIMIT 1
   * @example
   * Bone.get(8)
   * Bone.find({ foo: { $gt: 1 } }).get(42)
   */
  static get<T extends typeof AbstractBone>(this: T, index: number): Spell<T, InstanceType<T> | null>;

  /**
   * SELECT rows ORDER BY id ASC LIMIT 1
   */
  static first: Spell<typeof AbstractBone, AbstractBone | null>;

  /**
   * SELECT rows ORDER BY id DESC LIMIT 1
   */
  static last: Spell<typeof AbstractBone, AbstractBone | null>;

  /**
   * Short of `Bone.find().with(...names)`
   * @example
   * Post.include('author', 'comments').where('posts.id = ?', 1)
   */
  static include<T extends typeof AbstractBone>(this: T, ...names: string[]) : Spell<T>;

  /**
   * Whitelist SELECT fields by names or filter function
   * @example
   * Bone.select('foo')
   * Bone.select('foo, bar')
   * Bone.select('foo', 'bar')
   * Bone.select('MONTH(date), foo + 1')
   * Bone.select(name => name !== foo)
   */
  static select<T extends typeof AbstractBone>(this: T, ...names: string[]): Spell<T>;
  static select<T extends typeof AbstractBone>(this: T, filter: (name: string) => boolean): Spell<T>;

  /**
   * JOIN arbitrary models with given ON conditions
   * @example
   * Bone.join(Muscle, 'bones.id == muscles.boneId')
   */
  static join<T extends typeof AbstractBone>(this: T, Model: AbstractBone, onConditions: string, ...values: Literal[]): Spell<T, Collection<InstanceType<T>>>;
  static join<T extends typeof AbstractBone>(this: T, Model: AbstractBone, onConditions: WhereConditions<T>): Spell<T, Collection<InstanceType<T>>>;

  /**
   * Set WHERE conditions
   * @example
   * Bone.where('foo = ?', 1)
   * Bone.where({ foo: { $eq: 1 } })
   */
  static where<T extends typeof AbstractBone>(this: T, whereConditions: string, ...values: Literal[]): Spell<T, Collection<InstanceType<T>>>;
  static where<T extends typeof AbstractBone>(this: T, whereConditions: WhereConditions<T>): Spell<T, Collection<InstanceType<T>>>;

  /**
   * Set GROUP fields
   * @example
   * Bone.group('foo')
   * Bone.group('MONTH(createdAt)')
   */
  static group<T extends typeof AbstractBone>(this: T, ...names: string[]): Spell<T, ResultSet<T>>;

  /**
   * Set ORDER fields
   * @example
   * Bone.order('foo')
   * Bone.order('foo', 'desc')
   * Bone.order({ foo: 'desc' })
   */
  static order<T extends typeof AbstractBone>(this: T, name: string, order?: 'desc' | 'asc'): Spell<T>;
  static order<T extends typeof AbstractBone>(this: T, opts: OrderOptions<T>): Spell<T>;

  static count<T extends typeof AbstractBone>(this: T, name?: string): Spell<T, ResultSet<T> | number>;
  static average<T extends typeof AbstractBone>(this: T, name?: string): Spell<T, ResultSet<T> | number>;
  static minimum<T extends typeof AbstractBone>(this: T, name?: string): Spell<T, ResultSet<T> | number>;
  static maximum<T extends typeof AbstractBone>(this: T, name?: string): Spell<T, ResultSet<T> | number>;

  /**
   * Remove rows. If soft delete is applied, an UPDATE query is performed instead of DELETing records directly. Set `forceDelete` to true to force a `DELETE` query.
   */
  static remove<T extends typeof AbstractBone>(this: T, whereConditions: WhereConditions<T>, forceDelete?: boolean, opt?: QueryOptions): Spell<T, number>;

  /**
   * Grabs a connection and starts a transaction process. Both GeneratorFunction and AsyncFunction are acceptable. If GeneratorFunction is used, the connection of the transaction process will be passed around automatically.
   * @example
   * Bone.transaction(function* () {
   *   const bone = yield Bone.create({ foo: 1 })
   *   yield Muscle.create({ boneId: bone.id, bar: 1 })
   * });
   */
  static transaction<T extends (options: { connection: Connection }) => Generator>(callback: T): Promise<GeneratorReturnType<ReturnType<T>>>;
  static transaction<T extends (options: { connection: Connection }) => Promise<any>>(callback: T): Promise<ReturnType<T>>;
  
  static describe(): Promise<{[key: string]: any[]}>;

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

  constructor(values: { [key: string]: Literal }, opts?: { isNewRecord?: boolean });

  /**
   * @example
   * bone.attribute('foo');     // => 1
   * bone.attribute('foo', 2);  // => bone
   */
  attribute<T, Key extends keyof T>(this: T, name: Key, value: T[Key]): void;
  attribute<T, Key extends keyof T>(this: T, name: Key): T[Key];

  /**
   * Get the original attribute value.
   * @example
   * bone.attributeWas('foo')  // => 1
   */
  attributeWas<T, Key extends keyof Values<T>>(this: T, key: Key): T[Key];

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
  update(changes?: { [key: string]: Literal } | { [Property in keyof Extract<this, Literal>]?: Literal }, opts?: QueryOptions): Promise<number>;

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
  toJSON(): Values<this>;

  /**
   * This is the loyal twin of {@link Bone#toJSON} because when generating the result object, the raw values of attributes are used, instead of the values returned by custom getters (if any).
   * {@link Bone#toObject} might be called on descents of Bone that does not have attributes defined on them directly, hence for..in is preferred.
   * - https://developer.mozilla.org/en-US/docs/Web/JavaScript/Enumerability_and_ownership_of_properties
   * @example
   * const post = await Post.first
   * post.toObject()  // => { id: 1, ... }
   * @return {Object}
   */
  toObject(): Values<this>;
}
