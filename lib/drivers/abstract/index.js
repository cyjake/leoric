'use strict';

const Logger = require('./logger');

/**
 * Migration methods
 * - https://dev.mysql.com/doc/refman/8.0/en/create-table.html
 * - https://dev.mysql.com/doc/refman/8.0/en/alter-table.html
 */

module.exports = class AbstractDriver {
  constructor(opts = {}) {
    this.logger = new Logger(opts.logger);
  }

  /**
   * Cast raw values from database to JavaScript types. When the raw packet is fetched from database, `Date`s and special numbers are transformed by drivers already. This method is used to cast said values to custom types set by {@link Bone.attribute}, such as `JSON`.
   * @private
   * @param {string} value
   * @param {*} type
   * @returns {*}
   */
  cast(value, type) {
    if (value == null) return value;

    switch (type) {
      case JSON:
        if (!value) return null;
        // type === JSONB
        if (typeof value === 'object') return value;
        return JSON.parse(value);
      case Date:
        return value instanceof Date ? value : new Date(value);
      // node-sqlite3 doesn't convert TINYINT(1) to boolean by default
      case Boolean:
        return Boolean(value);
      default:
        return value;
    }
  }

  /**
   * Uncast JavaScript values back to database types. This is the reverse version of {@link Bone.uncast}.
   * @private
   * @param {*} value
   * @param {string} type
   * @returns {boolean|number|string|Date}
   */
  uncast(value, type) {
    switch (type) {
      case JSON:
        return JSON.stringify(value);
      default:
        return value;
    }
  }
};
