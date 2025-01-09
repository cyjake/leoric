'use strict';

const SqlString = require('sqlstring');
const assert = require('assert').strict;

const { Bone, Raw } = require('../../../src');

describe('=> Basic', () => {

  describe('=> JSON Functions', ()=>{

    class Gen extends Bone { }
    Gen.init({
      id: { type: Bone.DataTypes.INTEGER, primaryKey: true },
      name: Bone.DataTypes.STRING,
      extra: Bone.DataTypes.JSONB,
      deletedAt: Bone.DataTypes.DATE,
    });

    before(async () => {
      await Bone.driver.dropTable('gens');
      await Gen.sync();
    });

    after(async () => {
      await Bone.driver.dropTable('gens');
    });

    beforeEach(async () => {
      await Gen.remove({}, true);
    });

    it('bone.jsonMerge(name, value, options) should work', async () => {
      const gen = await Gen.create({ name: '章3️⃣疯' });
      assert.equal(gen.name, '章3️⃣疯');
      await gen.update({ extra: { a: 1 } });
      assert.equal(gen.extra.a, 1);
      await gen.jsonMerge('extra', { b: 2, a: 3 });
      assert.equal(gen.extra.a, 3);
      assert.equal(gen.extra.b, 2);

      const gen2 = await Gen.create({ name: 'gen2', extra: { test: 1 }});
      assert.equal(gen2.extra.test, 1);
      await gen2.jsonMerge('extra', { url: 'https://www.wanxiang.art/?foo=' });
      assert.equal(gen2.extra.url, 'https://www.wanxiang.art/?foo=');
    });

    it('bone.jsonMerge(name, value, options) should escape double quotations', async () => {
      const gen = await Gen.create({ name: '章3️⃣疯', extra: {} });
      await gen.jsonMerge('extra', { a: `fo'o"quote"bar` });
      assert.equal(gen.extra.a, `fo'o"quote"bar`);
    });

    it('bone.update(values, options) with JSON_MERGE_PATCH func should work', async () => {
      const gen = await Gen.create({ name: 'testUpdateGen', extra: { test: 'gen' }});
      assert.equal(gen.extra.test, 'gen');
      assert.equal(gen.name, 'testUpdateGen');

      await gen.update({
        extra: new Raw(`JSON_MERGE_PATCH(extra, ${SqlString.escape(JSON.stringify({ url: 'https://www.taobao.com/?id=1' }))})`),
      });
      assert.ok(!(gen.extra instanceof Raw));
      await gen.reload();
      assert.equal(gen.extra.url, 'https://www.taobao.com/?id=1');
    });

    it('bone.update(values, options) with Raw and literal values mixed should work', async () => {
      const gen = await Gen.create({ name: 'testUpdateGen', extra: { test: 'gen' }});
      await gen.update({
        extra: new Raw(`JSON_MERGE_PATCH(extra, ${SqlString.escape(JSON.stringify({ url: 'https://www.taobao.com/?id=2' }))})`),
        name: 'gen2',
      });
      assert.ok(!(gen.extra instanceof Raw));
      await gen.reload();
      assert.equal(gen.extra.test, 'gen');
      assert.equal(gen.extra.url, 'https://www.taobao.com/?id=2');
      assert.equal(gen.name, 'gen2');
    });

    it('bone.jsonMerge(values, options) with object and primitive values mixed should work', async () => {
      const gen = await Gen.create({ name: 'testUpdateGen', extra: { test: 'gen' }});
      await gen.jsonMerge({
        extra: { url: 'https://www.taobao.com/?id=2' },
        name: 'gen2',
      });
      assert.ok(!(gen.extra instanceof Raw));
      await gen.reload();
      assert.equal(gen.extra.test, 'gen');
      assert.equal(gen.extra.url, 'https://www.taobao.com/?id=2');
      assert.equal(gen.name, 'gen2');
    });

    it('bone.jsonMergePreserve(name, values, options) should work', async () => {
      const gen = await Gen.create({ name: '章3️⃣疯' });
      assert.equal(gen.name, '章3️⃣疯');
      await gen.update({ extra: { a: 1 } });
      assert.equal(gen.extra.a, 1);
      await gen.jsonMergePreserve('extra', { b: 2, a: 3 });
      assert.deepEqual(gen.extra.a, [1, 3]);

      await gen.jsonMerge('extra', { url: 'https://wanxiang.art/?foo=' });
      await gen.jsonMergePreserve('extra', { url: 'https://www.wanxiang.art/?foo=' });
      assert.deepEqual(gen.extra.url, ['https://wanxiang.art/?foo=', 'https://www.wanxiang.art/?foo=']);
    });

    it('Bone.jsonMerge(conditions, values, options) should work', async () => {
      const gen = await Gen.create({ name: '章3️⃣疯', extra: {} });
      await Gen.jsonMerge({ id: gen.id }, { extra: { a: 3 } });
      await gen.reload();
      assert.equal(gen.extra.a, 3);
    });

    it('Bone.jsonMerge(conditions, values, options) should escape values', async () => {
      const gen = await Gen.create({ name: '章3️⃣疯', extra: {} });
      await Gen.jsonMerge({ id: gen.id }, { extra: { a: "foo\'bar" } });
      await gen.reload();
      assert.equal(gen.extra.a, 'foo\'bar');
    });

    it('Bone.jsonMerge(conditions, values, options) should escape double quotations', async () => {
      const gen = await Gen.create({ name: '章3️⃣疯', extra: {} });
      await Gen.jsonMerge({ id: gen.id }, { extra: { a: 'foo"quote"bar' } });
      await gen.reload();
      assert.equal(gen.extra.a, 'foo"quote"bar');
    });

    it('Bone.jsonMergePreserve(conditions, values, options) should work', async () => {
      const gen = await Gen.create({ name: '章3️⃣疯', extra: {} });
      await Gen.jsonMerge({ id: gen.id }, { extra: { a: 3 } });
      await Gen.jsonMergePreserve({ id: gen.id }, { extra: { a: 4 } });
      await gen.reload();
      assert.deepEqual(gen.extra.a, [3, 4]);
    });
  });
});
