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

class Postgres_STRING extends DataTypes.STRING {
  toSqlString() {
    if (this.binary || this.varbinary) return 'BYTEA';
    return super.toSqlString();
  }
}

class Postgres_DataTypes extends DataTypes {
  static DATE = Postgres_DATE;
  static JSONB = Postgres_JSONB;
  static STRING = Postgres_STRING;
}

module.exports = Postgres_DataTypes;
