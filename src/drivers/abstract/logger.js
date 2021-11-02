'use strict';

const debug = require('debug')('leoric');
const SqlString = require('sqlstring');

class Logger {
  constructor(opts = {}) {
    if (typeof opts === 'function') opts = { logQuery: opts };
    this._opts = opts;
    this.hideKeys = opts.hideKeys || [];
  }

  format(query, values, opts = {}) {
    const { command, sets } = opts;

    if (['insert', 'upsert', 'update'].includes(command) && sets) {
      const { hideKeys } = this;
      const keys = Object.keys(sets);
      values = values.map((entry, i) => {
        // INSERT ... ON DUPLICATE UPDATE ...
        const index = command === 'upsert' ? i % keys.length : i;
        return hideKeys.includes(keys[index]) ? '***' : entry;
      });
    }
    return SqlString.format(query.sql || query, values);
  }

  logQuery(sql, duration, opts) {
    if (this._opts.logQuery) {
      try {
        this._opts.logQuery(sql, duration, opts);
      } catch (error) {
        console.error(error);
      }
    } else {
      debug('[query] [%s] %s', duration, sql);
    }
  }

  logQueryError(sql, err, duration, opts) {
    if (this._opts.logQueryError) {
      return this._opts.logQueryError(sql, err, duration, opts);
    }
    // err is thrown by default hence not logged here
    console.error('[query] [%s] %s', duration, sql);
  }

  logMigration(name) {
    if (this._opts.logMigration) {
      return this._opts.logMigration(name);
    }
    debug('[migration] %s', name);
  }
}

module.exports = Logger;
