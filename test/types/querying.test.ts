import { strict as assert } from 'assert';
import { Bone, connect } from '../..'

describe('=> Querying (TypeScript)', function() {
  class Post extends Bone {
    static table = 'articles'
    id: bigint;
    title: string;
  }

  class User extends Bone {
    static initialize() {
      this.hasMany('posts', { foreignKey: 'authorId' });
    }
    id: number;
    posts?: Post[];
  }

  before(async function() {
    Bone.driver = null;
    await connect({
      dialect: 'sqlite',
      database: '/tmp/leoric.sqlite3',
      models: [ Post, User ],
    });
  });

  beforeEach(async function() {
    await Post.truncate();
    await User.truncate();
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

  describe('=> Associations', function() {
    it('Bone.findOne().with()', async function() {
      const author = await User.create({
        email: 'hi@there.com',
        nickname: 'Hey',
        status: 0,
        level: 5,
      });
      await Post.bulkCreate([
        { title: 'Leah' },
        { title: 'Stranger', authorId: author.id }
      ])
      const user = await User.findOne({}).with({ posts: { select: 'title' } });
      assert.equal(user.id, author.id);
      assert.ok(Array.isArray(user.posts));
      assert.equal(user.posts.length, 1);
      assert.equal(user.posts[0].title, 'Stranger');
    });
  });

  describe('=> Aggregations', function() {
    it('Bone.count()', async function() {
      const count = await Post.count();
      assert.equal(count, 0);
    });

    it('Bone.group().count()', async function() {
      const result = await Post.group('title').count();
      assert.ok(Array.isArray(result));
    });

    it('Bone.where().count()', async function() {
      const count = await Post.where({ title: 'Leah' }).count();
      assert.equal(count, 0);
    });
  });

  describe('=> Select', async function() {
    before(async function() {
      await Post.bulkCreate([
        { title: 'There And Back Again' },
      ]);
    })
    const post = await Post.findOne().select(name => [ 'id', 'title' ].includes(name));
    assert.deepEqual(post.toJSON(), { id: post.id, title: 'There And Back Again' })
  });
});
