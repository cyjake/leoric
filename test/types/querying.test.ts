import { strict as assert } from 'assert';
import { Bone, DataTypes, Column, HasMany, connect, Raw } from '../../src';

describe('=> Querying (TypeScript)', function() {
  const { BIGINT, INTEGER, STRING } = DataTypes;
  class Post extends Bone {
    static table = 'articles';

    @Column(BIGINT)
    id!: number;

    @Column(BIGINT)
    authorId!: number;

    @Column()
    title!: string;
  }

  class User extends Bone {
    @Column(BIGINT)
    id!: number;

    @Column(STRING)
    email!: string;

    @Column(STRING)
    nickname!: string;

    @Column({ type: INTEGER, allowNull: false })
    status!: number;

    @Column(INTEGER)
    level!: number;

    @HasMany({ foreignKey: 'authorId' })
    posts?: Post[];
  }

  before(async function() {
    (Bone as any).driver = null;
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
      const { rows } = await Bone.driver!.query('SELECT 1');
      assert.equal(rows!.length, 1);
    });

    it('driver.query(INSERT)', async function() {
      const { insertId, affectedRows } = await Bone.driver!.query(
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
      ]);
      const user = await User.findOne({}).with({ posts: { select: 'title' } });
      assert.equal(user!.id, author.id);
      assert.ok(Array.isArray(user!.posts));
      assert.equal(user!.posts.length, 1);
      assert.equal(user!.posts[0].title, 'Stranger');
    });
  });

  describe('=> Aggregations', function() {
    it('Bone.count()', async function() {
      let count = await Post.count();
      assert.equal(count, 0);
      count = await Post.count('authorId');
      assert.equal(count, 0);
    });

    it('Bone.group().count()', async function() {
      await Post.create({ title: 'Samoa' });
      const results = await Post.group('title').count();
      assert.ok(Array.isArray(results));
      const [result] = results;
      assert.ok('title' in result);
      assert.equal(result.title, 'Samoa');
      assert.equal(result.count, 1);
    });

    it('Bone.group(raw).count()', async function() {
      await Post.create({ title: 'Samoa' });
      const results = await Post.group(new Raw('title')).count();
      assert.ok(Array.isArray(results));
      const [result] = results;
      assert.ok('title' in result);
      assert.equal(result.title, 'Samoa');
      assert.equal(result.count, 1);
    });

    it('Bone.where().count()', async function() {
      let count = await Post.where({ title: 'Leah' }).count();
      assert.equal(count, 0);
      count = await Post.where({ title: 'Leah' }).count('id');
      assert.equal(count, 0);
    });
  });

  describe('=> Select', async function() {
    beforeEach(async function() {
      await Post.bulkCreate([
        { id: 1, title: 'There And Back Again' },
        { id: 2, title: 'Foo', authorId: 2 },
        { id: 3, title: 'Foobar', authorId: 2 },
      ]);
    });

    it('Bone.findOne().select()', async function() {
      const post = await Post.findOne(1).select(name => [ 'id', 'title' ].includes(name));
      assert.deepEqual(post!.toJSON(), { id: post!.id, title: 'There And Back Again' });
    });

    it('Bone.findOne({ $or })', async function() {
      const post = await Post.findOne({
        $or: [
          { authorId: 2, title: 'Foo' },
          { authorId: 3, title: 'Bar' },
        ],
      });
      assert.ok(post);
    });

    it('Bone.fineOne({ $and })', async function() {
      const post = await Post.findOne({
        $and: [
          { authorId: 2, title: { $like: 'Foo%' } },
          { title: { $like: '%bar' } },
        ],
      });
      assert.ok(post);
    });

    it('Bone.select(Raw)', async function() {
      const posts = await Post.select(new Raw('COUNT(author_id) as count'));
      assert.ok(Array.isArray(posts));
      if ('count' in posts[0]) assert.equal(posts[0].count, 2);
    });

    it('Bone.where(Raw)', async function() {
      const posts = await Post.where(new Raw('author_id = 2'));
      assert.equal(posts.length, 2);
    });
  });
});
