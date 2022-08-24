'use strict';

const { default: DataTypes } = require('../../data_types');
const util = require('util');
const Raw = require('../../raw');


class Postgres_DATE extends DataTypes.DATE {
  constructor(precision, timezone = true) {
    super(precision, timezone);
    this.dataType = 'timestamp';
  }

  toSqlString() {
    const { timezone } = this;
    if (timezone) return `${super.toSqlString()} WITH TIME ZONE`;
    return `${super.toSqlString()} WITHOUT TIME ZONE`;
  }
}

class Postgres_JSONB extends DataTypes.JSONB {
  constructor() {
    super();
    this.dataType = 'jsonb';
  }

  toSqlString() {
    return 'JSONB';
  }
}

class Postgres_BINARY extends DataTypes.BINARY {
  constructor() {
    super();
    this.dataType = 'bytea';
  }

  toSqlString() {
    return 'BYTEA';
  }
}

class Postgres_INTEGER extends DataTypes.INTEGER {
  constructor(dataLength) {
    super(dataLength);
  }

  uncast(value) {
    const originValue = value;
    if (value == null || value instanceof Raw) return value;
    if (typeof value === 'string') value = parseInt(value, 10);
    if (isNaN(value)) throw new Error(util.format('invalid integer: %s', originValue));
    return value;
  }
}

class Postgres_BIGINT extends Postgres_INTEGER {
  constructor() {
    super();
    this.dataType = 'bigint';
  }
}

class Postgres_SMALLINT extends Postgres_INTEGER {
  constructor() {
    super();
    this.dataType = 'smallint';
  }
}

class Postgres_DataTypes extends DataTypes {
  static DATE = Postgres_DATE;
  static JSONB = Postgres_JSONB;
  static BINARY = Postgres_BINARY;
  static VARBINARY = Postgres_BINARY;
  static BLOB = Postgres_BINARY;
  static TINYINT = Postgres_SMALLINT;
  static SMALLINT = Postgres_SMALLINT;
  static MEDIUMINT = Postgres_INTEGER;
  static INTEGER = Postgres_INTEGER;
  static BIGINT =  Postgres_BIGINT;
}

module.exports = Postgres_DataTypes;
