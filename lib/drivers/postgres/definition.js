'use strict';

const SqlString = require('sqlstring');

const DataTypes = require('./data_types');
const Definition = require('../abstract/definition');

class PostgresDefinition extends Definition {
  constructor(name, params, opts) {
    super(name, params, opts);
  }

  static get DataTypes() {
    return DataTypes;
  }

  toSqlString() {
    const {
      type, columnType, allowNull, defaultValue, primaryKey,
    } = this;
    const dataType = columnType.toUpperCase() || type.toSqlString();
    const chunks = [ dataType ];

    if (primaryKey || this.autoIncrement) chunks[0] = 'SERIAL';

    if (primaryKey) chunks.push('PRIMARY KEY');

    if (!primaryKey && !allowNull) chunks.push('NOT NULL');

    if (defaultValue != null) {
      chunks.push(`DEFAULT ${SqlString.escape(defaultValue)}`);
    }

    return chunks.join(' ');
  }
}

module.exports = PostgresDefinition;
