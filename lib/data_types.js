'use strict';

const invokable = require('./utils/invokable');

/**
 * @example
 * const { STRING, INTEGER, BIGINT, DATE, BOOLEAN } = app.model;
 * class User = app.model.define('User', {
 *   login: STRING,
 * });
 */

class DataType {
  static findType(dataType) {
    const { STRING, TEXT, DATE, INTEGER, BIGINT, BOOLEAN } = this;

    switch (dataType) {
      case 'varchar':
        return STRING;
      case 'text':
        return TEXT;
      case 'datetime':
      case 'timestamp':
        return DATE;
      case 'decimal':
      case 'int':
      case 'integer':
      case 'numeric':
      case 'smallint':
      case 'tinyint':
        return INTEGER;
      case 'bigint':
        return BIGINT;
      case 'boolean':
        return BOOLEAN;
      default:
        throw new Error(`Unexpected data type ${dataType}`);
    }
  }
}

/**
 * @example
 * STRING
 * STRING(127)
 * STRING.BINARY
 * @param {number} length
 */
class STRING extends DataType {
  constructor(length = 255) {
    super();
    this.dataType = 'varchar';
    this.length = length;
  }

  get BINARY() {
    this.binary = true;
    return this;
  }

  toSqlString() {
    const { length, binary } = this;
    const dataType = this.dataType.toUpperCase();
    const chunks = [];
    chunks.push(length > 0 ? `${dataType}(${length})` : dataType);
    if (binary) chunks.push('BINARY');
    return chunks.join(' ');
  }
}

/**
 * ZEROFILL is deprecated
 * - https://dev.mysql.com/doc/refman/8.0/en/integer-types.html
 * @example
 * INTEGER
 * INTEGER.UNSIGNED
 * INTEGER.UNSIGNED.ZEROFILL
 * INTEGER(10)
 * @param {number} length
 */
class INTEGER extends DataType {
  constructor(length) {
    super();
    this.length = length;
    this.dataType = 'integer';
  }

  get UNSIGNED() {
    this.unsigned = true;
    return this;
  }

  get ZEROFILL() {
    this.zerofill = true;
    return this;
  }

  toSqlString() {
    const { length, unsigned, zerofill } = this;
    const dataType = this.dataType.toUpperCase();
    const chunks = [];
    chunks.push(length > 0 ? `${dataType}(${length})` : dataType);
    if (unsigned) chunks.push('UNSIGNED');
    if (zerofill) chunks.push('ZEROFILL');
    return chunks.join(' ');
  }
}

/**
 * 64 bit integer
 * @example
 * BIGINT
 * BIGINT.UNSIGNED
 * BIGINT(10)
 * @param {number} length
 */
class BIGINT extends INTEGER {
  constructor(length) {
    super(length);
    this.dataType = 'bigint';
  }
}

class DATE extends DataType {
  constructor(precision, timezone = true) {
    super();
    this.dataType = 'datetime';
    this.precision = precision;
    // PostgreSQL enables timestamp with or without time zone
    // - https://www.postgresql.org/docs/9.5/datatype-datetime.html
    this.timezone = timezone;
  }

  toSqlString() {
    const { precision } = this;
    const dataType = this.dataType.toUpperCase();
    if (precision > 0) return `${dataType}(${precision})`;
    return dataType;
  }
}

class BOOLEAN extends DataType {
  constructor() {
    super();
    this.dataType = 'boolean';
  }

  toSqlString() {
    return this.dataType.toUpperCase();
  }
}

class TEXT extends DataType {
  constructor() {
    super();
    this.dataType = 'text';
  }

  toSqlString() {
    return this.dataType.toUpperCase();
  }
}

class BLOB extends DataType {
  constructor() {
    super();
    this.dataType = 'longblob';
  }

  toSqlString() {
    return this.dataType.toUpperCase();
  }
}

// JSON text type
class JSON extends DataType {
  constructor() {
    super();
    this.dataType = 'json';
  }

  toSqlString() {
    return 'TEXT';
  }
}

// JSON binary type, available in postgreSQL or mySQL 5.7 +
class JSONB extends DataType {
  constructor() {
    super();
    this.dataType = 'jsonb';
  }

  toSqlString() {
    return 'json';
  }
}

const DataTypes = [
  STRING,
  INTEGER,
  BIGINT,
  DATE,
  BOOLEAN,
  TEXT,
  BLOB,
  JSON,
  JSONB,
];

for (const klass of DataTypes) {
  DataType[klass.name] = invokable(klass);
}

module.exports = DataType;
