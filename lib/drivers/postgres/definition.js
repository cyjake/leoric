'use strict';

const Definition = require('../abstract/definition');

class PostgresDefinition extends Definition {
  constructor(name, params, opts) {
    super(name, params, opts);
    if (this.dataType === 'datetime') {
      this.dataType = this.type.dataType = 'timestamp';
    }
    if (this.dataType === 'int' && this.primaryKey) {
      this.dataType = this.type.dataType = 'integer';
    }
  }

  toSqlString() {
    const {
      type, columnType, allowNull, defaultValue, primaryKey,
    } = this;
    const dataType = columnType || (type ? type.toSqlString() : this.dataType);
    const chunks = [ dataType ];

    if (primaryKey || this.autoIncrement) chunks[0] = 'SERIAL';

    if (primaryKey) chunks.push('PRIMARY KEY');

    if (!primaryKey && !allowNull) chunks.push('NOT NULL');

    if (defaultValue != null) {
      chunks.push(`DEFAULT ${(defaultValue)}`);
    }

    return chunks.join(' ');
  }
}

module.exports = PostgresDefinition;
