import { EventEmitter } from 'events';
import Connection from './connection';
import { ConnectOptions } from '../abstract';

interface PoolOptions extends ConnectOptions {
  connectionLimit?: number;
  trace?: boolean;
  busyTimeout?: number;
  client?: string;
}

export interface PoolConnection extends Connection {
  idle?: boolean;
}

class Pool extends EventEmitter {
  options: PoolOptions;
  client: any;
  connections: PoolConnection[];
  queue: Array<() => void>;

  constructor(opts: ConnectOptions) {
    super();
    const options: PoolOptions = {
      connectionLimit: 10,
      trace: true,
      busyTimeout: 30000,
      ...opts,
      client: (opts as any).client || 'sqlite3',
    };

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const client = require(options.client!);
    // Turn on stack trace capturing otherwise the output is useless
    // - https://github.com/mapbox/node-sqlite3/wiki/Debugging
    if (options.trace) client.verbose();

    this.options = options;
    this.client = client;
    this.connections = [];
    this.queue = [];
  }

  async getConnection(): Promise<PoolConnection> {
    const { connections, queue, client, options } = this;
    for (const connection of connections) {
      if (connection.idle) {
        connection.idle = false;
        this.emit('acquire', connection);
        return connection;
      }
    }
    if (connections.length < (options.connectionLimit || 10)) {
      const connection = new Connection({ ...this.options, client, pool: this } as any);
      connections.push(connection as PoolConnection);
      this.emit('connection', connection);
      this.emit('acquire', connection);
      return connection as PoolConnection;
    }
    await new Promise<void>((resolve) => queue.push(() => resolve()));
    return await this.getConnection();
  }

  releaseConnection(connection: PoolConnection): void {
    connection.idle = true;
    this.emit('release', connection);

    const { queue } = this;
    while (queue.length > 0) {
      const task = queue.shift();
      if (task) task();
    }
  }

  async end(): Promise<void> {
    await Promise.allSettled(this.connections.map((connection) => connection.close()));
    this.connections = [];
  }
}

export default Pool;
