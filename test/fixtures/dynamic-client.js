'use strict';

let verboseCalls = 0;
let createPoolCalls = 0;
let postgresPoolCalls = 0;

class Database {
  configure() {}
  close(callback) {
    callback(null);
  }
}

class Pool {
  constructor(options) {
    postgresPoolCalls += 1;
    this.options = options;
  }

  async connect() {
    return { release() {} };
  }

  async query() {
    return { rows: [] };
  }
}

function createPool(options) {
  createPoolCalls += 1;
  return {
    options,
    getConnection(callback) {
      callback(null, { release() {} });
    },
  };
}

function verbose() {
  verboseCalls += 1;
  return module.exports;
}

function reset() {
  verboseCalls = 0;
  createPoolCalls = 0;
  postgresPoolCalls = 0;
}

module.exports = {
  Database,
  OPEN_READWRITE: 1,
  OPEN_CREATE: 2,
  Pool,
  createPool,
  verbose,
  reset,
  get verboseCalls() {
    return verboseCalls;
  },
  get createPoolCalls() {
    return createPoolCalls;
  },
  get postgresPoolCalls() {
    return postgresPoolCalls;
  },
};
