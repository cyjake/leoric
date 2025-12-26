import assert from 'assert';
import sinon from 'sinon';

import { SqljsConnection } from '../../src/drivers/sqljs/sqljs-connection';

function createMockDatabase({ execResult }: { execResult?: any } = {}) {
  const exec = sinon.stub().callsFake((query: string) => {
    if (/last_insert_rowid\(\)/.test(query)) {
      return [{ columns: ['lastId'], values: [[99]] }];
    }
    return execResult ?? [];
  });
  const run = sinon.stub();
  const getRowsModified = sinon.stub().returns(3);
  return { exec, run, getRowsModified };
}

describe('SqljsConnection', () => {
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('initializes database once and caches connection', async () => {
    const mockDb = createMockDatabase();
    const initSqlJs = sandbox.stub().resolves(mockDb as any);
    const connection = new SqljsConnection({ initSqlJs } as any);

    await connection.getConnection();
    await connection.getConnection();

    assert.strictEqual(initSqlJs.callCount, 1);
  });

  it('normalizes select result and nests when requested', async () => {
    const execResult = [{
      columns: ['posts:title', 'posts:id'],
      values: [['Hello', 42]],
    }];
    const mockDb = createMockDatabase({ execResult });
    const initSqlJs = sandbox.stub().resolves(mockDb as any);
    const connection = new SqljsConnection({ initSqlJs } as any);
    await connection.getConnection();

    const spell = {
      Model: {
        tableAlias: 'posts',
        attributeMap: { title: true, id: true },
      },
    } as any;

    const nested = await connection.query({ sql: 'select * from posts', nestTables: true }, undefined, spell);
    assert.deepStrictEqual(nested.rows, [{ posts: { title: 'Hello', id: 42 } }]);
    assert.deepStrictEqual(nested.fields, ['posts:title', 'posts:id']);

    const flat = await connection.query({ sql: 'select * from posts' });
    assert.deepStrictEqual(flat.rows, [{ 'posts:title': 'Hello', 'posts:id': 42 }]);
    assert.deepStrictEqual(flat.fields, ['posts:title', 'posts:id']);
  });

  it('nests unqualified columns using attribute map fallback', async () => {
    const execResult = [{
      columns: ['title', 'id'],
      values: [['Hi', 7]],
    }];
    const mockDb = createMockDatabase({ execResult });
    const initSqlJs = sandbox.stub().resolves(mockDb as any);
    const connection = new SqljsConnection({ initSqlJs } as any);
    await connection.getConnection();

    const spell = {
      Model: {
        tableAlias: 'posts',
        attributeMap: { title: true, id: true },
      },
    } as any;

    const nested = await connection.query({ sql: 'select * from posts', nestTables: true }, undefined, spell);
    assert.deepStrictEqual(nested.rows, [{ posts: { title: 'Hi', id: 7 } }]);
    assert.deepStrictEqual(nested.fields, ['title', 'id']);
  });

  it('runs mutations and returns affected rows and last insert id', async () => {
    const mockDb = createMockDatabase();
    const initSqlJs = sandbox.stub().resolves(mockDb as any);
    const connection = new SqljsConnection({ initSqlJs } as any);
    await connection.getConnection();

    const result = await connection._runSQL('INSERT INTO posts(title) VALUES(?)', ['foo'] as any);

    assert.strictEqual(result.affectedRows, 3);
    assert.strictEqual(result.insertId, 99);
    sinon.assert.calledWith(mockDb.run, 'INSERT INTO posts(title) VALUES(?)', ['foo']);
    sinon.assert.calledWith(mockDb.exec, 'SELECT last_insert_rowid() as lastId;');
  });

  it('throws if executing without an opened database', async () => {
    const connection = new SqljsConnection({ initSqlJs: async () => createMockDatabase() } as any);

    await assert.rejects(() => connection._executeSQL('select 1'), /database not opened/);
    await assert.rejects(() => connection._runSQL('insert into posts(title) values(?)', ['foo'] as any), /database not opened/);
  });

  it('normalizes empty result sets', async () => {
    const mockDb = createMockDatabase();
    mockDb.exec.returns([]);
    const initSqlJs = sandbox.stub().resolves(mockDb as any);
    const connection = new SqljsConnection({ initSqlJs } as any);
    await connection.getConnection();

    const res = await connection._executeSQL('select 1');
    assert.deepStrictEqual(res, { rows: [], fields: [] });
  });

  it('warns when closing without an opened database and clears when present', async () => {
    const warn = sandbox.stub(console, 'warn');
    const connection = new SqljsConnection({ initSqlJs: async () => createMockDatabase() } as any);

    const closed = await connection.close();
    assert.strictEqual(closed, true);
    sinon.assert.calledWith(warn, 'close: database is null');

    warn.resetHistory();
    await connection.getConnection();
    await connection.close();
    sinon.assert.notCalled(warn);
  });
});
