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
};
