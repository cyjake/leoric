'use strict';

const Definition = require('./definition');
const schema = require('../abstract/schema');
const { heresql } = require('../../utils/string');

module.exports = {
  ...schema,

  Definition,

  /**
   * Fetch columns of give tables from database
   * - https://dev.mysql.com/doc/mysql-infoschema-excerpt/5.6/en/columns-table.html
   * @param {string} database
   * @param {string|string[]} tables
   */
  async querySchemaInfo(database, tables) {
    tables = [].concat(tables);
    const sql = heresql(`
      SELECT table_name, column_name, column_type, data_type, is_nullable,
             column_default, column_key
        FROM information_schema.columns
       WHERE table_schema = ? AND table_name in (?)
       ORDER BY table_name, column_name
    `);

    const { rows } = await this.query(sql, [ database, tables ]);
    const schema = {};

    for (const entry of rows) {
      // make sure the column names are in lower case
      const row = Object.keys(entry).reduce((obj, name) => {
        obj[name.toLowerCase()] = entry[name];
        return obj;
      }, {});
      const tabelName = row.table_name;
      const columns = schema[tabelName] || (schema[tabelName] = []);
      columns.push({
        columnName: row.column_name,
        columnType: row.column_type,
        defaultValue: row.column_default,
        dataType: row.data_type,
        allowNull: row.is_nullable === 'YES',
        primaryKey: row.column_key == 'PRI',
        unique: row.column_key == 'PRI' || row.column_key == 'UNI',
      });
    }

    return schema;
  },

  /**
   * Rename column with SQL that works on older versions of MySQL
   * - https://dev.mysql.com/doc/refman/5.7/en/alter-table.html
   * - https://dev.mysql.com/doc/refman/8.0/en/alter-table.html
   * @param {string} table
   * @param {string} column the old column name
   * @param {string} newColumn the new column name
   */
  async renameColumn(table, column, newColumn) {
    const { database, escapeId } = this;
    const schemaInfo = await this.querySchemaInfo(database, table);
    const columnInfo = schemaInfo[table].find(entry => entry.columnName == column);

    if (!columnInfo) throw new Error(`Unable to find column ${table}.${column}`);

    const definition = new Definition(newColumn, columnInfo);
    const sql = heresql(`
      ALTER TABLE ${escapeId(table)}
      CHANGE COLUMN
        ${escapeId(column)} ${escapeId(newColumn)}
        ${definition.toSqlString()}
    `);
    await this.query(sql);
  }
};
