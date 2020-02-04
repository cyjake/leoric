'use strict';

const SqlString = require('sqlstring');
const Definition = require('../abstract/definition');

function escape(value) {
  if (typeof value === 'boolean') return +value;
  return SqlString.escape(value);
}

class SqliteDefinition extends Definition {
  constructor(name, params, opts) {
    super(name, params, opts);
    // only INTEGER PRIMARY KEY can be mapped with rowid
    if (this.primaryKey && this.dataType == 'int') {
      this.dataType = 'integer';
    }
  }

  toSqlString() {
    const { dataType, allowNull, defaultValue, primaryKey } = this;
    const chunks = [ dataType.toUpperCase() ];

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
