import Bone from '../bone';
import AbstractDriver, { ConnectOptions } from '../drivers/abstract';
import { camelCase } from '../utils/string';
import sequelize from '../adapters/sequelize';
import Raw, { rawQuery, raw, RawQueryOptions } from '../raw';
import { LEGACY_TIMESTAMP_MAP } from '../constants';
import { AttributeMeta, ColumnMeta, Connection, Literal } from '../types/common';
import { invokable as DataTypes, AbstractDataType, DataType } from '../data_types';
import {
  AbstractBone,
  InitOptions,
  markModelClassFieldsChecked,
  markModelClassReady,
} from '../abstract_bone';
import { compileModel } from '../model';

const SequelizeBone: typeof AbstractBone = sequelize(Bone as any) as unknown as typeof AbstractBone;

interface SyncOptions {
  force?: boolean;
  alter?: boolean;
}

/**
 * construct model attributes entirely from column definitions
 * @param model
 * @param columns column definitions
 */
function initAttributes(
  model: typeof AbstractBone & { driver: AbstractDriver },
  columns: Array<ColumnMeta>,
) {
  const attributes: Record<string, AbstractDataType<DataType> | AttributeMeta> = {};

  for (const columnInfo of columns) {
    const { columnName, columnType, ...restInfo } = columnInfo as ColumnMeta & Required<Pick<ColumnMeta, 'columnName' | 'columnType'>>;
    const name = columnName === '_id' ? columnName : camelCase(columnName);
    attributes[name] = {
      ...restInfo,
      columnName,
      type: model.driver.DataTypes.findType(columnType) as AbstractDataType<DataType>,
    };
  }

  for (const [name, newName] of Object.entries(LEGACY_TIMESTAMP_MAP)) {
    if (attributes.hasOwnProperty(name) && !attributes.hasOwnProperty(newName)) {
      attributes[newName] = attributes[name];
      delete attributes[name];
    }
  }

  model.init(attributes, { timestamps: false });
}

function createSpine(opts: { Bone?: typeof AbstractBone; sequelize?: boolean; subclass?: boolean; }) {
  let Model: typeof AbstractBone = Bone;
  if (opts.Bone && opts.Bone.prototype instanceof Bone) {
    Model = opts.Bone;
  } else if (opts.sequelize) {
    Model = SequelizeBone;
  }
  if (opts.subclass === true) {
    const Spine = class Spine extends Model {};
    markModelClassReady(Spine);
    markModelClassFieldsChecked(Spine);
    return Spine;
  }
  markModelClassReady(Model);
  markModelClassFieldsChecked(Model);
  return Model;
}

/**
 * The central entry point of Leoric. Manages the database connection, model
 * registration and schema synchronization, and provides methods for raw
 * queries and transactions. Usually created via `new Realm()` or `connect()`.
 */
export default class BaseRealm {
  Bone: typeof AbstractBone;
  DataTypes = DataTypes;
  driver: AbstractDriver;
  models: Record<string, typeof AbstractBone>;
  connected?: boolean;
  options: ConnectOptions & { database: string };

  /**
   * Create a realm. Sets up the database driver with the given connection
   * options, and pre-registers the model classes passed in `opts.models`.
   * @param opts
   * @param opts.dialect - database dialect, such as `mysql`, `postgres`, or `sqlite`
   * @param opts.client - client module name, such as `mysql`, `mysql2`, `pg`, or `sqlite3`
   * @param opts.database - database name, aliases: `db`, `storage`
   * @param opts.driver - custom driver class, must be a subclass of AbstractDriver
   * @param opts.models - model classes to pre-register, or a directory path to load models from
   * @example
   * const realm = new Realm({
   *   dialect: 'mysql',
   *   host: 'localhost',
   *   user: 'root',
   *   database: 'my_app',
   *   models: [Post, User],
   * });
   */
  constructor(opts: ConnectOptions = {}) {
    const {
      dialect = 'mysql',
      dialectModulePath,
      client = dialectModulePath,
      database = opts.db || opts.storage || '',
      driver: CustomDriver,
      ...restOpts
    } = opts;
    const Spine = createSpine(opts);
    const models: Record<string, typeof AbstractBone> = {};

    if (Array.isArray(opts.models)) {
      for (const model of opts.models) {
        markModelClassReady(model);
        models[model.name] = model;
      }
    }

    const DriverClass = this.getDriverClass(CustomDriver, dialect);

    const driver = new DriverClass({
      client: client,
      database,
      ...restOpts,
    });

    const options: ConnectOptions & { database: string } = {
      client,
      dialect: driver.dialect,
      database,
      driver: DriverClass,
      ...restOpts,
      define: { underscored: true, ...opts.define },
    };

    this.Bone = Spine;
    this.models = Spine.models = models;
    this.driver = Spine.driver = driver;
    this.options = Spine.options = options;
  }

