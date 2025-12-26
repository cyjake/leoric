import util, { isDeepStrictEqual } from 'util';
import Debug from 'debug';
import pluralize from 'pluralize';
import DataTypes, { AbstractDataType, DataType } from './data_types';
import Collection from './collection';
import Spell from './spell';
import Raw, { rawQuery } from './raw';
import SqlString from 'sqlstring';
import 'reflect-metadata';
import {
  Pool, Literal, WhereConditions,
  QueryOptions, AttributeMeta, AssociateOptions, Connection,
  BoneColumns,
  ColumnMeta,
  BeforeHooksType, AfterHooksType,
  QueryResult,
  BoneCreateValues,
  BulkCreateOptions,
  Values,
} from './types/common';
import { AbstractDriver, ConnectOptions } from './drivers';
import { capitalize, camelCase, snakeCase } from './utils/string';
import { hookNames, setupSingleHook } from './setup_hooks';
import {
  TIMESTAMP_NAMES,
  LEGACY_TIMESTAMP_COLUMN_MAP,
  ASSOCIATE_METADATA_MAP,
  TIMESTAMP_ATTRIBUTE_NAMES,
  IS_LEORIC_BONE,
} from './constants';
import { executeValidator, LeoricValidateError } from './validator';
import Attribute, { AttributeParams } from './drivers/abstract/attribute';

interface SyncOptions {
  force?: boolean;
  alter?: boolean;
}

export interface InitOptions {
  underscored?: boolean;
  tableName?: string;
  hooks?: {
    [key in BeforeHooksType ]: (options: QueryOptions) => Promise<void>
  } | {
    [key in AfterHooksType ]: (instance: AbstractBone, result: object) => Promise<void>
  };
  timestamps?: boolean;
}

const columnAttributesKey = Symbol('leoric#columnAttributes');
const synchronizedKey = Symbol('leoric#synchronized');
const tableKey = Symbol('leoric#table');

const debug = Debug('leoric');

export class AbstractBone {
  static DataTypes: typeof DataTypes = DataTypes.invokable;

  // eslint-disable-next-line no-undef
  [key: string]: any;

  // private state
  #raw: Record<string, any> = {};
  #rawSaved: Record<string, any> = {};
  #rawUnset: Set<string> = new Set();
  #rawPrevious: Record<string, any> = {};

  isNewRecord = true;

  static [columnAttributesKey]: { [key: string]: Attribute } | null;
  static [synchronizedKey]: boolean;
  static [tableKey]: string;

  static get synchronized(): boolean {
    return this[synchronizedKey];
  }
  static set synchronized(value: boolean) {
    this[synchronizedKey] = value;
  }

  /**
   * The driver that powers the model
   */
  static driver: AbstractDriver;

  /**
   * The connected models structured as `{ [model.name]: model }`, e.g. `Bone.model.Post => Post`
   */
  static models: { [key: string]: typeof AbstractBone };

  /**
   * The plural model name in camelCase, e.g. `Post => posts`
   */
  static tableAlias: string;

  /**
   * The primary key of the model, defaults to `id`.
   */
  static primaryKey = 'id';

  /**
   * The primary column of the table, defaults to `id`. This is {@link Bone.primaryKey} in snake case.
   */
  static get primaryColumn(): string {
    return this.unalias(this.primaryKey);
  }

  /**
   * The attribute definitions of the model.
   */
  static attributes: { [key: string]: Attribute };

  /**
   * The attribute definitions of the model, referenced by column name.
   */
  static attributeMap: { [key: string]: Attribute };

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

  static get physicTable(): string {
    const { physicTables } = this;
    if (physicTables && physicTables.length > 0) {
      return physicTables[0];
    }
    return this.table || snakeCase(pluralize(this.name));
  }

  static set table(value: string) {
    this[tableKey] = value;
  }

  static get table(): string {
    return this[tableKey];
  }


  static options: ConnectOptions;

  static timestamps: { createdAt: string; updatedAt: string; deletedAt: string };

  static _scope: (spell: Spell<typeof AbstractBone>) => void;

  static associations: { [key: string]: any };

  constructor(values?: { [key: string]: Literal }, opts: { isNewRecord?: boolean } = {}) {
    Object.defineProperty(this, 'isNewRecord', {
      value: opts.isNewRecord !== undefined ? opts.isNewRecord : true,
      configurable: true,
      enumerable: false,
      writable: true,
    });
    setDefaultValue(values, (this.constructor as typeof AbstractBone).attributes);
    if (values) {
      for (const name in values) {
        this[name] = values[name];
      }
    }
  }

  static get shardingColumn(): string | undefined {
    if (this.shardingKey) return this.unalias(this.shardingKey);
  }

  /**
   * get the connection pool of the driver
   */
  static get pool(): Pool {
    return this.driver.pool;
  }

  /**
   * Override attribute metadata
   * @example
   * Bone.attribute('foo', { type: JSON })
   */
  static attribute(name: string, meta: AttributeMeta): void {
    const attribute = this.attributes[name];
    if (!attribute) {
      throw new Error(`${this.name} has no attribute called ${name}`);
    }
    const { type: jsType } = meta as any;
    if (jsType === JSON) attribute.type = new this.driver.DataTypes.JSON();
    Object.assign(attribute, { jsType });
  }

  /**
   * Model.hasAttribute(name)
   * @static
   * @param {string} name
   * @returns {boolean}
   */
  static hasAttribute(name: string): boolean {
    if (!name) return false;
    const { attributes } = this;
    return attributes.hasOwnProperty(name);
  }

  /**
   * get attributes except virtuals
   */
  static get columnAttributes() {
    if (this[columnAttributesKey]) return this[columnAttributesKey];
    const { attributes } = this;
    this[columnAttributesKey] = {};
    for (const key in this.attributes) {
      if (!attributes[key].virtual) this[columnAttributesKey][key] = attributes[key];
    }
    return this[columnAttributesKey];
  }

  /**
   * get actual update/insert columns to avoid empty insert or update
   * @param {Object} data
   */
  static _getColumns(data: Record<string, Literal>): Record<string, Literal> {
    if (!Object.keys(data).length) return data;
    const attributes = this.columnAttributes;
    const res: Record<string, Literal> = {};
    for (const key in data) {
      if (attributes[key]) res[key] = data[key];
    }
    return res;
  }

  /**
   * Rename attribute
   * @example
   * Bone.renameAttribute('foo', 'bar')
   */
  static renameAttribute<T extends typeof AbstractBone>(this: T, originalName: any, newName: string): void {
    const { attributes, attributeMap } = this;
    if (attributes.hasOwnProperty(newName)) {
      throw new Error(`unable to override existing attribute "${newName}"`);
    }
    if (attributes.hasOwnProperty(originalName)) {
      const info = attributes[originalName];
      info.name = newName;
      attributes[newName] = info;
      attributeMap[info.columnName] = info;
      delete attributes[originalName];
      Reflect.deleteProperty(this.prototype, originalName);
      this.loadAttribute(newName);
    }
    this[columnAttributesKey] = null;
  }

