import 'reflect-metadata';

import Bone from './bone';
import DataTypes, { DataType, DATA_TYPE } from './data_types';
import { ASSOCIATE_METADATA_MAP } from './constants';
import { ColumnBase, Validator, AssociateOptions } from './types/common';

interface ColumnOption extends Omit<ColumnBase, 'columnName'| 'columnType'> {
  type?: DataType;
  name?: string;
  validate?: {
    [key: string]: Validator;
  }
}

function findType(tsType: typeof BigInt | typeof Number | typeof Date | typeof String | typeof Boolean) {
  const {
    BIGINT, INTEGER,
    DATE,
    STRING,
    BOOLEAN,
  } = DataTypes;

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

export function Column(options: ColumnOption | DATA_TYPE<DataType> | DataType = {}) {
  return function(target: any, propertyKey: string) {
    // target refers to model prototype, an internal instance of `Bone {}`
    if (('prototype' in options && options['prototype'] instanceof DataType) || options instanceof DataType) {
      options = { type: options as DATA_TYPE<DataType> };
    }

    if (!('type' in options)) {
      const tsType = Reflect.getMetadata('design:type', target, propertyKey);
      options['type'] = findType(tsType);
    }

    // target refers to model prototype, an internal instance of `Bone {}`
    const model = target.constructor as any;
    if (!model.hasOwnProperty('attributes') || !model.attributes) {
      Object.defineProperty(model, 'attributes', {
        value: { ...model.attributes },
        writable: false,
        enumerable: false,
        configurable: true,
      });
    }
    const { name: columnName, ...restOptions } = options;
    model.attributes[propertyKey] = { ...restOptions, columnName };
  };
}

const { hasMany, hasOne, belongsTo } = ASSOCIATE_METADATA_MAP;

export function HasMany(options: Partial<AssociateOptions> = {}) {
  return function(target: Bone, propertyKey: string) {
    const model = target.constructor;
    // it seems it's not possible to get the type of array element at runtime
    Reflect.defineMetadata(hasMany, {
      ...Reflect.getMetadata(hasMany, model),
      [propertyKey]: options,
    }, model);
  };
}

export function HasOne(options: Partial<AssociateOptions> = {}) {
  return function(target: Bone, propertyKey: string) {
    const model = target.constructor;
    if (options.className == null) {
      const tsType = Reflect.getMetadata('design:type', target, propertyKey);
      if (tsType.name !== 'Function') options.className = tsType.name;
    }
    Reflect.defineMetadata(hasOne, {
      ...Reflect.getMetadata(hasOne, model),
      [propertyKey]: options,
    }, model);
  };
}

/**
 * design:type will be `Function { [native code] }` in following example
 *
 * @example
 * import type Foo from './foo';
 * class Bar extends Bone {
 *   @BelongsTo()
 *   foo?: Foo;
 * }
 */
export function BelongsTo(options: Partial<AssociateOptions> = {}) {
  return function(target: Bone, propertyKey: string) {
    const model = target.constructor;
    if (options.className == null) {
      const tsType = Reflect.getMetadata('design:type', target, propertyKey);
      if (tsType.name !== 'Function') options.className = tsType.name;
    }
    Reflect.defineMetadata(belongsTo, {
      ...Reflect.getMetadata(belongsTo, model),
      [propertyKey]: options,
    }, model);
  };
}
