'use strict';

const DataTypes = require('../../data_types');

class Sqlite_DATE extends DataTypes.DATE {
  constructor(precision, timezone) {
    super(precision, timezone);
    this.dataType = 'datetime';
  }

  uncast(value) {
    try {
      return super.uncast(value);
    } catch (error) {
      console.error(new Error(`unable to cast ${value} to DATE`));
      return value;
    }
  }
}

class Sqlite_DATEONLY extends DataTypes.DATEONLY {
  constructor() {
    super();
  }

  uncast(value) {
    try {
      return super.uncast(value);
    } catch (error) {
      console.error(new Error(`unable to cast ${value} to DATEONLY`));
      return value;
    }
  }
}

class Sqlite_INTEGER extends DataTypes.INTEGER {
  constructor(length) {
    super(length);
  }

  uncast(value) {
    return super.uncast(value, false);
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

  static get BINARY() {
    return Sqlite_BINARY;
  }

  static get VARBINARY() {
    return Sqlite_VARBINARY;
  }

  static get DATEONLY() {
    return Sqlite_DATEONLY;
  }

  static get INTEGER() {
    return Sqlite_INTEGER;
  }
}

module.exports = Sqlite_DataTypes;
