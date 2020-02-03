'use strict';

const SqlString = require('sqlstring');
const Definition = require('../abstract/definition');

class MysqlDefinition extends Definition {
  toSqlString() {
    const {
      type, columnType, dataType, allowNull, defaultValue, primaryKey,
    } = this;
    const chunks = [ columnType || (type ? type.toSqlString() : dataType) ];

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
