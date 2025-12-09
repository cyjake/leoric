import { AbstractDriver } from './drivers';
import { AbstractBone } from './types/abstract_bone';
import { Literal } from './types/common';
import { isBone } from './utils';

export default class Raw {
  value: string;

  // consumed in expr_formatter.js
  type = 'raw';

  constructor(value: string) {
    if (typeof value !== 'string') {
      throw new Error('invalid type of raw value');
    }
    this.value = value;
  }

  toString() {
    return this.value;
  }

  static build(value: string) {
    return new Raw(value);
  }
}

const rReplacementKey = /\s:(\w+)\b/g;

interface QueryOptions {
  model?: typeof AbstractBone;
  replacements?: { [key: string]: any };
  connection?: any;
}

export interface QueryResult {
  fields?: { table: string; name: string }[];
  rows?: any[];
  affectedRows?: number;
  insertId?: number;
}

/**
 * raw query
 */
export async function rawQuery(
  driver: AbstractDriver,
  sql: string,
  values: Literal[] | QueryOptions,
  opts: QueryOptions = {},
): Promise<QueryResult & { rows?: any[] }> {
  if (values && typeof values === 'object' && !Array.isArray(values)) {
    if ('replacements' in values) {
      opts.replacements = values.replacements;
    } else {
      opts.replacements = values;
    }
    const { model, connection } = values;
    if (model) opts.model = model;
    if (connection) opts.connection = connection;
    values = [];
  }

  const replacements = opts.replacements || {};
  sql = sql.replace(rReplacementKey, function replacer(m, key) {
    if (!replacements.hasOwnProperty(key)) {
      throw new Error(`unable to replace: ${key}`);
    }
    values.push(replacements[key]);
    return ' ?';
  });

  const { rows, ...restRes } = await driver.query(sql, values, {
    connection: opts.connection,
    Model: opts.model,
  } as any);
  const results = [];

  if (rows && rows.length && opts.model && isBone(opts.model)) {
    const { attributeMap } = opts.model;

    for (const data of rows) {
      const instance = opts.model.instantiate(data);
      for (const key in data) {
        if (!attributeMap.hasOwnProperty(key)) (instance as any)[key] = data[key];
      }
      results.push(instance);
    }
  }

  return {
    ...restRes,
    rows: results.length > 0 ? results : rows,
  };
}
