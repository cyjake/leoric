'use strict';

const util = require('util');
const invokable = require('./utils/invokable');
const Raw = require('./raw');

/**
 * @example
 * const { STRING, INTEGER, BIGINT, DATE, BOOLEAN } = app.model;
 * class User = app.model.define('User', {
 *   login: STRING,
 * });
 */

class DataType {
  static findType(columnType) {
    const {
      STRING, TEXT,
      DATE, DATEONLY,
      TINYINT, SMALLINT, MEDIUMINT, INTEGER, BIGINT, DECIMAL,
      BOOLEAN,
      BINARY, VARBINARY, BLOB,
    } = this;
    const [ , dataType, ...matches ] = columnType.match(/(\w+)(?:\((\d+)(?:,(\d+))?\))?/);
    const params = [];
    for (let i = 0; i < matches.length; i++) {
      if (matches[i] != null) params[i] = parseInt(matches[i], 10);
    }

    switch (dataType) {
      case 'varchar':
      case 'char':
        return new STRING(...params);
      // longtext is only for MySQL
      case 'longtext':
        return new TEXT('long');
      case 'mediumtext':
        return new TEXT('medium');
      case 'text':
        return new TEXT();
      case 'date':
        return new DATEONLY();
      case 'datetime':
      case 'timestamp':
        // new DATE(precision)
        return new DATE(...params);
      case 'decimal':
        return new DECIMAL(...params);
      case 'int':
      case 'integer':
      case 'numeric':
        return new INTEGER(...params);
      case 'mediumint':
        return new MEDIUMINT(...params);
      case 'smallint':
        return new SMALLINT(...params);
      case 'tinyint':
        return new TINYINT(...params);
      case 'bigint':
        return new BIGINT(...params);
      case 'boolean':
        return new BOOLEAN();
      // mysql only
      case 'binary':
      // postgres only
      case 'bytea':
        return new BINARY(...params);
      // mysql only
      case 'varbinary':
        return new VARBINARY(...params);
      case 'longblob':
        return new BLOB('long');
      case 'mediumblob':
        return new BLOB('medium');
      case 'blob':
        return new BLOB();
      case 'tinyblob':
        return new BLOB('tiny');
      default:
        throw new Error(`Unexpected data type ${dataType}`);
    }
  }

  /**
   * Check if params is instance of DataType or not
   * @param {*} params
   * @returns {boolean}
   */
  static is(params) {
    return params instanceof DataType;
  }

  /**
   * cast raw data returned from data packet into js type
   */
  cast(value) {
    return value;
  }

  /**
   * uncast js value into database type with precision
   */
  uncast(value) {
    return value;
  }
}

/**
 * @example
 * STRING
 * STRING(127)
 * STRING.BINARY
 * @param {number} dataLength
 */
class STRING extends DataType {
  constructor(dataLength = 255) {
    super();
    this.dataType = 'varchar';
    this.dataLength = dataLength;
  }

  toSqlString() {
    const { dataLength } = this;
    const dataType = this.dataType.toUpperCase();
    const chunks = [];
    chunks.push(dataLength > 0 ? `${dataType}(${dataLength})` : dataType);
    return chunks.join(' ');
  }

  uncast(value) {
    if (value == null || value instanceof Raw) return value;
    return '' + value;
  }
}

class BINARY extends DataType {
  constructor(dataLength = 255) {
    super();
    this.dataLength = dataLength;
    this.dataType = 'binary';
  }

  toSqlString() {
    const { dataLength } = this;
    const dataType = this.dataType.toUpperCase();
    const chunks = [];
    chunks.push(dataLength > 0 ? `${dataType}(${dataLength})` : dataType);
    return chunks.join(' ');
  }

  cast(value) {
    if (value == null) return value;
    if (Buffer.isBuffer(value)) return value;
    return Buffer.from(value);
  }
}