  static alias<T extends typeof AbstractBone>(this: T, name: BoneColumns<T>): string;
  static alias<T extends typeof AbstractBone>(this: T, data: { [key in BoneColumns<T>]: Literal }): Record<string, Literal>;
  static alias<T extends typeof AbstractBone>(this: T, name: string): string;
  static alias<T extends typeof AbstractBone>(this: T, data: Record<string, Literal>): Record<string, Literal>;
  static alias<T extends typeof AbstractBone>(
    this: T,
    data: string | BoneColumns<T> | { [key in BoneColumns<T>]: Literal } | Record<string, Literal>
  ): string | Record<string, Literal> {
    const { attributeMap } = this;
    if (typeof data === 'string') {
      const result = attributeMap[data];
      return result ? result.name : data;
    }
    const result: Record<string, any> = {};
    for (const key in data as Record<string, Literal>) {
      const value = (data as any)[key];
      const attribute = attributeMap[key];
      if (attribute) {
        result[attribute.name] = attribute.cast(value);
      } else {
        result[key] = value;
      }
    }
    return result;
  }

  static unalias(name: string): string {
    if (name in this.attributes) {
      return this.attributes[name].columnName;
    }
    return name;
  }

  /**
   * Load attribute definition to merge default getter/setter and custom descriptor on prototype
   */
  static loadAttribute(name: string): void {
    const descriptor = Object.getOwnPropertyDescriptor(this.prototype, name);
    const customDescriptor = Object.keys(descriptor || {}).reduce((result: any, key) => {
      if ((descriptor as any)[key] != null) result[key] = (descriptor as any)[key];
      return result;
    }, {});
    Object.defineProperty(this.prototype, name, {
      get() {
        return this.attribute(name); }
        ,
      set(value: any) {
        return this.attribute(name, value); }
        ,
      ...customDescriptor,
      enumerable: true,
      configurable: true,
    });
  }

  static hasOne(name: string, options?: AssociateOptions): void {
    options = ({
      className: capitalize(name),
      foreignKey: camelCase(`${this.name}Id`),
      ...options,
      hasMany: false,
    });
    if (options.through) options.foreignKey = '';
    this.associate(name, options);
  }

  static hasMany(name: string, options?: AssociateOptions): void {
    options = ({
      className: capitalize(pluralize(name, 1)),
      foreignKey: camelCase(`${this.name}Id`),
      ...options,
      hasMany: true,
    });
    if (options.through) options.foreignKey = '';
    this.associate(name, options);
  }

  static belongsTo(name: string, options: AssociateOptions = {} as any): void {
    const { className = capitalize(name) } = options;
    options = ({
      className,
      foreignKey: camelCase(`${className}Id`),
      ...options as Partial<AssociateOptions>,
    });
    this.associate(name, { ...options, belongsTo: true });
  }

  /**
   * Mount association metadata, verifying existence and applying paranoid defaults.
   */
  static associate(name: string, opts: AssociateOptions): void {
    if (name in this.associations) {
      throw new Error(`duplicated association "${name}" on model ${this.name}`);
    }
    const { className } = opts;
    const Model = this.models[className];
    if (!Model) throw new Error(`unable to find associated model "${className}" (model ${this.name})`);
    if (opts.foreignKey && Model.attributes[opts.foreignKey] && Model.attributes[opts.foreignKey].virtual) {
      throw new Error(`unable to use virtual attribute ${opts.foreignKey} as foreign key in model ${Model.name}`);
    }
    const { deletedAt } = Model.timestamps;
    if (Model.attributes[deletedAt]) opts.where = { [deletedAt]: null, ...opts.where };
    this.associations[name] = { ...opts, Model };
  }

  /**
   * INSERT rows
   * @example
   * Bone.create({ foo: 1, bar: 'baz' })
   */
  static create<T extends typeof AbstractBone>(this: T, values: BoneCreateValues<T>, opts: QueryOptions = {}) {
    const data = Object.assign({}, values);
    const instance = new this(data);
    return instance.create({ ...opts });
  }

  /**
   * INSERT or UPDATE rows
   * @example
   * Bone.upsert(values, { hooks: false })
   * @param values values
   * @param opt query options
   */
  static upsert<T extends typeof AbstractBone>(this: T, values: BoneCreateValues<T>, options: QueryOptions = {}): Promise<number> {
    const data: Record<string, Literal> = {};
    const { attributes } = this;
    for (const key of Object.keys(attributes) as Array<keyof BoneCreateValues<T>>) {
      const attribute = attributes[key];
      if (values[key] == null && attribute.defaultValue != null) {
        data[key] = attribute.defaultValue;
      } else if (values[key] !== undefined) {
        data[key] = values[key];
      }
    }

    if (!Object.keys(this._getColumns(data)).length) {
      return Promise.resolve(0);
    }

    const { createdAt, updatedAt } = this.timestamps;
    if (attributes[createdAt] && !data[createdAt]) data[createdAt] = new Date();
    if (attributes[updatedAt] && !data[updatedAt]) data[updatedAt] = new Date();
    if (options.validate !== false) this._validateAttributes(data);
    const spell = new Spell<T, number>(this, options).$upsert(data);
    return spell.later((result: any) => result.affectedRows);
  }

  static async bulkCreate<T extends typeof AbstractBone>(
    this: T,
    records: Array<BoneCreateValues<T>>,
    options?: BulkCreateOptions,
  ): Promise<InstanceType<T>[]>

  /**
   * Batch INSERT
   */
  static async bulkCreate<T extends typeof AbstractBone>(
    this: T,
    records: Array<Record<string, Literal>>,
    options: BulkCreateOptions = {},
  ): Promise<InstanceType<T>[]> {
    if (!records || !records.length) return records as InstanceType<T>[];
    const { attributes, driver, primaryKey, primaryColumn } = this;
    const { createdAt, updatedAt } = this.timestamps;
    const now = new Date();
    for (const entry of records) {
      if (createdAt && entry[createdAt] == null) entry[createdAt] = now;
      if (updatedAt && entry[updatedAt] == null) entry[updatedAt] = now;
      setDefaultValue(entry, attributes);
    }
    const unset = records.every(entry => entry[primaryKey] == null);
    const allset = records.every(entry => entry[primaryKey] != null);
    const opts: BulkCreateOptions & {
      returning?: string[];
      attributes: Record<string, Attribute>;
      primaryKey: string;
      uniqueKeys?: string[];
    } = { ...options, attributes, primaryKey: primaryColumn };
    if (driver.type === 'postgres') opts.returning = [ primaryColumn ];
    const attribute = attributes[primaryKey];
    const autoIncrement = attribute.autoIncrement || (attribute.jsType == Number && attribute.primaryKey);
    if (options.validate !== false) records.map(entry => this._validateAttributes(entry));
    const instances = records.map(entry => new this(entry) as InstanceType<T>);
    if (options.individualHooks) {
      await Promise.all(instances.map(instance => instance.save(options)));
      return instances;
    }
    if (Array.isArray(opts.updateOnDuplicate)) {
      opts.updateOnDuplicate = opts.updateOnDuplicate.map((field: string) => this.unalias(field));
    }
    if (Array.isArray(opts.uniqueKeys)) {
      opts.uniqueKeys = opts.uniqueKeys.map((field: string) => this.unalias(field));
    }
    records = instances.map(instance => (instance as any).getRaw());
    if (!(autoIncrement && unset || allset)) {
      if (options.validate !== false) {
        for (const record of records) this._validateAttributes(record);
      }
      return await new Spell<T, InstanceType<T>[]>(this, options).$bulkInsert(records);
    }
    const result: any = await new Spell(this, options).$bulkInsert(records);
    const { affectedRows, rows } = result;
    let { insertId } = result;
    if (Array.isArray(rows)) {
      for (let i = 0; i < rows.length; i++) {
        const value = (attribute.jsType as any)(rows[i][primaryColumn]);
        Object.assign(instances[i], { [primaryKey]: value });
      }
    } else if (unset && affectedRows === instances.length) {
      if (['sqlite', 'sqljs'].includes(driver.type)) {
        for (let i = instances.length - 1; i >= 0; i--) {
          (instances[i] as any)[primaryKey] = insertId--;
        }
      } else {
        for (const entry of instances) (entry as any)[primaryKey] = insertId++;
      }
    }
    for (const entry of instances) entry.syncRaw();
    return instances;
  }

