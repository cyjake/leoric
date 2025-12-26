import { escape, escapeId } from 'sqlstring';

import Attribute from '../abstract/attribute';
import DataTypes from './data_types';

class MysqlAttribute extends Attribute {
  constructor(name: string, params?: any, opts?: any) {
    super(name, params, opts);
  }

  static get DataTypes() {
    return DataTypes as any;
  }

  toSqlString(): string {
    const {
      columnName,
      columnType,
      allowNull,
      defaultValue,
      primaryKey,
      comment,
      unique,
    } = this;

    const chunks = [
      escapeId(columnName),
      columnType.toUpperCase(),
    ];

    if (primaryKey) chunks.push('PRIMARY KEY');

    if (this.autoIncrement ?? primaryKey) chunks.push('AUTO_INCREMENT');

    if (!primaryKey && !allowNull) chunks.push('NOT NULL');

    if (unique === true) {
      chunks.push('UNIQUE');
    }

    if (defaultValue != null) {
      chunks.push(`DEFAULT ${escape(defaultValue)}`);
    }

    if (typeof comment === 'string') {
      chunks.push(`COMMENT ${escape(comment)}`);
    }

    return chunks.join(' ');
  }
}

export default MysqlAttribute;