class VARBINARY extends BINARY {
  constructor(dataLength) {
    super(dataLength);
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
 * @param {number} dataLength
 */
class INTEGER extends DataType {
  constructor(dataLength) {
    super();
    this.dataLength = dataLength;
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
    const { dataLength, unsigned, zerofill } = this;
    const dataType = this.dataType.toUpperCase();
    const chunks = [];
    chunks.push(dataLength > 0 ? `${dataType}(${dataLength})` : dataType);
    if (unsigned) chunks.push('UNSIGNED');
    if (zerofill) chunks.push('ZEROFILL');
    return chunks.join(' ');
  }

  cast(value) {
    if (value == null || isNaN(value)) return value;
    return Number(value);
  }

  uncast(value, strict = true) {
    const originValue = value;
    if (value == null || value instanceof Raw) return value;
    if (typeof value === 'string') value = parseInt(value, 10);
    if (isNaN(value)) {
      if (strict) throw new Error(util.format('invalid integer: %s', originValue));
      return originValue;
    }
    return value;
  }
}

/**
 * 8 bit integer
 * @example
 * TINYINT
 * TINYINT.UNSIGNED
 * TINYINT(1)
 * @param {number} dataLength
 */
class TINYINT extends INTEGER {
  constructor(dataLength) {
    super(dataLength);
    this.dataType = 'tinyint';
  }
}

/**
 * 16 bit integer
 * @example
 * SMALLINT
 * SMALLINT.UNSIGNED
 * SMALLINT(2)
 * @param {number} dataLength
 */
class SMALLINT extends INTEGER {
  constructor(dataLength) {
    super(dataLength);
    this.dataType = 'smallint';
  }
}

/**
 * 24 bit integer
 * @example
 * MEDIUMINT
 * MEDIUMINT.UNSIGNED
 * MEDIUMINT(3)
 * @param {number} dataLength
 */
class MEDIUMINT extends INTEGER {
  constructor(dataLength) {
    super(dataLength);
    this.dataType = 'mediumint';
  }
}


/**
 * 64 bit integer
 * @example
 * BIGINT
 * BIGINT.UNSIGNED
 * BIGINT(8)
 * @param {number} dataLength
 */
class BIGINT extends INTEGER {
  constructor(dataLength) {
    super(dataLength);
    this.dataType = 'bigint';
  }
}

/**
 * fixed-point decimal types
 * @example
 * DECIMAL
 * DECIMAL.UNSIGNED
 * DECIMAL(5, 2)
 * @param {number} precision
 * @param {number} scale
 * - https://dev.mysql.com/doc/refman/8.0/en/fixed-point-types.html
 */
class DECIMAL extends INTEGER {
  constructor(precision, scale) {
    super();
    this.dataType = 'decimal';
    this.precision = precision;
    this.scale = scale;
  }

  toSqlString() {
    const { precision, scale, unsigned, zerofill } = this;
    const dataType = this.dataType.toUpperCase();
    const chunks = [];
    if (precision > 0 && scale >= 0) {
      chunks.push(`${dataType}(${precision},${scale})`);
    } else if (precision > 0) {
      chunks.push(`${dataType}(${precision})`);
    } else {
      chunks.push(dataType);
    }
    if (unsigned) chunks.push('UNSIGNED');
    if (zerofill) chunks.push('ZEROFILL');
    return chunks.join(' ');
  }
}

const rDateFormat = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:[,.]\d{3,6})$/;

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
    if (precision != null && precision >= 0) return `${dataType}(${precision})`;
    return dataType;
  }

  _round(value) {
    const { precision } = this;
    if (precision != null && precision < 3 && value instanceof Date) {
      const divider = 10 ** (3 - precision);
      return new Date(Math.round(value.getTime() / divider) * divider);
    }
    return value;
  }

  cast(value) {
    const original = value;
    if (value == null) return value;
    if (!(value instanceof Date)) value = new Date(value);
    if (isNaN(value.getTime())) return original;
    return this._round(value);
  }

  uncast(value) {
    const originValue = value;

    if (value == null || value instanceof Raw) return value;
    if (typeof value.toDate === 'function') {
      value = value.toDate();
    }

    // @deprecated
    // vaguely standard date formats such as 2021-10-15 15:50:02,548
    if (typeof value === 'string' && rDateFormat.test(value)) {
      value = new Date(`${value.replace(' ', 'T').replace(',', '.')}Z`);
    }

    // 1634611135776
    // '2021-10-15T08:38:43.877Z'
    if (!(value instanceof Date)) value = new Date(value);
    if (isNaN(value)) throw new Error(util.format('invalid date: %s', originValue));

    return this._round(value);
  }
}

