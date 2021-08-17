'use strict';

const Logger = require('./logger');

/**
 * Migration methods
 * - https://dev.mysql.com/doc/refman/8.0/en/create-table.html
 * - https://dev.mysql.com/doc/refman/8.0/en/alter-table.html
 */

module.exports = class AbstractDriver {
  constructor(opts = {}) {
    const { logger } = opts;
    this.logger = logger instanceof Logger ? logger : new Logger(logger);
    this.idleTimeout = opts.idleTimeout || 60;
    this.options = opts;
  }

  /**
   * Cast raw values from database to JavaScript types. When the raw packet is fetched from database, `Date`s and special numbers are transformed by drivers already. This method is used to cast said values to custom types set by {@link Bone.attribute}, such as `JSON`.
   * @private
   * @param {string|boolean} value
   * @param {Object|Date|string|Boolean} type
   * @returns {Object|Date|string|boolean}
   */
  cast(value, jsType) {
    if (value == null) return value;

    switch (jsType) {
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
      case Number:
        // pg may return string
        return Number(value);
      default:
        return value;
    }
  }

  /**
   * Uncast JavaScript values back to database types. This is the reverse version of {@link AbstractDriver#cast}.
   * @private
   * @param {Object|Date|string|boolean} value
   * @param {Object|Date|String|Boolean} type
   * @returns {boolean|number|string|Date}
   */
  uncast(value, type) {
    if (value == null) return value;
    if (value != null && typeof value === 'object') {
      if (type === JSON && typeof value.toObject === 'function') {
        return JSON.stringify(value.toObject());
      }
      if (type === Date && typeof value.toDate === 'function') {
        return value.toDate();
      }
      if (type === String && typeof value.toString === 'function') {
        return value.toString();
      }
    }

    switch (type) {
      case JSON:
        return JSON.stringify(value);
      case Date:
        return value instanceof Date ? value : new Date(value);
      default:
        return value;
    }
  }
};
