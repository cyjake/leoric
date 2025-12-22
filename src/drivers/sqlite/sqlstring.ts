import SqlString from 'sqlstring';
import Debug from 'debug';

import { ExprLiteral, parseExpr } from '../../expr';
import { heresql } from '../../utils/string';
import type SqliteDriver from './index';

const debug = Debug('leoric');

export function escape(value: any): any {
  if (typeof value === 'boolean') return +value;
  return SqlString.escape(value);
}

export function escapeId(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}

/**
 * Schema altering commands other than RENAME COLUMN or ADD COLUMN
 * - https://www.sqlite.org/lang_altertable.html
 * @param {SqliteDriver} driver
 * @param {string} table
 * @param {Object[]} changes the changed attributes
 */
export async function alterTableWithChangeColumn(
  driver: SqliteDriver,
  table: string,
  changes: any[],
): Promise<void> {
  const { escapeId: escapeIdFn } = driver;
  const schemaInfo = await driver.querySchemaInfo(null, table);
  const columns = schemaInfo[table];

  const changeMap = changes.reduce((result: any, entry: any) => {
    result[entry.columnName] = entry;
    return result;
  }, {});

  const newAttributes: any[] = [];
  for (const column of columns) {
    const { columnName } = column;
    const change = changeMap[columnName];
    if (!change || !change.remove) {
      newAttributes.push(Object.assign(column, change));
    }
  }

  for (const attribute of changes) {
    if (!attribute.modify && !attribute.remove) {
      newAttributes.push(attribute);
    }
  }

  const newColumns: string[] = [];
  for (const attribute of newAttributes) {
    const { columnName, defaultValue } = attribute;
    const change = changeMap[columnName];
    if (!change || change.modify) {
      newColumns.push(escapeIdFn(columnName));
    } else {
      newColumns.push(SqlString.escape(defaultValue));
    }
  }

  const connection = await driver.getConnection();
  try {
    await connection.query('BEGIN');
    try {
      const newTable = `new_${table}`;
      await driver.createTable(newTable, newAttributes, { connection });
      await connection.query(heresql(`
        INSERT INTO ${escapeIdFn(newTable)}
        SELECT ${newColumns.join(', ')}
        FROM ${escapeIdFn(table)}
      `));
      await connection.query(`DROP TABLE ${escapeIdFn(table)}`);
      await connection.query(heresql(`
        ALTER TABLE ${escapeIdFn(newTable)}
        RENAME TO ${escapeIdFn(table)}
      `));
      await connection.query('COMMIT');
    } catch (err) {
      await connection.query('ROLLBACK');
      throw err;
    }
  } finally {
    connection.release();
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function parseDefaultValue(text: any, type: string): any {
  if (typeof text !== 'string') return text;
  if (type === 'boolean') return text === 'true';

  try {
    const ast = parseExpr(text) as ExprLiteral;
    if (ast.type === 'literal') {
      return ast.value;
    }
  } catch (err) {
    debug('[parseDefaultValue] [%s] %s', text, err);
  }

  return text;
}
