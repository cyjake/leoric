'use strict';

const { performance } = require('perf_hooks');

const AbstractDriver = require('../abstract').default;
const Attribute = require('./attribute');
const DataTypes = require('./data_types');
const {
  escape, escapeId, formatAddColumn,
  formatAlterColumns, formatDropColumn,
  cast, nest, parameterize,
} = require('./sqlstring');

const Spellbook = require('./spellbook');
const { calculateDuration } = require('../../utils');
const { heresql } = require('../../utils/string');

class PostgresDriver extends AbstractDriver {

  // define static properties as this way IDE will prompt
  static Spellbook = Spellbook;
  static Attribute = Attribute;
  static DataTypes = DataTypes;

  constructor(opts = {}) {
    super(opts);
    this.type = 'postgres';
    this.pool = this.createPool(opts);
    this.Attribute = this.constructor.Attribute;
    this.DataTypes = this.constructor.DataTypes;
    this.spellbook = new this.constructor.Spellbook();

    this.escape = escape;
    this.escapeId = escapeId;
  }

  createPool(opts) {
    const { host, port, user, password, database } = opts;
    // dynamic require pg type parse
    // if not use pg, pg-types may not exits
    require('./type_parser');
    return new (require('pg')).Pool({ host, port, user, password, database });
  }

  async getConnection() {
    return await this.pool.connect();
  }

  async query(query, values, spell = {}) {
    const { sql, nestTables } = typeof query === 'string' ? { sql: query } : query;
    const { text } = parameterize(sql, values);
    const { logger } = this;
    const connection = spell.connection || await this.getConnection();
    const command = sql.slice(0, sql.indexOf(' ')).toLowerCase();

    async function tryQuery(...args) {
      const logOpts = { ...spell, query: sql };
      const formatted = logger.format(sql, values, spell);
      const start = performance.now();
      let result;

      try {
        result = await connection.query(...args);
      } catch (err) {
        logger.logQueryError(err, formatted, calculateDuration(start), logOpts);
        throw err;
      } finally {
        if (!spell.connection) connection.release();
      }

      logger.tryLogQuery(formatted, calculateDuration(start), logOpts, result);
      return result;
    }

    switch (command) {
      case 'select': {
        if (nestTables) {
          const { rows, fields } = await tryQuery({ text, rowMode: 'array' }, values);
          return nest(rows, fields, spell);
        }
        return await tryQuery(text, values);
      }
      case 'insert': {
        const result = await tryQuery({ text, values });
        const { rowCount, fields } = result;
        const rows = result.rows.map(entry => {
          const row = {};
          for (const field of fields) {
            row[field.name] = cast(entry[field.name], field);
          }
          return row;
        });
        let insertId;
        const { primaryColumn } = spell.Model || {};
        if (primaryColumn) insertId = rows[0][primaryColumn];
        return { ...result, insertId, affectedRows: rowCount, rows };
      }
      case 'update':
      case 'delete': {
        const { rowCount: affectedRows } = await tryQuery(text, values);
        return { affectedRows };
      }
      default:
        return await tryQuery(text, values);
    }
  }

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
    ORDER BY columns.ordinal_position ASC
    `);

    const { pool } = this;
    const { rows } = await pool.query(text, [database, tables]);
    const schemaInfo = {};

    for (const row of rows) {
      const tableName = row.table_name;
      const columns = schemaInfo[tableName] || (schemaInfo[tableName] = []);
      const { character_maximum_length: length } = row;
      let { data_type: dataType } = row;

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
  }

  async alterTable(table, changes) {
    const chunks = [ `ALTER TABLE ${escapeId(table)}` ];
    const actions = Object.keys(changes).map(name => {
      const options = changes[name];
      if (options.remove) return formatDropColumn(this, name);
      const attribute = new this.Attribute(name, options);
      const { columnName } = attribute;;
      return attribute.modify
        ? formatAlterColumns(this, columnName, attribute).join(', ')
        : formatAddColumn(this, columnName, attribute);
    });
    chunks.push(actions.join(', '));
    await this.query(chunks.join(' '));
  }

  async changeColumn(table, column, params) {
    const attribute = new this.Attribute(column, params);
    const { columnName } = attribute;
    const alterColumns = formatAlterColumns(this, columnName, attribute);
    const sql = heresql(`ALTER TABLE ${escapeId(table)} ${alterColumns.join(', ')}`);
    await this.query(sql);
  }

  /**
   * Truncate table
   * @param {string} table the name of the table to truncate
   * @param {Object} [opts={}] extra truncation options
   * @param {object} [opts.restartIdentity] restart sequences owned by the table
   */
  async truncateTable(table, opts = {}) {
    const chunks = [ `TRUNCATE TABLE ${escapeId(table)}` ];
    if (opts.restartIdentity) chunks.push('RESTART IDENTITY');
    await this.query(chunks.join(' '));
  }
};

module.exports = PostgresDriver;
