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
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        if (hideKeys.includes(key)) {
          values[i] = '***';
        }
      }
    }
    return SqlString.format(query.sql || query, values);
  }

  logQuery(sql) {
    debug(sql);
  }
}

module.exports = Logger;
