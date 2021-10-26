import { strict as assert } from 'assert';
import { Bone, connect } from '../..'

describe('=> Querying (TypeScript)', function() {
  class Post extends Bone {
    static table = 'articles'
  }

  before(async function() {
    Bone.driver = null;
    await connect({
      dialect: 'sqlite',
      database: '/tmp/leoric.sqlite3',
      models: [ Post ],
    });
  });

  beforeEach(async function() {
    await Post.truncate();
  });

  describe('=> Driver', function() {
    it('driver.query(SELECT)', async function() {
      const { rows } = await Bone.driver.query('SELECT 1');
      assert.equal(rows.length, 1);
    });

    it('driver.query(INSERT)', async function() {
      const { insertId, affectedRows } = await Bone.driver.query(
        'INSERT INTO articles (title) VALUES ("Leah")'
      );
      assert.equal(affectedRows, 1);
      assert.ok(insertId);
    });
  });
});