  /**
   * SELECT all rows. In production, when the table is at large, it is not recommended to access records in this way. To iterate over all records, {@link Bone.batch} shall be considered as the better alternative. For tables with soft delete enabled, which means they've got `deletedAt` attribute, use {@link Bone.unscoped} to discard the default scope.
   */
  static get all() {
    return this._find() as Spell<typeof AbstractBone, Collection<InstanceType<typeof AbstractBone>>>;
  }

  /**
   * SELECT rows OFFSET index LIMIT 1
   * @example
   * Bone.get(8)
   * Bone.find({ foo: { $gt: 1 } }).get(42)
   */
  static get<T extends typeof AbstractBone>(this: T, index: number) {
    return this._find().$get(index) as Spell<T, InstanceType<T> | null>;
  }

  /**
   * SELECT rows ORDER BY id ASC LIMIT 1
   */
  static get first(): Spell<typeof AbstractBone, InstanceType<typeof AbstractBone> | null> {
    return this._find().first;
  }

  /**
   * SELECT rows ORDER BY id DESC LIMIT 1
   */
  static get last(): Spell<typeof AbstractBone, InstanceType<typeof AbstractBone> | null> {
    return this._find().last;
  }

  /**
   * Short of `Bone.find().with(...names)`
   * @example
   * Post.include('author', 'comments').where('posts.id = ?', 1)
   */
  static include(...names: string[]): any {
    return this._find().$with(...names);
  }

  /**
   * Start a find query by creating and returning Spell
   */
  static find(conditions: any, ...values: any[]): any {
    return this._find(conditions, ...values);
  }

  /**
   * Internal finder powering all query starts.
   */
  static _find<T extends typeof AbstractBone>(this: T, conditions?: WhereConditions<T> | string | number | number[] | bigint | bigint[], ...values: Literal[]) {
    const conditionsType = typeof conditions;
    const options = (values.length == 1 && typeof values[0] === 'object' ? values[0] : undefined) as QueryOptions;
    const spell = new Spell<T>(this, options);
    if (Array.isArray(conditions) || conditionsType == 'number') {
      spell.$where({ [this.primaryKey]: conditions });
    } else if (typeof conditions === 'object' && options) {
      spell.$where(conditions);
    } else if (conditions) {
      spell.$where(conditions, ...values);
    }
    if (options) {
      for (const method of [ 'order', 'limit', 'offset', 'select' ]) {
        const value = (options as any)[method];
        if (value != null) (spell as any)[`$${method}`](value);
      }
    }
    return spell.later(Collection.init);
  }

  static select<T extends typeof AbstractBone>(this: T, ...names: Array<BoneColumns<T>> | string[]): Spell<T>;
  static select<T extends typeof AbstractBone>(this: T, ...names: string[]): Spell<T>;
  static select<T extends typeof AbstractBone>(this: T, ...names: Raw[]): Spell<T>;
  static select<T extends typeof AbstractBone>(this: T, filter: (name: string) => boolean): Spell<T>;
  /**
   * Whitelist SELECT fields by names or filter function
   * @example
   * Bone.select('foo')
   * Bone.select('foo, bar')
   * Bone.select('foo', 'bar')
   * Bone.select('MONTH(date), foo + 1')
   * Bone.select(name => name !== foo)
   */
  static select<T extends typeof AbstractBone>(this: T, ...names: Array<BoneColumns<T> | string | Raw> | [(name: string) => boolean]): Spell<T> {
    return this._find().$select(...names);
  }

  /**
   * JOIN arbitrary models with given ON conditions
   * @example
   * Bone.join(Muscle, 'bones.id == muscles.boneId')
   */
  static join<T extends typeof AbstractBone>(this: T, ...args: Parameters<typeof Spell.prototype.$join>) {
    return this._find().$join(...args) as Spell<T, Collection<InstanceType<T>>>;
  }

  /**
   * Set WHERE conditions
   * @example
   * Bone.where('foo = ?', 1)
   * Bone.where({ foo: { $eq: 1 } })
   */
  static where<T extends typeof AbstractBone>(this: T, ...args: Parameters<typeof Spell.prototype.$where>) {
    return this._find().$where(...args) as Spell<T, Collection<InstanceType<T>>>;
  }

  /**
   * Set GROUP fields
   * @example
   * Bone.group('foo')
   * Bone.group('MONTH(createdAt)')
   */
  static group<T extends typeof AbstractBone>(this: T, ...names: Parameters<typeof Spell.prototype.$group>) {
    return this._find().$group(...names);
  }

  /**
   * Set ORDER fields
   * @example
   * Bone.order('foo')
   * Bone.order('foo', 'desc')
   * Bone.order({ foo: 'desc' })
   */
  static order<T extends typeof AbstractBone>(this: T, ...args: Parameters<typeof Spell.prototype.$order>) {
    return this._find().$order(...args);
  }

  static count<T extends typeof AbstractBone>(this: T, name?: BoneColumns<T> | Raw | string) {
    return this._find().$count(name);
  }

  static average<T extends typeof AbstractBone>(this: T, name: BoneColumns<T> | Raw | string) {
    return this._find().$average(name);
  }

  static minimum<T extends typeof AbstractBone>(this: T, name: BoneColumns<T> | Raw | string) {
    return this._find().$minimum(name);
  }

  static maximum<T extends typeof AbstractBone>(this: T, name: BoneColumns<T> | Raw | string) {
    return this._find().$maximum(name);
  }

  /**
   * Update any record that matches conditions.
   */
  static update(conditions: any, values: any = {}, options: any = {}): any {
    const { attributes } = this;
    const data = Object.assign({}, values);
    const { updatedAt, deletedAt } = this.timestamps;
    if (attributes[updatedAt] && !data[updatedAt] && !data[deletedAt] && !options.silent) {
      data[updatedAt] = new Date();
    }
    if (!options || options.validate !== false) {
      const validateData = copyValues(values);
      const instance = new this(validateData);
      (instance as any)._validateAttributes(validateData);
    }
    let spell: any = new Spell(this, options).$where(conditions).$update(data);
    if (options && options.paranoid === false) spell = spell.unparanoid;
    return (spell as any).later((result: any) => result.affectedRows);
  }

