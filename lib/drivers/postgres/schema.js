'use strict';

const SqlString = require('sqlstring');
const schema = require('../abstract/schema');
const Definition = require('./definition');
const { heresql } = require('../../utils/string');

/**
 * - https://www.postgresql.org/docs/9.1/sql-altertable.html
 * @param {string} columnName
 * @param {Object} definition
 */
function formatAlterColumns(driver, columnName, definition) {
  const { allowNull, type, defaultValue } = definition;
  const sets = [
    `TYPE ${type.toSqlString()}`,
    allowNull ? 'DROP NOT NULL' : 'SET NOT NULL',
    defaultValue == null
      ? 'DROP DEFAULT'
      : `SET DEFAULT ${SqlString.escape(defaultValue)}`,
  ];

  return sets.map(entry => `ALTER COLUMN ${driver.escapeId(columnName)} ${entry}`);
}

function formatAddColumn(driver, columnName, definition) {
  return `ADD COLUMN ${driver.escapeId(columnName)} ${definition.toSqlString()}`;
}

module.exports = {
  ...schema,

  Definition,

  async querySchemaInfo(database, tables) {
    tables = [].concat(tables);
    const text = heresql(`
      SELECT columns.*,
             constraints.constraint_type
        FROM information_schema.columns AS columns
   LEFT JOIN information_schema.key_column_usage AS usage
          ON columns.table_catalog = usage.table_catalog
         AND columns.table_name = usage.table_name
         AND columns.column_name = usage.column_name
   LEFT JOIN information_schema.table_constraints AS constraints
          ON usage.constraint_name = constraints.constraint_name
       WHERE columns.table_catalog = $1 AND columns.table_name = ANY($2)
    `);

    const { pool } = this;
    const { rows } = await pool.query(text, [database, tables]);
    const schema = {};

    for (const row of rows) {
      const tableName = row.table_name;
      const columns = schema[tableName] || (schema[tableName] = []);
      let { data_type: dataType, character_octet_length: length } = row;

      if (dataType === 'character varying') dataType = 'varchar';
      if (dataType === 'timestamp without time zone') dataType = 'timestamp';

      const primaryKey = row.constraint_type === 'PRIMARY KEY';
      columns.push({
        columnName: row.column_name,
        columnType: length > 0 ? `${dataType}(${length})` : dataType,
        defaultValue: primaryKey ? null : row.column_default,
        dataType,
        allowNull: row.is_nullable !== 'NO',
        // https://www.postgresql.org/docs/9.5/infoschema-table-constraints.html
        primaryKey,
        unique: row.constraint_type === 'UNIQUE',
      });
    }

    return schema;
  },

  async alterTable(table, changes) {
    const { escapeId, Definition } = this;
    const chunks = [ `ALTER TABLE ${escapeId(table)}` ];
    const actions = Object.keys(changes).map(name => {
      const definition = new Definition(name, changes[name]);
      const { columnName } = definition;;
      return definition.modify
        ? formatAlterColumns(this, columnName, definition).join(', ')
        : formatAddColumn(this, columnName, definition);
    });
    chunks.push(actions.join(', '));
    await this.query(chunks.join(' '));
  },

  async changeColumn(table, column, params) {
    const { escapeId, Definition } = this;
    const definition = new Definition(column, params);
    const { columnName } = definition;
    const alterColumns = formatAlterColumns(this, columnName, definition);
    const sql = heresql(`ALTER TABLE ${escapeId(table)} ${alterColumns.join(', ')}`);
    await this.query(sql);
  },
};
