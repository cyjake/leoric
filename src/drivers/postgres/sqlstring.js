'use strict';

const SqlString = require('sqlstring');

exports.escape = function escape(value) {
  return SqlString.escape(value);
};

exports.escapeId = function escapeId(identifier) {
  return `"${identifier.replace(/"/g, '""')}"`;
};

/**
 * - https://www.postgresql.org/docs/9.1/sql-altertable.html
 * @param {string} columnName
 * @param {Object} attribute
 */
exports.formatAlterColumns = function formatAlterColumns(driver, columnName, attribute) {
  const { allowNull, type, defaultValue } = attribute;
  const sets = [
    `TYPE ${type.toSqlString()}`,
    allowNull ? 'DROP NOT NULL' : 'SET NOT NULL',
    defaultValue == null
      ? 'DROP DEFAULT'
      : `SET DEFAULT ${SqlString.escape(defaultValue)}`,
  ];

  return sets.map(entry => `ALTER COLUMN ${driver.escapeId(columnName)} ${entry}`);
};

exports.formatAddColumn = function formatAddColumn(driver, columnName, attribute) {
  return `ADD COLUMN ${attribute.toSqlString()}`;
};

exports.formatDropColumn = function formatDropColumn(driver, columnName) {
  return `DROP COLUMN ${driver.escapeId(columnName)}`;
};

/**
 * The actual column type can be found by mapping the `oid` (which is called `dataTypeID`) in the `RowDescription`.
 * - https://stackoverflow.com/questions/11829368/how-can-i-see-the-postgresql-column-type-from-a-rowdescription-message
 * - https://www.postgresql.org/docs/8.4/static/catalog-pg-type.html
 * - https://www.postgresql.org/docs/9.1/static/protocol-message-formats.html
 * - https://github.com/postgres/postgres/blob/master/src/include/catalog/pg_type.dat
 */
const pgType = {
  20: { oid: 20, typname: 'int8', type: Number }
};

/**
 * Postgres tend to keep the returned value as string, even if the column type specified is something like 8 byte int. Hence this function is necessary to find the actual column type, and cast the string to the correct type if possible.
 * @param {*} value
 * @param {Object} field
 */

function cast(value, field) {
  const opts = pgType[field.dataTypeID];

  if (opts) {
    try {
      return value == null ? null : opts.type(value);
    } catch (err) {
      throw new Error('unable to cast %s to type %s', value, opts);
    }
  }
  return value;
};

exports.cast = cast;

/**
 * Postgres returns a nested array when `rowMode` is `array`:
 *
 *     [ [ 1, 'New Post' ] ]
 *
 * the corresponding fields would be:
 *
 *     [ { tableID: 15629, dataTypeID: 20, name: 'id' }
 *       { tableID: 15629, dataTypeID: 20, name: 'title' } ]
 *
 * This function is to turn above rows into nested objects with qualifers as keys:
 *
 *     [ { articles: { id: 1, title: 'New Post' } } ]
 *
 * @param {Array} rows
 * @param {Array} fields
 * @param {Spell} spell
 */
exports.nest = function nest(rows, fields, spell) {
  const results = [];
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
    const result = {};
    let tableIndex = defaultTableIndex;
    let tableIDWas;
    let qualifier;

    for (let i = 0; i < fields.length; i++) {
      const { name, tableID } = fields[i];
      if (tableID !== tableIDWas) {
        qualifier = tableID === 0 ? '' : qualifiers[tableIndex++];
        tableIDWas = tableID;
      }
      const obj = result[qualifier] || (result[qualifier] = {});
      obj[name] = cast(row[i], fields[i]);
    }
    results.push(result);
  }

  return { rows: results, fields };
};

/**
 * Postgres supports parameterized queries with `$i` slots.
 * - https://node-postgres.com/features/queries#Parameterized%20query
 * @param {string} sql
 * @param {Array} values
 */
exports.parameterize = function parameterize(sql, values) {
  let i = 0;
  // starts with 1
  const text = sql.replace(/\?/g, () => `$${++i}`);
  return { text, values };
};

