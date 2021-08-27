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

class Sqlite_BIGINT extends DataTypes.BIGINT {
  constructor() {
    super();
    this.dataType = 'integer';
  }

  toSqlString() {
    return this.dataType.toUpperCase();
  }
}

class Sqlite_STRING extends DataTypes.STRING {
  constructor(length = 255) {
    super(length);
    this.dataType = 'varchar';
  }

  get BINARY() {
    this.binary = true;
    return this;
  }

  get VARBINARY() {
    this.varbinary = true;
    return this;
  }

  toSqlString() {
    const { length } = this;
    const dataType = this.dataType.toUpperCase();
    const chunks = [];
    chunks.push(dataType);
    if (this.binary) chunks.push(length > 0 ? `BINARY(${length})` : 'BINARY');
    else if (this.varbinary) chunks.push(length > 0 ? `VARBINARY(${length})` : 'BINARY');
    else return super.toSqlString();
    return chunks.join(' ');
  }
}

class Sqlite_DataTypes extends DataTypes {
  static get DATE() {
    return Sqlite_DATE;
  }

  static get BIGINT() {
    return Sqlite_BIGINT;
  }

  static get STRING() {
    return Sqlite_STRING;
  }
}

module.exports = Sqlite_DataTypes;
