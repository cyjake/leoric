'use strict';

const debug = require('debug')('leoric');
const SqlString = require('sqlstring');

class Logger {
  constructor(opts) {
    if (typeof opts === 'function') opts = { logQuery: opts };
    Object.assign(this, { hideKeys: [] }, opts);
  }

  format(query, values, opts = {}) {
    const { command, sets } = opts;

    if ([ 'insert', 'upsert', 'update' ].includes(command) && sets) {
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

  logQuery(sql, duration) {
    debug('[query] [%s] %s', duration, sql);
  }

  logQueryError(sql, err) {
    // err is thrown by default hence not logged here
    console.error(sql);
  }

  logMigration(name) {
    debug('[migration] %s', name);
  }
}

module.exports = Logger;
