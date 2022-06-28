'use strict';

const util = require('util');
const invokableFunc = require('./utils/invokable');
const Raw = require('./raw');

type LENGTH_VARIANTS = 'tiny' | '' | 'medium' | 'long';

export interface AbstractDataType<T> {
  new (dataLength?: LENGTH_VARIANTS | number): BaseDataType & T;
  (dataLength?: LENGTH_VARIANTS | number): BaseDataType & T;
  // toSqlString(): string;
}

/**
 * @example
 * const { STRING, INTEGER, BIGINT, DATE, BOOLEAN } = app.model;
 * class User = app.model.define('User', {
 *   login: STRING,
 * });
 */

export abstract class BaseDataType {
  // BaseDataType(_dataLength?: number) => BaseDataType;

  dataType: string;
  dataLength?: string | number;

  /**
   * Check if params is instance of DataType or not
   * @param {*} params
   * @returns {boolean}
   */
  static is(params: any): boolean {
    return params instanceof BaseDataType;
  }

  /**
   * cast raw data returned from data packet into js type
   */
  cast(value: any): any {
    return value;
  }

  /**
   * uncast js value into database type with precision
   */
  uncast(value: any, _strict?: boolean): string {
    return value;
  }

  static get invokable() {
    return new Proxy(this, {
      get(target, p) {
        const value = target[p];
        if (DataTypes.hasOwnProperty(p)) return invokableFunc(value);
        return value;
      }
    }); 
  }

  abstract toSqlString(): string;

  static toSqlString(): string {
    return '';
  }
}

/**
 * @example
 * STRING
 * STRING(127)
 * STRING.BINARY
 * @param {number} dataLength
 */
class STRING extends BaseDataType {
  constructor(dataLength = 255) {
    super();
    this.dataType = 'varchar';
    this.dataLength = dataLength;
  }

  toSqlString() {
    const { dataLength } = this;
    const dataType = this.dataType.toUpperCase();
    const chunks: string[] = [];
    chunks.push(dataLength && dataLength > 0 ? `${dataType}(${dataLength})` : dataType);
    return chunks.join(' ');
  }

  uncast(value) {
    if (value == null || value instanceof Raw) return value;
    return '' + value;
  }
}

class BINARY extends BaseDataType {
  constructor(dataLength = 255) {
    super();
    this.dataLength = dataLength;
    this.dataType = 'binary';
  }

  toSqlString() {
    const { dataLength } = this;
    const dataType = this.dataType.toUpperCase();
    const chunks: string[] = [];
    chunks.push(dataLength && dataLength > 0 ? `${dataType}(${dataLength})` : dataType);
    return chunks.join(' ');
  }

  cast(value: string | Buffer): Buffer | string {
    if (value == null) return value;
    if (Buffer.isBuffer(value)) return value;
    return Buffer.from(value);
  }
}

