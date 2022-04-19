'use strict';

const SqlString = require('sqlstring');
const debug = require('debug')('leoric');

const { parseExpr } = require('../../expr');
const { heresql } = require('../../utils/string');

exports.escape = function escape(value) {
  if (typeof value === 'boolean') return +value;
  return SqlString.escape(value);
};

exports.escapeId = function escapeId(identifier) {
  return `"${identifier.replace(/"/g, '""')}"`;
};

/**
 * Schema altering commands other than RENAME COLUMN or ADD COLUMN
 * - https://www.sqlite.org/lang_altertable.html
 * @param {string} table
 * @param {Object} attributes the changed attributes
 */
exports.alterTableWithChangeColumn = async function alterTableWithChangeColumn(driver, table, changes) {
  const { escapeId } = driver;
  const schemaInfo = await driver.querySchemaInfo(null, table);
  const columns = schemaInfo[table];

  const changeMap = changes.reduce((result, entry) => {
    result[entry.columnName] = entry;
    return result;
  }, {});

  const newAttributes = [];
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

  const newColumns = [];
  for (const attribute of newAttributes) {
    const { columnName, defaultValue } = attribute;
    const change = changeMap[columnName];
    if (!change || change.modify) {
      newColumns.push(escapeId(columnName));
    } else {
      newColumns.push(SqlString.escape(defaultValue));
    }
  }

  const connection = await driver.getConnection();
  await connection.query('BEGIN');
  try {
    const newTable = `new_${table}`;
    await driver.createTable(newTable, newAttributes, { connection });
    await connection.query(heresql(`
      INSERT INTO ${escapeId(newTable)}
      SELECT ${newColumns.join(', ')}
      FROM ${escapeId(table)}
    `));
    await connection.query(`DROP TABLE ${escapeId(table)}`);
    await connection.query(heresql(`
      ALTER TABLE ${escapeId(newTable)}
      RENAME TO ${escapeId(table)}
    `));
    await connection.query('COMMIT');
  } catch (err) {
    await connection.query('ROLLBACK');
    throw err;
  } finally {
    await connection.release();
  }
};

// eslint-disable-next-line no-unused-vars
exports.parseDefaultValue = function parseDefaultValue(text, type) {
  if (typeof text !== 'string') return text;
  if (type === 'boolean') return text === 'true';

  try {
    const ast = parseExpr(text);
    if (ast.type === 'literal') {
      return ast.value;
    }
  } catch (err) {
    debug('[parseDefaultValue] [%s] %s', text, err);
  }

  return text;
};

