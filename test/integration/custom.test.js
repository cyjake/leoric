'use strict';

const assert = require('assert').strict;
const path = require('path');
const sinon = require('sinon');
const SqlString = require('sqlstring');

const { connect, raw, Bone, disconnect, Raw, SqliteDriver } = require('../../src');
const { checkDefinitions } = require('./helpers');
const { formatConditions, collectLiteral } = require('../../src/expr_formatter');
const { findExpr } = require('../../src/expr');

class MySpellbook extends SqliteDriver.Spellbook {

  format(spell) {
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

  formatUpdate(spell) {
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
    const values = {};
    Object.keys(spell.sets).reduce((obj, key) => {
      obj[escapeId(Model.unalias(key))] = spell.sets[key];
      return obj;
    }, values);

    const whereArgs = [];
    let whereClause = '';
    if (whereConditions.length > 0) {
      for (const condition of whereConditions) collectLiteral(spell, condition, whereArgs);
      whereClause += `WHERE ${formatConditions(spell, whereConditions)}`;
    }
    return {
      table,
      whereArgs,
      whereClause,
      values,
    };
  }

  formatDelete(spell) {
    const { Model, whereConditions } = spell;
    const { escapeId } = Model.driver;
    const table = escapeId(spell.table.value);
    const whereArgs = [];
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

  formatMyInsert(spell) {
    const { Model, sets } = spell;
    const { escapeId } = Model.driver;
    const table = escapeId(spell.table.value);
    const values = {};

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
        break;
    }
  }

  async update({ table, values, whereClause, whereArgs }, options) {
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

  async insert({ table, values }, options) {
    const valueSets = [];
    const assignValues = [];
    Object.keys(values).map((key) => {
      valueSets.push(key);
      assignValues.push(values[key]);
    });
    const sql = `INSERT INTO ${table} (${valueSets.join(',')}) VALUES (${valueSets.map(_ => '?')})`;
    return await this.query(sql, assignValues, options);
  }

  async disconnect(callback) {
    // do nothing
    callback && callback();
    return true;
  }
};

let realm;

before(async function() {
  realm = await connect({
    driver: CustomDriver,
    database: '/tmp/leoric.sqlite3',
    models: path.resolve(__dirname, '../models'),
  });
});

require('./suite/index.test');

describe('=> Table definitions (sqlite)', () => {
  beforeEach(async () => {
    await Bone.driver.dropTable('notes');
  });

  after(async () => {
    await Bone.driver.dropTable('notes');
  });

  it('should be able to create table with INTEGER PRIMARY KEY', async () => {
    const { INTEGER } = Bone.DataTypes;
    class Note extends Bone {}
    Note.init({
      id: { type: INTEGER, primaryKey: true },
      public: { type: INTEGER },
    });

    await Note.sync();
    await checkDefinitions('notes', {
      id: { dataType: 'integer', primaryKey: true },
      public: { dataType: 'integer', primaryKey: false },
    });
  });

  it('should be able to create table with BIGINT(actual: INTEGER) PRIMARY KEY', async () => {
    const { BIGINT, INTEGER } = Bone.DataTypes;
    class Note extends Bone {}
    Note.init({
      id: { type: BIGINT, primaryKey: true },
      public: { type: INTEGER },
    });

    await Note.sync();
    await checkDefinitions('notes', {
      id: { dataType: 'integer', primaryKey: true },
      public: { dataType: 'integer', primaryKey: false },
    });
  });
});

describe('=> upsert (sqlite)', function () {
  const Post = require('../models/post');

  it('upsert', function() {
    assert.equal(
      new Post({ id: 1, title: 'New Post', createdAt: raw('CURRENT_TIMESTAMP()'), updatedAt: raw('CURRENT_TIMESTAMP()') }).upsert().toString(),
      `INSERT INTO "articles" ("id", "title", "is_private", "word_count", "gmt_create", "gmt_modified") VALUES (1, 'New Post', false, 0, CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP()) ON CONFLICT ("id") DO UPDATE SET "id"=EXCLUDED."id", "title"=EXCLUDED."title", "is_private"=EXCLUDED."is_private", "word_count"=EXCLUDED."word_count", "gmt_modified"=EXCLUDED."gmt_modified"`
    );
    const date = new Date(2017, 11, 12);
    const fakeDate = date.getTime();
    sinon.useFakeTimers(fakeDate);
    assert.equal(
      new Post({ id: 1, title: 'New Post', createdAt: date, updatedAt: date }).upsert().toString(),
      `INSERT INTO "articles" ("id", "title", "is_private", "word_count", "gmt_create", "gmt_modified") VALUES (1, 'New Post', false, 0, '2017-12-12 00:00:00.000', '2017-12-12 00:00:00.000') ON CONFLICT ("id") DO UPDATE SET "id"=EXCLUDED."id", "title"=EXCLUDED."title", "is_private"=EXCLUDED."is_private", "word_count"=EXCLUDED."word_count", "gmt_modified"=EXCLUDED."gmt_modified"`
    );
    assert.equal(
      new Post({ title: 'New Post', createdAt: date, updatedAt: date }).upsert().toString(),
      `INSERT INTO "articles" ("title", "is_private", "word_count", "gmt_create", "gmt_modified") VALUES ('New Post', false, 0, '2017-12-12 00:00:00.000', '2017-12-12 00:00:00.000') ON CONFLICT ("id") DO UPDATE SET "title"=EXCLUDED."title", "is_private"=EXCLUDED."is_private", "word_count"=EXCLUDED."word_count", "gmt_modified"=EXCLUDED."gmt_modified"`
    );
    // default set createdAt
    assert.equal(
      new Post({ id: 1, title: 'New Post' }).upsert().toString(),
      `INSERT INTO "articles" ("id", "title", "is_private", "word_count", "gmt_create", "gmt_modified") VALUES (1, 'New Post', false, 0, '2017-12-12 00:00:00.000', '2017-12-12 00:00:00.000') ON CONFLICT ("id") DO UPDATE SET "id"=EXCLUDED."id", "title"=EXCLUDED."title", "is_private"=EXCLUDED."is_private", "word_count"=EXCLUDED."word_count", "gmt_modified"=EXCLUDED."gmt_modified"`
    );

    assert.equal(
      Post.upsert({ title: 'New Post' }).toSqlString(),
      `INSERT INTO "articles" ("title", "is_private", "word_count", "gmt_create", "gmt_modified") VALUES ('New Post', false, 0, '2017-12-12 00:00:00.000', '2017-12-12 00:00:00.000') ON CONFLICT ("id") DO UPDATE SET "title"=EXCLUDED."title", "is_private"=EXCLUDED."is_private", "word_count"=EXCLUDED."word_count", "gmt_modified"=EXCLUDED."gmt_modified"`
    );
  });
});

describe('=> driver.disconnect', () => {
  it('should be called', async () => {
    let called = false;
    const res = await realm.disconnect(() => called = true);
    assert.equal(res, true);
    assert.equal(called, true);
  });

  it('should be called with realm', async () => {
    let called = false;
    let res = await disconnect();
    assert.ok(!res);
    assert.equal(called, false);
    res = await disconnect(realm, () => called = true);
    assert.equal(res, true);
    assert.equal(called, true);
  });
});
