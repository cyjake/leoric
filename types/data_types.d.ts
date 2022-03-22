type LENGTH_VARIANTS = 'tiny' | '' | 'medium' | 'long';

interface INVOKABLE<T> {
  (length: LENGTH_VARIANTS): T;
  (length: number): T;
}

export default class DataType {
  toSqlString(): string;

  static STRING: typeof STRING & INVOKABLE<STRING>;
  static INTEGER: typeof INTEGER & INVOKABLE<INTEGER>;
  static BIGINT: typeof BIGINT & INVOKABLE<BIGINT>;
  static DECIMAL: typeof DECIMAL & INVOKABLE<DECIMAL>;
  static TEXT: typeof TEXT & INVOKABLE<TEXT>;
  static BLOB: typeof BLOB & INVOKABLE<BLOB>;
  static JSON: typeof JSON & INVOKABLE<JSON>;
  static JSONB: typeof JSONB & INVOKABLE<JSONB>;
  static BINARY: typeof BINARY & INVOKABLE<BINARY>;
  static VARBINARY: typeof VARBINARY & INVOKABLE<VARBINARY>;
  static DATE: typeof DATE & INVOKABLE<DATE>;
  static DATEONLY: typeof DATEONLY & INVOKABLE<DATEONLY>;
  static BOOLEAN: typeof BOOLEAN & INVOKABLE<BOOLEAN>;
  static VIRTUAL: typeof VIRTUAL & INVOKABLE<VIRTUAL>;

}

declare class STRING extends DataType {
  dataType: 'varchar';
  length: number;
  constructor(length: number);
}

declare class INTEGER extends DataType {
  dataType: 'integer' | 'bigint' | 'decimal';
  length: number;
  constructor(length: number);
  get UNSIGNED(): this;
  get ZEROFILL(): this;
}

declare class BIGINT extends INTEGER {
  dataType: 'bigint';
}

declare class DECIMAL extends INTEGER {
  dataType: 'decimal';
  precision: number;
  scale: number;
  constructor(precision: number, scale: number);
}

declare class TEXT extends DataType {
  dataType: 'text';
  length: LENGTH_VARIANTS;
  constructor(length: LENGTH_VARIANTS);
}

declare class BLOB extends DataType {
  dataType: 'blob';
  length: LENGTH_VARIANTS;
  constructor(length: LENGTH_VARIANTS)
}

declare class JSON extends DataType {
  dataType: 'text' | 'json';
}

declare class JSONB extends JSON {
  dataType: 'json';
}

declare class BINARY extends DataType {
  dataType: 'binary';
  length: number;
  constructor(length: number);
}

declare class VARBINARY extends DataType {
  dataType: 'varbinary';
  length: number;
  constructor(length: number);
}

declare class DATE extends DataType {
  dataType: 'date';
  precision: number;
  timezone: boolean;
  constructor(precision: number, timezone?: boolean)
}

declare class DATEONLY extends DataType {
  dataType: 'dateonly';
}

declare class BOOLEAN extends DataType {
  dataType: 'boolean'
}

declare class VIRTUAL extends DataType {
  dataType: 'virtual'
}
