'use strict';

const SqlString = require('sqlstring');

const schema = require('../abstract/schema');
const Attribute = require('./attribute');
const { heresql } = require('../../utils/string');

/**
 * - https://www.postgresql.org/docs/9.1/sql-altertable.html
 * @param {string} columnName
 * @param {Object} attribute
 */
function formatAlterColumns(driver, columnName, attribute) {
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

function formatAddColumn(driver, columnName, attribute) {
  return `ADD COLUMN ${attribute.toSqlString()}`;
}

function formatDropColumn(driver, columnName) {
  return `DROP COLUMN ${driver.escapeId(columnName)}`;
}

module.exports = {
  ...schema,

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
    const schemaInfo = {};

    for (const row of rows) {
      const tableName = row.table_name;
      const columns = schemaInfo[tableName] || (schemaInfo[tableName] = []);
      let { data_type: dataType, character_maximum_length: length } = row;

      if (dataType === 'character varying') dataType = 'varchar';
      if (dataType === 'timestamp without time zone') dataType = 'timestamp';

      let columnDefault = row.column_default;
      if (/^NULL::/i.test(columnDefault)) columnDefault = null;
      if (dataType === 'boolean') columnDefault = columnDefault === 'true';

      const primaryKey = row.constraint_type === 'PRIMARY KEY';
      const precision = row.datetime_precision;

      columns.push({
        columnName: row.column_name,
        columnType: length > 0 ? `${dataType}(${length})` : dataType,
        defaultValue: primaryKey ? null : columnDefault,
        dataType,
        allowNull: row.is_nullable !== 'NO',
        // https://www.postgresql.org/docs/9.5/infoschema-table-constraints.html
        primaryKey,
        unique: row.constraint_type === 'UNIQUE',
        datetimePrecision: precision === 6 ? null : precision,
      });
    }

    return schemaInfo;
  },

  async alterTable(table, changes) {
    const { escapeId } = this;
    const chunks = [ `ALTER TABLE ${escapeId(table)}` ];
    const actions = Object.keys(changes).map(name => {
      const options = changes[name];
      if (options.remove) return formatDropColumn(this, name);
      const attribute = new Attribute(name, options);
      const { columnName } = attribute;;
      return attribute.modify
        ? formatAlterColumns(this, columnName, attribute).join(', ')
        : formatAddColumn(this, columnName, attribute);
    });
    chunks.push(actions.join(', '));
    await this.query(chunks.join(' '));
  },

  async changeColumn(table, column, params) {
    const { escapeId } = this;
    const attribute = new Attribute(column, params);
    const { columnName } = attribute;
    const alterColumns = formatAlterColumns(this, columnName, attribute);
    const sql = heresql(`ALTER TABLE ${escapeId(table)} ${alterColumns.join(', ')}`);
    await this.query(sql);
  },

  /**
   * Truncate table
   * @param {string} table the name of the table to truncate
   * @param {Object} [opts={}] extra truncation options
   * @param {object} [opts.restartIdentity] restart sequences owned by the table
   */
  async truncateTable(table, opts = {}) {
    const { escapeId } = this;
    const chunks = [ `TRUNCATE TABLE ${escapeId(table)}` ];
    if (opts.restartIdentity) chunks.push('RESTART IDENTITY');
    await this.query(chunks.join(' '));
  },
};
