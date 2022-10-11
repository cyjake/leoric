import Raw from './raw';
import util from 'util';
const invokableFunc = require('./utils/invokable');

export enum LENGTH_VARIANTS {
  tiny = 'tiny',
  empty = '',
  medium = 'medium',
  long = 'long',
};

export interface AbstractDataType<T> {
  new (dataLength?: LENGTH_VARIANTS | number): DataType & T;
  (dataLength?: LENGTH_VARIANTS | number): DataType & T;
}

/**
 * @example
 * const { STRING, INTEGER, BIGINT, DATE, BOOLEAN } = app.model;
 * class User = app.model.define('User', {
 *   login: STRING,
 * });
 */

export abstract class DataType {
  dataType: string = '';
  dataLength?: string | number;

  /**
   * cast raw data returned from data packet into js type
   */
  cast(value: any): any {
    return value;
  }

  /**
   * uncast js value into database type with precision
   */
  uncast(value: any, _strict?: boolean): any {
    return value;
  }

  abstract toSqlString(): string;
}

/**
 * @example
 * STRING
 * STRING(127)
 * STRING.BINARY
 * @param {number} dataLength
 */
class STRING extends DataType {
  constructor(dataLength: number = 255) {
    super();
    this.dataType = 'varchar';
    this.dataLength = dataLength;
  }

  toSqlString(): string {
    const { dataLength } = this;
    const dataType = this.dataType.toUpperCase();
    const chunks: string[] = [];
    chunks.push(dataLength && dataLength > 0 ? `${dataType}(${dataLength})` : dataType);
    return chunks.join(' ');
  }

  uncast(value: string | Raw | null): string | Raw | null {
    if (value == null || value instanceof Raw) return value;
    return '' + value;
  }
}

class CHAR extends STRING {
  constructor(dataLength: number = 255) {
    super(dataLength);
    this.dataType = 'char';
  }
}

class BINARY extends DataType {
  constructor(dataLength = 255) {
    super();
    this.dataLength = dataLength;
    this.dataType = 'binary';
  }

