
import { snakeCase } from '../../utils/string';
import AbstractDataTypes, { DataType as AbstractDataType, LENGTH_VARIANTS } from '../../data_types';
import { Literal, PickTypeKeys } from '../../types/common';

/**
 * Find the corresponding JavaScript type of the type in database.
 * @param {string} dataType
 */
function findJsType(DataTypes: typeof AbstractDataTypes, type: AbstractDataType, dataType: string) {
  if (type instanceof DataTypes.VIRTUAL) return '';
  if (type instanceof DataTypes.BOOLEAN) return Boolean;
  if (type instanceof DataTypes.JSON) return JSON;
  if (type instanceof DataTypes.BINARY || type instanceof DataTypes.BLOB) {
    return Buffer;
  }

  switch (dataType.toLowerCase().split('(')[0]) {
    case 'boolean':
      return Boolean;
    case 'bigint':
    case 'mediumint':
    case 'smallint':
    case 'tinyint':
    case 'int':
    case 'integer':
    case 'decimal':
      return Number;
    case 'date':
    case 'datetime':
    case 'timestamp':
      return Date;
    case 'jsonb':
    case 'json':
      return JSON;
    case 'longtext':
    case 'mediumtext':
    case 'text':
    case 'varchar':
    case 'char':
    default:
      return String;
  }
}

type DataTypeKey = PickTypeKeys<typeof AbstractDataTypes, AbstractDataType>;

/**
 * Find and instantiate the database specific data type
 * @param {Function} DataTypes
 * @param {Object} params
 * @param {Function} params.type
 * @param {string} params.dataType
 */
function createType(DataTypes: typeof AbstractDataTypes, params: { dataType?: string; type?: any }) {
  const { dataType, type } = params;
  if (!type && dataType) return DataTypes.findType(dataType);

  if (type && typeof type === 'function') {
    const DataType = DataTypes[type.name as DataTypeKey] || type;
    return new DataType();
  }

  const DataType = DataTypes[type.constructor.name as DataTypeKey];
  if (!DataType) return type;

  switch (type.constructor.name) {
    case 'DATE':
      return new DataType(type.precision, type.timezone);
    case 'DECIMAL':
      return new DataType(type.precision, type.scale);
    case 'TINYINT':
    case 'SMALLINT':
    case 'MEDIUMINT':
    case 'INTEGER':
    case 'BIGINT':
      return new DataType(type.dataLength, type.unsigned, type.zerofill);
    case 'BINARY':
    case 'VARBINARY':
    case 'CHAR':
    case 'VARCHAR':
    case 'STRING':
    case 'TEXT':
      return new DataType(type.dataLength);
    default:
      return new DataType();
  }
}

export interface AttributeParams {
  type?: AbstractDataType;
  defaultValue?: Literal;
  primaryKey?: boolean;
  allowNull?: boolean;
  columnName?: string;
  columnType?: string;
  dataType?: string;
  virtual?: boolean;
}

export default class Attribute {
  static DataTypes = AbstractDataTypes;

  type!: AbstractDataType;
  defaultValue?: Literal;
  primaryKey?: boolean;
  allowNull!: boolean;
  columnName!: string;
  columnType!: string;
  dataType?: string;
  jsType?: Literal;
  autoIncrement?: boolean;
  comment?: string;
  unique?: boolean;

  /**
   * Attribute name and definition
   * @param {string} name attribute name
   * @param {Object} params attribute definition
   * @param {Object} opts
   * @param {boolean} opts.underscored
   */
  constructor(name: string, params?: AttributeParams, { underscored }: { underscored?: boolean } = {}) {
    const { DataTypes } = this.constructor as typeof Attribute;
    if (params instanceof Attribute) return params;
    const columnName = underscored === false ? name : snakeCase(name);
    if (params == null) return Object.assign(this, { name, columnName });

    // { foo: STRING }
    // { foo: STRING(255) }
    if (typeof params === 'function' || DataTypes.is(params)) {
      params = { type: params } as AttributeParams;
    }
    const type = createType(DataTypes, params);
    const dataType = params.dataType || type.dataType;
    let { defaultValue = null } = params;
    try {
      // normalize column defaults like `'0'` or `CURRENT_TIMESTAMP`
      defaultValue = type.cast(type.uncast(defaultValue));
    } catch {
      defaultValue = null;
    }

    Object.assign(this, {
      name,
      primaryKey: false,
      allowNull: !params.primaryKey,
      ...params,
      columnName: params.columnName || columnName,
      columnType: type.toSqlString().toLowerCase(),
      type,
      defaultValue,
      dataType,
      jsType: findJsType(DataTypes, type, dataType),
      virtual: type.virtual,
    });
  }

  equals(columnInfo: { allowNull?: boolean; dataType?: string; defaultValue?: Literal; primaryKey?: boolean } | null) {
    if (!columnInfo) return false;
    const props: (keyof typeof columnInfo)[] = [ 'allowNull', 'dataType', 'defaultValue', 'primaryKey' ];
    for (const prop of props) {
      let source = this[prop];
      const target = columnInfo[prop];
      if (prop === 'dataType') {
        const { dataLength } = this.type;
        if (source === 'integer' && target === 'int') continue;
        if (source !== target && Object.values(LENGTH_VARIANTS).includes(dataLength as LENGTH_VARIANTS)) {
          source = `${dataLength}${source}`;
        }
      } else if (prop === 'defaultValue') {
        if (source === null && target === 'CURRENT_TIMESTAMP') continue;
      }
      // SQLite has default value as string even if data type is integer
      if (source != target) return false;
    }
    return true;
  }

  cast(value: Literal) {
    const castedValue = this.type.cast(value);
    return castedValue == null? null : castedValue;
  }

  uncast(value: Literal, strict = true) {
    if (Array.isArray(value) && this.jsType !== JSON) {
      return value.map(entry => this.type.uncast(entry, strict));
    }
    return this.type.uncast(value, strict);
  }

  /**
   * @abstract
   * @returns {string} SQL string representation of this attribute
   */
  toSqlString(): string {
    throw new Error('unimplemented!');
  }
}

