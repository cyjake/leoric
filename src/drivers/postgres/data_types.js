'use strict';

const DataTypes = require('../../data_types');

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

class Postgres_BINARY extends DataTypes {
  constructor() {
    super();
    this.dataType = 'bytea';
  }

  toSqlString() {
    return 'BYTEA';
  }
}

class Postgres_DataTypes extends DataTypes {
  static DATE = Postgres_DATE;
  static JSONB = Postgres_JSONB;
  static BINARY = Postgres_BINARY;
  static VARBINARY = Postgres_BINARY;
  static BLOB = Postgres_BINARY;
}

module.exports = Postgres_DataTypes;
