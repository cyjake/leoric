'use strict';

const { escape, escapeId } = require('sqlstring');

const Attribute = require('../abstract/attribute');
const DataTypes = require('./data_types');

class MysqlAttribute extends Attribute {
  constructor(name, params, opts) {
    super(name, params, opts);
  }

  static get DataTypes() {
    return DataTypes;
  }

  toSqlString() {
    const {
      columnName,
      type, columnType,
      allowNull, defaultValue,
      primaryKey,
      comment,
      unique,
    } = this;

    const chunks = [
      escapeId(columnName),
      columnType.toUpperCase() || type.toSqlString(),
    ];

    if (primaryKey) chunks.push('PRIMARY KEY');

    if (primaryKey || this.autoIncrement) chunks.push('AUTO_INCREMENT');

    if (!primaryKey && !allowNull) chunks.push('NOT NULL');

    if (unique === true) {
      chunks.push('UNIQUE');
    }

    if (defaultValue != null) {
      chunks.push(`DEFAULT ${escape(defaultValue)}`);
    }

    if (typeof comment === 'string') {
      chunks.push(`COMMENT ${escape(comment)}`);
    }

    return chunks.join(' ');
  }
}

module.exports = MysqlAttribute;