class DATEONLY extends DataType {
  constructor() {
    super();
    this.dataType = 'date';
  }

  toSqlString() {
    return this.dataType.toUpperCase();
  }

  _round(value) {
    if (value instanceof Date) {
      return new Date(value.getFullYear(), value.getMonth(), value.getDate());
    }
    return value;
  }

  cast(value) {
    const original = value;
    if (value == null) return value;
    if (!(value instanceof Date)) value = new Date(value);
    if (isNaN(value.getTime())) return original;
    return this._round(value);
  }

  uncast(value) {
    const originValue = value;

    if (value == null || value instanceof Raw) return value;
    if (typeof value.toDate === 'function') {
      value = value.toDate();
    }

    // @deprecated
    // vaguely standard date formats such as 2021-10-15 15:50:02,548
    if (typeof value === 'string' && rDateFormat.test(value)) {
      value = new Date(`${value.replace(' ', 'T').replace(',', '.')}Z`);
    }

    if (!(value instanceof Date)) value = new Date(value);
    if (isNaN(value)) throw new Error(util.format('invalid date: %s', originValue));

    return this._round(value);
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

  cast(value) {
    if (value == null) return value;
    return Boolean(value);
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
    this.dataLength = length;
  }

  toSqlString() {
    return [ this.dataLength, this.dataType ].join('').toUpperCase();
  }
}

class BLOB extends DataType {
  constructor(length = '') {
    if (!LENGTH_VARIANTS.includes(length)) {
      throw new Error(`invalid blob length: ${length}`);
    }
    super();
    this.dataType = 'blob';
    this.dataLength = length;
  }

  toSqlString() {
    return [ this.dataLength, this.dataType ].join('').toUpperCase();
  }

  cast(value) {
    if (value == null) return value;
    if (Buffer.isBuffer(value)) return value;
    return Buffer.from(value);
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

  cast(value) {
    if (!value) return value;
    // type === JSONB
    if (typeof value === 'object') return value;
    try {
      return global.JSON.parse(value);
    } catch (err) {
      console.error(new Error(`unable to cast ${value} to JSON`));
      return value;
    }
  }

  uncast(value) {
    if (value == null || value instanceof Raw) return value;
    return global.JSON.stringify(value);
  }
}

// JSON binary type, available in postgreSQL or mySQL 5.7 +
// - https://dev.mysql.com/doc/refman/8.0/en/json.html
// - https://www.postgresql.org/docs/9.4/datatype-json.html
class JSONB extends JSON {
  constructor() {
    super();
    this.dataType = 'json';
  }

  toSqlString() {
    return 'JSON';
  }
}

class VIRTUAL extends DataType {
  constructor() {
    super();
    this.dataType = 'virtual';
    this.virtual = true;
  }

  toSqlString() {
    return 'VIRTUAL';
  }
}

const DataTypes = {
  STRING,
  TINYINT,
  SMALLINT,
  MEDIUMINT,
  INTEGER,
  BIGINT,
  DECIMAL,
  DATE,
  DATEONLY,
  BOOLEAN,
  TEXT,
  BLOB,
  JSON,
  JSONB,
  BINARY,
  VARBINARY,
  VIRTUAL,
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
