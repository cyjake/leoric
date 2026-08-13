'use strict';

const assert = require('assert').strict;

const { Bone } = require('../../../src');

describe('=> JSON partial updates', function() {
  class JsonSetGen extends Bone {
    static table = 'json_set_gens';
  }

  JsonSetGen.init({
    id: { type: Bone.DataTypes.INTEGER, primaryKey: true },
    name: Bone.DataTypes.STRING,
    extra: Bone.DataTypes.JSONB,
    deletedAt: Bone.DataTypes.DATE,
  });

  before(async function() {
    await Bone.driver.dropTable(JsonSetGen.table);
    await JsonSetGen.sync();
  });

  after(async function() {
    await Bone.driver.dropTable(JsonSetGen.table);
  });

  beforeEach(async function() {
    await JsonSetGen.remove({}, true);
  });

  it('bone.jsonSet(name, path, value) should set a nested value', async function() {
    const gen = await JsonSetGen.create({ name: 'jsonSet', extra: { profile: { name: 'Ada' } } });
    await gen.jsonSet('extra', [ 'profile', 'name' ], 'Grace');
    assert.deepEqual(gen.extra, { profile: { name: 'Grace' } });
  });

  it('bone.jsonSet(name, mutations) should apply multiple ordered mutations', async function() {
    const gen = await JsonSetGen.create({ name: 'jsonSetMany', extra: { items: [ 1 ] } });
    await gen.jsonSet('extra', [
      { path: [ 'items', 0 ], value: 2 },
      { path: [ 'active' ], value: true },
      { path: [ 'metadata' ], value: { source: 'test' } },
      { path: [ 'nullable' ], value: null },
    ]);
    assert.deepEqual(gen.extra, {
      items: [ 2 ],
      active: true,
      metadata: { source: 'test' },
      nullable: null,
    });
  });

  it('Bone.jsonSet(conditions, name, path, value) should work', async function() {
    const gen = await JsonSetGen.create({ name: 'staticJsonSet', extra: {} });
    await JsonSetGen.jsonSet({ id: gen.id }, 'extra', [ 'count' ], 1);
    await gen.reload();
    assert.deepEqual(gen.extra, { count: 1 });
  });

  it('bone.jsonSet() should initialize a NULL document', async function() {
    const gen = await JsonSetGen.create({ name: 'nullJsonSet' });
    await gen.jsonSet('extra', [ 'enabled' ], true);
    assert.deepEqual(gen.extra, { enabled: true });
  });

  it('bone.jsonSet() should support postgres null treatment', async function() {
    if (JsonSetGen.driver.type !== 'postgres') this.skip();
    const gen = await JsonSetGen.create({ name: 'laxJsonSet', extra: { keep: true, remove: true } });
    await gen.jsonSet('extra', [ 'remove' ], null, { nullTreatment: 'delete_key' });
    assert.deepEqual(gen.extra, { keep: true });
  });
});
