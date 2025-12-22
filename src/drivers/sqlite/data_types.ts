import { DATA_TYPE, default as DataTypes } from '../../data_types';

class Sqlite_DATE extends DataTypes.DATE {
  constructor(precision?: number, timezone?: boolean) {
    super(precision, timezone);
    this.dataType = 'datetime';
  }

  uncast(value: any): any {
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

  uncast(value: any): any {
    try {
      return super.uncast(value);
    } catch (error) {
      console.error(new Error(`unable to cast ${value} to DATEONLY`));
      return value;
    }
  }
}

class Sqlite_INTEGER extends DataTypes.INTEGER {
  constructor(dataLength?: number, unsigned?: boolean, zerofill?: boolean) {
    super(dataLength, unsigned, zerofill);
  }

  uncast(value: any): any {
    return super.uncast(value, false);
  }
}

class Sqlite_BIGINT extends DataTypes.BIGINT {
  constructor(dataLength?: number, unsigned?: boolean, zerofill?: boolean) {
    super(dataLength, unsigned, zerofill);
    this.dataType = 'integer';
  }

  toSqlString(): string {
    return this.dataType.toUpperCase();
  }
}

class Sqlite_BINARY extends DataTypes.BINARY {
  declare dataLength: number;
  declare dataType: string;

  constructor(dataLength = 255) {
    super(dataLength);
    this.dataLength = dataLength;
    this.dataType = 'binary';
  }

  toSqlString(): string {
    const { dataLength } = this;
    const dataType = this.dataType.toUpperCase();
    const chunks = [];
    chunks.push('VARCHAR');
    chunks.push(dataLength > 0 ? `${dataType}(${dataLength})` : dataType);
    return chunks.join(' ');
  }
}

class Sqlite_VARBINARY extends Sqlite_BINARY {
  constructor(dataLength?: number) {
    super(dataLength);
    this.dataType = 'varbinary';
  }
}

class Sqlite_DataTypes extends DataTypes {
  static get DATE() {
    return Sqlite_DATE as DATA_TYPE<typeof DataTypes.DATE>;
  }

  static get BIGINT() {
    return Sqlite_BIGINT as DATA_TYPE<typeof DataTypes.BIGINT>;
  }

  static get BINARY() {
    return Sqlite_BINARY as DATA_TYPE<typeof DataTypes.BINARY>;
  }

  static get VARBINARY() {
    return Sqlite_VARBINARY as DATA_TYPE<typeof DataTypes.VARBINARY>;
  }

  static get DATEONLY() {
    return Sqlite_DATEONLY as DATA_TYPE<typeof DataTypes.DATEONLY>;
  }

  static get INTEGER() {
    return Sqlite_INTEGER as DATA_TYPE<typeof DataTypes.INTEGER>;
  }
}

export default Sqlite_DataTypes;
