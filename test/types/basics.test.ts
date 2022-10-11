import { strict as assert } from 'assert';
import sinon from 'sinon';
import Realm, { Bone, Column, DataTypes, connect, Raw } from '../..';

describe('=> Basics (TypeScript)', function() {
  const { TEXT } = DataTypes;
  let realm: Realm;

  class Post extends Bone {
    static table = 'articles';

    @Column()
    id: bigint;

    @Column({ name: 'gmt_create' })
    createdAt: Date;

    @Column({ name: 'gmt_modified'})
    updatedAt: Date;

    @Column({ name: 'gmt_deleted' })
    deletedAt: Date;

    @Column()
    title: string;

    @Column(TEXT)
    content: string;

    @Column(TEXT)
    extra: string;

    @Column()
    get thumb(): string {
      return this.attribute('thumb');
    };

    set thumb(value: string) {
      this.attribute('thumb', value.replace('http://', 'https://'));
    }

    @Column()
    authorId: bigint;

    @Column()
    isPrivate: boolean;

    @Column(TEXT)
    summary: string;

    @Column(TEXT)
    get settings(): Record<string, any> | null {
      const text = this.attribute('settings') as string;
      if (!text) return null;
      try {
        return JSON.parse(text);
      } catch {
        return null;
      }
    }

    set settings(value: string | Record<string, any> | null) {
      if (typeof value !== 'string') value = JSON.stringify(value);
      this.attribute('settings', value);
    }

    @Column()
    wordCount: number;

    @Column(DataTypes.VIRTUAL)
    get isEmptyContent(): boolean {
      return this.wordCount <= 0;
    }

    @Column(DataTypes.VIRTUAL)
    get shouldBeRemove(): boolean {
      return this.wordCount <= 0;
    }

    nodes: unknown;
  }

  before(async function() {
    realm = await connect({
      dialect: 'sqlite',
      database: '/tmp/leoric.sqlite3',
      models: [ Post ],
    });
  });

  after(() => {
    Bone.driver = null;
  });

  beforeEach(async function() {
    await Post.truncate();
  });

  describe('=> Attributes', function() {
    it('Bone.renameAttribute', () => {
      Post.renameAttribute('shouldBeRemove', 'newName');
      assert.ok(Post.attributes['newName']);
      assert.ok(!Post.attributes['shouldBeRemove']);
      Post.renameAttribute('newName', 'shouldBeRemove');
      assert.ok(Post.attributes['shouldBeRemove']);
      assert.ok(!Post.attributes['newName']);
    });

    it('bone.attribute(name)', async function() {
      const post = await Post.create({ title: 'Cain' });
      assert.equal(post.attribute('title'), 'Cain');
      assert.equal(post.attributeWas('title'), 'Cain');
      assert.equal(post.attribute('settings'), null);
    });

    it('bone.attribute(name) type casting', async function() {
      class Article extends Bone {
        @Column(DataTypes.TEXT)
        get settings(): Record<string, any> | null {
          try {
            // inferred type is Record<string, any>, fallback to Literal
            return JSON.parse(this.attribute('settings') as string);
          } catch {
            return null;
          }
        }

        @Column()
        get isPrivate(): boolean {
          return Boolean(this.attribute('isPrivate'));
        }

        @Column(DataTypes.TEXT)
        get callback(): () => void {
          // inferred type is Function, fallback to Literal
          return eval(this.attribute('callback') as string);
        }
      }
      const article = new Article({});
      await Article.sync({});
      article.attribute('settings', '{"bar":2}');
      article.attribute('isPrivate', '1');
      article.attribute('callback', '() => 1');
      assert.deepEqual(article.settings, { bar: 2 });
      assert.equal(article.isPrivate, true);
      assert.equal(article.callback(), 1);
    })

    it('bone.attribute(name, value)', async function() {
      const post = new Post({});
      post.attribute('title', 'Cain');
      post.attribute('settings', '{"foo":1}');
      assert.equal(post.title, 'Cain');
      assert.deepEqual(post.settings, { foo: 1 });
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

    it('bone.previousChanged()', async function() {
      const post = new Post({ title: 'Cain' });
      assert.deepEqual(post.previousChanged(), false);
      assert.equal(post.previousChanged('title'), false);

      await post.create();

      assert.ok(post.id);
      assert.equal(post.title, 'Cain');
      assert.deepEqual(post.previousChanged().sort(), [ 'id', 'title', 'createdAt', 'updatedAt' ].sort());
      assert.equal(post.previousChanged('title'), true);
    });

    it('bone.changes()', async function() {
      const post = new Post({ title: 'Cain' });
      assert.deepEqual(post.changes(), { title: [ null, 'Cain' ] });
      assert.deepEqual(post.changes('title'), { title: [ null, 'Cain' ] });

      await post.create();

      assert.ok(post.id);
      assert.equal(post.title, 'Cain');
      assert.deepEqual(post.changes('title'), {});
    });

    it('bone.previousChanges()', async function() {
      const post = new Post({ title: 'Cain' });
      assert.deepEqual(post.previousChanges(), {});
      assert.deepEqual(post.previousChanges('title'), {});

      await post.create();

      assert.ok(post.id);
      assert.equal(post.title, 'Cain');
      assert.deepEqual(post.changes('title'), {});
    });

    it('bone.attributeWas(name)', async () => {
      const post = new Post({
        title: 'Yhorm',
      });
      await post.save();
      post.attribute('title', 'Cain');
      assert.equal(post.attributeWas('title'), 'Yhorm');
    });

    it('bone.attributeChanged',async () => {
      const post = new Post({
        title: 'Yhorm',
      });
      await post.save();
      assert.equal(post.attributeChanged('title'), false);
    });


  });

  describe('=> Accessors', function() {
    it('Bone.primaryColumn', async function() {
      assert.equal(Post.primaryColumn, 'id');
    });
  });

  describe('=> Integration', function() {
    it('bone.toJSON()', async function() {
      const post = await Post.create({ title: 'Nephalem', wordCount: 0 });
      assert.equal(post.toJSON().title, 'Nephalem');
      // virtual column should not be added to unset
      assert.equal(post.toJSON().isEmptyContent, true);
      const post1 = await Post.findOne();
      assert.equal(post1!.toJSON().title, 'Nephalem');
      // virtual column should not be added to unset
      assert.equal(post1!.toJSON().isEmptyContent, true);
    });

    it('bone.toObject()', async function() {
      const post = await Post.create({ title: 'Leah' });
      assert.equal(post.toObject().title, 'Leah');
      // virtual column should not be added to unset
      assert.equal(post.toObject().isEmptyContent, true);
      const post1 = await Post.findOne();
      assert.equal(post1!.toObject().title, 'Leah');
      // virtual column should not be added to unset
      assert.equal(post1!.toObject().isEmptyContent, true);
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

    it('Bone.create({ setter })', async function() {
      const post = await Post.create({ title: 'Tyrael', thumb: 'http://example.com' });
      assert.ok(post instanceof Post);
      assert.ok(post.id);
    });

    it('Bone.create({ arbitrary })', async function() {
      const post = await Post.create({ title: 'Apia', nodes: [] });
      assert.ok(post instanceof Post);
      assert.ok(post.nodes);
    });

    it('bone.create()', async function() {
      const post = new Post({ title: 'Cain' });
      await post.create();
      assert.ok(post.id);
      assert.equal(post.title, 'Cain');
    });

    it('bone.save()', async function() {
      await Post.create({ id: BigInt(1), title: 'Leah' });
      const post = new Post({ id: 1, title: 'Diablo' });
      await post.save();

      const posts = await Post.all;
      assert.equal(posts.length, 1);
    });
  });

  describe('=> Read', function() {
    beforeEach(async function() {
      await Post.bulkCreate([
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
      assert.equal(post!.title, 'Leah');
      const post1 = await Post.findOne({ id: post!.id });
      assert.equal(post1!.id, post!.id);
    });

    it('Post.where()', async function() {
      const posts = await Post.where({ title: { $like: '%a%' } }).select('title');
      assert.equal(posts.length, 3);
    });

    it('first', async () => {
      const post1 = await Post.find().first;
      assert.equal(post1.title, 'Leah');
    });

    it('last', async () => {
      const post1 = await Post.find().last;
      assert.equal(post1.title, 'Nephalem');
    });

    it('get(index)', async () => {
      const post1 = await Post.find().get(0);
      assert.equal(post1.title, 'Leah');
    });

    it('all', async () => {
      const posts = await Post.find().all;
      assert.equal(posts.length, 3);
      assert.equal(posts[0].title, 'Leah');
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
      assert.equal((await Post.findOne({ title: 'Cain' }))!.title, 'Cain');
      assert.equal((await Post.findOne({ title: 'Diablo' }))!.title, 'Diablo');
    });

    it('post.update()', async function() {
      const post = await Post.create({ title: 'Tyrael' });
      assert.equal(post.title, 'Tyrael');
      let result = await post.update({ title: 'Stranger' });
      assert.equal(result, 1);
      await post.reload();
      assert.equal(post.title, 'Stranger');
      result = await post.update({});
      assert.equal(result, 0);
    });

    it('spell.increment()', async function() {
      const [ post, post2 ] = await Post.bulkCreate([
        { title: 'Leah', wordCount: 20 },
        { title: 'Cain', wordCount: 10 },
      ]);

      const result = await Post.where({ title: 'Leah' }).increment('wordCount');
      assert.equal(result.affectedRows, 1);

      await post.reload();
      assert.equal(post.wordCount, 21);

      await Post.all.increment('wordCount', 20);
      await post.reload();
      assert.equal(post.wordCount, 41);
      await post2.reload();
      assert.equal(post2.wordCount, 30);
    });

    it('spell.update()', async function() {
      const post = await Post.create({ title: 'Leah', wordCount: 20 });
      assert.equal(post.title, 'Leah');

      const result = await Post.where({ title: 'Leah' }).update({ title: 'Diablo' });
      assert.equal(result.affectedRows, 1);

      await post.reload();
      assert.equal(post.title, 'Diablo');
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
      assert.equal((await Post.findOne())!.title, 'Leah');
    });

    it('post.remove()', async function() {
      const post = await Post.create({ title: 'Untitled' });
      await post.remove();
      assert.equal((await Post.find()).length, 0);
    });

    it('spell.delete()', async function() {
      const [ post, post2 ] = await Post.bulkCreate([
        { title: 'Leah', wordCount: 20 },
        { title: 'Cain', wordCount: 10 },
      ]);

      const result = await Post.where({ title: 'Leah' }).delete();
      assert.equal(result.affectedRows, 1);

      assert.equal(await Post.count(), 1);
      assert.equal((await Post.findOne())!.title, 'Cain');
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

  describe('=> Transaction', function() {
    it('realm.transaction(function* () {})', async function() {
      const result = await realm.transaction(function* () {
        yield true;
        return 1;
      });
      // tsc should be able to infer that the type of result is number
      assert.equal(result, 1);
    });

    it('realm.transaction(async function() {})', async function() {
      const result = await realm.transaction(async function() {
        return 1;
      });
      // tsc should be able to infer that the type of result is number
      assert.equal(result, 1);
    });
  });

  describe('Num', () => {

    let clock;
    before(() => {
      const date = new Date(2017, 11, 12);
      const fakeDate = date.getTime();
      sinon.useFakeTimers(fakeDate);
    });
  
    after(() => {
      clock?.restore();
    });

    it('count', () => {
      assert.equal(Post.count('authorId').toSqlString(), 'SELECT COUNT("author_id") AS "count" FROM "articles" WHERE "gmt_deleted" IS NULL');
      assert.equal(Post.count(new Raw("DISTINCT(author_id)")).toSqlString(), 'SELECT COUNT(DISTINCT(author_id)) AS count FROM "articles" WHERE "gmt_deleted" IS NULL');
    });

    it('average', () => {
      assert.equal(Post.average('wordCount').toSqlString(), 'SELECT AVG("word_count") AS "average" FROM "articles" WHERE "gmt_deleted" IS NULL');
      assert.equal(Post.average(new Raw("DISTINCT(word_count)")).toSqlString(), 'SELECT AVG(DISTINCT(word_count)) AS average FROM "articles" WHERE "gmt_deleted" IS NULL');
    });

    it('minimum', () => {
      assert.equal(Post.minimum('wordCount').toSqlString(), 'SELECT MIN("word_count") AS "minimum" FROM "articles" WHERE "gmt_deleted" IS NULL');
      assert.equal(Post.minimum(new Raw("DISTINCT(word_count)")).toSqlString(), 'SELECT MIN(DISTINCT(word_count)) AS minimum FROM "articles" WHERE "gmt_deleted" IS NULL');
    });

    it('maximum', () => {
      assert.equal(Post.maximum('wordCount').toSqlString(), 'SELECT MAX("word_count") AS "maximum" FROM "articles" WHERE "gmt_deleted" IS NULL');
      assert.equal(Post.maximum(new Raw("DISTINCT(word_count)")).toSqlString(), 'SELECT MAX(DISTINCT(word_count)) AS maximum FROM "articles" WHERE "gmt_deleted" IS NULL');
    });

    it('sum', () => {
      assert.equal(Post.sum('wordCount').toSqlString(), 'SELECT SUM("word_count") AS "sum" FROM "articles" WHERE "gmt_deleted" IS NULL');
      assert.equal(Post.sum(new Raw("DISTINCT(word_count)")).toSqlString(), 'SELECT SUM(DISTINCT(word_count)) AS sum FROM "articles" WHERE "gmt_deleted" IS NULL');
    });

    it('increment', () => {
      assert.equal(Post.find().increment('wordCount').toSqlString(), 'UPDATE "articles" SET "word_count" = "word_count" + 1, "gmt_modified" = \'2017-12-12 00:00:00.000\' WHERE "gmt_deleted" IS NULL');
    });

    it('decrement', () => {
      assert.equal(Post.find().decrement('wordCount').toSqlString(), 'UPDATE "articles" SET "word_count" = "word_count" - 1, "gmt_modified" = \'2017-12-12 00:00:00.000\' WHERE "gmt_deleted" IS NULL');
    });
  });
});
