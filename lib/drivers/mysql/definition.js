'use strict';

const SqlString = require('sqlstring');

const DataTypes = require('./data_types');
const Definition = require('../abstract/definition');

class MysqlDefinition extends Definition {
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

    const chunks = [ columnType.toUpperCase() || type.toSqlString() ];

    if (primaryKey) chunks.push('PRIMARY KEY');

    if (primaryKey || this.autoIncrement) chunks.push('AUTO_INCREMENT');

    if (!primaryKey && !allowNull) chunks.push('NOT NULL');

    if (defaultValue != null) {
      chunks.push(`DEFAULT ${SqlString.escape(defaultValue)}`);
    }

    return chunks.join(' ');
  }
}

module.exports = MysqlDefinition;