class VARBINARY extends BINARY {
  constructor(dataLength?: number) {
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
class INTEGER extends BaseDataType {
  unsigned?: boolean;
  zerofill?: boolean;

  constructor(dataLength?: number) {
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
    const chunks: string[] = [];
    chunks.push(dataLength && dataLength > 0 ? `${dataType}(${dataLength})` : dataType);
    if (unsigned) chunks.push('UNSIGNED');
    if (zerofill) chunks.push('ZEROFILL');
    return chunks.join(' ');
  }

  cast(value: number): number {
    if (value == null || isNaN(value)) return value;
    return Number(value);
  }

  uncast(value: any, strict = true): string {
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
  constructor(dataLength?: number) {
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
  constructor(dataLength?: number) {
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
  constructor(dataLength?: number) {
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
  constructor(dataLength?: number) {
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
  precision?: number;
  scale?: number;

  constructor(precision?: number, scale?: number) {
    super();
    this.dataType = 'decimal';
    this.precision = precision;
    this.scale = scale;
  }

  toSqlString() {
    const { precision, scale, unsigned, zerofill } = this;
    const dataType = this.dataType.toUpperCase();
    const chunks: string[] = [];
    if (precision && precision > 0 && scale != null && scale >= 0) {
      chunks.push(`${dataType}(${precision},${scale})`);
    } else if (precision && precision > 0) {
      chunks.push(`${dataType}(${precision})`);
    } else {
      chunks.push(dataType);
    }
    if (unsigned) chunks.push('UNSIGNED');
    if (zerofill) chunks.push('ZEROFILL');
    return chunks.join(' ');
  }
}

const rDateFormat = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:[,.]\d{3,6}){0,1}$/;
class DATE extends BaseDataType {
  precision?: number | null;
  timezone?: boolean = true;

  constructor(precision?: number | null, timezone: boolean = true) {
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

  cast(value: Date | string | number): Date | number | string {
    const original = value;
    if (value == null) return value;
    if (!(value instanceof Date)) value = new Date(value);
    if (isNaN(value.getTime())) return original;
    return this._round(value);
  }

  uncast(value: any, _strict?: boolean): string {
    const originValue = value;

    if (value == null || value instanceof Raw) return value;
    if (typeof value.toDate === 'function') {
      value = value.toDate();
    }

    // @deprecated
    // vaguely standard date formats such as 2021-10-15 15:50:02,548
    if (typeof value === 'string' && rDateFormat.test(value)) {
      // 2021-10-15 15:50:02,548 => 2021-10-15T15:50:02,548,
      // 2021-10-15 15:50:02 => 2021-10-15T15:50:02.000
      value = new Date(`${value.replace(' ', 'T').replace(',', '.')}`);
    }

    // 1634611135776
    // '2021-10-15T08:38:43.877Z'
    if (!(value instanceof Date)) value = new Date(value);
    if (isNaN(value)) throw new Error(util.format('invalid date: %s', originValue));

    return this._round(value);
  }
}

class DATEONLY extends DATE {
  constructor() {
    super();
    this.dataType = 'date';
    this.precision = null;
    this.timezone = false;
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
}

class BOOLEAN extends BaseDataType {
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

class TEXT extends BaseDataType {
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

class BLOB extends BaseDataType {
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
class MYJSON extends BaseDataType {
  constructor() {
    super();
    this.dataType = 'text';
  }

  toSqlString() {
    return 'TEXT';
  }

  static toSqlString() {
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
class JSONB extends MYJSON {
  constructor() {
    super();
    this.dataType = 'json';
  }

  toSqlString() {
    return 'JSON';
  }

  static toSqlString() {
    return 'JSON';
  }
}

class VIRTUAL extends BaseDataType {
  virtual: boolean = true;
  constructor() {
    super();
    this.dataType = 'virtual';
    this.virtual = true;
  }

  toSqlString() {
    return 'VIRTUAL';
  }

  static  toSqlString() {
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
  JSON: MYJSON,
  JSONB,
  BINARY,
  VARBINARY,
  VIRTUAL,
};

type EXPORTED_DATA_TYPE<T> =  AbstractDataType<T> & T;

export class DataType extends BaseDataType {
  static STRING: EXPORTED_DATA_TYPE<STRING> = STRING as unknown as EXPORTED_DATA_TYPE<STRING>;
  static TINYINT: EXPORTED_DATA_TYPE<TINYINT> = TINYINT as unknown as EXPORTED_DATA_TYPE<TINYINT>;
  static SMALLINT: EXPORTED_DATA_TYPE<SMALLINT> = SMALLINT as unknown as EXPORTED_DATA_TYPE<SMALLINT>;
  static MEDIUMINT: EXPORTED_DATA_TYPE<MEDIUMINT> = MEDIUMINT as unknown as EXPORTED_DATA_TYPE<MEDIUMINT>;
  static INTEGER: EXPORTED_DATA_TYPE<INTEGER> = INTEGER as unknown as EXPORTED_DATA_TYPE<INTEGER>;
  static BIGINT: EXPORTED_DATA_TYPE<BIGINT> = BIGINT as unknown as EXPORTED_DATA_TYPE<BIGINT>;
  static DECIMAL: EXPORTED_DATA_TYPE<DECIMAL> = DECIMAL as unknown as EXPORTED_DATA_TYPE<DECIMAL>;
  static DATE: EXPORTED_DATA_TYPE<DATE> = DATE as unknown as EXPORTED_DATA_TYPE<DATE>;
  static TEXT: EXPORTED_DATA_TYPE<TEXT> = TEXT as unknown as EXPORTED_DATA_TYPE<TEXT>;
  static BLOB: EXPORTED_DATA_TYPE<BLOB> = BLOB as unknown as EXPORTED_DATA_TYPE<BLOB>;
  static JSON: EXPORTED_DATA_TYPE<MYJSON> = MYJSON as unknown as EXPORTED_DATA_TYPE<MYJSON>;
  static JSONB: EXPORTED_DATA_TYPE<JSONB> = JSONB as unknown as EXPORTED_DATA_TYPE<JSONB>;
  static BINARY: EXPORTED_DATA_TYPE<BINARY> = BINARY as unknown as EXPORTED_DATA_TYPE<BINARY>;
  static VARBINARY: EXPORTED_DATA_TYPE<VARBINARY> = VARBINARY as unknown as EXPORTED_DATA_TYPE<VARBINARY>;
  static VIRTUAL: EXPORTED_DATA_TYPE<VIRTUAL> = VIRTUAL as unknown as EXPORTED_DATA_TYPE<VIRTUAL>;
  static DATEONLY: EXPORTED_DATA_TYPE<DATEONLY> = DATEONLY as unknown as EXPORTED_DATA_TYPE<DATEONLY>;
  static BOOLEAN: EXPORTED_DATA_TYPE<BOOLEAN> = BOOLEAN as unknown as EXPORTED_DATA_TYPE<BOOLEAN>;

  static findType(columnType: string): DataType {
    const {
      STRING, TEXT, DATE, DATEONLY,
      TINYINT, SMALLINT, MEDIUMINT, INTEGER, 
      BIGINT, DECIMAL, BOOLEAN,
      BINARY, VARBINARY, BLOB,
    } = this;

    const res = columnType?.match(/(\w+)(?:\((\d+)(?:,(\d+))?\))?/);
    if(!res) {
      throw new Error(`Unknown columnType ${columnType}`);
    }
    const [ , dataType, ...matches ] = res;
    const params: any[] = [];
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

  toSqlString(): string {
    return '';
  }
}

export const invokable = DataType.invokable;

export default DataType;
