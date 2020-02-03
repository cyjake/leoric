'use strict';

const Logger = require('./logger');

/**
 * Migration methods
 * - https://dev.mysql.com/doc/refman/8.0/en/create-table.html
 * - https://dev.mysql.com/doc/refman/8.0/en/alter-table.html
 */

module.exports = class AbstractDriver {
  constructor(name, opts = {}) {
    this.logger = new Logger(opts.logger);
  }
};
