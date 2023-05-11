import dayjs from 'dayjs';
import { performance } from 'perf_hooks';

import SqliteDriver from '../sqlite';
import { SqljsConnectionOptions, SqljsQueryQuery, SqljsQueryValues } from './interface';
import { SqljsConnection } from './sqljs-connection';

import { calculateDuration } from '../../utils';
import { SpellMeta } from '../../spell';

interface DriverOptions extends Omit<SqljsConnectionOptions, 'name'> {
  database: string;
}

export default class SqljsDriver extends SqliteDriver {
  constructor(opts: DriverOptions) {
    super(opts);
    this.type = 'sqljs';
  }

  type: string;
  /**
   * @override
   */
  // @ts-ignore
  pool: SqljsConnection;

  /**
   * @override
   */
  // @ts-ignore
  createPool(opts: DriverOptions) {
    const { database, ...restOpts } = opts;
    return new SqljsConnection({
      ...restOpts,
      name: database,
    });
  }

  async getConnection() {
    return await this.pool.getConnection();
  }

  async query(query: SqljsQueryQuery, values?: SqljsQueryValues, spell?: SpellMeta) {
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
    const logOpts = { ...spell, query };
    const sql = logger.format(query, values, spell);
    const start = performance.now();
    let result;

    try {
      result = await connection.query(query, values, spell);
    } catch (err) {
      logger.logQueryError(err, sql, calculateDuration(start), logOpts);
      throw err;
    }
    logger.tryLogQuery(sql, calculateDuration(start), logOpts, result);
    return result;
  }
}
