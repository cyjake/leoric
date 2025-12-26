import Bone from '../bone';
import AbstractDriver, { ConnectOptions } from '../drivers/abstract';
import { camelCase } from '../utils/string';
import sequelize from '../adapters/sequelize';
import Raw, { rawQuery, raw, RawQueryOptions } from '../raw';
import { LEGACY_TIMESTAMP_MAP } from '../constants';
import { AttributeMeta, ColumnMeta, Connection, Literal } from '../types/common';
import { invokable as DataTypes, AbstractDataType, DataType } from '../data_types';
import { AbstractBone, InitOptions } from '../abstract_bone';

const SequelizeBone: typeof AbstractBone = sequelize(Bone as any) as unknown as typeof AbstractBone;

interface SyncOptions {
  force?: boolean;
  alter?: boolean;
}

/**
 * construct model attributes entirely from column definitions
 * @param {Bone} model
 * @param {Array<string, Object>} columns column definitions
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
  return opts.subclass === true ? class Spine extends Model {} : Model;
}

export default class BaseRealm {
  Bone: typeof AbstractBone;
  DataTypes = DataTypes;
  driver: AbstractDriver;
  models: Record<string, typeof AbstractBone>;
  connected?: boolean;
  options: ConnectOptions;

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
      for (const model of opts.models) models[model.name] = model;
    }

    const DriverClass = this.getDriverClass(CustomDriver, dialect);

    const driver = new DriverClass({
      client: client,
      database,
      ...restOpts,
    });

    const options = {
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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getDriverClass(CustomDriver: typeof AbstractDriver | undefined, dialect: string) {
    if (CustomDriver && CustomDriver.prototype instanceof AbstractDriver) {
      return CustomDriver;
    }
    throw new Error('DriverClass must be a subclass of AbstractDriver');
  }

  define(
    name: string,
    attributes: Record<string, AbstractDataType<DataType> | AttributeMeta>,
    options?: InitOptions,
    descriptors?: Record<string, PropertyDescriptor>,
  ): typeof AbstractBone {
    const Model = class extends this.Bone {};
    Object.defineProperty(Model, 'name', {
      value: name,
      writable: false,
      enumerable: false,
      configurable: true,
    });
    Model.init(attributes, options, descriptors);
    this.Bone.models[name] = Model;
    return Model;
  }

  async getModels() {
    return Object.values(this.models);
  }

  async loadModels(models: Array<typeof AbstractBone>, opts: ConnectOptions) {
    if (this.driver == null) {
      throw new Error('Driver is not initialized');
    }
    const { database } = opts;
    const tables = models.map(model => model.physicTable);
    const schemaInfo = await this.driver.querySchemaInfo(database as string, tables);

    for (const model of models) {
      if (!model.driver) model.driver = this.driver;
      if (!model.options) model.options = this.options;
      if (!model.models) model.models = this.models;
      const columns = schemaInfo[model.physicTable] || schemaInfo[model.table];
      if (!model.attributes) {
        initAttributes(model as typeof AbstractBone & { driver: AbstractDriver }, columns);
      }
      model.load(columns);
    }

    for (const model of models) {
      model.initialize();
    }
  }

  async connect() {
    let models = await this.getModels();

    for (const model of models) this.Bone.models[model.name] = model;
    // models could be connected already if cached
    models = models.filter(model => model.synchronized == null);

    if (models.length > 0) {
      await this.loadModels(models, this.options);
    }
    this.connected = true;
    return this.Bone;
  }

  async disconnect(callback?: (() => Promise<void>)) {
    if (this.connected && this.driver) {
      return await this.driver.disconnect(callback);
    }
  }

  async sync(options: SyncOptions = {}) {
    if (!this.connected) await this.connect();
    const { models } = this;

    for (const model of Object.values(models)) {
      await model.sync(options);
    }
  }

  async query(sql: string, values?: Literal[], opts: RawQueryOptions = {}): Promise<any> {
    return await rawQuery(this.driver, sql, values, opts);
  }

  async transaction<T extends (options: { connection: Connection }) => Promise<any> | Generator>(callback: T): Promise<ReturnType<T>> {
    return await this.Bone.transaction(callback);
  }

  // instance.raw
  raw(sql: string): Raw {
    return raw(sql);
  }

  /**
   * escape value
   * @param {string} value
   * @returns {string} escaped value
   * @memberof Realm
   */
  escape(value: string): string {
    return this.driver.escape(value);
  }

  static SequelizeBone = SequelizeBone;
}
