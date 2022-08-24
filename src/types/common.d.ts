
export type Literal = null | undefined | boolean | number | bigint | string | Date | object | ArrayBuffer;

type BaseValidateArgs = boolean | RegExp | Function | Array<Array<Literal>> | string;

export type Validator = BaseValidateArgs | {
  args: BaseValidateArgs,
  msg?: string;
};

export interface ColumnBase {
  allowNull?: boolean;
  defaultValue?: Literal;
  primaryKey?: boolean;
  comment?: string;
  unique?: boolean;
  columnName?: string;
  columnType?: string;
  autoIncrement?: boolean;
}

export interface QueryResult {
  insertId?: number;
  affectedRows?: number;
  rows?: Array<Record<string, Literal>>,
  fields?: Array<{ table: string, name: string }>,
}

export interface Connection {
  /**
   * MySQL
   */
  query(
    query: string,
    values: Array<Literal | Literal[]>,
  ): Promise<QueryResult>;
}

export interface QueryOptions {
  validate?: boolean;
  individualHooks?: boolean;
  hooks?: boolean;
  paranoid?: boolean;
  silent?: boolean;
  connection?: Connection;
}

export interface AssociateOptions {
  className?: string;
  foreignKey?: string;
}

export type command = 'select' | 'insert' | 'bulkInsert' | 'update' | 'delete' | 'upsert';

export type ResultSet = {
  [key: string]: Literal
};