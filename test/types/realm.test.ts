import { strict as assert } from 'assert';
import Realm from '../..';

describe('=> Realm (TypeScript)', function () {
  let realm: Realm;
  before(function() {
    realm = new Realm({
      port: process.env.MYSQL_PORT,
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
      realm.define('User', { name: STRING }, {}, {
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
    });
  });

  describe('realm.sync(options)', async function() {

  });
});
