'use strict';

const debug = require('debug')('leoric');

const DataTypes = require('../../data_types');
const { snakeCase } = require('../../utils/string');

/**
 * Find the corresponding JavaScript type of the type in database.
 * @param {string} dataType
 */
function findJsType(type, defaultDataType) {
  // MySQL stores BOOLEAN as TINYINT(1)
  if (type instanceof DataTypes.BOOLEAN) {
    return Boolean;
  }

  const dataType = defaultDataType || type.dataType;

  switch (dataType.toLowerCase().split('(')[0]) {
    case 'bigint':
    // case 'mediumint':
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
  if (!type) {
    return new (DataTypes.findType(dataType));
  }

  if (type && typeof type === 'function') {
    const DataType = DataTypes[type.name] || type;
    return new DataType();
  }

  const DataType = DataTypes[type.constructor.name];
  if (!DataType) return type;

  switch (type.constructor.name) {
    case 'DATE':
      return new DataType(type.precision, type.timezone);
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
    if (params instanceof Attribute) return params;
    const columnName = underscored === false ? name : snakeCase(name);
    if (params == null) return Object.assign(this, { name, columnName });

    // { foo: STRING }
    // { foo: STRING(255) }
    if (typeof params === 'function' || params instanceof DataTypes) {
      params = { type: params };
    }
    const type = createType(this.constructor.DataTypes, params);
    const dataType = params.dataType || type.dataType;
    Object.assign(this, {
      name,
      columnName,
      primaryKey: false,
      defaultValue: null,
      allowNull: !params.primaryKey,
      columnType: type.toSqlString().toLowerCase(),
      ...params,
      type,
      dataType,
      jsType: findJsType(type, dataType),
    });
  }

  equals(targetAttribute) {
    if (!targetAttribute) return false;
    const props = [ 'dataType', 'allowNull', 'defaultValue', 'primaryKey' ];
    for (const prop of props) {
      // SQLite has default value as string even if data type is integer
      if (this[prop] != targetAttribute[prop]) {
        debug('[attribute] [%s] %s not equal (defined: %s, actual: %s)',
          this.columnName,
          prop,
          this[prop],
          targetAttribute[prop]);
        return false;
      }
    }
    return true;
  }
}

module.exports = Attribute;
