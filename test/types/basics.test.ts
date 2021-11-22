import { strict as assert } from 'assert';
import { Bone, DataTypes, connect } from '../..';

describe('=> Basics (TypeScript)', function() {
  const { BIGINT, INTEGER, STRING, TEXT, DATE, BOOLEAN } = DataTypes;
  class Post extends Bone {
    static table = 'articles';

    static attributes = {
      id: BIGINT,
      createdAt: { type: DATE, columnName: 'gmt_create' },
      updatedAt: { type: DATE, columnName: 'gmt_modified' },
      deletedAt: { type: DATE, columnName: 'gmt_deleted' },
      title: STRING,
      content: TEXT,
      extra: TEXT,
      thumb: STRING,
      authorId: BIGINT,
      isPrivate: BOOLEAN,
      summary: TEXT,
      settings: TEXT,
      wordCount: INTEGER,
    }

    // TODO: should be generated or automated with decorator
    id: bigint;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date;
    title: string;
    content: string;
    extra: string;
    thumb: string;
    authorId: number;
    isPrivate: boolean;
    summary: string;
    settings: string;
    wordCount: number;
  }

  before(async function() {
    await connect({
      dialect: 'sqlite',
      database: '/tmp/leoric.sqlite3',
      models: [ Post ],
    });
  });

  beforeEach(async function() {
    await Post.truncate();
  });

  describe('=> Attributes', function() {
    it('bone.attribute(name)', async function() {
      const post = await Post.create({ title: 'Cain' });
      assert.equal(post.attribute('title'), 'Cain');
    });

    it('bone.attribute(name, value)', async function() {
      const post = new Post({});
      post.attribute('title', 'Cain');
      assert.equal(post.title, 'Cain');
    });

    it('bone.changed()', async function() {
      const post = new Post({ title: 'Cain' });
      assert.deepEqual(post.changed(), [ 'title' ]);
      assert.equal(post.changed('title'), true);
      await post.create();

      assert.ok(post.id);
      assert.equal(post.title, 'Cain');
      assert.equal(post.changed(), false);
      assert.equal(post.changed('title'), false);
    });
  });

  describe('=> Accessors', function() {
    it('Bone.primaryColumn', async function() {
      assert.equal(Post.primaryColumn, 'id');
    });
  });

  describe('=> Integration', function() {
    it('bone.toJSON()', async function() {
      const post = await Post.create({ title: 'Nephalem' });
      assert.equal(post.toJSON().title, 'Nephalem');
    });

    it('bone.toObject()', async function() {
      const post = await Post.create({ title: 'Leah' });
      assert.equal(post.toObject().title, 'Leah');
    });
  });

  describe('=> Create', function() {
    it('Bone.create()', async function() {
      const post = await Post.create({ title: 'Tyrael' });
      assert.ok(post instanceof Post);
      assert.ok(post.id);
      assert.equal(post.title, 'Tyrael');
      assert.equal(post.toJSON().title, 'Tyrael');
      assert.equal(post.toObject().title, 'Tyrael');
    });

    it('bone.create()', async function() {
      const post = new Post({ title: 'Cain' });
      await post.create();
      assert.ok(post.id);
      assert.equal(post.title, 'Cain');
    });

    it('bone.save()', async function() {
      await Post.create({ id: 1, title: 'Leah' });
      const post = new Post({ id: 1, title: 'Diablo' });
      await post.save();

      const posts = await Post.all;
      assert.equal(posts.length, 1)
    });
  });

  describe('=> Read', function() {
    beforeEach(async function() {
      const posts = await Post.bulkCreate([
        { title: 'Leah' },
        { title: 'Cain' },
        { title: 'Nephalem' }
      ]);
    });

    it('Post.find()', async function() {
      const posts = await Post.find();
      assert.equal(posts.length, 3);
      assert.deepEqual(Array.from(posts, post => post.title).sort(), [
        'Cain',
        'Leah',
        'Nephalem',
      ]);
    });

    it('Post.findOne()', async function() {
      const post = await Post.findOne({ title: 'Leah' });
      assert.equal(post.title, 'Leah');
      const post1 = await Post.findOne({ id: post.id });
      assert.equal(post1.id, post.id);
    });

    it('Post.where()', async function() {
      const posts = await Post.where({ title: { $like: '%a%' } }).select('title');
      assert.equal(posts.length, 3);
    });
  });

  describe('=> Update', function() {
    it('Post.update()', async function() {
      await Post.bulkCreate([
        { title: 'Leah' },
        { title: 'Cain' },
      ]);
      await Post.update({ title: 'Leah' }, { title: 'Diablo' });
      assert.equal(await Post.findOne({ title: 'Leah' }), null);
      assert.equal((await Post.findOne({ title: 'Cain' })).title, 'Cain');
      assert.equal((await Post.findOne({ title: 'Diablo' })).title, 'Diablo');
    });

    it('post.update()', async function() {
      const post = await Post.create({ title: 'Tyrael' });
      assert.equal(post.title, 'Tyrael');
      const result = await post.update({ title: 'Stranger' });
      assert.equal(result, 1);
      await post.reload();
      assert.equal(post.title, 'Stranger');
    });

    it('spell.increment()', async function() {
      const [ post, post2 ] = await Post.bulkCreate([
        { title: 'Leah', wordCount: 20 },
        { title: 'Cain', wordCount: 10 },
      ]);

      await Post.where({ title: 'Leah' }).increment('wordCount');
      await post.reload();
      assert.equal(post.wordCount, 21);

      await Post.all.increment('wordCount', 20);
      await post.reload();
      assert.equal(post.wordCount, 41);
      await post2.reload();
      assert.equal(post2.wordCount, 30);
    });
  });

  describe('=> Remove', function() {
    it('Post.remove()', async function() {
      await Post.bulkCreate([
        { title: 'Leah' },
        { title: 'Cain' },
      ]);
      await Post.remove({ title: 'Cain' });
      assert.equal((await Post.find()).length, 1);
      assert.equal((await Post.findOne()).title, 'Leah');
    });

    it('post.remove()', async function() {
      const post = await Post.create({ title: 'Untitled' });
      await post.remove();
      assert.equal((await Post.find()).length, 0);
    });
  });

  describe('=> Bulk', function() {
    it('Post.bulkCreate()', async function() {
      const posts = await Post.bulkCreate([
        { title: 'Leah' },
        { title: 'Cain' },
        { title: 'Nephalem' }
      ]);
      assert.equal(posts.length, 3);
      assert.equal(posts[0].title, 'Leah');
      assert.equal(posts[1].title, 'Cain');
      assert.equal(posts[2].title, 'Nephalem');
    });
  });
});