  /**
   * JSON merge convenience for update
   */
  static jsonMerge<T extends typeof AbstractBone, Key extends keyof Values<T>>(
    this: T,
    conditions: WhereConditions<T>,
    values: Record<Key, Record<string, Literal> | Raw>,
    options: QueryOptions & { preserve?: boolean } = {},
  ): Promise<number> {
    const { preserve, ...restOptions } = options;
    const method = preserve ? 'JSON_MERGE_PRESERVE' : 'JSON_MERGE_PATCH';
    const data = { ...values };
    for (const [name, value] of Object.entries(values)) {
      if (value != null && typeof value === 'object') {
        data[name as Key] = new Raw(`${method}(COALESCE(${name}, '{}'), ${SqlString.escape(JSON.stringify(value))})`);
      } else {
        data[name as Key] = value as Record<string, Literal>;
      }
    }
    return this.update(conditions, data, restOptions);
  }

  static jsonMergePreserve<T extends typeof AbstractBone, Key extends keyof Values<T>>(
    this: T,
    conditions: WhereConditions<T>,
    values: Record<Key, Record<string, Literal>>,
    options: QueryOptions,
  ): Promise<number> {
    return this.jsonMerge(conditions, values, { ...options, preserve: true });
  }

  /**
   * Remove rows. If soft delete is applied, an UPDATE query is performed instead of DELETing records directly. Set `forceDelete` to true to force a `DELETE` query.
   */
  static remove(conditions: any, forceDelete = false, options?: any): any {
    return this._remove(conditions, forceDelete, options);
  }

  /**
   * private method for internal calling
   * Remove any record that matches `conditions`.
   * - If `forceDelete` is true, `DELETE` records from database permanently.
   * - If not, update `deletedAt` attribute with current date.
   * - If `forceDelete` isn't true and `deleteAt` isn't around, throw an Error.
   * @example
   * Post.remove({ title: 'Leah' })         // mark Post { title: 'Leah' } as deleted
   * Post.remove({ title: 'Leah' }, true)   // delete Post { title: 'Leah' }
   * Post.remove({}, true)                  // delete all data of posts
   */
  static _remove<T extends typeof AbstractBone>(
    this: T,
    conditions: WhereConditions<T>,
    forceDelete = false,
    options: QueryOptions,
  ) {
    const { deletedAt } = this.timestamps;
    if (forceDelete !== true && this.attributes[deletedAt]) {
      return AbstractBone.update.call(this, conditions, { [deletedAt]: new Date() }, {
        ...options,
        hooks: false, // should not run hooks again
      });
    }

    const spell = new Spell(this, options).unscoped.$where(conditions).$delete();
    return spell.later(result => {
      return result.affectedRows;
    });
  }

  static async query(sql: string, values: Literal[], opts: QueryOptions) {
    return await rawQuery(this.driver, sql, values, { model: this, ...opts });
  }

  /**
   * Grabs a connection and starts a transaction process. Both GeneratorFunction and AsyncFunction are acceptable. If GeneratorFunction is used, the connection of the transaction process will be passed around automatically.
   * @example
   * Bone.transaction(function* () {
   *   const bone = yield Bone.create({ foo: 1 })
   *   yield Muscle.create({ boneId: bone.id, bar: 1 })
   * });
   */
  static async transaction<
    T extends (
      options: {
        connection: Connection;
        commit: () => Promise<QueryResult>;
        rollback: () => Promise<QueryResult>;
      }
    ) => Promise<any> | Generator
  >(
    callback: T,
  ): Promise<ReturnType<T>> {
    const driver = this.driver;
    const connection = await driver.getConnection();
    const begin = async () => await driver.begin({ Model: this, connection });
    const commit = async () => await driver.commit({ Model: this, connection });
    const rollback = async () => await driver.rollback({ Model: this, connection });
    let result;
    if (callback.constructor.name === 'AsyncFunction') {
      await begin();
      try {
        result = await callback({ connection, commit, rollback });
        await commit();
      } catch (err) {
        await rollback();
        throw err;
      } finally {
        connection.release();
      }
    } else if (callback.constructor.name === 'GeneratorFunction') {
      const gen = callback({ connection, commit, rollback }) as Generator;
      try {
        await begin();
        while (true) {
          const { value: spell, done } = gen.next(result);
          if (spell instanceof Spell) (spell as any).connection = connection;
          result = spell && typeof (spell as any).then === 'function' ? await spell : spell;
          if (done) break;
        }
        await commit();
      } catch (err) {
        await rollback();
        throw err;
      } finally {
        connection.release();
      }
    } else {
      throw new Error('unexpected transaction function, should be GeneratorFunction or AsyncFunction.');
    }
    return result;
  }

  static async describe() {
    return await this.driver?.describeTable(this.physicTable);
  }

  /**
   * DROP the table
   */
  static async drop(): Promise<void> {
    await this.driver?.dropTable(this.table);
  }

  /**
   * TRUNCATE table to clear records.
   */
  static async truncate(): Promise<void> {
    await this.driver?.truncateTable(this.table);
  }

  static async sync({ force = false, alter = false }: SyncOptions = {}): Promise<void> {
    const { physicTable: table } = this;
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const database = this.options.database!;
    const driver = this.driver;
    if (!this.hasOwnProperty(synchronizedKey)) {
      const schemaInfo = await driver.querySchemaInfo(database, [ table ]);
      this.load(schemaInfo[table]);
    }
    if (this.synchronized) return;
    if (this.physicTables) throw new Error('unable to sync model with custom physic tables');
    const { columnAttributes: attributes, columns } = this;
    const columnMap = columns.reduce((result: any, entry: any) => {
      result[entry.columnName] = entry;
      return result;
    }, {});
    if (columns.length === 0) {
      await driver.createTable(table, attributes);
    } else {
      if (force) {
        await driver.dropTable(table);
        await driver.createTable(table, attributes);
      } else if (alter) {
        await driver.alterTable(table, compare(attributes, columnMap));
      } else {
        console.warn(`[synchronize_fail] ${this.name} couldn't be synchronized, please use force or alter to specify execution`);
      }
    }
    const schemaInfo = await driver.querySchemaInfo(database, table);
    this.load(schemaInfo[table]);
  }

  static initialize(): void {
    for (const [key, metadataKey] of Object.entries(ASSOCIATE_METADATA_MAP)) {
      const result = (Reflect as any).getMetadata(metadataKey, this);
      for (const property in result) {
        this[key as keyof typeof ASSOCIATE_METADATA_MAP].call(this, property, (result as any)[property]);
      }
    }
  }

