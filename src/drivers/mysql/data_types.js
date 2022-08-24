'use strict';

const { default: DataTypes } = require('../../data_types');

class Mysql_BOOLEAN extends DataTypes.BOOLEAN {
  constructor() {
    super();
    this.dataType = 'tinyint';
  }

  toSqlString() {
    return 'TINYINT(1)';
  }
}

class Mysql_DataTypes extends DataTypes {
  static BOOLEAN = Mysql_BOOLEAN;
}

module.exports = Mysql_DataTypes;
