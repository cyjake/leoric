'use strict';

const debug = require('debug')('leoric');

const { snakeCase } = require('../../utils/string');

/**
 * Find the corresponding JavaScript type of the type in database.
 * @param {string} dataType
 */
function findJsType(DataTypes, type, dataType) {
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

/**
 * Find and instantiate the database specific data type
 * @param {Function} DataTypes
 * @param {Object} params
 * @param {Function} params.type
 * @param {string} params.dataType
 */
function createType(DataTypes, params) {
  const { dataType, type } = params;
  if (!type) return DataTypes.findType(dataType);

  if (type && typeof type === 'function') {
    const DataType = DataTypes[type.name] || type;
    return new DataType();
  }

  const DataType = DataTypes[type.constructor.name];
  if (!DataType) return type;

  switch (type.constructor.name) {
    case 'DATE':
      return new DataType(type.precision, type.timezone);
    case 'TINYINT':
    case 'SMALLINT':
    case 'MEDIUMINT':
    case 'INTEGER':
    case 'BIGINT':
    case 'BINARY':
    case 'VARBINARY':
      return new DataType(type.length);
    default:
      return new DataType();
  }
}

class Attribute {
  /**
   * Attribute name and definition
   * @param {string} name attribute name
   * @param {Object} params attribute definition
   * @param {Object} opts
   * @param {boolean} opts.underscored
   */
  constructor(name, params, { underscored } = {}) {
    const { DataTypes } = this.constructor;
    if (params instanceof Attribute) return params;
    const columnName = underscored === false ? name : snakeCase(name);
    if (params == null) return Object.assign(this, { name, columnName });

    // { foo: STRING }
    // { foo: STRING(255) }
    if (typeof params === 'function' || DataTypes.is(params)) {
      params = { type: params };
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
      columnName,
      primaryKey: false,
      allowNull: !params.primaryKey,
      columnType: type.toSqlString().toLowerCase(),
      ...params,
      type,
      defaultValue,
      dataType,
      jsType: findJsType(DataTypes, type, dataType),
    });
  }

  equals(columnInfo) {
    if (!columnInfo) return false;
    const props = [ 'allowNull', 'dataType', 'primaryKey' ];
    for (const prop of props) {
      // SQLite has default value as string even if data type is integer
      if (this[prop] != columnInfo[prop]) {
        debug('[attribute] [%s] %s not equal (defined: %s, actual: %s)',
          this.columnName,
          prop,
          this[prop],
          columnInfo[prop]);
        return false;
      }
    }
    return true;
  }

  cast(value) {
    const castedValue = this.type.cast(value);
    return castedValue == null? null : castedValue;
  }

  uncast(value, strict = true) {
    if (Array.isArray(value) && this.jsType !== JSON) {
      return value.map(entry => this.type.uncast(entry, strict));
    }
    return this.type.uncast(value, strict);
  }
}

module.exports = Attribute;
