import { default as DataTypes } from '../../data_types';
import util from 'util';
import Raw from '../../raw';

class Postgres_DATE extends DataTypes.DATE {
  constructor(precision?: number, timezone = true) {
    super(precision, timezone);
    this.dataType = 'timestamp';
  }

  toSqlString(): string {
    const { timezone } = this as any;
    if (timezone) return `${super.toSqlString()} WITH TIME ZONE`;
    return `${super.toSqlString()} WITHOUT TIME ZONE`;
  }
}

class Postgres_JSONB extends DataTypes.JSONB {
  constructor() {
    super();
    this.dataType = 'jsonb';
  }

  toSqlString(): string {
    return 'JSONB';
  }
}

class Postgres_BINARY extends DataTypes.BINARY {
  constructor() {
    super();
    this.dataType = 'bytea';
  }

  toSqlString(): string {
    return 'BYTEA';
  }
}

class Postgres_INTEGER extends DataTypes.INTEGER {
  constructor(dataLength?: number, unsigned?: boolean, zerofill?: boolean) {
    super(dataLength, unsigned, zerofill);
  }

  uncast(value: any): any {
    const originValue = value;
    if (value == null || value instanceof Raw) return value;
    if (typeof value === 'string') value = parseInt(value, 10);
    if (isNaN(value)) throw new Error(util.format('invalid integer: %s', originValue));
    return value;
  }
}

class Postgres_BIGINT extends Postgres_INTEGER {
  constructor(dataLength?: number, unsigned?: boolean, zerofill?: boolean) {
    super(dataLength, unsigned, zerofill);
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
  static DATE = Postgres_DATE as typeof DataTypes.DATE;
  static JSONB = Postgres_JSONB as typeof DataTypes.JSONB;
  static BINARY = Postgres_BINARY as typeof DataTypes.BINARY;
  static VARBINARY = Postgres_BINARY as typeof DataTypes.VARBINARY;
  static BLOB = Postgres_BINARY as typeof DataTypes.BLOB;
  static TINYINT = Postgres_SMALLINT as typeof DataTypes.TINYINT;
  static SMALLINT = Postgres_SMALLINT as typeof DataTypes.SMALLINT;
  static MEDIUMINT = Postgres_INTEGER as typeof DataTypes.MEDIUMINT;
  static INTEGER = Postgres_INTEGER as typeof DataTypes.INTEGER;
  static BIGINT =  Postgres_BIGINT as typeof DataTypes.BIGINT;
}

export default Postgres_DataTypes;
