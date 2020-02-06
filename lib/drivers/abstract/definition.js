'use strict';

const debug = require('debug')('leoric');

const DataTypes = require('../../data_types');
const { snakeCase } = require('../../utils/string');

/**
 * Find the corresponding JavaScript type of the type in database.
 * @param {string} dataType
 */
function findJsType(dataType) {
  switch (dataType.toLowerCase().split('(')[0]) {
    case 'bigint':
    case 'smallint':
    case 'tinyint':
    case 'int':
    case 'integer':
    case 'decimal':
      return Number;
    case 'datetime':
    case 'timestamp':
      return Date;
    case 'longtext':
    case 'mediumtext':
    case 'text':
    case 'varchar':
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

class Definition {
  constructor(name, params, { underscored } = {}) {
    if (params instanceof Definition) return params;

    // { foo: STRING }
    // { foo: STRING(255) }
    if (typeof params === 'function' || params instanceof DataTypes) {
      params = { type: params };
    }
    const type = createType(this.constructor.DataTypes, params);
    const dataType = params.dataType || type.dataType;

    Object.assign(this, {
      name,
      columnName: underscored === false ? name : snakeCase(name),
      primaryKey: false,
      defaultValue: null,
      allowNull: !params.primaryKey,
      columnType: type.toSqlString().toLowerCase(),
      ...params,
      type,
      dataType,
      // MySQL stores BOOLEAN as TINYINT(1)
      jsType: type instanceof DataTypes.BOOLEAN ? Boolean : findJsType(dataType),
    });
  }

  equals(targetDefinition) {
    if (!targetDefinition) return false;
    const props = [ 'dataType', 'allowNull', 'defaultValue', 'primaryKey' ];
    for (const prop of props) {
      // SQLite has default value as string even if data type is integer
      if (this[prop] != targetDefinition[prop]) {
        debug('[definition] [%s] %s not equal (defined: %s, actual: %s)',
          this.columnName,
          prop,
          this[prop],
          targetDefinition[prop]);
        return false;
      }
    }
    return true;
  }
}

module.exports = Definition;
