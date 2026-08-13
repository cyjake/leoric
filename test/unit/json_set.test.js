'use strict';

const assert = require('assert').strict;
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

  it('rejects invalid mutations and unsupported dialect options', function() {
    const User = createModel('mysql');
    assert.throws(() => User.jsonSet({ id: 1 }, 'extra', [], { silent: true }), /at least one mutation/);
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
});

function createModel(dialect) {
  const realm = new Realm({ dialect });
  const User = realm.define('User', {
    id: { type: DataTypes.BIGINT, primaryKey: true },
    extra: DataTypes.JSONB,
  }, { tableName: 'users', timestamps: false });
  User.load([
    column('id', 'bigint'),
    column('extra', dialect === 'postgres' ? 'jsonb' : 'json'),
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