  /**
   * Get the driver class. Returns the custom driver class when it is a
   * subclass of AbstractDriver, otherwise throws an error. Overridden by
   * `Realm` to resolve the built-in driver by dialect.
   * @param CustomDriver - custom driver class
   * @param dialect - database dialect
   * @returns the driver class
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getDriverClass(CustomDriver: typeof AbstractDriver | undefined, dialect: string) {
    if (CustomDriver && CustomDriver.prototype instanceof AbstractDriver) {
      return CustomDriver;
    }
    throw new Error('DriverClass must be a subclass of AbstractDriver');
  }

  /**
   * Define and register a model at runtime. The class overload compiles the
   * given model class, which must extend the realm's Bone; the string
   * overload generates a Bone subclass with the given name instead.
   * `attributes` define the columns of the model, such as
   * `{ id: { type: BIGINT, primaryKey: true }, title: STRING }`.
   * @param Model - the model class to compile, must extend the realm's Bone
   * @param attributes - column definitions
   * @param options - model init options
   * @param descriptors - property descriptors
   * @returns the model class
   * @example
   * const Post = realm.define(class Post extends Bone {
   *   static initialize() {
   *     this.belongsTo('author', { Model: 'User' });
   *   }
   * }, {
   *   id: { type: BIGINT, primaryKey: true },
   *   title: STRING,
   * });
   *
   * const User = realm.define('User', {
   *   login: STRING,
   *   nickname: STRING,
   * });
   */
  define<T extends typeof AbstractBone>(
    Model: T,
    attributes?: Record<string, AbstractDataType<DataType> | AttributeMeta>,
    options?: InitOptions,
    descriptors?: Record<string, PropertyDescriptor>,
  ): T;
  define(
    name: string,
    attributes: Record<string, AbstractDataType<DataType> | AttributeMeta>,
    options?: InitOptions,
    descriptors?: Record<string, PropertyDescriptor>,
  ): typeof AbstractBone;
  define(
    nameOrModel: string | typeof AbstractBone,
    attributes?: Record<string, AbstractDataType<DataType> | AttributeMeta>,
    options?: InitOptions,
    descriptors?: Record<string, PropertyDescriptor>,
  ): typeof AbstractBone {
    let Model: typeof AbstractBone;
    if (typeof nameOrModel === 'string') {
      Model = class extends this.Bone {};
      Object.defineProperty(Model, 'name', {
        value: nameOrModel,
        writable: false,
        enumerable: false,
        configurable: true,
      });
      markModelClassReady(Model);
      markModelClassFieldsChecked(Model);
    } else {
      if (!(nameOrModel.prototype instanceof this.Bone)) {
        throw new TypeError(`${nameOrModel.name} must extend this realm's Bone`);
      }
      Model = compileModel(nameOrModel);
    }

    if (attributes) Model.init(attributes, options, descriptors);
    this.models[Model.name] = Model;
    this.Bone.models[Model.name] = Model;
    return Model;
  }

  /**
   * Register an already defined model class to the realm without compiling it
   * again. The model will be loaded and initialized when the realm connects.
   * @param Model - the model class to register
   * @returns the registered model class
   * @example
   * realm.registerModel(Post);
   */
  registerModel<T extends typeof AbstractBone>(Model: T): T {
    markModelClassReady(Model);
    this.models[Model.name] = Model;
    this.Bone.models[Model.name] = Model;
    return Model;
  }

  /**
   * Get all model classes registered in the realm.
   * @returns an array of the model classes
   * @example
   * const models = await realm.getModels();
   */
  async getModels() {
    return Object.values(this.models);
  }

