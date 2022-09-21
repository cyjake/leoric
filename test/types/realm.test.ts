import { strict as assert } from 'assert';
import Realm from '../..';

describe('=> Realm (TypeScript)', function () {
  let realm: Realm;
  before(function() {
    realm = new Realm({
      host: 'localhost',
      port: process.env.MYSQL_PORT,
      user: 'root',
      database: 'leoric',
      subclass: true,
    });
  });

  describe('realm.define(name, attributes, options, descriptors)', async function() {
    it('options and descriptors should be optional', async function() {
      assert.doesNotThrow(function() {
        const { STRING } = realm.DataTypes;
        realm.define('User', { name: STRING });
      });
    });

    it('can customize attributes with descriptors', async function() {
      const { STRING } = realm.DataTypes;
      const User = realm.define('User', { name: STRING }, {}, {
        get name() {
          return this.attribute('name').replace(/^([a-z])/, function(m, chr) {
            return chr.toUpperCase();
          });
        },
        set name(value) {
          if (typeof value !== 'string') throw new Error('unexpected name' + value);
          this.attribute('name', value);
        }
      });
      // User.findOne should exists
      assert(User.findOne);
    });
  });

  describe('realm.sync(options)', async function() {
    it('options should be optional', async function() {
      await assert.doesNotReject(async () => {
        const { STRING } = realm.DataTypes;
        realm.define('User', { name: STRING });
        await realm.sync();
      });
    });

    it('`force` can be passed individually', async function() {
      await assert.doesNotReject(async () => {
        const { STRING } = realm.DataTypes;
        realm.define('User', { name: STRING });
        await realm.sync({ force: true });
      });
    });

    it('`alter` can be passed individually', async function() {
      await assert.doesNotReject(async () => {
        const { STRING } = realm.DataTypes;
        realm.define('User', { name: STRING });
        await realm.sync({ alter: true });
      });
    });

    it('`force` and `alter` can be passed together', async function() {
      await assert.doesNotReject(async () => {
        const { STRING } = realm.DataTypes;
        realm.define('User', { name: STRING });
        await realm.sync({ force: true, alter: true });
      });
    });
  });

  describe('realm.query(sql, values, options)', async function() {
    before(async function() {
      const { STRING } = realm.DataTypes;
      realm.define('User', { name: STRING, email: STRING });
      await realm.sync({ force: true, alter: true });
    });

    it('values and options should be optional', async function() {
      const result = await realm.query('SELECT * FROM users');
      assert.ok(Array.isArray(result.rows));
      assert.equal(result.rows.length, 0);
    });

    it('should pass on original properties in result', async function() {
      const result = await realm.query('INSERT INTO users (name) VALUES (?)', [ 'Cain' ]);
      assert.equal(result.affectedRows, 1);
    });

    it('should try to instantiate rows with options.model if possible', async function() {
      await realm.query('SELECT * FROM users', [], { model: realm.models.User });
    });
  });

  describe('realm.transaction({ connection })', async function() {
    it('should return whatever the callback returns', async function() {
      const result = await realm.transaction(async ({ connection }) => {
        return await realm.query('SELECT 1');
      });
      assert.ok(Array.isArray(result.rows));
    });

    it('should accept generator functions as callback too', async function() {
      const result = await realm.transaction(function* () {
        yield 1;
        return 2;
      });
      assert.equal(result, 2);
    });
  });
});
