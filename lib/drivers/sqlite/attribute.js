'use strict';

const Attribute = require('../abstract/attribute');
const DataTypes = require('./data_types');
const { escape, escapeId } = require('./sqlstring');

class SqliteAttribute extends Attribute {
  constructor(name, params, opts) {
    super(name, params, opts);
  }

  static get DataTypes() {
    return DataTypes;
  }

  toSqlString() {
    const { allowNull, defaultValue, primaryKey } = this;
    const { columnName, columnType, type } = this;
    const chunks = [
      escapeId(columnName),
      columnType.toUpperCase() || type.toSqlString(),
    ];

    if (primaryKey) chunks.push('PRIMARY KEY');

    // https://www.cyj.me/programming/2018/01/11/programming-leoric-ii/
    if (this.autoIncrement) chunks.push('AUTOINCREMENT');

    if (!primaryKey && !allowNull) chunks.push('NOT NULL');

    if (defaultValue != null) {
      chunks.push(`DEFAULT ${escape(defaultValue)}`);
    }

    return chunks.join(' ');
  }
}

module.exports = SqliteAttribute;