  static instantiate<T extends typeof AbstractBone>(this: T, row: any): InstanceType<T> {
    const { attributes, attributeMap } = this;
    const instance = new this();
    const skipCloneValue = this.options?.skipCloneValue === true;
    for (const columnName in row) {
      const value = row[columnName];
      const attribute = attributeMap[columnName];
      if (attribute) {
        const castedValue = attribute.cast(value);
        instance._setRaw(attribute.name, castedValue);
        instance._setRawSaved(attribute.name, skipCloneValue ? attribute.cast(value) : cloneValue(castedValue));
      } else {
        if (value != null && typeof value == 'object') instance[columnName] = value;
        else if (!isNaN(value as any)) instance[columnName] = Number(value);
        else if (!isNaN(Date.parse(value))) instance[columnName] = new Date(value);
        else instance[columnName] = value;
      }
    }
    for (const name in attributes) {
      const attribute = attributes[name];
      if (!(attribute.columnName in row) && !attribute.virtual) {
        instance._getRawUnset().add(name);
      }
    }
    instance.isNewRecord = false;
    return instance as InstanceType<T>;
  }

  static init(attributes: Record<string, AbstractDataType<DataType> | AttributeMeta>, opts: InitOptions = {}, overrides: Record<string, PropertyDescriptor> = {}): void {
    const { hooks, paranoid, tableName: table, timestamps } = {
      underscored: true,
      timestamps: true,
      tableName: this.table,
      hooks: {},
      ...(this.options && this.options.define),
      ...opts as any,
    } as any;
    if (timestamps) {
      const names = [ 'createdAt', 'updatedAt' ];
      if (paranoid) names.push('deletedAt');
      for (const name of names) {
        if (!(attributes as any)[name] && !(attributes as any)[snakeCase(name)]) {
          (attributes as any)[name] = (DataTypes as any).DATE;
        }
      }
    }
    const customDescriptors = Object.getOwnPropertyDescriptors(overrides);
    Object.defineProperties(this.prototype, customDescriptors);
    const hookMethods = (hookNames as any).reduce(function(result: any, key: string) {
      const method = (hooks as any)[key];
      if (typeof method === 'function') result[key] = method;
      return result;
    }, {});
    this[columnAttributesKey] = null;
    this[tableKey] = table;
    Object.defineProperties(this, looseReadonly({ ...hookMethods, attributes }));
  }

  static load<T extends typeof AbstractBone>(this: T, columns: Array<ColumnMeta> = []): void {
    // eslint-disable-next-line @typescript-eslint/no-shadow
    const { Attribute } = this.driver;
    const { associations = {}, attributes, options } = this;
    const attributeMap: any = {};
    const table = this.table || snakeCase(pluralize(this.name));
    const tableAlias = camelCase(pluralize((this.name || table)));
    if (Object.values(attributes as Record<string, AttributeParams>).every((attribute) => !attribute.primaryKey)) {
      (attributes[this.primaryKey] as AttributeParams) = {
        type: DataTypes.BIGINT,
        allowNull: false,
        autoIncrement: true,
        columnName: snakeCase(this.primaryKey),
        ...attributes[this.primaryKey] as AttributeParams,
        primaryKey: true,
      };
    }
    const columnMap = (columns as any).reduce((result: any, entry: any) => { result[entry.columnName] = entry; return result; }, {});
    for (const name of Object.keys(attributes)) {
      const attribute = new Attribute(name, (attributes as any)[name], options.define);
      attributeMap[attribute.columnName] = attribute;
      (attributes as any)[name] = attribute;
      if (TIMESTAMP_ATTRIBUTE_NAMES.includes(name)) {
        const { columnName } = attribute;
        const legacyColumnName = (LEGACY_TIMESTAMP_COLUMN_MAP as any)[columnName];
        if (!columnMap[columnName] && legacyColumnName && columnMap[legacyColumnName]) {
          attribute.columnName = legacyColumnName;
          attributeMap[attribute.columnName] = attribute;
        }
      }
      const columnInfo = columnMap[attribute.columnName];
      if (columnInfo && attribute.type instanceof DataTypes.DATE && attribute.type.precision == null) {
        attribute.type.precision = columnInfo.datetimePrecision;
      }
    }
    const primaryKey = Object.keys(attributes).find(key => (attributes as any)[key].primaryKey);
    const timestamps: any = {};
    for (const key of TIMESTAMP_NAMES) {
      const name = (attributes).hasOwnProperty(key) ? key : snakeCase(key);
      const attribute = (attributes)[name];
      if (attribute && columnMap[attribute.columnName]) timestamps[key] = name;
    }
    for (const name in attributes) this.loadAttribute(name);
    const diff = compare((attributes), columnMap);
    Object.defineProperties(this, looseReadonly({ timestamps, primaryKey, columns, attributeMap, associations, tableAlias }));
    this[tableKey] = table;
    this[synchronizedKey] = Object.keys(diff).length === 0;
    if (!this.synchronized) {
      debug(`[load] ${this.name} \`${this.table}\` out of sync %j`, Object.keys(diff));
    }
    for (const hookName of hookNames) {
      if (this[hookName as keyof T]) {
        setupSingleHook(this, hookName, this[hookName as keyof T] as any);
      }
    }
    this[columnAttributesKey] = null;
  }

  static from<T extends typeof AbstractBone>(this: T, table: string | Spell<T>) {
    return new Spell(this).$from(table);
  }

  // raw accessors
  getRaw(key?: string) {
    if (key) return this.#raw[key];
    return this.#raw;
  }

  getRawSaved(key?: string) {
    if (key) return this.#rawSaved[key];
    return this.#rawSaved;
  }

  getRawPrevious(key?: string) {
    if (key) return this.#rawPrevious[key];
    return this.#rawPrevious;
  }

  _setRaw(...args: any[]): void {
    const [ name, value ] = args as any;
    if (args.length > 1) {
      this.#raw[name] = value;
    } else if (args.length === 1 && name !== undefined && typeof name === 'object') {
      this.#raw = name;
    }
  }

  _getRawUnset(): Set<string> {
    return this.#rawUnset;
  }

  _setRawSaved(key: string, value: any): void {
    this.#rawSaved[key] = value;
  }

  attribute<T, Key extends keyof Values<T>, U extends T[Key]>(this: T, name: Key): U extends Literal ? U : Literal;
  attribute<T, Key extends keyof T, U extends T[Key]>(this: T, name: Key): U extends Literal ? U : Literal;
  attribute<T, Key extends keyof Values<T>>(this: T, name: Key, value: Literal): this
  attribute<T, Key extends keyof T>(this: T, name: Key, value: Literal): this

