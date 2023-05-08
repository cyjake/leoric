import dayjs from 'dayjs';

import SqliteDriver from '../sqlite';
import { SQLJSConnectionOptions, SQLJSQueryParams } from './interface';
import { SQLJSConnection } from './sqljs-connection';

import { calculateDuration } from '../../utils';

interface DriverOptions extends Omit<SQLJSConnectionOptions, 'name'> {
  database: string;
}

export default class SqlJDriver extends SqliteDriver {
  constructor(opts: DriverOptions) {
    super(opts);
    this.type = 'sqljs';
  }

  type: string;
  pool: SQLJSConnection;

  createPool(opts: DriverOptions) {
    const { database, ...restOpts } = opts;
    return new SQLJSConnection({
      ...restOpts,
      name: database,
    });
  }

  async getConnection() {
    return await this.pool.getConnection();
  }

  async disconnect(callback) {
    console.log('-- [ORM] will disconnect driver');

    try {
      await this.pool.close();
      console.log('-- [ORM] driver disconnect success');
      callback?.();
    } catch (e) {
      console.error('-- [ORM] driver disconnect error', e);
    }
  }

  async cast(spell) {
    const { command } = spell;
    // @ts-ignore
    const { sql, values } = this.format(spell);
    switch (command) {
      case 'insert': {
        return await this.insert(sql, values);
      }
      default:
        return await this.query(sql, values);
    }
  }

  async insert(sql: SQLJSQueryParams['query'], values?: SQLJSQueryParams['values']) {
    await this.query(sql, values);
    // 模拟 node-sqlite3 的行为
    const lastInsertRowIdRet = await this.query(
      'SELECT last_insert_rowid() as lastInsertRowId;',
    );
    return {
      insertId: lastInsertRowIdRet?.rows[0]?.lastInsertRowId,
    };
  }

  async query(query: SQLJSQueryParams['query'], values?: SQLJSQueryParams['values'], opts = {}) {
    const connection = await this.getConnection();

    // sql.js does not support Date as parameterized value
    if (Array.isArray(values)) {
      values = values.map((entry) => {
        if (entry instanceof Date) {
          return dayjs(entry).format('YYYY-MM-DD HH:mm:ss.SSS Z');
        }
        return entry;
      });
    }

    // @ts-ignore
    const { logger } = this;
    const logOpts = { ...opts, query };
    const sql = logger.format(query, values, opts);
    const start = performance.now();
    let result;

    try {
      result = await connection.query({
        query,
        values,
      });
    } catch (err) {
      logger.logQueryError(err, sql, calculateDuration(start), logOpts);
      throw err;
    }
    logger.tryLogQuery(query, calculateDuration(start), logOpts, result);
    return result;
  }
}
