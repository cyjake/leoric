import { strict as assert } from 'assert';
import SqlString from 'sqlstring';

import Realm, { SqliteDriver, Literal, SpellBookFormatResult, Column, Raw, Bone, AbstractDriver } from '../../src';
import { formatConditions, collectLiteral } from '../../src/expr_formatter';
import { findExpr } from '../../src/expr';
import Spell from '../../src/spell';
import { AbstractBone } from '../../src/types/abstract_bone';

interface FormatResult {
  sql: string;
  table: string;
  whereArgs?: Array<Literal>
  whereClause?: string,
  values?: { [key: string]: Literal };
  [key: string]: Literal
}

class MySpellbook extends SqliteDriver.Spellbook {

  format<T extends typeof AbstractBone>(spell: Spell<T>): SpellBookFormatResult<FormatResult> {
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

  formatUpdate<T extends typeof AbstractBone>(spell: Spell<T>): SpellBookFormatResult<FormatResult> {
    const { Model, sets, whereConditions } = spell;
    const { shardingKey } = Model;
    const { escapeId } = Model.driver!;
    if (Array.isArray(sets)) throw new Error('multiple sets not allowed in UPDATE command');
    if (shardingKey) {
      if (sets!.hasOwnProperty(shardingKey) && sets![shardingKey] == null) {
        throw new Error(`Sharding key ${Model.table}.${shardingKey} cannot be NULL`);
      }
      if (!whereConditions.some(condition => findExpr(condition, { type: 'id', value: shardingKey }))) {
        throw new Error(`Sharding key ${Model.table}.${shardingKey} is required.`);
      }
    }

    if (Object.keys(sets!).length === 0) {
      throw new Error('Unable to update with empty set');
    }

    const table = escapeId(spell.table.value as string);
    const values: Record<string, Literal> = {};
    Object.keys(sets!).reduce((obj, key) => {
      obj[escapeId(Model.unalias(key))] = sets![key];
      return obj;
    }, values);

    const whereArgs: Literal[] = [];
    let whereClause = '';
    if (whereConditions.length > 0) {
      for (const condition of whereConditions) collectLiteral(spell, condition, whereArgs);
      whereClause += `WHERE ${formatConditions(spell, whereConditions)}`;
    }
    return {
      sql: '',
      table,
      whereArgs,
      whereClause,
      values,
    };
  }

  formatDelete<T extends typeof AbstractBone>(spell: Spell<T>): SpellBookFormatResult<FormatResult> {
    const { Model, whereConditions } = spell;
    const { escapeId } = Model.driver!;
    const table = escapeId(spell.table.value as string);
    const whereArgs: Literal[] = [];
    let whereClause = '';
    if (whereConditions.length > 0) {
      for (const condition of whereConditions) collectLiteral(spell, condition, whereArgs);
      whereClause += `WHERE ${formatConditions(spell, whereConditions)}`;
    }
    return {
      sql: '',
      table,
      whereArgs,
      whereClause,
    };
  }

  formatMyInsert<T extends typeof AbstractBone>(spell: Spell<T>): SpellBookFormatResult<FormatResult> {
    const { Model, sets } = spell;
    const { escapeId } = Model.driver!;
    const table = escapeId(spell.table.value as string);
    if (Array.isArray(sets)) throw new Error('multiple sets not supported in INSERT command yet');

    const { shardingKey } = Model;
    if (shardingKey && sets![shardingKey] == null) {
      throw new Error(`Sharding key ${Model.table}.${shardingKey} cannot be NULL.`);
    }
    const values: Record<string, Literal> = {};
    for (const name in sets) {
      const value = sets[name];
      values[escapeId(Model.unalias(name))] = value instanceof Raw? SqlString.raw(value.value) : value;
    }

    return {
      sql: '',
      table,
      values,
    };
  }

}

class CustomDriver extends SqliteDriver {
  static Spellbook = MySpellbook;

  // @ts-ignore
  async cast(spell) {
    const { command } = spell;
    switch (command) {
      case 'update': {
        const updateParams = this.format(spell) as FormatResult;
        return await this.update(updateParams, spell);
      }
      case 'delete': {
        const deleteParams = this.format(spell) as FormatResult;
        return await this.delete(deleteParams, spell);
      }
      case 'insert': {
        const insertParams = this.format(spell) as FormatResult;
        return await this.insert(insertParams, spell);
      }
      case 'upsert':
      case 'bulkInsert':
      case 'select': {
        const { sql, values } = this.format(spell);
        const query = { sql, nestTables: command === 'select' };
        return await this.query(query, values as Literal[], spell);
      }
      default:
        throw new Error('unspported sql command');
    }
  }

