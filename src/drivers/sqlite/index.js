'use strict';

const strftime = require('strftime');
const { performance } = require('perf_hooks');

const AbstractDriver = require('../abstract');
const Attribute = require('./attribute');
const DataTypes = require('./data_types');
const { escapeId, escape } = require('./sqlstring');
const schema = require('./schema');
const spellbook = require('./spellbook');
const Pool = require('./pool');
const { calculateDuration } = require('../../utils');

class SqliteDriver extends AbstractDriver {
  constructor(opts = {}) {
    super(opts);
    this.type = 'sqlite';
    this.pool = this.createPool(opts);
  }

  createPool(opts) {
    return new Pool(opts);
  }

  async getConnection() {
    return await this.pool.getConnection();
  }

  async query(query, values, opts = {}) {
    const connection = opts.connection || await this.getConnection();

    // node-sqlite3 does not support Date as parameterized value
    if (values) {
      values = values.map(entry => {
        if (entry instanceof Date) {
          return strftime('%Y-%m-%d %H:%M:%S.%L %:z', entry);
        }
        return entry;
      });
    }

    const { logger } = this;
    const sql = logger.format(query, values, opts);
    const start = performance.now();
    let result;

    try {
      result = await connection.query(query, values, opts);
    } catch (err) {
      logger.logQueryError(err, sql, calculateDuration(start), opts);
      throw err;
    } finally {
      if (!opts.connection) connection.release();
    }

    logger.tryLogQuery(sql, calculateDuration(start), opts, result);
    return result;
  }

  format(spell) {
    return spellbook.format(spell);
  }
};

Object.assign(SqliteDriver.prototype, {
  ...schema,
  Attribute,
  DataTypes,
  escape,
  escapeId,
});

module.exports = SqliteDriver;
