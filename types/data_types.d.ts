type LENGTH_VARIANTS = 'tiny' | '' | 'medium' | 'long';

interface INVOKABLE<T> extends DataType {
  (length?: LENGTH_VARIANTS): T;
  (length?: number): T;
}

export default class DataType {
  toSqlString(): string;

  static STRING: INVOKABLE<STRING>;
  static INTEGER: INTEGER & INVOKABLE<INTEGER>;
  static BIGINT: BIGINT & INVOKABLE<BIGINT>;
  static DECIMAL: DECIMAL & INVOKABLE<DECIMAL>;
  static TEXT: INVOKABLE<TEXT>;
  static BLOB: INVOKABLE<BLOB>;
  static JSON: JSON;
  static JSONB: JSONB;
  static BINARY: BINARY & INVOKABLE<BINARY>;
  static VARBINARY: VARBINARY & INVOKABLE<VARBINARY>;
  static DATE: DATE & INVOKABLE<DATE>;
  static DATEONLY: DATEONLY;
  static BOOLEAN: BOOLEAN;
  static VIRTUAL: VIRTUAL;

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
  // avoid INTEGER.UNSIGNED.ZEROFILL.UNSIGNED.UNSIGNED
  get UNSIGNED(): Omit<this, 'UNSIGNED' | 'ZEROFILL'>;
  get ZEROFILL(): Omit<this, 'UNSIGNED' | 'ZEROFILL'>;
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