  /**
   * @example
   * bone.attribute('foo');     // => 1
   * bone.attribute('foo', 2);  // => bone
   */
  attribute(name: string, value?: Literal): this | Literal {
    const { attributes } = (this.constructor as typeof AbstractBone);
    const attribute = attributes[name];
    if (!attribute) throw new Error(`${(this.constructor as typeof AbstractBone).name} has no attribute "${name}"`);
    if (arguments.length > 1) {
      this.#raw[name] = value instanceof Raw ? value : attribute.cast(value);
      this.#rawUnset.delete(name);
      return this;
    }
    if (this.#rawUnset.has(name)) return;
    const rawValue = this.#raw[name];
    return rawValue == null ? null : rawValue;
  }

  /**
   * instance.hasAttribute(name)
   * @param {string} name
   * @returns {boolean}
   */
  hasAttribute(name: string): boolean {
    if (!name) return false;
    const { attributes } = (this.constructor as any);
    return attributes.hasOwnProperty(name);
  }

  /**
   * Get the original attribute value.
   * @example
   * bone.attributeWas('foo')  // => 1
   */
  attributeWas(name: string): any {
    const value = this.#rawSaved[name];
    return value == null ? null : value;
  }

  /**
   * See if attribute has been changed or not.
   * @deprecated {@link Bone#changed} is preferred
   * @example
   * bone.attributeChanged('foo')
   */
  attributeChanged(name: string): boolean {
    if (this.#rawUnset.has(name) || !this.hasAttribute(name)) return false;
    const value = this.attribute(name);
    const valueWas = this.attributeWas(name);
    return !isDeepStrictEqual(value, valueWas);
  }

  /**
   * Get changed attributes or check if given attribute is changed or not
   */
  changed(): string[] | false;
  changed(name: string): boolean;
  changed(name?: string): string[] | boolean {
    const result = Object.keys(this.changes(name));
    if (name != null) return !!result.length;
    return result.length > 0 ? result : false;
  }

  /**
   * Get attribute changes
   */
  changes(name?: string): Record<string, [ any, any ]> {
    if (name != null) {
      if (this.#rawUnset.has(name) || !this.hasAttribute(name)) return {};
      const value = this.attribute(name);
      const valueWas = this.attributeWas(name);
      if (isDeepStrictEqual(value, valueWas)) return {};
      return { [name]: [ valueWas, value ] };
    }
    const result: Record<string, [ any, any ]> = {};
    for (const attrKey of Object.keys((this.constructor as any).attributes)) {
      if (this.#rawUnset.has(attrKey)) continue;
      const value = this.attribute(attrKey);
      const valueWas = this.attributeWas(attrKey);
      if (!isDeepStrictEqual(value, valueWas)) result[attrKey] = [ valueWas, value ];
    }
    return result;
  }

  /**
   * See if attribute was changed previously or not.
   */
  previousChanged(name?: string): any {
    const result = Object.keys(this.previousChanges(name as any));
    if (name != null) return !!result.length;
    return result.length > 0 ? result : false;
  }

  previousChanges(name?: string): Record<string, [ any, any ]> {
    if (name != null) {
      if (this.#rawUnset.has(name) || this.#rawPrevious[name] === undefined || !this.hasAttribute(name)) {
        return {};
      }
      const value = this.attribute(name);
      const valueWas = this.#rawPrevious[name] == null ? null : this.#rawPrevious[name];
      if (isDeepStrictEqual(value, valueWas)) return {};
      return { [name]: [ valueWas, value ] };
    }
    const result: Record<string, [ any, any ]> = {};
    for (const attrKey of Object.keys((this.constructor as any).attributes)) {
      if (this.#rawUnset.has(attrKey) || this.#rawPrevious[attrKey] === undefined) continue;
      const value = this.attribute(attrKey);
      const valueWas = this.#rawPrevious[attrKey] == null ? null : this.#rawPrevious[attrKey];
      if (!isDeepStrictEqual(value, valueWas)) result[attrKey] = [ valueWas, value ];
    }
    return result;
  }

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
  save(opts?: QueryOptions): Promise<this> {
    return this._save(opts);
  }

  /**
   * Internal save dispatcher deciding between create/update/upsert
   */
  async _save(opts: QueryOptions = {}): Promise<this> {
    const { primaryKey } = (this.constructor as any);
    if (this.#rawUnset.has(primaryKey)) throw new Error(`unset primary key ${primaryKey}`);
    if (this[primaryKey] == null) {
      await this.create(opts);
    } else if (this.changed(primaryKey)) {
      await this.upsert(opts);
    } else {
      const changeValues: Record<string, Literal> = {};
      const changedKeys = this.changed();
      if (changedKeys) {
        for (const name of changedKeys as any) changeValues[name] = this.attribute(name);
      }
      await this.update(changeValues, opts);
    }
    return this;
  }

  /**
   * Sync raw caches after persistence
   */
  syncRaw(): void {
    const { attributes } = (this.constructor as typeof AbstractBone);
    this.isNewRecord = false;
    for (const name of Object.keys(attributes)) {
      const attribute = attributes[name];
      let value: any;
      try { value = attribute.uncast(this.#raw[name]); }
      catch (error) { console.error(error); value = this.#raw[name]; }
      if (this.#rawSaved[name] !== undefined) this.#rawPrevious[name] = this.#rawSaved[name];
      else if (this.#rawPrevious[name] === undefined && this.#raw[name] != null) this.#rawPrevious[name] = null;
      this.#rawSaved[name] = attribute.cast(value);
    }
  }

  /**
   * Remove current record. If `deletedAt` attribute exists, then instead of DELETing records from database directly, the records will have their `deletedAt` attribute UPDATEd instead. To force `DELETE`, no matter the existence of `deletedAt` attribute, pass `true` as the argument.
   * @example
   * bone.remove()      // => UPDATE ... SET deleted_at = now() WHERE ...
   * bone.remove(true)  // => DELETE FROM ... WHERE ...
   * bone.remove(true, { hooks: false })
   */
  async remove(forceDelete?: boolean, opts: QueryOptions = {}): Promise<number> {
    return await this._remove(forceDelete, opts);
  }

  /**
   * Delete current instance. If `deletedAt` attribute exists, calling {@link Bone#remove} does not actually delete the record from the database. Instead, it updates the value of `deletedAt` attribute to current date. This is called [soft delete](../querying#scopes). To force a regular `DELETE`, use `.remove(true)`.
   * @private
   * @param {boolean} forceDelete
   * @example
   * const post = await Post.first
   * post.remove()      // update the `deletedAt`
   * post.remove(true)  // delete record
   */
  async _remove(forceDelete?: boolean, opts: QueryOptions = {}) {
    const Model = this.constructor as typeof AbstractBone;
    const { primaryKey, shardingKey, attributes, timestamps } = Model;
    const { deletedAt } = timestamps;

    if (this[primaryKey] == null) {
      throw new Error('instance is not persisted yet.');
    }

    const condition = { [primaryKey]: this[primaryKey] };
    if (shardingKey) condition[shardingKey] = this[shardingKey];


    if (!forceDelete && attributes[deletedAt]) {
      const result = this._update({
        [deletedAt]: new Date(),
      }, opts);
      return result;
    }
    return await Model._remove(condition, forceDelete, opts);
  }

  /**
   * update or insert record.
   * @example
   * bone.upsert() // INERT ... VALUES ON DUPLICATE KEY UPDATE ...
   * bone.upsert({ hooks: false })
   * @param opts queryOptions
   */
  upsert(opts: QueryOptions = {}): Promise<number> {
    return this._upsert(opts);
  }

  /**
   * Internal upsert implementation
   */
  _upsert(opts: QueryOptions): Promise<number> {
    const data: Record<string, Literal> = {};
    const Model = this.constructor as typeof AbstractBone;
    const { attributes, primaryKey } = Model;
    for (const name in attributes) {
      if (this.changed(name)) data[name] = this.attribute(name);
    }
    if (!Object.keys(Model._getColumns(data)).length) {
      this.syncRaw();
      return Promise.resolve(0);
    }
    const { createdAt, updatedAt } = Model.timestamps;
    if (attributes[createdAt] && !this[createdAt]) data[createdAt] = new Date();
    if (attributes[updatedAt] && !(this[updatedAt] && this.changed('updatedAt'))) data[updatedAt] = new Date();
    if (this[primaryKey]) data[primaryKey] = this[primaryKey];
    if (opts.validate !== false) this._validateAttributes(data);
    const spell = new Spell<typeof Model, number>(Model, opts).$upsert(data);
    return spell.later((result: QueryResult) => {
      if (this[primaryKey] == null) this[primaryKey] = result.insertId;
      this.syncRaw();
      return result.affectedRows;
    });
  }

  /**
   * update rows
   * @param changes data changes
   * @param opts query options
   */
  async update(
    values?: Record<string, Literal | Raw>,
    options: QueryOptions & { fields?: string[] } = {},
  ): Promise<number> {
    const changes: Record<string, Literal | Raw> = {};
    const originalValues = Object.assign({}, this.#raw);
    const { fields = [] } = options;
    if (typeof values === 'object') {
      for (const name in values) {
        const value = values[name];
        if (value instanceof Raw) {
          changes[name] = value;
        } else if (value !== undefined && this.hasAttribute(name) && (!fields.length || (fields as any).includes(name))) {
          this[name] = value;
          changes[name] = this.attribute(name);
        }
      }
    }
    try {
      const res = await this._update(Object.keys(changes).length ? changes : values, options);
      return res;
    } catch (error) {
      this._setRaw(originalValues);
      throw error;
    }
  }

  /**
   * Persist changes on current instance back to database with `UPDATE`.
   * @private
   */
  async _update(values?: Record<string, Literal>, options: QueryOptions = {}): Promise<number> {
    const Model = this.constructor as typeof AbstractBone;
    const { attributes, primaryKey, shardingKey } = Model;
    const changes: Record<string, Literal> = {};
    if (values == null) {
      for (const name in attributes) {
        if (this.changed(name)) changes[name] = this.attribute(name);
      }
    } else {
      for (const key in values) {
        if (values[key] !== undefined && this.hasAttribute(key)) {
          changes[key] = values[key];
        }
      }
    }

    if (!Object.keys(Model._getColumns(changes)).length) {
      this.syncRaw();
      return Promise.resolve(0);
    }
    if (this[primaryKey] == null) {
      throw new Error(`unset primary key ${primaryKey}`);
    }

    const where = { [primaryKey]: this[primaryKey] };
    if (shardingKey) where[shardingKey] = this[shardingKey];

    const { updatedAt, deletedAt } = Model.timestamps;
    if (attributes[updatedAt] && !changes[updatedAt] && !changes[deletedAt] && !options.silent) {
      changes[updatedAt] = new Date();
    }
    if (options.validate !== false) {
      this._validateAttributes(changes);
    }
    const spell = new Spell<typeof Model, number>(Model, options).$where(where).$update(changes);
    return await spell.later(result => {
      // sync changes (changes has been formatted by custom setters, use this.attribute(name, value) directly)
      for (const key in changes) {
        const value = changes[key];
        if (!(value instanceof Raw)) this.attribute(key, value);
      }
      this.syncRaw();
      return result.affectedRows;
    });
  }


  /**
   * UPDATE JSONB column with JSON_MERGE_PATCH function
   * @example
   * /// before: bone.extra equals { name: 'zhangsan', url: 'https://alibaba.com' }
   * bone.jsonMerge('extra', { url: 'https://taobao.com' })
   * /// after: bone.extra equals { name: 'zhangsan', url: 'https://taobao.com' }
  */
  jsonMerge<Key extends keyof Extract<this, Literal>>(
    values: Record<Key, Record<string, Literal>>,
    opts?: QueryOptions & { preserve?: boolean },
  ): Promise<number>;

  jsonMerge<Key extends keyof Extract<this, Literal>>(
    name: Key,
    jsonValue: Record<string, Literal>,
    opts?: QueryOptions & { preserve?: boolean },
  ): Promise<number>;

  async jsonMerge<Key extends keyof Extract<this, Literal>>(
    name: Key | Record<Key, Record<string, Literal>>,
    jsonValue: Record<Key, Literal> | QueryOptions = {},
    options: QueryOptions & { preserve?: boolean } = {},
  ): Promise<number> {
    const Model = this.constructor as typeof AbstractBone;
    const { primaryKey, shardingKey } = Model;
    if (this[primaryKey] == null) throw new Error(`unset primary key ${primaryKey}`);
    let values: any;
    if (typeof name === 'string') {
      values = { [name]: jsonValue };
    } else {
      values = name;
      options = jsonValue;
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { preserve: _, ...restOptions } = options;
    const where: any = { [primaryKey]: this[primaryKey] };
    if (shardingKey) where[shardingKey] = this[shardingKey];
    const affectedRows = await Model.jsonMerge(where, values, options);
    if (affectedRows > 0) {
      const keys = Object.keys(values);
      const spell = Model._find(where, restOptions).$select(keys).$get(0);
      spell.scopes = [];
      const instance = await spell as InstanceType<typeof Model>;
      if (instance) {
        for (const key of keys) this.attribute(key, instance.attribute(key));
      }
    }
    return affectedRows;
  }

  async jsonMergePreserve<Key extends keyof Extract<this, Literal>>(
    values: Record<Key, Record<string, Literal>>,
    opts?: QueryOptions,
  ): Promise<number>;

  async jsonMergePreserve<Key extends keyof Extract<this, Literal>>(
    name: Key,
    jsonValue: Record<string, Literal>,
    opts?: QueryOptions,
  ): Promise<number>;

  /**
   * UPDATE JSONB column with JSON_MERGE_PRESERVE function
   * @example
   * /// before: bone.extra equals { name: 'zhangsan', url: 'https://alibaba.com' }
   * bone.jsonMergePreserve('extra', { url: 'https://taobao.com' })
   * /// after: bone.extra equals { name: 'zhangsan', url: ['https://alibaba.com', 'https://taobao.com'] }
   */
  async jsonMergePreserve<Key extends keyof Extract<this, Literal>>(
    name: Key | Record<Key, Record<string, Literal>>,
    jsonValue: Record<Key, Literal> | QueryOptions,
    options: QueryOptions = {},
  ): Promise<number> {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    return await this.jsonMerge(name, jsonValue, { ...options, preserve: true });
  }

  /**
   * create instance
   * @param opts query options
   */
  create(opts?: QueryOptions): Spell<typeof AbstractBone, this> | this {
    return this._create(opts);
  }

  /**
   * Internal create implementation
   */
  _create(opts: QueryOptions = {}): Spell<typeof AbstractBone, this> | this {
    const Model = this.constructor as typeof AbstractBone;
    const { primaryKey, attributes } = Model;
    const data: Record<string, Literal> = {};
    const { createdAt, updatedAt } = Model.timestamps;
    if (attributes[createdAt] && !this[createdAt]) this[createdAt] = new Date();
    if (attributes[updatedAt] && !this[updatedAt]) {
      this[updatedAt] = this[createdAt] || new Date();
    }
    const validateValues: Record<string, Literal> = {};
    for (const name in attributes) {
      const value = this.attribute(name);
      const { defaultValue } = attributes[name];
      if (value != null) {
        data[name] = value;
      } else if (value === undefined && defaultValue != null) {
        data[name] = defaultValue;
      }
      if (attributes[name].primaryKey) continue;
      validateValues[name] = data[name];
    }
    if (opts.validate !== false) this._validateAttributes(validateValues);
    if (!Object.keys(Model._getColumns(data)).length) {
      this.syncRaw();
      return this;
    }
    const spell = new Spell<typeof Model, this>(Model, opts).$insert(data);
    return spell.later((result: QueryResult) => {
      if (this[primaryKey] == null) this[primaryKey] = result.insertId;
      this.syncRaw();
      return this;
    });
  }

  /**
   * reload instance
   */
  async reload(): Promise<this> {
    const { primaryKey, shardingKey } = (this.constructor as any);
    const conditions: any = { [primaryKey]: this[primaryKey] };
    if (shardingKey) conditions[shardingKey] = this[shardingKey];
    const spell = (this.constructor as any)._find(conditions).$get(0);
    (spell as any).scopes = [];
    const instance = await spell;
    if (instance) this._clone(instance);
    return instance;
  }

  /**
   * Protected clone
   */
  _clone(target: any): void {
    this.#raw = Object.assign({}, this.getRaw(), target.getRaw());
    this.#rawSaved = Object.assign({}, this.getRawSaved(), target.getRawSaved());
    this.#rawPrevious = Object.assign({}, this.getRawPrevious(), target.getRawPrevious());
    this.#rawUnset = target._getRawUnset();
  }

  /**
   * Validate current changes
   */
  validate(): void {
    this._validateAttributes();
  }

  /**
   * Instance attribute validation
   */
  _validateAttributes(values: Record<string, Literal> = {}): void {
    const { attributes } = (this.constructor as any);
    const changes = this.changes();
    let changedValues: Record<string, Literal> = {};
    for (const key in changes) {
      if (changes[key].length === 2) changedValues[key] = changes[key][1];
    }
    changedValues = Object.assign(changedValues, values);
    valuesValidate(changedValues, attributes, this);
  }

  /**
   * Static attribute validation
   */
  static _validateAttributes(values: Record<string, Literal>): void {
    const { attributes } = this;
    valuesValidate(values, attributes, this);
  }

  /**
   * restore data
   * @param opts query options
   */
  async restore(opts: QueryOptions = {}): Promise<this> {
    const Model: any = this.constructor;
    const { primaryKey, shardingKey } = Model;
    const { deletedAt } = Model.timestamps;
    if (this[primaryKey] == null) throw new Error('instance is not persisted yet.');
    if (deletedAt == null) throw new Error('Model is not paranoid');
    const conditions = { [primaryKey]: this[primaryKey], [deletedAt]: { $ne: null } };
    if (shardingKey) conditions[shardingKey] = this[shardingKey];
    await this.update({ [deletedAt]: null }, { ...opts, paranoid: false });
    return this;
  }

  /**
   * Gets called when `JSON.stringify(instance)` is invoked.
   * {@link Bone#toJSON} might be called on descents of Bone that does not have attributes defined on them directly, hence for..in is preferred.
   * - https://developer.mozilla.org/en-US/docs/Web/JavaScript/Enumerability_and_ownership_of_properties
   * @example
   * const post = await Post.first
   * post.toJSON()  // => { id: 1, ... }
   * @return {Object}
   */
  [util.inspect.custom](): string {
    return this.constructor.name + ' ' + util.inspect(this.toJSON());
  }

  toJSON(): Record<string, any> {
    const obj: any = {};
    for (const key in this) {
      if (this.#rawUnset.has(key)) continue;
      if (typeof this[key] !== 'function') {
        const value = this[key];
        if (value != null) obj[key] = value as any instanceof AbstractBone ? value.toJSON() : value;
      }
    }
    return obj;
  }

  /**
   * This is the loyal twin of {@link Bone#toJSON} because when generating the result object, the raw values of attributes are used, instead of the values returned by custom getters (if any).
   * {@link Bone#toObject} might be called on descents of Bone that does not have attributes defined on them directly, hence for..in is preferred.
   * - https://developer.mozilla.org/en-US/docs/Web/JavaScript/Enumerability_and_ownership_of_properties
   * @example
   * const post = await Post.first
   * post.toObject()  // => { id: 1, ... }
   * @return {Object}
   */
  toObject(): any {
    const obj: any = {};
    for (const key in this) {
      if (this.#rawUnset.has(key)) continue;
      if (typeof this[key] !== 'function') {
        const value = this[key];
        obj[key] = value != null && typeof value.toObject === 'function' ? value.toObject() : value;
      }
    }
    return obj;
  }
}

function looseReadonly(props: Record<string, any>) {
  return Object.keys(props).reduce((result: any, name) => {
    result[name] = { value: (props as any)[name], writable: false, enumerable: false, configurable: true };
    return result;
  }, {} as any);
}

function compare(attributes: any, columnMap: any) {
  const diff: any = {};
  const columnNames = new Set<string>();
  for (const name in attributes) {
    const attribute = attributes[name];
    const { columnName } = attribute;
    columnNames.add(columnName);
    if (!attribute.equals(columnMap[columnName])) {
      diff[name] = { modify: columnMap.hasOwnProperty(columnName), ...attribute };
    }
  }
  for (const columnName in columnMap) {
    if (!columnNames.has(columnName)) diff[columnName] = { remove: true };
  }
  return diff;
}

function setDefaultValue(record: any, attributes: any) {
  if (record == null || attributes == null) return;
  for (const name in attributes) {
    const value = record[name];
    const { defaultValue } = attributes[name];
    if (value === undefined && defaultValue != null) record[name] = defaultValue;
  }
  return record;
}

function copyValues(values: any) {
  const copyValue: any = {};
  if (values && typeof values === 'object') {
    for (const key in values) {
      if (Object.hasOwnProperty.call(values, key)) {
        const v = values[key];
        if (v && ((v instanceof Raw) || (v as any).__expr || (v instanceof Spell))) continue;
        copyValue[key] = v;
      }
    }
  }
  return copyValue;
}

function valuesValidate(values: any, attributes: any, ctx: any) {
  for (const valueKey in values) {
    const attribute = attributes[valueKey];
    if (!attribute) continue;
    const { validate = {}, name, allowNull, defaultValue } = attribute;
    const value = values[valueKey];
    if (value == null && defaultValue == null) {
      if (allowNull === false) throw new LeoricValidateError('notNull', name);
      if ((allowNull === true || allowNull === undefined) && validate.notNull === undefined) continue;
    }
    if (!validate) continue;
    for (const key in validate) {
      if ((validate as any).hasOwnProperty(key)) executeValidator(ctx, key, attribute, value);
    }
  }
}

function cloneValue(value: any) {
  if (value instanceof Date && isNaN(value as any)) return value;
  return typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value));
}

Reflect.defineMetadata(IS_LEORIC_BONE, true, AbstractBone);

