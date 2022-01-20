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
    const { STRING, TEXT, DATE, DATEONLY, INTEGER, BIGINT, BOOLEAN, BINARY, VARBINARY, BLOB } = this;
    const [ , dataType, appendix ] = columnType.match(/(\w+)(?:\((\d+)\))?/);
    const length = appendix && parseInt(appendix, 10);

    switch (dataType) {
      case 'varchar':
      case 'char':
        return new STRING(length);
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
        return new DATE(length);
      case 'decimal':
      case 'int':
      case 'integer':
      case 'numeric':
      case 'mediumint':
      case 'smallint':
      case 'tinyint':
        return new INTEGER(length);
      case 'bigint':
        return new BIGINT(length);
      case 'boolean':
        return new BOOLEAN();
      // mysql only
      case 'binary':
      // postgres only
      case 'bytea':
        return new BINARY(length);
      // mysql only
      case 'varbinary':
        return new VARBINARY(length);
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

  uncast(value) {
    if (value == null || value instanceof Raw) return value;
    return '' + value;
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

  cast(value) {
    if (value == null) return value;
    if (Buffer.isBuffer(value)) return value;
    return Buffer.from(value);
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

  cast(value) {
    if (value == null) return value;
    return Number(value);
  }

  uncast(value) {
    const originValue = value;
    if (value == null || value instanceof Raw) return value;
    if (typeof value === 'string') value = parseInt(value, 10);
    if (isNaN(value)) throw new Error(util.format('invalid integer: %s', originValue));
    return value;
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
    if (value == null) return value;
    if (!(value instanceof Date)) value = new Date(value);
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
    if (value == null) return value;
    if (!(value instanceof Date)) value = new Date(value);
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
    if (isNaN(value)) throw new Error(util.format('invalid date: %s', originValue));;

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

const DataTypes = {
  STRING,
  INTEGER,
  BIGINT,
  DATE,
  DATEONLY,
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