  toSqlString(): string {
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
class INTEGER extends DataType {
  unsigned?: boolean;
  zerofill?: boolean;

  constructor(dataLength?: number, unsigned?: boolean, zerofill?: boolean) {
    super();
    this.dataLength = dataLength;
    this.dataType = 'integer';
    this.unsigned = unsigned;
    this.zerofill = zerofill;
  }

  get UNSIGNED() {
    this.unsigned = true;
    return this;
  }

  get ZEROFILL() {
    this.zerofill = true;
    return this;
  }

  toSqlString(): string {
    const { dataLength, unsigned, zerofill } = this;
    const dataType = this.dataType.toUpperCase();
    const chunks: string[] = [];
    chunks.push(dataLength && dataLength > 0 ? `${dataType}(${dataLength})` : dataType);
    if (unsigned) chunks.push('UNSIGNED');
    if (zerofill) chunks.push('ZEROFILL');
    return chunks.join(' ');
  }

  cast(value: number): number {
    const result = Number(value);
    if (value == null || Number.isNaN(result)) return value;
    return result;
  }

  uncast(value: any, strict = true): string | number {
    const originValue = value;
    if (value == null || value instanceof Raw) return value;
    if (typeof value === 'string') value = parseInt(value, 10);
    if (Number.isNaN(value)) {
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
  constructor(dataLength?: number, unsigned?: boolean, zerofill?: boolean) {
    super(dataLength, unsigned, zerofill);
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
  constructor(dataLength?: number, unsigned?: boolean, zerofill?: boolean) {
    super(dataLength, unsigned, zerofill);
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
  constructor(dataLength?: number, unsigned?: boolean, zerofill?: boolean) {
    super(dataLength, unsigned, zerofill);
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
  constructor(dataLength?: number, unsigned?: boolean, zerofill?: boolean) {
    super(dataLength, unsigned, zerofill);
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
class DATE extends DataType {
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

  uncast(value: null | Raw | string | Date | { toDate: () => Date }, _strict?: boolean): string | Date | Raw | null | undefined {
    const originValue = value;

    // type narrowing doesn't handle `return value` correctly
    if (value == null) return value as null | undefined;
    if (value instanceof Raw) return value;
    // Date | Moment
    if (typeof value === 'object' && 'toDate' in value) value = value.toDate();

    // @deprecated
    // vaguely standard date formats such as 2021-10-15 15:50:02,548
    if (typeof value === 'string' && rDateFormat.test(value)) {
      // 2021-10-15 15:50:02,548 => 2021-10-15T15:50:02,548,
      // 2021-10-15 15:50:02 => 2021-10-15T15:50:02.000
      value = new Date(`${value.replace(' ', 'T').replace(',', '.')}`);
    }

    // 1634611135776
    // '2021-10-15T08:38:43.877Z'
    if (!(value instanceof Date)) value = new Date((value as string));
    if (isNaN((value as any))) throw new Error(util.format('invalid date: %s', originValue));

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

  toSqlString(): string {
    return this.dataType.toUpperCase();
  }

  _round(value) {
    if (value instanceof Date) {
      return new Date(value.getFullYear(), value.getMonth(), value.getDate());
    }
    return value;
  }
}

class BOOLEAN extends DataType {
  constructor() {
    super();
    this.dataType = 'boolean';
  }

  toSqlString(): string {
    return this.dataType.toUpperCase();
  }

  cast(value) {
    if (value == null) return value;
    return Boolean(value);
  }
}

class TEXT extends DataType {
  constructor(length: LENGTH_VARIANTS = LENGTH_VARIANTS.empty) {
    if (!Object.values(LENGTH_VARIANTS).includes(length)) {
      throw new Error(`invalid text length: ${length}`);
    }
    super();
    this.dataType = 'text';
    this.dataLength = length;
  }

  toSqlString(): string {
    return [ this.dataLength, this.dataType ].join('').toUpperCase();
  }
}

class BLOB extends DataType {
  constructor(length: LENGTH_VARIANTS = LENGTH_VARIANTS.empty) {
    if (!Object.values(LENGTH_VARIANTS).includes(length)) {
      throw new Error(`invalid blob length: ${length}`);
    }
    super();
    this.dataType = 'blob';
    this.dataLength = length;
  }

  toSqlString(): string {
    return [ this.dataLength, this.dataType ].join('').toUpperCase();
  }

  cast(value) {
    if (value == null) return value;
    if (Buffer.isBuffer(value)) return value;
    return Buffer.from(value);
  }
}

// JSON text type
class MYJSON extends DataType {
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

  toSqlString(): string {
    return 'JSON';
  }

  static toSqlString(): string {
    return 'JSON';
  }
}

class VIRTUAL extends DataType {
  virtual: boolean = true;
  constructor() {
    super();
    this.dataType = 'virtual';
    this.virtual = true;
  }

  toSqlString(): string {
    return 'VIRTUAL';
  }

  static toSqlString(): string {
    return 'VIRTUAL';
  }

}

const AllDataTypes = {
  CHAR,
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

export type DATA_TYPE<T> = AbstractDataType<T> & T;

class DataTypes {
  static CHAR: DATA_TYPE<CHAR> = CHAR as any;
  static STRING: DATA_TYPE<STRING> = STRING as any;
  static TINYINT: DATA_TYPE<TINYINT> = TINYINT as any;
  static SMALLINT: DATA_TYPE<SMALLINT> = SMALLINT as any;
  static MEDIUMINT: DATA_TYPE<MEDIUMINT> = MEDIUMINT as any;
  static INTEGER: DATA_TYPE<INTEGER> = INTEGER as any;
  static BIGINT: DATA_TYPE<BIGINT> = BIGINT as any;
  static DECIMAL: DATA_TYPE<DECIMAL> = DECIMAL as any;
  static DATE: DATA_TYPE<DATE> = DATE as any;
  static TEXT: DATA_TYPE<TEXT> = TEXT as any;
  static BLOB: DATA_TYPE<BLOB> = BLOB as any;
  static JSON: DATA_TYPE<MYJSON> = MYJSON as any;
  static JSONB: DATA_TYPE<JSONB> = JSONB as any;
  static BINARY: DATA_TYPE<BINARY> = BINARY as any;
  static VARBINARY: DATA_TYPE<VARBINARY> = VARBINARY as any;
  static VIRTUAL: DATA_TYPE<VIRTUAL> = VIRTUAL as any;
  static DATEONLY: DATA_TYPE<DATEONLY> = DATEONLY as any;
  static BOOLEAN: DATA_TYPE<BOOLEAN> = BOOLEAN as any;

  static findType(columnType: string): DataTypes {
    const {
      CHAR, STRING, TEXT, DATE, DATEONLY,
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
      case 'char':
        return new CHAR(...params);
      case 'varchar':
        return new STRING(...params);
      // longtext is only for MySQL
      case 'longtext':
        return new TEXT(LENGTH_VARIANTS.long);
      case 'mediumtext':
        return new TEXT(LENGTH_VARIANTS.medium);
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
        return new BLOB(LENGTH_VARIANTS.long);
      case 'mediumblob':
        return new BLOB(LENGTH_VARIANTS.medium);
      case 'blob':
        return new BLOB();
      case 'tinyblob':
        return new BLOB(LENGTH_VARIANTS.tiny);
      default:
        throw new Error(`Unexpected data type ${dataType}`);
    }
  }

  static get invokable() {
    return new Proxy(this, {
      get(target, p) {
        const value = target[p];
        if (AllDataTypes.hasOwnProperty(p)) return invokableFunc(value);
        return value;
      }
    }); 
  }

  /**
   * Check if params is instance of DataType or not
   * @param {*} params
   * @returns {boolean}
   */
  static is(params: any): boolean {
    return params instanceof DataType;
  }
}

export const invokable = DataTypes.invokable;

export default DataTypes;
