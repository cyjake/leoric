import Debug from 'debug';

import Attribute from '../abstract/attribute';
import DataTypes from './data_types';
import { escape, escapeId } from './sqlstring';

const debug = Debug('leoric');

class PostgresAttribute extends Attribute {
  constructor(name: string, params?: any, opts?: any) {
    super(name, params, opts);
  }

  static DataTypes = DataTypes.invokable;

  toSqlString(): string {
    const {
      columnName,
      type,
      columnType,
      allowNull,
      defaultValue,
      primaryKey,
      unique,
    } = this;
    const chunks = [
      escapeId(columnName),
      columnType.toUpperCase(),
    ];
    if (type instanceof (DataTypes).INTEGER && primaryKey) {
      chunks[1] = (type instanceof (DataTypes).BIGINT) ? 'BIGSERIAL' : 'SERIAL';
    }

    if (primaryKey) chunks.push('PRIMARY KEY');

    if (!primaryKey && !allowNull) chunks.push('NOT NULL');

    if (unique === true) {
      chunks.push('UNIQUE');
    }

    if (defaultValue != null) {
      chunks.push(`DEFAULT ${escape(defaultValue)}`);
    }
    return chunks.join(' ');
  }

  equals(columnInfo: any): boolean {
    if (!columnInfo) return false;
    if ((this).type.toSqlString() !== columnInfo.columnType.toUpperCase()) {
      debug('[attribute] [%s] columnType not equal (defined: %s, actual: %s)',
        (this).columnName,
        (this).type.toSqlString(),
        columnInfo.columnType.toUpperCase());
      return false;
    }
    const props: (keyof this)[] = [ 'allowNull', 'defaultValue', 'primaryKey' ];
    for (const prop of props) {
      if ((this)[prop] != columnInfo[prop]) {
        debug('[attribute] [%s] %s not equal (defined: %s, actual: %s)',
          (this).columnName,
          prop,
          (this)[prop],
          columnInfo[prop]);
        return false;
      }
    }
    return true;
  }
}

export default PostgresAttribute;
