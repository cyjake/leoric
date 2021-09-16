'use strict';

const EventEmitter = require('events');
const Connection = require('./connection');

class Pool extends EventEmitter {
  constructor(opts) {
    super(opts);
    const options = {
      connectionLimit: 10,
      trace: true,
      busyTimeout: 30000,
      ...opts,
      client: opts.client || 'sqlite3',
    };

    const client = require(options.client);
    // Turn on stack trace capturing otherwise the output is useless
    // - https://github.com/mapbox/node-sqlite3/wiki/Debugging
    if (options.trace) client.verbose();

    this.options = options;
    this.client = client;
    this.connections = [];
    this.queue = [];
  }

  async getConnection() {
    const { connections, queue, client, options } = this;
    for (const connection of connections) {
      if (connection.idle) {
        connection.idle = false;
        this.emit('acquire', connection);
        return connection;
      }
    }
    if (connections.length < options.connectionLimit) {
      const connection = new Connection({ ...options, client, pool: this });
      connections.push(connection);
      this.emit('connection', connection);
      this.emit('acquire', connection);
      return connection;
    }
    await new Promise(resolve => queue.push(resolve));
    return await this.getConnection();
  }

  releaseConnection(connection) {
    connection.idle = true;
    this.emit('release', connection);

    const { queue } = this;
    while (queue.length > 0) {
      const task = queue.shift();
      task();
    }
  }

  async end() {
    await Promise.allSettled(this.connections.map(connection => connection.close()));
    this.connections = [];
  }
}

module.exports = Pool;
