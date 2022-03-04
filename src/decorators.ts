import Bone from './bone';
import DataType from './data_types';
import { ASSOCIATE_METADATA_MAP } from './constants';
import 'reflect-metadata';

type DataTypes<T> = {
  [Property in keyof T as Exclude<Property, "toSqlString">]: T[Property];
}

interface ColumnOption {
  type?: DataTypes<DataType>;
  name?: string;
  defaultValue?: null | boolean | number | string | Date | JSON;
  allowNull?: boolean;
}

function findType(tsType) {
  const {
    BIGINT, INTEGER,
    DATE,
    STRING,
    BOOLEAN,
  } = DataType;

  switch (tsType) {
    case BigInt:
      return BIGINT;
    case Number:
      return INTEGER;
    case Date:
      return DATE;
    case String:
      return STRING;
    case Boolean:
      return BOOLEAN;
    default:
      throw new Error(`unknown typescript type ${tsType}`);
  }
}

export function Column(options: ColumnOption | DataTypes<DataType> = {}) {
  return function(target: Bone, propertyKey: string) {
    if (options['prototype'] instanceof DataType) options = { type: options };

    if (!('type' in options)) {
      const tsType = Reflect.getMetadata('design:type', target, propertyKey);
      options['type'] = findType(tsType);
    }

    // narrowing the type of options to ColumnOption
    if (!('type' in options)) throw new Error(`unknown column options ${options}`);

    // target refers to model prototype, an internal instance of `Bone {}`
    const model = target.constructor;
    const { attributes = (model.attributes = {}) } = model;
    const { name: columnName, ...restOptions } = options;
    attributes[propertyKey] = { ...restOptions, columnName };
  };
}

interface AssociateOptions {
  className?: string;
  foreignKey?: string;
}

const { hasMany, hasOne, belongsTo } = ASSOCIATE_METADATA_MAP;

export function HasMany(options?: AssociateOptions) {
  return function(target: Bone, propertyKey: string) {
    const model = target.constructor;
    Reflect.defineMetadata(hasMany, {
      ...Reflect.getMetadata(hasMany, model),
      [propertyKey]: options,
    }, model);
  }
}

export function HasOne(options?: AssociateOptions) {
  return function(target: Bone, propertyKey: string) {
    const model = target.constructor;
    Reflect.defineMetadata(hasOne, {
      ...Reflect.getMetadata(hasOne, model),
      [propertyKey]: options,
    }, model);
  }
}

export function BelongsTo(options?: AssociateOptions) {
  return function(target: Bone, propertyKey: string) {
    const model = target.constructor;
    Reflect.defineMetadata(belongsTo, {
      ...Reflect.getMetadata(belongsTo, model),
      [propertyKey]: options,
    }, model);
  }
}
