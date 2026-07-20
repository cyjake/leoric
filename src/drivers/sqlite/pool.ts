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
  client?: any;
  private clientPromise?: Promise<any>;
  connections: PoolConnection[];
  queue: Array<() => void>;
  connectionLimit: number;

  constructor(opts: ConnectOptions) {
    super();
    const options: PoolOptions = {
      trace: true,
      busyTimeout: 30000,
      ...opts,
      client: (opts as any).client || 'sqlite3',
    };

    this.options = options;
    this.connections = [];
    this.queue = [];
    this.connectionLimit = options.connectionLimit || 10;
  }

  private async loadClient(): Promise<any> {
    if (!this.clientPromise) {
      this.clientPromise = import(this.options.client ?? 'sqlite3').then((module) => {
        const client = module.default ?? module;
        // Turn on stack trace capturing otherwise the output is useless
        // - https://github.com/mapbox/node-sqlite3/wiki/Debugging
        if (this.options.trace) client.verbose();
        this.client = client;
        return client;
      });
    }

    try {
      return await this.clientPromise;
    } catch (error) {
      this.clientPromise = undefined;
      throw error;
    }
  }

  async getConnection(): Promise<PoolConnection> {
    const client = await this.loadClient();
    const { connections, queue, connectionLimit } = this;
    for (const connection of connections) {
      if (connection.idle) {
        connection.idle = false;
        this.emit('acquire', connection);
        return connection;
      }
    }
    if (connections.length < connectionLimit) {
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