  async update<T extends typeof AbstractBone>({ table, values = {}, whereClause, whereArgs }: FormatResult, options?: Spell<T>) {
    const valueSets: string[] = [];
    const assignValues: Literal[] = [];
    Object.keys(values).map((key) => {
      valueSets.push(`${key}=?`);
      assignValues.push(values[key]);
    });
    const sql = `UPDATE ${table} SET ${valueSets.join(',')} ${whereClause}`;
    return await this.query(sql, assignValues.concat(whereArgs), options);
  }

  async delete<T extends typeof AbstractBone>({ table, whereClause, whereArgs }: FormatResult, options?: Spell<T>) {
    const sql = `DELETE FROM ${table} ${whereClause}`;
    return await this.query(sql, whereArgs, options);
  }

  async insert<T extends typeof AbstractBone>({ table, values = {} }: FormatResult, options?: Spell<T>) {
    const valueSets: string[] = [];
    const assignValues: Literal[] = [];
    Object.keys(values).map((key) => {
      valueSets.push(key);
      assignValues.push(values[key]);
    });
    const sql = `INSERT INTO ${table} (${valueSets.join(',')}) VALUES (${valueSets.map(_ => '?')})`;
    return await this.query(sql, assignValues, options);
  }
}

describe('=> Realm (TypeScript)', function () {
  let realm: Realm;
  before(function() {
    realm = new Realm({
      driver: CustomDriver as unknown as typeof AbstractDriver,
      database: '/tmp/leoric.sqlite3',
      subclass: true,
    });
  });

  afterEach(async () => {
    await realm?.driver?.dropTable('test_user');
  });

  describe('realm.define(name, attributes, options, descriptors)', async function() {
    it('options and descriptors should be optional', async function() {
      assert.doesNotThrow(function() {
        const { STRING } = realm.DataTypes;
        realm.define('TestUser', { name: STRING });
      });
    });

    it('can customize attributes with descriptors', async function() {
      const { STRING } = realm.DataTypes;
      const User = realm.define('TestUser', { name: STRING }, {}, {
        get name() {
          return this.attribute('name').replace(/^([a-z])/, function(m: string, chr: string) {
            return chr.toUpperCase();
          });
        },
        set name(value) {
          if (typeof value !== 'string') throw new Error('unexpected name' + value);
          if (this instanceof realm.Bone) this.attribute('name', value);
        }
      }) as typeof Bone;
      // User.findOne should exists
      assert(User.findOne);
    });
  });

  describe('realm.sync(options)', async function() {
    it('options should be optional', async function() {
      assert.doesNotThrow(async () => {
        const { STRING } = realm.DataTypes;
        realm.define('TestUser', { name: STRING });
        await realm.sync();
      });
    });

    it('`force` can be passed individually', async function() {
      assert.doesNotThrow(async () => {
        const { STRING } = realm.DataTypes;
        realm.define('TestUser', { name: STRING });
        await realm.sync({ force: true });
      });
    });

    it('`alter` can be passed individually', async function() {
      assert.doesNotThrow(async () => {
        const { STRING } = realm.DataTypes;
        realm.define('TestUser', { name: STRING });
        await realm.sync({ alter: true });
      });
    });

    it('`force` and `alter` can be passed together', async function() {
      assert.doesNotThrow(async () => {
        const { STRING } = realm.DataTypes;
        realm.define('TestUser', { name: STRING });
        await realm.sync({ force: true, alter: true });
      });
    });
  });

  describe('createTable', () => {
    it('should work', async () => {
      const { STRING, BIGINT, TEXT, INTEGER } = realm.DataTypes;

      await realm.driver.createTable('test_user', {
        id: BIGINT,
        name: {
          allowNull: true,
          type: STRING,
        },
        content: TEXT,
        rank: INTEGER.UNSIGNED,
      });

      class TestUser extends realm.Bone {
        static table = 'test_user';

        @Column()
        id!: bigint;

        @Column()
        name!: string;

        @Column(TEXT)
        content!: string;

        @Column(INTEGER.UNSIGNED)
        rank!: number;
      }

      // TODO how to avoid calling load() manually
      (TestUser as any).load();

      const user = await TestUser.create({
        name: 'giant Y',
        content: 'hello world',
        rank: 1
      });

      assert(user.id);
      assert.equal(user.name, 'giant Y');

    });
  });
});
