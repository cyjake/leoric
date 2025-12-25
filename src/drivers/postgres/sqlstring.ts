import SqlString from 'sqlstring';
import { Literal } from '../..';

export function escape(value: any) {
  return SqlString.escape(value);
}

export function escapeId(identifier: string) {
  return `"${identifier.replace(/"/g, '""')}"`;
}

export function formatAlterColumns(driver: any, columnName: string, attribute: any) {
  const { allowNull, type, defaultValue } = attribute;
  const sets = [
    `TYPE ${type.toSqlString()}`,
    allowNull ? 'DROP NOT NULL' : 'SET NOT NULL',
    defaultValue == null
      ? 'DROP DEFAULT'
      : `SET DEFAULT ${SqlString.escape(defaultValue)}`,
  ];

  return sets.map(entry => `ALTER COLUMN ${driver.escapeId(columnName)} ${entry}`);
}

export function formatAddColumn(_driver: any, _columnName: string, attribute: any) {
  return `ADD COLUMN ${attribute.toSqlString()}`;
}

export function formatDropColumn(driver: any, columnName: string) {
  return `DROP COLUMN ${driver.escapeId(columnName)}`;
}

const pgType: Record<number, { oid: number; typname: string; type: any }> = {
  20: { oid: 20, typname: 'int8', type: Number }
};

export function cast(value: any, field: any) {
  const opts = pgType[field.dataTypeID];

  if (opts) return value == null ? null : opts.type(value);
  return value;
}

export function nest(rows: any[][], fields: any[], spell: any) {
  const results: any[] = [];
  const qualifiers = [ spell.Model.tableAlias, ...Object.keys(spell.joins) ];
  let defaultTableIndex = 0;

  if (spell.groups.length > 0 && Object.keys(spell.joins).length > 0) {
    defaultTableIndex = Infinity;
    for (const token of spell.columns) {
      if (token.type !== 'id') continue;
      const index = qualifiers.indexOf(token.qualifiers[0]);
      if (index >= 0 && index < defaultTableIndex) defaultTableIndex = index;
    }
  }

  for (const row of rows) {
    const result: Record<string, Record<string, Literal>> = {};
    let tableIndex = defaultTableIndex;
    let tableIDWas: number | undefined;
    let qualifier: string | undefined;

    for (let i = 0; i < fields.length; i++) {
      const { name, tableID } = fields[i];
      if (tableID !== tableIDWas) {
        qualifier = tableID === 0 ? '' : qualifiers[tableIndex++];
        tableIDWas = tableID;
      }
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const obj = (result)[qualifier!] || ((result)[qualifier!] = {});
      obj[name] = cast(row[i], fields[i]);
    }
    results.push(result);
  }

  return { rows: results, fields };
}

export function parameterize(sql: string, values: Literal[]) {
  let i = 0;
  const text = sql.replace(/\?/g, () => `$${++i}`);
  return { text, values };
}
