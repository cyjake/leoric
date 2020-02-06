'use strict';

const SqlString = require('sqlstring');

const DataTypes = require('./data_types');
const Definition = require('../abstract/definition');

function escape(value) {
  if (typeof value === 'boolean') return +value;
  return SqlString.escape(value);
}

class SqliteDefinition extends Definition {
  constructor(name, params, opts) {
    super(name, params, opts);
  }

  static get DataTypes() {
    return DataTypes;
  }

  toSqlString() {
    const { allowNull, defaultValue, primaryKey } = this;
    const { columnType, type } = this;
    const chunks = [ columnType || type.toSqlString() ];

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

module.exports = SqliteDefinition;
