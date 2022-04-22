import { strict as assert } from 'assert';
const SqlString = require('sqlstring');

import Realm, { SqliteDriver, SpellMeta, Literal, SpellBookFormatResult } from '../..';
const { formatConditions, collectLiteral } = require('../../src/expr_formatter');
const { findExpr } = require('../../src/expr');
const Raw = require('../../src/raw');

interface FormatResult {
  table?: string;
  whereArgs?: Array<Literal> 
  whereClause?: string,
  values?: Array<Literal> | {
    [key: string]: Literal
  };
  [key: string]: Literal
}

class MySpellbook extends SqliteDriver.Spellbook {

  format(spell: SpellMeta): SpellBookFormatResult<FormatResult> {
    for (const scope of spell.scopes) scope(spell);
    switch (spell.command) {
      case 'insert':
        return this.formatMyInsert(spell);
      case 'bulkInsert':
        return this.formatInsert(spell);
      case 'select':
        return this.formatSelect(spell);
      case 'update':
        return this.formatUpdate(spell);
      case 'delete':
        return this.formatDelete(spell);
      case 'upsert':
        return this.formatUpsert(spell);
      default:
        throw new Error(`Unsupported SQL command ${spell.command}`);
    }
  }

  formatUpdate(spell: SpellMeta): SpellBookFormatResult<FormatResult> {
    const a = super.formatDelete(spell);

    const { Model, sets, whereConditions } = spell;
    const { shardingKey } = Model;
    const { escapeId } = Model.driver;
    if (shardingKey) {
      if (sets.hasOwnProperty(shardingKey) && sets[shardingKey] == null) {
        throw new Error(`Sharding key ${Model.table}.${shardingKey} cannot be NULL`);
      }
      if (!whereConditions.some(condition => findExpr(condition, { type: 'id', value: shardingKey }))) {
        throw new Error(`Sharding key ${Model.table}.${shardingKey} is required.`);
      }
    }

    if (Object.keys(sets).length === 0) {
      throw new Error('Unable to update with empty set');
    }

    const table = escapeId(spell.table.value);
    const opValues = {};
    Object.keys(spell.sets).reduce((obj, key) => {
      obj[escapeId(Model.unalias(key))] = spell.sets[key];
      return obj;
    }, opValues);
  
    let whereArgs = [];
    let whereClause = '';
    if (whereConditions.length > 0) {
      for (const condition of whereConditions) collectLiteral(spell, condition, whereArgs);
      whereClause += `WHERE ${formatConditions(spell, whereConditions)}`;
    }
    return {
      table,
      whereArgs,
      whereClause,
      opValues,
    };
  }

  formatDelete(spell: SpellMeta): SpellBookFormatResult<FormatResult> {
    const { Model, whereConditions } = spell;
    const { escapeId } = Model.driver;
    const table = escapeId(spell.table.value);
    let whereArgs = [];
    let whereClause = '';
    if (whereConditions.length > 0) {
      for (const condition of whereConditions) collectLiteral(spell, condition, whereArgs);
      whereClause += `WHERE ${formatConditions(spell, whereConditions)}`;
    }
    return {
      table,
      whereArgs,
      whereClause,
    };
  }

  formatMyInsert(spell: SpellMeta): SpellBookFormatResult<FormatResult> {
    const { Model, sets } = spell;
    const { escapeId } = Model.driver;
    const table = escapeId(spell.table.value);
    let values = {};

    const { shardingKey } = Model;
    if (shardingKey && sets[shardingKey] == null) {
      throw new Error(`Sharding key ${Model.table}.${shardingKey} cannot be NULL.`);
    }
    for (const name in sets) {
      const value = sets[name];
      values[escapeId(Model.unalias(name))] = value instanceof Raw? SqlString.raw(value.value) : value;
    }

    return {
      table,
      values,
    };
  }

};

class CustomDriver extends SqliteDriver {
  static Spellbook = MySpellbook;

  async cast(spell) {
    const { command } = spell;
    switch (command) {
      case 'update': {
        const updateParams = this.format(spell);
        return await this.update(updateParams, spell);
      }
      case 'delete': {
        const deleteParams = this.format(spell);
        return await this.delete(deleteParams, spell);
      }
      case 'insert': {
        const insertParams = this.format(spell);
        return await this.insert(insertParams, spell);
      }
      case 'upsert':
      case 'bulkInsert':
      case 'select': {
        const { sql, values } = this.format(spell);
        const query = { sql, nestTables: command === 'select' };
        return await this.query(query, values, spell);
      }
      default:
        throw new Error('unspported sql command');
    }
  }

  async update({ table, values, whereClause, whereArgs }, options?: SpellMeta) {
    const valueSets = [];
    const assignValues = [];
    Object.keys(values).map((key) => {
      valueSets.push(`${key}=?`);
      assignValues.push(values[key]);
    });
    const sql = `UPDATE ${table} SET ${valueSets.join(',')} ${whereClause}`;
    return await this.query(sql, assignValues.concat(whereArgs), options);
  }

  async delete({ table, whereClause, whereArgs }, options) {
    const sql = `DELETE FROM ${table} ${whereClause}`;
    return await this.query(sql, whereArgs, options);
  }

  async insert({ table, values }: { table: string, values: {[key: string]: Literal}}, options?: SpellMeta) {
    const valueSets = [];
    const assignValues = [];
    Object.keys(values).map((key) => {
      valueSets.push(key);
      assignValues.push(values[key]);
    });
    const sql = `INSERT INTO ${table} (${valueSets.join(',')}) VALUES (${valueSets.map(_ => '?')})`;
    return await this.query(sql, assignValues, options);
  }
};

describe('=> Realm (TypeScript)', function () {
  let realm: Realm;
  before(function() {
    realm = new Realm({
      driver: CustomDriver,
      database: '/tmp/leoric.sqlite3',
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
      assert.doesNotThrow(async () => {
        const { STRING } = realm.DataTypes;
        realm.define('User', { name: STRING });
        await realm.sync();
      });
    });

    it('`force` can be passed individually', async function() {
      assert.doesNotThrow(async () => {
        const { STRING } = realm.DataTypes;
        realm.define('User', { name: STRING });
        await realm.sync({ force: true });
      });
    });

    it('`alter` can be passed individually', async function() {
      assert.doesNotThrow(async () => {
        const { STRING } = realm.DataTypes;
        realm.define('User', { name: STRING });
        await realm.sync({ alter: true });
      });
    });

    it('`force` and `alter` can be passed together', async function() {
      assert.doesNotThrow(async () => {
        const { STRING } = realm.DataTypes;
        realm.define('User', { name: STRING });
        await realm.sync({ force: true, alter: true });
      });
    });
  });
});
