'use strict';

const invokable = require('./utils/invokable');

/**
 * @example
 * const { STRING, INTEGER, BIGINT, DATE, BOOLEAN } = app.model;
 * class User = app.model.define('User', {
 *   login: STRING,
 * });
 */

class DataType {}

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
    this.dataType = 'int';
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
  constructor(precision) {
    super();
    this.dataType = 'datetime';
    this.precision = precision;
  }

  toSqlString() {
    const { precesion } = this;
    const dataType = this.dataType.toUpperCase();
    if (precesion > 0) return `${dataType}(${precesion})`;
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

const DataTypes = [
  STRING,
  INTEGER,
  BIGINT,
  DATE,
  BOOLEAN,
  TEXT,
  BLOB,
];

for (const klass of DataTypes) {
  DataType[klass.name] = invokable(klass);
}

module.exports = DataType;
