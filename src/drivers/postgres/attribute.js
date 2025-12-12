'use strict';

const debug = require('debug')('leoric');

const Attribute = require('../abstract/attribute').default;
const DataTypes = require('./data_types');
const { escape, escapeId } = require('./sqlstring');

class PostgresAttribute extends Attribute {
  constructor(name, params, opts) {
    super(name, params, opts);
  }

  static DataTypes = DataTypes.invokable;

  toSqlString() {
    const {
      columnName, type, columnType, allowNull, defaultValue, primaryKey, unique,
    } = this;
    const chunks = [
      escapeId(columnName),
      columnType.toUpperCase() || type.toSqlString(),
    ];
    if (type instanceof DataTypes.INTEGER && primaryKey) {
      chunks[1] = (type instanceof DataTypes.BIGINT) ? 'BIGSERIAL' : 'SERIAL';
    }

    if (primaryKey) chunks.push('PRIMARY KEY');

    if (!primaryKey && !allowNull) chunks.push('NOT NULL');

    if (unique === true) {
      chunks.push('UNIQUE');
    }

    if (defaultValue != null) {
      chunks.push(`DEFAULT ${escape(defaultValue)}`);
    }
    return chunks.join(' ');
  }

  equals(columnInfo) {
    if (!columnInfo) return false;
    if (this.type.toSqlString() !== columnInfo.columnType.toUpperCase()) {
      debug('[attribute] [%s] columnType not equal (defined: %s, actual: %s)',
        this.columnName,
        this.type.toSqlString(),
        columnInfo.columnType.toUpperCase());
      return false;
    }
    const props = [ 'allowNull', 'defaultValue', 'primaryKey' ];
    for (const prop of props) {
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
}

module.exports = PostgresAttribute;
