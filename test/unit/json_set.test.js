'use strict';

const assert = require('assert').strict;
const sinon = require('sinon');
const Realm = require('../../src').default;
const { DataTypes, raw } = require('../../src');

describe('=> jsonSet SQL formatting', function() {
  it('formats MySQL paths and JSON values in one JSON_SET call', function() {
    const User = createModel('mysql');
    const spell = User.jsonSet({ id: 1 }, 'extra', [
      { path: [ 'profile', 'display name' ], value: 'Ada' },
      { path: [ 'items', 0 ], value: { active: true } },
      { path: [ 'computed' ], value: raw('JSON_EXTRACT(extra, \'$.source\')') },
    ], { silent: true });

    assert.equal(
      spell.toString(),
      'UPDATE `users` SET `extra` = JSON_SET(COALESCE(`extra`, JSON_OBJECT()), \'$.\\"profile\\".\\"display name\\"\', CAST(\'\\"Ada\\"\' AS JSON), \'$.\\"items\\"[0]\', CAST(\'{\\"active\\":true}\' AS JSON), \'$.\\"computed\\"\', JSON_EXTRACT(extra, \'$.source\')) WHERE `id` = 1',
    );
  });

  it('nests PostgreSQL jsonb_set calls for ordered mutations', function() {
    const User = createModel('postgres');
    const spell = User.jsonSet({ id: 1 }, 'extra', [
      { path: [ 'profile', 'display name' ], value: 'Ada' },
      { path: [ 'items', 0 ], value: { active: true } },
    ], { silent: true });

    assert.equal(
      spell.toString(),
      `UPDATE "users" SET "extra" = jsonb_set(jsonb_set(COALESCE("extra", '{}'::jsonb), ARRAY['profile', 'display name']::text[], '"Ada"'::jsonb, true), ARRAY['items', '0']::text[], '{"active":true}'::jsonb, true) WHERE "id" = 1`,
    );
  });

  it('uses jsonb_set_lax for PostgreSQL null treatment', function() {
    const User = createModel('postgres');
    const spell = User.jsonSet({ id: 1 }, 'extra', [ 'remove' ], null, {
      nullTreatment: 'delete_key',
      silent: true,
    });

    assert.equal(
      spell.toString(),
      `UPDATE "users" SET "extra" = jsonb_set_lax(COALESCE("extra", '{}'::jsonb), ARRAY['remove']::text[], NULL, true, 'delete_key') WHERE "id" = 1`,
    );
  });

  it('formats raw PostgreSQL values and escapes path segments', function() {
    const User = createModel('postgres');
    const expression = User.driver.formatJsonSet('extra', [
      { path: [ "author's note" ], value: raw("'true'::jsonb") },
    ]);

    assert.equal(
      expression.toString(),
      `jsonb_set(COALESCE("extra", '{}'::jsonb), ARRAY['author''s note']::text[], 'true'::jsonb, true)`,
    );
  });

  it('serializes non-null values when PostgreSQL null treatment is enabled', function() {
    const User = createModel('postgres');
    const expression = User.driver.formatJsonSet('extra', [
      { path: [ 'active' ], value: true },
    ], { nullTreatment: 'use_json_null' });

    assert.equal(
      expression.toString(),
      `jsonb_set_lax(COALESCE("extra", '{}'::jsonb), ARRAY['active']::text[], 'true'::jsonb, true, 'use_json_null')`,
    );
  });

  it('uses default MySQL formatter options', function() {
    const User = createModel('mysql');
    const expression = User.driver.formatJsonSet('extra', [
      { path: [ 'active' ], value: true },
    ]);

    assert.equal(
      expression.toString(),
      'JSON_SET(COALESCE(`extra`, JSON_OBJECT()), \'$.\\"active\\"\', CAST(\'true\' AS JSON))',
    );
  });

  it('rejects invalid mutations and unsupported dialect options', function() {
    const User = createModel('mysql');
    assert.throws(() => User.jsonSet({ id: 1 }, 'extra', [], { silent: true }), /at least one mutation/);
    assert.throws(() => User.jsonSet({ id: 1 }, 'missing', [ 'active' ], true), /has no attribute/);
    assert.throws(() => User.jsonSet({ id: 1 }, 'extra', [ null ]), /non-empty arrays/);
    assert.throws(() => User.jsonSet({ id: 1 }, 'extra', [ { path: [ 'items', 0.5 ], value: true } ]), /non-empty arrays/);
    assert.throws(() => User.jsonSet({ id: 1 }, 'extra', [ 'items', -1 ], true), /non-empty arrays/);
    assert.throws(() => User.jsonSet({ id: 1 }, 'extra', [ 'invalid' ], undefined), /valid JSON/);
    assert.throws(() => User.jsonSet({ id: 1 }, 'extra', [ 'invalid' ], 1n), /valid JSON/);
    assert.throws(
      () => User.jsonSet({ id: 1 }, 'extra', [ 'remove' ], null, { nullTreatment: 'delete_key' }),
      /only supported by the postgres dialect/,
    );
    assert.throws(() => User.jsonSet({ id: 1 }, 'id', [ 'invalid' ], true), /is not a JSON attribute/);

    const SqliteUser = createModel('sqlite');
    assert.throws(
      () => SqliteUser.jsonSet({ id: 1 }, 'extra', [ 'active' ], true),
      /not supported by the sqlite dialect/,
    );
  });

  it('accepts mutation lists without options', function() {
    const User = createModel('mysql');
    const spell = User.jsonSet({ id: 1 }, 'extra', [
      { path: [ 'active' ], value: true },
    ]);

    assert.equal(
      spell.toString(),
      'UPDATE `users` SET `extra` = JSON_SET(COALESCE(`extra`, JSON_OBJECT()), \'$.\\"active\\"\', CAST(\'true\' AS JSON)) WHERE `id` = 1',
    );
  });

  it('rejects instance updates without a primary key', async function() {
    const User = createModel('mysql');
    const user = new User({ extra: {} });

    await assert.rejects(user.jsonSet('extra', [ 'active' ], true), /unset primary key id/);
  });

  it('includes the sharding key and skips refresh when no rows are updated', async function() {
    const User = createModel('mysql', {
      tenantId: DataTypes.BIGINT,
    });
    User.shardingKey = 'tenantId';
    const user = new User({ id: 1, tenantId: 2, extra: {} });
    const jsonSet = sinon.stub(User, 'jsonSet').resolves(0);
    const find = sinon.spy(User, '_find');

    assert.equal(await user.jsonSet('extra', [ 'active' ], true), 0);
    assert.deepEqual(jsonSet.firstCall.args[0], { id: 1, tenantId: 2 });
    assert.equal(find.callCount, 0);
  });

  it('tolerates a missing row while refreshing an updated instance', async function() {
    const User = createModel('mysql');
    const user = new User({ id: 1, extra: {} });
    sinon.stub(User, 'jsonSet').resolves(1);
    const spell = Promise.resolve(null);
    spell.$select = () => spell;
    spell.$get = () => spell;
    sinon.stub(User, '_find').returns(spell);

    assert.equal(await user.jsonSet('extra', [ 'active' ], true), 1);
    assert.deepEqual(user.extra, {});
    assert.deepEqual(spell.scopes, []);
  });

  it('refreshes the JSON attribute after an instance update', async function() {
    const User = createModel('mysql');
    const user = new User({ id: 1, extra: {} });
    const refreshedUser = new User({ id: 1, extra: { active: true } });
    sinon.stub(User, 'jsonSet').resolves(1);
    const spell = Promise.resolve(refreshedUser);
    spell.$select = () => spell;
    spell.$get = () => spell;
    sinon.stub(User, '_find').returns(spell);

    assert.equal(await user.jsonSet('extra', [ 'active' ], true), 1);
    assert.deepEqual(user.extra, { active: true });
  });
});

function createModel(dialect, attributes = {}) {
  const realm = new Realm({ dialect });
  const User = realm.define('User', {
    id: { type: DataTypes.BIGINT, primaryKey: true },
    extra: DataTypes.JSONB,
    ...attributes,
  }, { tableName: 'users', timestamps: false });
  User.load([
    column('id', 'bigint'),
    column('extra', dialect === 'postgres' ? 'jsonb' : 'json'),
    ...Object.keys(attributes).map(name => column(name, 'bigint')),
  ]);
  return User;
}

function column(columnName, dataType) {
  return {
    columnName,
    columnType: dataType,
    dataType,
    isNullable: 'YES',
  };
}
