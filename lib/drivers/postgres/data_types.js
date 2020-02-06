'use strict';

const DataTypes = require('../../data_types');

class Postgres_DATE extends DataTypes.DATE {
  constructor(precision, timezone = true) {
    super(precision, timezone);
    this.dataType = 'timestamp';
  }

  toSqlString() {
    const { timezone } = this;
    if (timezone) return `${super.toSqlString()} WITH TIME ZONE}`;
    return `${super.toSqlString()} WITHOUT TIME ZONE`;
  }
}

class Postgres_DataTypes extends DataTypes {
  static get DATE() {
    return Postgres_DATE;
  }
}

module.exports = Postgres_DataTypes;
