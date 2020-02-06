'use strict';

const DataTypes = require('../../data_types');

class Sqlite_DATE extends DataTypes.DATE {
  constructor(precision) {
    super(precision);
    this.dataType = 'datetime';
  }

  toSqlString() {
    return this.dataType.toUpperCase();
  }
}

class Sqlite_DataTypes extends DataTypes {
  static get DATE() {
    return Sqlite_DATE;
  }
}

module.exports = Sqlite_DataTypes;
