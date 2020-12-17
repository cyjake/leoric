'use strict';

const Attribute = require('../abstract/attribute');
const DataTypes = require('./data_types');
const { escape, escapeId } = require('./sqlstring');

class PostgresAttribute extends Attribute {
  constructor(name, params, opts) {
    super(name, params, opts);
  }

  static get DataTypes() {
    return DataTypes;
  }

  toSqlString() {
    const {
      columnName, type, columnType, allowNull, defaultValue, primaryKey,
    } = this;
    const chunks = [
      escapeId(columnName),
      columnType.toUpperCase() || type.toSqlString(),
    ];
    if (type instanceof DataTypes.INTEGER && primaryKey) {
      if (type instanceof DataTypes.BIGINT) chunks[1] = 'BIGSERIAL';
      else chunks[1] = 'SERIAL';
    }

    if (primaryKey) chunks.push('PRIMARY KEY');

    if (!primaryKey && !allowNull) chunks.push('NOT NULL');

    if (defaultValue != null) {
      chunks.push(`DEFAULT ${escape(defaultValue)}`);
    }
    return chunks.join(' ');
  }
}

module.exports = PostgresAttribute;
