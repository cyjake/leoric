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

class Sqlite_BINARY extends DataTypes {
  constructor(length = 255) {
    super(length);
    this.length = length;
    this.dataType = 'binary';
  }

  toSqlString() {
    const { length } = this;
    const dataType = this.dataType.toUpperCase();
    const chunks = [];
    chunks.push('VARCHAR');
    chunks.push(length > 0 ? `${dataType}(${length})` : dataType);
    return chunks.join(' ');
  }
}
class Sqlite_VARBINARY extends Sqlite_BINARY {
  constructor(length) {
    super(length);
    this.dataType = 'varbinary';
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

  static get BINARY() {
    return Sqlite_BINARY;
  }

  static get VARBINARY() {
    return Sqlite_VARBINARY;
  }
}

module.exports = Sqlite_DataTypes;
