'use strict';

const Realm = require('../../src');
const { rawQuery } = require('../../src/raw');
const assert = require('assert').strict;

const { DataTypes, Raw } = Realm;

describe('=> Raw', () => {
  describe('constructor()', () => {
    it('should throw if not called with string', async () => {
      assert.throws(() => new Raw({ toSqlString() { return 'foo'; } }));
    });
  });
});

describe('=> rawQuery()', () => {
  let realm;
  before(async () => {
    realm = new Realm({
      dialect: 'sqlite',
      database: ':memory:',
    });
    await realm.connect();
  });

  it('should execute raw sql query', async () => {
    const result = await realm.query('SELECT 1 + 1 AS result');
    assert.equal(result.rows[0].result, 2);
  });

  it('should execute raw sql query with rawQuery()', async () => {
    const result = await rawQuery(realm.driver, 'SELECT 2 + 3 AS result');
    assert.equal(result.rows[0].result, 5);
  });

  it('should support parameterized query with array', async () => {
    const result = await realm.query('SELECT ? + ? AS result', [2, 3]);
    assert.equal(result.rows[0].result, 5);
  });

  it('should support parameterized query with named replacements', async () => {
    const result = await realm.query('SELECT :a + :b AS result', {
      replacements: { a: 4, b: 5 },
    });
    assert.equal(result.rows[0].result, 9);
  });

  it('should support model option', async () => {
    const { BIGINT } = DataTypes;
    const TestModel = realm.define('TestModel', {
      value: { type: BIGINT },
    });
    await TestModel.sync({ force: true });

    const result = await realm.query('SELECT 10 AS value', { model: TestModel });
    assert.equal(result.rows[0] instanceof TestModel, true);
    assert.equal(result.rows[0].value, 10);

    const result2 = await TestModel.query('SELECT 20 AS value');
    assert.equal(result2.rows[0] instanceof TestModel, true);
    assert.equal(result2.rows[0].value, 20);
  });

  it('should support conenection option', async () => {
    const result = await realm.query('SELECT 7 AS result', {
      connection: await realm.driver.getConnection(),
    });
    assert.equal(result.rows[0].result, 7);
  });

  after(async () => {
    await realm.disconnect();
  });
});
