import type { Database, sqlite3 } from 'sqlite3';
import type Spell from '../../spell';
import { AbstractBone } from '../../abstract_bone';
import { Literal, QueryResult } from '../../types/common';
import type Pool from './pool';

type Row = Record<string, Literal>;

type Fields = Array<{ table: string; name: string }>;

function nest<T extends typeof AbstractBone>(rows: Row[], fields: Fields | undefined, spell: Spell<T>) {
  const { Model } = spell;
  const { tableAlias } = Model;
  const results: Record<string, Row>[] = [];

  for (const row of rows) {
    const result: Record<string, Row> = {};
    const qualified = Object.keys(row).some((entry) => entry.includes(':'));
    for (const key in row) {
      const parts = key.split(':');
      const [qualifier, column] = qualified
        ? parts.length > 1
          ? parts
          : ['', key]
        : [(Model as any).attributeMap.hasOwnProperty(key) ? tableAlias : '', key];
      const obj = result[qualifier] || (result[qualifier] = {});
      obj[column] = row[key];
    }
    results.push(result);
  }

  return { rows: results, fields };
}

interface ConnectionOptions {
  client: sqlite3;
  database: string;
  mode?: number;
  pool: any;
  busyTimeout: number;
}

class Connection {
  private database: Database;
  private pool: Pool;

  constructor({ client, database: databasePath, mode, pool, busyTimeout }: ConnectionOptions) {
    const { Database, OPEN_READWRITE, OPEN_CREATE } = client;
    let openMode = mode;
    if (openMode == null) openMode = OPEN_READWRITE | OPEN_CREATE;
    const database = new Database(databasePath, openMode);
    // SQLITE_BUSY
    // - https://www.sqlite.org/rescode.html#busy
    // - https://www.sqlite.org/c3ref/busy_timeout.html
    // - https://github.com/mapbox/node-sqlite3/wiki/API#databaseconfigureoption-value
    if (busyTimeout > 0) database.configure('busyTimeout', busyTimeout);
    this.database = database;
    this.pool = pool;
  }

  async query<T extends typeof AbstractBone>(
    query: string | { sql: string; nestTables?: boolean },
    values?: Literal[] | { [key: string]: Literal },
    spell?: Spell<T>,
  ): Promise<QueryResult> {
    const queryObj = typeof query === 'string' ? { sql: query } : query;
    const { sql, nestTables } = queryObj;

    if (/^(?:pragma|select)/i.test(sql)) {
      const result = await this.all(sql, values);
      if (nestTables && spell) return nest(result.rows as Row[], result.fields, spell);
      return result;
    }
    return await this.run(sql, values);
  }

  private all(sql: string, values?: Literal[] | { [key: string]: Literal }): Promise<QueryResult> {
    return new Promise((resolve, reject) => {
      this.database.once('error', reject);
      this.database.all(sql, values, function Leoric_all(err: Error | null, rows: Row[], fields?: Fields) {
        if (err) {
          reject(err);
        } else {
          resolve({ rows, fields });
        }
      });
    });
  }

  private run(sql: string, values?: Literal[] | { [key: string]: Literal }): Promise<QueryResult> {
    return new Promise((resolve, reject) => {
      this.database.once('error', reject);
      this.database.run(sql, values, function Leoric_run(this: any, err: Error | null) {
        if (err) {
          reject(err);
        } else {
          resolve({ insertId: this.lastID, affectedRows: this.changes });
        }
      });
    });
  }

  release(): void {
    this.pool.releaseConnection(this);
  }

  async end(): Promise<void> {
    const { connections } = this.pool;
    const index = connections.indexOf(this);
    if (index >= 0) connections.splice(index, 1);
    await this.close();
  }

  async close(): Promise<void> {
    return await new Promise((resolve, reject) => {
      this.database.close(function Leoric_end(err: Error | null) {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }
}

export default Connection;
