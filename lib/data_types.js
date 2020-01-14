'use strict';

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
    this.type = 'varchar';
    this.length = length;
  }

  get BINARY() {
    this.binary = true;
    return this;
  }

  toSqlString() {
    const { length, binary } = this;
    const type = this.type.toUpperCase();
    const chunks = [];
    chunks.push(length > 0 ? `${type}(${length})` : type);
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
    this.type = 'int';
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
    const type = this.type.toUpperCase();
    const chunks = [];
    chunks.push(length > 0 ? `${type}(${length})` : type);
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
    this.type = 'bigint';
  }
}

class DATE extends DataType {
  constructor(precision) {
    super();
    this.type = 'datetime';
    this.precision = precision;
  }

  toSqlString() {
    const { precesion } = this;
    const type = this.type.toUpperCase();
    if (precesion > 0) return `${type}(${precesion})`;
    return type;
  }
}

class BOOLEAN extends DataType {
  constructor() {
    super();
    this.type = 'tinyint';
  }

  toSqlString() {
    const type = this.type.toUpperCase();
    return `${type}(1)`;
  }
}

class TEXT extends DataType {
  constructor() {
    super();
    this.type = 'text';
  }

  toSqlString() {
    return this.type.toUpperCase();
  }
}

class BLOB extends DataType {
  constructor() {
    super();
    this.type = 'longblob';
  }

  toSqlString() {
    return this.type.toUpperCase();
  }
}

module.exports = [
  STRING,
  INTEGER,
  BIGINT,
  DATE,
  BOOLEAN,
  TEXT,
  BLOB,
].reduce((result, klass) => {
  result[klass.name] = new Proxy(klass, {
    apply(target, thisArg, args) {
      return new target(...args);
    },

    construct(target, args) {
      return new target(...args);
    },

    get(target, p) {
      return new target()[p];
    }
  });
  return result;
}, {});
