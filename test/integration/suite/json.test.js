'use strict';

const assert = require('assert').strict;

const { Bone, Raw } = require('../../../src');

describe('=> Basic', () => {

  describe('=> JSON Functions', ()=>{

    class Gen extends Bone { }
    Gen.init({
      id: { type: Bone.DataTypes.INTEGER, primaryKey: true },
      name: Bone.DataTypes.STRING,
      extra: Bone.DataTypes.JSONB,
      deleted_at: Bone.DataTypes.DATE,
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

    it('bone.jsonMerge(name, values, options) should work', async () => {
      const gen = await Gen.create({ name: '章3️⃣疯' });
      assert.equal(gen.name, '章3️⃣疯');
      await gen.update({ extra: { a: 1 } });
      assert.equal(gen.extra.a, 1);
      await gen.jsonMerge('extra', { b: 2, a: 3 });
      await gen.reload();
      assert.equal(gen.extra.a, 3);
      assert.equal(gen.extra.b, 2);

      const gen2 = await Gen.create({ name: 'gen2', extra: { test: 1 }});
      assert.equal(gen2.extra.test, 1);
      await gen2.jsonMerge('extra', { url: 'https://www.wanxiang.art/?foo=' });
      await gen2.reload();
      assert.equal(gen2.extra.url, 'https://www.wanxiang.art/?foo=');
    });

    it('bone.update(values,options) with JSON_MERGE_PATCH func should work', async () => {
      const gen = await Gen.create({ name: 'testUpdateGen', extra: { test: 'gen' }});
      assert.equal(gen.extra.test, 'gen');
      assert.equal(gen.name, 'testUpdateGen');

      const sql = new Raw(`JSON_MERGE_PATCH(extra, '${JSON.stringify({ url: 'https://www.taobao.com/?id=1' })}')`);
      await gen.update({extra: sql});
      await gen.reload();
      assert.equal(gen.extra.url, 'https://www.taobao.com/?id=1');
    });

    it('bone.jsonMergePreserve(name, values, options) should work', async () => {
      const gen = await Gen.create({ name: '章3️⃣疯' });
      assert.equal(gen.name, '章3️⃣疯');
      await gen.update({ extra: { a: 1 } });
      assert.equal(gen.extra.a, 1);
      await gen.jsonMergePreserve('extra', { b: 2, a: 3 });
      await gen.reload();
      assert.deepEqual(gen.extra.a, [1, 3]);

      await gen.jsonMerge('extra', { url: 'https://wanxiang.art/?foo=' });
      await gen.jsonMergePreserve('extra', { url: 'https://www.wanxiang.art/?foo=' });
      await gen.reload();
      assert.deepEqual(gen.extra.url, ['https://wanxiang.art/?foo=', 'https://www.wanxiang.art/?foo=']);
    });
  });
});
