'use strict';

const DataType = require('../../data_types');
const { snakeCase } = require('../../utils/string');

const { BOOLEAN } = DataType;

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
      return Date;
    case 'longtext':
    case 'mediumtext':
    case 'text':
    case 'varchar':
    default:
      return String;
  }
}

class Definition {
  constructor(name, params, { underscored } = {}) {
    // { foo: STRING }
    // { foo: STRING(255) }
    if (typeof params === 'function' || params instanceof DataType) {
      params = { type: params };
    }
    const type = typeof params.type == 'function' ? new (params.type) : params.type;
    const dataType = params.dataType || type.dataType;

    Object.assign(this, {
      name,
      columnName: underscored === false ? name : snakeCase(name),
      primaryKey: false,
      defaultValue: null,
      allowNull: !params.primaryKey,
      ...params,
      type,
      dataType,
      jsType: type instanceof BOOLEAN ? Boolean : findJsType(dataType),
    });
  }

  equals(targetDefinition) {
    if (!targetDefinition) return false;
    const props = [ 'dataType', 'allowNull', 'defaultValue', 'primaryKey' ];
    for (const prop of props) {
      if (!Object.is(this[prop], targetDefinition[prop])) {
        return false;
      }
    }
    return true;
  }
}

module.exports = Definition;
