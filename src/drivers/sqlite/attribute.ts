import Attribute from '../abstract/attribute';
import DataTypes from './data_types';
import { escape, escapeId } from './sqlstring';

class SqliteAttribute extends Attribute {
  declare columnName: string;
  declare columnType: string;
  declare type: any;
  declare allowNull: boolean;
  declare defaultValue: any;
  declare primaryKey: boolean;
  declare unique?: boolean;
  declare autoIncrement?: boolean;

  constructor(name: string, params?: any, opts?: any) {
    super(name, params, opts);
  }

  static get DataTypes() {
    return DataTypes;
  }

  toSqlString(): string {
    const { columnName, columnType, type, allowNull, defaultValue, primaryKey, unique } = this;
    const chunks = [
      escapeId(columnName),
      columnType.toUpperCase() || type.toSqlString(),
    ];

    if (primaryKey) chunks.push('PRIMARY KEY');

    // https://www.cyj.me/programming/2018/01/11/programming-leoric-ii/
    if (this.autoIncrement) chunks.push('AUTOINCREMENT');

    if (!primaryKey && !allowNull) chunks.push('NOT NULL');

    if (unique === true) {
      chunks.push('UNIQUE');
    }

    if (defaultValue != null) {
      chunks.push(`DEFAULT ${escape(defaultValue)}`);
    }

    return chunks.join(' ');
  }
}

export default SqliteAttribute;
