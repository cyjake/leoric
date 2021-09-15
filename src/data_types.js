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
    const { STRING, TEXT, DATE, INTEGER, BIGINT, BOOLEAN, BINARY, VARBINARY, BLOB } = this;

    switch (dataType) {
      case 'varchar':
      case 'char':
        return STRING;
      // longtext is only for MySQL
      case 'longtext':
      case 'mediumtext':
      case 'text':
        return TEXT;
      case 'date':
      case 'datetime':
      case 'timestamp':
        return DATE;
      case 'decimal':
      case 'int':
      case 'integer':
      case 'numeric':
      case 'mediumint':
      case 'smallint':
      case 'tinyint':
        return INTEGER;
      case 'bigint':
        return BIGINT;
      case 'boolean':
        return BOOLEAN;
      // mysql only
      case 'binary':
      // postgres only
      case 'bytea':
        return BINARY;
      // mysql only
      case 'varbinary':
        return VARBINARY;
      case 'blob':
        return BLOB;
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

  toSqlString() {
    const { length } = this;
    const dataType = this.dataType.toUpperCase();
    const chunks = [];
    chunks.push(length > 0 ? `${dataType}(${length})` : dataType);
    return chunks.join(' ');
  }
}

class BINARY extends DataType {
  constructor(length = 255) {
    super();
    this.length = length;
    this.dataType = 'binary';
  }

  toSqlString() {
    const { length } = this;
    const dataType = this.dataType.toUpperCase();
    const chunks = [];
    chunks.push(length > 0 ? `${dataType}(${length})` : dataType);
    return chunks.join(' ');
  }
}

class VARBINARY extends BINARY {
  constructor(length) {
    super(length);
    this.dataType = 'varbinary';
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

const LENGTH_VARIANTS = [ 'tiny', '', 'medium', 'long' ];

class TEXT extends DataType {
  constructor(length = '') {
    if (!LENGTH_VARIANTS.includes(length)) {
      throw new Error(`invalid text length: ${length}`);
    }
    super();
    this.dataType = 'text';
    this.length = length;
  }

  toSqlString() {
    return [ this.length, this.dataType ].join('').toUpperCase();
  }
}

class BLOB extends DataType {
  constructor(length = '') {
    if (!LENGTH_VARIANTS.includes(length)) {
      throw new Error(`invalid blob length: ${length}`);
    }
    super();
    this.dataType = 'blob';
    this.length = length;
  }

  toSqlString() {
    return [ this.length, this.dataType ].join('').toUpperCase();
  }
}

// JSON text type
class JSON extends DataType {
  constructor() {
    super();
    this.dataType = 'text';
  }

  toSqlString() {
    return 'TEXT';
  }
}

// JSON binary type, available in postgreSQL or mySQL 5.7 +
// - https://dev.mysql.com/doc/refman/8.0/en/json.html
// - https://www.postgresql.org/docs/9.4/datatype-json.html
class JSONB extends DataType {
  constructor() {
    super();
    this.dataType = 'json';
  }

  toSqlString() {
    return 'JSON';
  }
}

const DataTypes = {
  STRING,
  INTEGER,
  BIGINT,
  DATE,
  BOOLEAN,
  TEXT,
  BLOB,
  JSON,
  JSONB,
  BINARY,
  VARBINARY,
};

Object.assign(DataType, DataTypes);
Object.defineProperty(DataType, 'invokable', {
  get() {
    return new Proxy(this, {
      get(target, p) {
        const value = target[p];
        if (DataTypes.hasOwnProperty(p)) return invokable(value);
        return value;
      }
    });
  },
});

module.exports = DataType;
