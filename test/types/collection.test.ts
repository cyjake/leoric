import { strict as assert } from 'assert';
import { Bone, Collection, connect } from '../../src';

describe('=> Collection (TypeScript)', function() {
  class User extends Bone {
    id!: number;
    createdAt!: Date;
    deletedAt!: Date;
    email!: string;
    nickname!: string;
    status!: number;
  }

  before(async function() {
    (Bone as any).driver = null;
    await connect({
      dialect: 'sqlite',
      database: '/tmp/leoric.sqlite3',
      models: [ User ]
    });
  });

  beforeEach(async function() {
    await User.truncate();
  });

  it('collection.toJSON()', async function() {
    const uesrs = await User.all;
    assert.deepEqual(uesrs.toJSON(), []);
  });

  it('collection.save()', async function() {
    const users = new Collection(
      new User({ nickname: 'siri', email: 'siri@me.com', status: 0, level: 3 }),
      new User({ nickname: 'xiaoai', email: 'xiaoai@mi.com', status: 1, level: 2 })
    );
    await users.save();
    assert.equal(await User.count(), 2);
  });
});