  /**
   * Load schema information of the given models from the database, map table
   * columns to model attributes, and initialize their associations. Usually
   * called by `connect()` rather than directly.
   * @param models - the model classes to load
   * @param opts - connection options
   * @example
   * await realm.loadModels([Post, User], realm.options);
   */
  async loadModels(models: Array<typeof AbstractBone>, opts: ConnectOptions) {
    if (this.driver == null) {
      throw new Error('Driver is not initialized');
    }
    const { database } = this.options;
    const tables = models.map(model => model.physicTable);
    const schemaInfo = await this.driver.querySchemaInfo(database, tables);

    for (const model of models) {
      if (!model.driver) model.driver = this.driver;
      if (!model.options) model.options = this.options;
      if (!model.models) model.models = this.models;
      const columns = schemaInfo[model.physicTable] || schemaInfo[model.table] || [];
      if (!model.attributes) {
        initAttributes(model as typeof AbstractBone & { driver: AbstractDriver }, columns);
      }
      model.load(columns);
    }

    for (const model of models) {
      model.initialize();
    }
  }

  /**
   * Connect to the database. Loads schema information of the registered
   * models, maps table columns to model attributes, and initializes their
   * associations. Queries must not be executed before the realm is connected.
   * @returns the realm's Bone class
   * @example
   * await realm.connect();
   * const post = await Post.find(1);
   */
  async connect() {
    let models = (await this.getModels()).map(model => this.registerModel(model));
    // models could be connected already if cached
    models = models.filter(model => model.synchronized == null);

    if (models.length > 0) {
      await this.loadModels(models, this.options);
    }
    this.connected = true;
    return this.Bone;
  }

  /**
   * Disconnect the realm from the database. Does nothing if the realm is not
   * connected.
   * @param callback - called once the connection is closed
   * @example
   * await realm.disconnect();
   */
  async disconnect(callback?: (() => Promise<void>)) {
    if (this.connected && this.driver) {
      return await this.driver.disconnect(callback);
    }
  }

  /**
   * Synchronize the model definitions to the database. Creates tables that do
   * not exist, and optionally alters existing tables to match the model
   * definitions. Connects the realm first if it is not connected yet.
   * @param options
   * @param options.force - drop existing tables before creating, which will lose data
   * @param options.alter - alter existing tables to match the model definitions
   * @example
   * await realm.sync();
   * await realm.sync({ force: true });
   * await realm.sync({ alter: true });
   */
  async sync(options: SyncOptions = {}) {
    if (!this.connected) await this.connect();
    const { models } = this;

    for (const model of Object.values(models)) {
      await model.sync(options);
    }
  }

  /**
   * Execute a raw SQL query against the database. Values are bound to the
   * `?` placeholders in the SQL statement.
   * @param sql - the SQL statement, with `?` placeholders for values
   * @param values - values to be bound to the placeholders
   * @param opts - query options, such as `{ type: 'select' }`
   * @returns the query result
   * @example
   * const result = await realm.query('SELECT * FROM posts WHERE id = ?', [1]);
   */
  async query(sql: string, values?: Literal[], opts: RawQueryOptions = {}): Promise<any> {
    return await rawQuery(this.driver, sql, values, opts);
  }

  /**
   * Run the callback inside a database transaction. The callback receives
   * `{ connection }`; queries executed with this connection belong to the
   * transaction and are rolled back when the callback throws. Both async
   * functions and generator functions are supported.
   * @param callback - the transaction callback, receives `{ connection }`
   * @returns the return value of the callback
   * @example
   * await realm.transaction(async ({ connection }) => {
   *   await Post.create({ title: 'Hello' }, { connection });
   *   await Comment.create({ postId: 1, content: 'World' }, { connection });
   * });
   */
  async transaction<T extends (options: { connection: Connection }) => Promise<any> | Generator>(callback: T): Promise<ReturnType<T>> {
    return await this.Bone.transaction(callback);
  }

  /**
   * Create a `Raw` SQL expression that will not be escaped when used in
   * queries or updates.
   * @param sql - the SQL expression
   * @returns the raw SQL expression
   * @example
   * await Post.update({ title: 'New Title' }, { updatedAt: realm.raw('NOW()') });
   */
  raw(sql: string): Raw {
    return raw(sql);
  }

  /**
   * Escape a value for safe use in SQL queries.
   * @param value - the value to escape
   * @returns the escaped value
   * @memberof Realm
   * @example
   * const safe = realm.escape("O'Reilly");
   * // => "'O\\'Reilly'"
   */
  escape(value: string): string {
    return this.driver.escape(value);
  }

  static SequelizeBone = SequelizeBone;
}
