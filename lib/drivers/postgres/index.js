'use strict';

const { Pool } = require('pg');

const spellbook = require('../abstract/spellbook');
const AbstractDriver = require('../abstract');
const schema = require('./schema');

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
}

/**
 * Postgres returns a nested array when `rowMode` is `array`:
 *
 *     [ [ 1, 'New Post' ] ]
 *
 * the corresponding fields would be:
 *
 *     [ { tableID: 15629, dataTypeID: 20, name: 'id' },
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
function nest(rows, fields, spell) {
  const results = [];
  const qualifiers = [ spell.Model.aliasName, ...Object.keys(spell.joins) ];
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
}

/**
 * Postgres supports parameterized queries with `$i` slots.
 * - https://node-postgres.com/features/queries#Parameterized%20query
 * @param {string} sql
 * @param {Array} values
 */
function parameterize(sql, values) {
  let i = 0;
  // starts with 1
  const text = sql.replace(/\?/g, () => `$${++i}`);
  return { text, values };
}

function escapeId(identifier) {
  return `"${identifier.replace(/"/g, '""')}"`;
}
class PostgresDriver extends AbstractDriver {
  constructor(name, opts = {}) {
    super(name, opts);
    const { host, port, user, password, database } = opts;

    this.type = 'postgres';
    this.pool = new Pool({ host, port, user, password, database });
  }

  get escapeId() {
    return escapeId;
  }

  async getConnection() {
    return await this.pool.connect();
  }

  async query(query, values, spell) {
    const { sql, nestTables } = typeof query === 'string' ? { sql: query } : query;
    const { text } = parameterize(sql, values);
    const { escapeId, logger } = this;
    const client = spell && spell.connection || this.pool;
    const command = spell && spell.command || sql.split(' ').shift();

    logger.logQuery(logger.format(sql, values, spell));

    switch (command) {
      case 'select': {
        if (nestTables) {
          const { rows, fields } = await client.query({ text, rowMode: 'array' }, values);
          return nest(rows, fields, spell);
        }
        return client.query(text, values);
      }
      case 'insert':
      case 'upsert': {
        const { primaryColumn } = spell.Model;
        const key = escapeId(primaryColumn);
        const result = await client.query({ text: `${text} RETURNING ${key}`, values });
        const { rows, rowCount, fields } = result;
        let insertId;
        for (const field of fields) {
          if (field.name == primaryColumn) {
            insertId = cast(rows[0][primaryColumn], field);
          }
        }
        return { insertId, affectedRows: rowCount };
      }
      case 'update':
      case 'delete': {
        const { rowCount: affectedRows } = await client.query(text, values);
        return { affectedRows };
      }
      default:
        return await client.query(text, values);
    }
  }

  format(spell) {
    return spellbook.format(spell);
  }
};

Object.assign(PostgresDriver.prototype, schema);

module.exports = PostgresDriver;
