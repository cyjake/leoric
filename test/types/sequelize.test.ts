import { strict as assert } from 'assert';
const sinon = require('sinon');

import { SequelizeBone, Column, DataTypes, connect, Hint, Raw, Bone } from '../..';

describe('=> sequelize (TypeScript)', function() {
  const { TEXT, STRING, VIRTUAL } = DataTypes;
  class Post extends SequelizeBone {
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
    thumb: string;

    @Column()
    authorId: bigint;

    @Column({
      defaultValue: false,
    })
    isPrivate: boolean;

    @Column(TEXT)
    summary: string;

    @Column(TEXT)
    settings: string;

    @Column({
      defaultValue: 0,
    })
    wordCount: number;

    @Column(VIRTUAL)
    get virtualField(): string {
      return this.getDataValue('content')?.toLowerCase() || '';
    }

    set virtualField(v: string) {
      this.setDataValue('content', v?.toUpperCase());
    }
  }

  class Book extends SequelizeBone {
    @Column({
      primaryKey: true,
    })
    isbn: bigint;

    @Column({ name: 'gmt_create' })
    createdAt: Date;

    @Column({ name: 'gmt_modified'})
    updatedAt: Date;

    @Column({ name: 'gmt_deleted' })
    deletedAt: Date;

    @Column(STRING(1000))
    name: string;

    @Column()
    price: number;
  }

  class Like extends SequelizeBone {
    @Column()
    userId: number;
  }

  before(async function() {
    Bone.driver = null;
    SequelizeBone.driver = null;
    await connect({
      host: 'localhost',
      port: process.env.MYSQL_PORT,
      user: 'root',
      database: 'leoric',
      models: [ Post, Book, Like ],
    });
  });

  beforeEach(async function() {
    await Post.truncate();
    await Book.truncate();
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

    it('bone.get(name)', async function() {
      const post = await Post.create({ title: 'Cain' });
      assert.equal(post.get('title'), 'Cain');
    });

    it('bone.set(name, value)', async function() {
      const post = new Post({});
      post.set('title', 'Cain');
      assert.equal(post.title, 'Cain');
    });

    it('bone.getDataValue(name)', async function() {
      const post = await Post.create({ title: 'Cain' });
      const title = post.getDataValue('title');
      assert.equal(title, 'Cain');
    });

    it('bone.setDataValue(name, value)', async function() {
      const post = new Post({});
      post.setDataValue('title', 'Cain');
      assert.equal(post.title, 'Cain');
    });

    it('bone.changed()', async function() {
      const post = new Post({ title: 'Cain' });
      assert.deepEqual(post.changed(), [ 'title', 'isPrivate', 'wordCount' ]);
      assert.equal(post.changed('title'), true);
      await post.create();

      assert.ok(post.id);
      assert.equal(post.title, 'Cain');
      assert.equal(post.changed(), false);
      assert.equal(post.changed('title'), false);
    });

    it('bone.previous()', async function() {
      const post = await Post.create({ title: 'By three they come' });
      post.title = 'Hello there';
      assert.deepEqual(post.previous(), {
        title: null,
        id: null,
        isPrivate: null,
        updatedAt: null,
        createdAt: null,
        wordCount: null,
      });
      post.content = 'a';
      assert.deepEqual(post.previous(), {
        title: null,
        id: null,
        isPrivate: null,
        updatedAt: null,
        createdAt: null,
        wordCount: null,
      });
      const prevUpdatedAt = post.updatedAt;
      await post.update();
      assert.deepEqual(post.previous(), {
        title: 'By three they come',
        id: post.id,
        isPrivate: false,
        updatedAt: prevUpdatedAt,
        createdAt: post.createdAt,
        wordCount: 0,
        authorId: null,
        content: null,
        deletedAt: null,
        extra: null,
        settings: null,
        summary: null,
        thumb: null,
        virtualField: null,
      });
    });

    it('bone.where sequelize', async () => {
      const post = await Post.create({ title: 'Cain' });
      assert.deepEqual(post.where(), { id: post.id });
    });
  });

  describe('=> Accessors', function() {
    it('Bone.primaryColumn', async function() {
      assert.equal(Post.primaryColumn, 'id');
    });

    it('Bone.sequelize', () => {
      assert.equal(Post.sequelize, true);
    });

    it('Bone.sequelize', () => {
      assert.deepEqual(Post.Instance, Post);
    });

    it('Bone.rawAttributes', () => {
      assert.deepEqual(Post.rawAttributes, Post.attributes);
    });

    it('Bone.getTableName', () => {
      assert.equal(Post.getTableName(), Post.table);
    });

    it('bone.isSoftDeleted', async () => {
      const post = await Post.create({ title: 'Nephalem' });
      assert.equal(post.isSoftDeleted(), false);
      await post.destroy();
      assert.equal(post.isSoftDeleted(), true);
    });

    it('bone.Model', () => {
      const post = Post.build({ title: 'Yhorm' });
      assert.deepEqual(post.Model, Post);
    });

    it('bone.dataValues', () => {
      const post = Post.build({ title: 'Yhorm' });
      const value = post.getDataValue();
      assert.deepEqual(post.dataValues, value);
      assert.ok(Object.keys(post.dataValues).length);
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
      await Post.create({ id: BigInt(1), title: 'Leah' });
      const post = new Post({ id: BigInt(1), title: 'Diablo' });
      await post.save();

      const posts = await Post.all;
      assert.equal(posts.length, 1)
    });

    it('Bone.bulkCreate()', async function() {
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

  describe('=> findAll', () => {
    it('Model.findAll()', async () => {
      await Promise.all([
        { title: 'Leah', createdAt: new Date(Date.now() - 1000) },
        { title: 'Tyrael' },
      ].map(opts => Post.create(opts)));
  
      let posts = await Post.findAll({
        where: {
          title: { $like: '%ea%' },
        },
      });
      assert.equal(posts.length, 1);
      assert.equal(posts[0].title, 'Leah');
  
      posts = await Post.findAll({
        order: [[ 'createdAt', 'desc' ]],
      });
      assert.equal(posts.length, 2);
      assert.equal(posts[0].title, 'Tyrael');
      assert.equal(posts[1].title, 'Leah');
  
      posts = await Post.findAll({
        order: [[ 'createdAt', 'desc' ]],
        offset: 1,
        limit: 2,
      });
      assert.equal(posts.length, 1);
      assert.equal(posts[0].title, 'Leah');
  
      posts = await Post.findAll({
        order: [[ 'createdAt', 'desc' ]],
        limit: 1,
      });
      assert.equal(posts.length, 1);
      assert.equal(posts[0].title, 'Tyrael');
  
      posts = await Post.findAll({
        attributes: [ 'title' ],
        where: { title: 'Leah' },
      });
      assert.equal(posts.length, 1);
      assert.equal(posts[0].title, 'Leah');
      assert.deepEqual(posts[0].content, undefined);
  
  
      // empty id array should be NULL
      posts = await Post.findAll({
        where: {
          id: [],
        }
      });
      assert.equal(posts.length, 0);
  
      posts = await Post.findAll({
        order: 'createdAt desc, id desc',
        limit: 1,
      });

      assert.equal(posts.length, 1);
      assert.equal(posts[0].title, 'Tyrael');
  
      posts = await Post.findAll({
        order: ['createdAt desc', 'id desc'],
        limit: 1,
      });
      assert.equal(posts.length, 1);
      assert.equal(posts[0].title, 'Tyrael');
  
      posts = await Post.findAll({
        order: [['createdAt', 'desc'], ['id', 'desc']],
        limit: 1,
      });
      assert.equal(posts.length, 1);
      assert.equal(posts[0].title, 'Tyrael');
  
      // order raw
      await Promise.all([
        { title: 'Leah1', createdAt: new Date(Date.now() - 1000) },
        { title: 'Tyrael1' },
      ].map(opts => Post.create(opts)));
      posts = await Post.findAll();
      assert.equal(posts.length, 4);
      const ids = [ posts[3].id, posts[1].id, posts[2].id, posts[0].id ];
      assert.equal(Post.findAll({
        order: [ new Raw(`FIND_IN_SET(id, '${ids.join(',')}')`) ],
      }).toSqlString(), `SELECT * FROM \`articles\` WHERE \`gmt_deleted\` IS NULL ORDER BY FIND_IN_SET(id, '${ids.join(',')}')`);
      posts = await Post.findAll({
        order: new Raw(`FIND_IN_SET(id, '${ids.join(',')}')`),
      });
      assert.equal(posts[0].id, ids[0]);
      assert.equal(posts[1].id, ids[1]);
      assert.equal(posts[2].id, ids[2]);
      assert.equal(posts[3].id, ids[3]);
  
      assert.equal(Post.findAll({
        order: [ new Raw(`FIND_IN_SET(id, '${ids.join(',')}')`), 'createdAt asc' ],
      }).toSqlString(), `SELECT * FROM \`articles\` WHERE \`gmt_deleted\` IS NULL ORDER BY FIND_IN_SET(id, '${ids.join(',')}'), \`gmt_create\``);
      posts = await Post.findAll({
        order: [ new Raw(`FIND_IN_SET(id, '${ids.join(',')}')`), 'createdAt asc' ],
      });
      assert.equal(posts[0].id, ids[0]);
      assert.equal(posts[1].id, ids[1]);
      assert.equal(posts[2].id, ids[2]);
      assert.equal(posts[3].id, ids[3]);

      assert.equal(Post.findAll({
        order: [[new Raw(`FIND_IN_SET(id, '${ids.join(',')}')`)], ['createdAt', 'asc']],
      }).toSqlString(), `SELECT * FROM \`articles\` WHERE \`gmt_deleted\` IS NULL ORDER BY FIND_IN_SET(id, '${ids.join(',')}'), \`gmt_create\``);
      posts = await Post.findAll({
        order: [[ new Raw(`FIND_IN_SET(id, '${ids.join(',')}')`) ], ['createdAt', 'asc']],
      });
      assert.equal(posts[0].id, ids[0]);
      assert.equal(posts[1].id, ids[1]);
      assert.equal(posts[2].id, ids[2]);
      assert.equal(posts[3].id, ids[3]);

    });
  
    it('Model.findAll(opt) with { paranoid: false }', async () => {
      await Promise.all([
        { title: 'Leah', createdAt: new Date(Date.now() - 1000) },
        { title: 'Tyrael' },
      ].map(opts => Post.create(opts)));
  
      let posts = await Post.findAll({
        where: {
          title: { $like: '%ea%' },
        },
      });
      assert.equal(posts.length, 1);
      assert.equal(posts[0].title, 'Leah');
  
      await Post.destroy({ where: { title: 'Leah' } });
      const post = await Post.findOne({ where: { title: 'Leah' } });
      assert.equal(post, null);
  
      posts = await Post.findAll({
        order: [[ 'createdAt', 'desc' ]],
        paranoid: false,
      });
      assert.equal(posts.length, 2);
      assert.equal(posts[0].title, 'Tyrael');
      assert.equal(posts[1].title, 'Leah');
  
      posts = await Post.findAll({
        order: [[ 'createdAt', 'desc' ]],
        offset: 1,
        limit: 2,
        paranoid: false
      });
      assert.equal(posts.length, 1);
      assert.equal(posts[0].title, 'Leah');
  
      posts = await Post.findAll({
        order: [[ 'createdAt', 'desc' ]],
        limit: 1,
        paranoid: false,
      });
      assert.equal(posts.length, 1);
      assert.equal(posts[0].title, 'Tyrael');
  
      posts = await Post.findAll({
        attributes: [ 'title' ],
        where: { title: 'Leah' },
        paranoid: false,
      });
      assert.equal(posts.length, 1);
      assert.equal(posts[0].title, 'Leah');
      assert.deepEqual(posts[0].content, undefined);
  
    });
  
    it('Model.findAll({ order })', async () => {
      await Promise.all([
        { title: 'Leah' },
        { title: 'Leah', createdAt: new Date(Date.now() - 1000) },
        { title: 'Tyrael' },
      ].map(opts => Post.create(opts)));
  
      const posts = await Post.findAll({
        order: [
          [ 'title', 'desc' ],
          [ 'createdAt', 'desc' ],
        ],
      });
      assert.equal(posts.length, 3);
      assert.equal(posts[0].title, 'Tyrael');
      assert.ok(posts[1].createdAt > posts[2].createdAt);
    });
  
    it('Mode.findAll({ order: [] })', async function() {
      await Promise.all([
        { title: 'Leah' },
        { title: 'Tyrael' },
      ].map(opts => Post.create(opts)));
  
      const posts = await Post.findAll({
        order: [ 'title', 'desc' ],
      });
      assert.equal(posts.length, 2);
      assert.equal(posts[0].title, 'Tyrael');
      assert.equal(posts[1].title, 'Leah');
    });
  
    it('Model.findAll({ order: <malformed> })', async () => {
      const posts = await Post.findAll({
        order: [ null as any ],
      });
      assert.equal(posts.length, 0);
    });
  
    describe('Model.findAll({ group })', () => {
      beforeEach(async () => {
        await Promise.all([
          { title: 'Leah' },
          { title: 'Leah' },
          { title: 'Tyrael' },
        ].map(opts => Post.create(opts)));
      });
  
      it('Model.findAll({ group: string })', async () => {
        const result = await Post.findAll({
          attributes: 'count(*) AS count',
          group: 'title',
          order: [[ 'title', 'desc' ]],
        });
        assert.deepEqual(result.toJSON(), [
          { title: 'Tyrael', count: 1 },
          { title: 'Leah', count: 2 },
        ]);
      });
  
      it('Model.findAll({ group: [] })', async () => {
        const result = await Post.findAll({
          attributes: 'count(*) AS count',
          group: [ 'title' ],
          order: [[ 'title', 'desc' ]],
        });
        assert.deepEqual(result.toJSON(), [
          { title: 'Tyrael', count: 1 },
          { title: 'Leah', count: 2 },
        ]);
      });
    });
  
    describe('Model.findAll({ having })', () => {
      beforeEach(async () => {
        await Promise.all([
          { title: 'Leah' },
          { title: 'Leah' },
          { title: 'Tyrael' },
        ].map(opts => Post.create(opts)));
      });
  
      it('Model.findAll({ having: string })', async () => {
        const result = await Post.findAll({
          attributes: 'count(*) AS count',
          group: 'title',
          order: [[ 'title', 'desc' ]],
          having: 'count(*) = 2'
        });
        assert.deepEqual(result.toJSON(), [
          { title: 'Leah', count: 2 },
        ]);
      });
  
      it('Model.findAll({ having: rawObject })', async () => {
        const result = await Post.findAll({
          attributes: 'count(*) AS count',
          group: 'title',
          order: [[ 'title', 'desc' ]],
          having: new Raw('count(*) = 2')
        });
  
        assert.deepEqual(result.toJSON(), [
          { title: 'Leah', count: 2 },
        ]);
      });
    });
  });

  describe('=> findAndCountAll', () => {
    it('Model.findAndCountAll()', async () => {
      await Promise.all([
        { title: 'Leah', createdAt: new Date(Date.now() - 1000) },
        { title: 'Tyrael' },
      ].map(opts => Post.create(opts)));
  
      const { rows, count } = await Post.findAndCountAll({
        where: {
          title: { $like: '%ea%' },
        },
      });
      assert.equal(rows.length, 1);
      assert.equal(count, 1);
      assert.equal(rows[0].title, 'Leah');
  
      // with limit
      const { rows: rows1, count: count1 } = await Post.findAndCountAll({
        where: {
          title: { $like: '%ea%' },
        },
        offset: 1,
        limit: 2,
      });
  
      assert.equal(rows1.length, 0);
      assert.equal(count1, 1);  
      //ignore attributes
  
      const { rows: rows2, count: count2 } = await Post.findAndCountAll({
        where: {
          title: { $like: '%ea%' },
        },
        attributes: [ 'id' ],
      });
  
      assert.equal(rows2.length, 1);
      assert.equal(count2, 1);
      assert.deepEqual(Object.keys((rows2[0] as any).getRaw()), [ 'id' ]);
    });
  
    it('Model.findAndCountAll(opt) with paranoid = false', async () => {
      await Promise.all([
        { title: 'Leah', createdAt: new Date(Date.now() - 1000) },
        { title: 'Tyrael' },
      ].map(opts => Post.create(opts)));
      await Post.destroy({ where: { title: 'Leah' } });
      const post = await Post.findOne({ where: { title: 'Leah' } });
      assert.equal(post, null);
      const post1 = await Post.findOne({ where: { title: 'Leah' }, paranoid: false });
      assert.equal(post1.title, 'Leah');
  
      const { rows, count } = await Post.findAndCountAll({
        where: {
          title: { $like: '%ea%' },
        },
        paranoid: false,
      });
      assert.equal(rows.length, 1);
      assert.equal(count, 1);
      assert.equal(rows[0].title, 'Leah');
    });
  });

  describe('=> findOne', () => {
    it('Model.findOne(id)', async () => {
      const { id } = await Post.create({ title: 'Leah' });
  
      const post = await Post.findOne();
      assert.equal(post.title, 'Leah');
  
      // if passed value, take the value as primary key
      assert.deepEqual((await Post.findOne(id)).toJSON(), post.toJSON());
  
      // if passed null or undefined, return null
      assert.equal(await Post.findOne(null as any), null);
      assert.equal(await Post.findOne(undefined), null);
    });
  
    it('Model.findOne(id) with paranoid = false', async () => {
      const { id } = await Post.create({ title: 'Leah' });
  
      const post = await Post.findOne();
      assert.equal(post.title, 'Leah');
      await post.remove();
      const post1 = await Post.findOne();
      assert.equal(post1, null);
      const post2 = await Post.findOne({ paranoid: false });
      assert.equal(post2.isNewRecord, false);
      assert(post2);
  
      const post3 = await Post.findOne({ where: { id }, paranoid: false });
      assert.equal(post3.title, 'Leah');
      assert.equal(post3.isNewRecord, false);
      await post3.destroy({ force: true });
      const post4 = await Post.findOne({ where: { id }, paranoid: false });
      assert.equal(post4, null);
    });
  });

  describe('=> findByPk', () => {
    it('Model.findByPk(pk)', async () => {
      const { id } = await Post.create({ title: 'Leah' });
  
      const post = await Post.findByPk(id);
      assert.equal(post.title, 'Leah');
      assert.equal(post.isNewRecord, false);
    });
  
    it('Model.findByPk(pk, { paranoid: false })', async () => {
      const { id } = await Post.create({ title: 'Leah' });
  
      const post = await Post.findByPk(id);
      assert.equal(post.title, 'Leah');
  
      await post.remove();
      const post1 = await Post.findByPk(id);
      assert.equal(post1, null);
  
      const post2 = await Post.findByPk(id, { paranoid: false });
      assert.equal(post2.title, 'Leah');
      await post2.destroy({ force: true });
      const post3 = await Post.findOne({ where: { id }, paranoid: false });
      assert.equal(post3, null);
    });
  });

  describe('=> findOrBuild', () => {
    it('Model.findOrBuild()', async function() {
      const { id } = await Post.create({ title: 'Leah' });
      const [ post, isNewRecord ] = await Post.findOrBuild({
        where: { title: 'Leah' },
      });
      assert.equal(post.id, id);
      assert.equal(isNewRecord, false);
    });
  
    it('Model.findOrBuild({ defaults })', async function() {
      const { id } = await Post.create({ title: 'Leah' });
      const [ post, isNewRecord ] = await Post.findOrBuild({
        where: { title: 'Tyrael' },
        defaults: { isPrivate: 1 },
      });
      assert.notEqual(post.id, id);
      assert.equal(post.id, null);
      assert.equal(post.isPrivate, true);
      assert.equal(isNewRecord, true);
    });
  });

  describe('=> findOrCreate', () => {
    it('Model.findOrCreate()', async function() {
      const { id } = await Post.create({ title: 'Leah' });
      const [ post, isNewRecord ] = await Post.findOrCreate({
        where: { title: 'Leah' },
      });
      assert.equal(post.id, id);
      assert.equal(isNewRecord, false);
    });
  
    it('Model.findOrCreate({ defaults })', async function() {
      const { id } = await Post.create({ title: 'Leah' });
      const [ post, isNewRecord ] = await Post.findOrCreate({
        where: { title: 'Tyrael' },
        defaults: { content: 'I am Justice itself!' },
      });
      assert.notEqual(post.id, id);
      assert.notEqual(post.id, null);
      assert.equal(post.title, 'Tyrael');
      assert.equal(post.content, 'I am Justice itself!');
      assert.equal(isNewRecord, true);
      assert.equal(await Post.count(), 2);
    });
  });

  describe('=> findCreateFind', () => {
    it('Model.findCreateFind()', async function() {
      const p1 = await Post.create({ title: 'Leah' });
      const p2 = await Post.findCreateFind({
        where: { id: p1.id },
        defaults: { id: 1, title: 'Tyrael' },
      });
      assert.equal(p2.id, p1.id);
      assert.equal(p2.title, 'Leah');
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
      let post = await Post.find();
      assert.ok(post!.title);

      let posts = await Post.findAll();
      posts = posts.sort((a, b) => (a.id - b.id) as unknown as number);

      post = await Post.find({
        where: {
          title: {
            $in: [ 'Leah', 'Cain', 'Nephalem' ]
          }
        },
        order: {
          id: 'asc',
        }
      });
      assert.equal(post!.id, posts[0].id);
    });

    it('Post.where()', async function() {
      const posts = await Post.where({ title: { $like: '%a%' } }).select('title');
      assert.equal(posts.length, 3);
    });
  });

  describe('=> Scope', () => {
    class MyPost extends Post {};

    it('addScope', () => {
      MyPost.addScope('dk', {
        where: {
          title: 'Yhorm',
        },
        order: [ 'id', 'desc' ],
      });
      assert.ok(typeof (MyPost as any)._scopes.dk === 'function');
      const scope = (MyPost as any)._scopes.dk;
      MyPost.addScope('dk', {
        where: {
          title: 'Lothric',
        },
        order: [ 'id', 'desc' ],
      }, { override: true });
      assert.ok(typeof (MyPost as any)._scopes.dk === 'function');
      assert.notDeepEqual((MyPost as any)._scopes.dk, scope);
    });

    it('setScope', () => {
      MyPost.addScope('dk', {
        where: {
          title: 'Yhorm',
        },
        order: [ 'id', 'desc' ],
      });

      MyPost.addScope('bd', {
        where: {
          title: 'Yhorm1',
        },
        order: {
          title: 'asc',
        },
      });

      MyPost.setScope('bd');

      assert.deepEqual((MyPost as any)._scopes.bd, (MyPost as any)._scope);

      MyPost.setScope({
        where: {
          title: 'Yhorm2',
        },
        order: {
          id: 'asc',
        },
      });

      assert.notDeepEqual((MyPost as any)._scopes.bd, (MyPost as any)._scope);
      assert.notDeepEqual((MyPost as any)._scopes.dk, (MyPost as any)._scope);

      const prevScope = (MyPost as any)._scope;

      MyPost.setScope(() => ({
        where: {
          title: 'Yhorm2',
        },
        order: {
          id: 'asc',
        },
      }));

      assert.notDeepEqual((MyPost as any)._scopes.bd, (MyPost as any)._scope);
      assert.notDeepEqual((MyPost as any)._scopes.dk, (MyPost as any)._scope);
      assert.notDeepEqual((MyPost as any)._scope, prevScope);
    });

    it('scope', () => {
      MyPost.addScope('dk', {
        where: {
          title: 'Yhorm',
        },
        order: [ 'id', 'desc' ],
      });

      MyPost.addScope('bd', {
        where: {
          title: 'Yhorm1',
        },
        order: {
          title: 'asc',
        },
      });

      let Scopped = MyPost.scope('bd');

      assert.deepEqual((MyPost as any)._scopes.bd, (Scopped as any)._scope);

      Scopped = MyPost.scope({
        where: {
          title: 'Yhorm2',
        },
        order: {
          id: 'asc',
        },
      });

      assert.notDeepEqual((MyPost as any)._scopes.bd, (Scopped as any)._scope);
      assert.notDeepEqual((MyPost as any)._scopes.dk, (Scopped as any)._scope);

      const prevScope = (Scopped as any)._scope;

      Scopped = MyPost.scope(() => ({
        where: {
          title: 'Yhorm2',
        },
        order: {
          id: 'asc',
        },
      }));

      assert.notDeepEqual((MyPost as any)._scopes.bd, (Scopped as any)._scope);
      assert.notDeepEqual((MyPost as any)._scopes.dk, (Scopped as any)._scope);
      assert.notDeepEqual((MyPost as any)._scope, prevScope);

      assert.equal(
        MyPost.scope((title, order, limit) => {
          return {
            where: {
              title
            },
            order,
            limit
          };
        }, 1, 'title desc', 10).where({ title: 'New Post' }).toString(),
        'SELECT * FROM \`articles\` WHERE \`title\` = \'New Post\' AND \`title\` = \'1\' AND \`gmt_deleted\` IS NULL ORDER BY \`title\` DESC LIMIT 10'
      );

      // array should work
      const scopes = [{
        where: {
          id: 1,
        },
      }, {
        where: {
          author_id: 1
        }
      }];
      assert.equal(
        MyPost.scope(scopes).where({ title: 'New Post' }).toString(),
        'SELECT * FROM \`articles\` WHERE \`title\` = \'New Post\' AND \`id\` = 1 AND \`author_id\` = 1 AND \`gmt_deleted\` IS NULL'
      );

      MyPost.addScope('custom', (order, limit, thumb) => {
        return {
          where: {
            thumb,
          },
          order,
          limit,
        };
      });

      assert.equal(
        MyPost.scope('custom', 'id desc', 1, 'Yhorm').where({ title: 'New Post' }).toString(),
        'SELECT * FROM \`articles\` WHERE \`title\` = \'New Post\' AND \`thumb\` = \'Yhorm\' AND \`gmt_deleted\` IS NULL ORDER BY \`id\` DESC LIMIT 1'
      );

    });

    it('unscoped', () => {
      MyPost.addScope('dk', {
        where: {
          title: 'Yhorm',
        },
        order: [ 'id', 'desc' ],
      });

      const Scopped = MyPost.scope('dk');

      assert.ok(!!(MyPost as any)._scopes.dk);
      assert.deepEqual((MyPost as any)._scopes.dk, (Scopped as any)._scope);

      const Scopped1 = Scopped.unscoped();
      assert.ok(!(Scopped1 as any)._scope);

    });
  });

  describe('=> Hook', () => {
    it('addHook', async () => {
      let probe = false;
      let instance;
      Post.addHook('afterCreate', 'createdAfter', (obj) => {
        probe = true;
        instance = obj;
      });

      const post = await Post.create({ title: 'Yhorm' });
      assert.equal(probe, true);
      assert.deepEqual(instance, post);
    });
  });

  describe('=> aggregate', () => {
    it('aggregate', async () => {
      await Promise.all([
        await Book.create({ name: 'Book of Tyrael', price: 20 }),
        await Book.create({ name: 'Book of Cain', price: 10 }),
      ]);
  
      const count = await Book.aggregate('*', 'count');
      assert.equal(count, 2);
  
      const average = await Book.aggregate('price', 'average');
      assert.equal(Math.round(average), 15);
  
      let minimum = await Book.aggregate('price', 'minimum');
      assert.equal(Math.round(minimum), 10);

      minimum = await Book.aggregate('price', 'MINIMUM');
      assert.equal(Math.round(minimum), 10);

      const count1 = await Book.aggregate('*', 'count', {
        where: {
          price: { $gt: 10 },
        },
      });
      assert.equal(count1, 1);
    });
  });

  describe('=> Build', () => {
    it('build', () => {
      const post = Post.build({ title: 'Yhorm', thumb: 'yes' }, { isNewRecord: true });
      assert.equal(post.title, 'Yhorm');
      assert.equal(post.thumb, 'yes');
      assert.equal(post.isNewRecord, true);
      const post1 = Post.build({ title: 'Yhorm', thumb: 'yes' });
      assert.equal(post1.isNewRecord, true);
      const post2 = Post.build({ title: 'Yhorm', thumb: 'yes' }, { isNewRecord: false });
      assert.equal(post2.isNewRecord, false);
    });

    it('bulkBuild', () => {
      const posts = Post.bulkBuild([{
        title: 'Yhorm',
        thumb: 'yes',
      }, {
        title: 'Yhorm',
        thumb: 'yes',
      }]);

      assert.equal(posts.length, 2);
      assert.ok(posts.every(p => p.isNewRecord && p.title === 'Yhorm'));

      const posts1 = Post.bulkBuild([{
        title: 'Yhorm',
        thumb: 'yes',
      }, {
        title: 'Yhorm',
        thumb: 'yes',
      }], { isNewRecord: false });

      assert.equal(posts1.length, 2);
      assert.ok(posts1.every(p => !p.isNewRecord && p.title === 'Yhorm'));
    });
  });

  describe('=> Count', () => {
    it('Model.count()', async () => {
      await Promise.all([
        Post.create({ title: 'By three they come' }),
        Post.create({ title: 'By three thy way opens' }),
      ]);
      assert.equal(await Post.count(), 2);
    });

    it('Model.count(name)', async () => {
      await Promise.all([
        Post.create({ title: 'By three they come' }),
        Post.create({ title: 'By three thy way opens' }),
      ]);
      assert.equal(await Post.count('title'), 2);
    });
  
    it('Model.count({ paranoid: false })', async () => {
      await Promise.all([
        Post.create({ title: 'By three they come' }),
        Post.create({ title: 'By three thy way opens' }),
      ]);
      assert.equal(await Post.count(), 2);
      await Post.destroy({ where: { title: 'By three they come' } });
      assert.equal(await Post.count(), 1);
      assert.equal(await Post.count({ paranoid: false }), 2);
    });
  
    it('Model.count({ where })', async () => {
      await Promise.all([
        Post.create({ title: 'By three they come' }),
        Post.create({ title: 'By three thy way opens' }),
      ]);
      const result = await Post.count({
        where: { title: 'By three they come' },
      });
      assert.equal(result, 1);
    });
  
    it('Model.count({ where, paranoid: false })', async () => {
      const books = await Promise.all([
        Post.create({ title: 'By three they come' }),
        Post.create({ title: 'By three thy way opens' }),
      ]);
      const result = await Post.count({
        where: { title: 'By three they come' },
      });
      assert.equal(result, 1);
      await books[0].destroy();
      const result1 = await Post.count({
        where: { title: 'By three they come' },
      });
      assert.equal(result1, 0);
      const result2 = await Post.count({
        where: { title: 'By three they come' },
        paranoid: false,
      });
      assert.equal(result2, 1);
  
      await books[0].destroy({ force: true });
      const result3 = await Post.count({
        where: { title: 'By three they come' },
        paranoid: false,
      });
      assert.equal(result3, 0);
    });
  });

  describe('=> Model.find({ hint })', () => {
    it('findOne', () => {
      assert.equal(
        Post.findOne({ where: { id: 1 }, hint: new Hint('SET_VAR(foreign_key_checks=OFF)') }).toString(),
        'SELECT /*+ SET_VAR(foreign_key_checks=OFF) */ * FROM `articles` WHERE `id` = 1 AND `gmt_deleted` IS NULL LIMIT 1'
      );
    });
  
    it('findByPk', () => {
      assert.equal(
        Post.findByPk(1, { hint: new Hint('SET_VAR(foreign_key_checks=OFF)') }).toString(),
        'SELECT /*+ SET_VAR(foreign_key_checks=OFF) */ * FROM `articles` WHERE `id` = 1 AND `gmt_deleted` IS NULL LIMIT 1'
      );
    });
  
    it('findAll', () => {
      assert.equal(
        Post.findAll({ where: { id: 1 }, hint: new Hint('SET_VAR(foreign_key_checks=OFF)') }).toString(),
        'SELECT /*+ SET_VAR(foreign_key_checks=OFF) */ * FROM `articles` WHERE `id` = 1 AND `gmt_deleted` IS NULL'
      );
    });
  });

  describe('=> Num', () => {
    it('Model.max(attribute)', async () => {
      await Promise.all([
        await Book.create({ name: 'Book of Tyrael', price: 20 }),
        await Book.create({ name: 'Book of Cain', price: 10 }),
      ]);
      assert.equal(await Book.max('price'), 20);
    });
  
    it('Model.max(attribute, { where })', async () => {
      await Promise.all([
        await Book.create({ name: 'Book of Tyrael', price: 20 }),
        await Book.create({ name: 'Book of Cain', price: 10 }),
      ]);
      const max = await Book.max('price', {
        where: { name: 'Book of Cain' },
      });
      assert.equal(max, 10);
    });
  
    it('Model.max(attribute, { paranoid })', async () => {
      const books = await Promise.all([
        await Book.create({ name: 'Book of Tyrael', price: 20 }),
        await Book.create({ name: 'Book of Cain', price: 10 }),
      ]);
      assert.equal(await Book.max('price'), 20);
      await books[0].destroy();
      assert.equal(await Book.max('price'), 10);
      assert.equal(await Book.max('price', { paranoid: false }), 20);
      await books[0].destroy({ force: true });
      assert.equal(await Book.max('price', { paranoid: false }), 10);
    });
  
    it('Model.min(attribute)', async () => {
      await Promise.all([
        await Book.create({ name: 'Book of Tyrael', price: 20 }),
        await Book.create({ name: 'Book of Cain', price: 10 }),
      ]);
      assert.equal(await Book.min('price'), 10);
    });
  
    it('Model.min(attribute, { where })', async () => {
      await Promise.all([
        await Book.create({ name: 'Book of Tyrael', price: 20 }),
        await Book.create({ name: 'Book of Cain', price: 10 }),
      ]);
      Post.find().decrement('authorId')
      const min = await Book.min('price', {
        where: { name: 'Book of Tyrael' },
      });
      assert.equal(min, 20);
    });
  
    it('Model.max(attribute, { paranoid })', async () => {
      const books = await Promise.all([
        await Book.create({ name: 'Book of Tyrael', price: 20 }),
        await Book.create({ name: 'Book of Cain', price: 10 }),
      ]);
      assert.equal(await Book.min('price'), 10);
      await books[1].destroy();
      assert.equal(await Book.min('price'), 20);
      assert.equal(await Book.min('price', { paranoid: false }), 10);
      await books[1].destroy({ force: true });
      assert.equal(await Book.min('price', { paranoid: false }), 20);
    });
  
    it('Model.sum(attribute)', async () => {
      await Promise.all([
        await Book.create({ name: 'Book of Tyrael', price: 20 }),
        await Book.create({ name: 'Book of Cain', price: 10 }),
      ]);
      assert.equal(await Book.sum('price'), 30);
    });
  
    it('Model.sum(attribute, { where })', async () => {
      await Promise.all([
        await Book.create({ name: 'Book of Tyrael', price: 20 }),
        await Book.create({ name: 'Book of Cain', price: 10 }),
      ]);
      const sum = await Book.sum('price', {
        where: { name: 'Book of Cain' },
      });
      assert.equal(sum, 10);
    });
  
    it('Model.sum(attribute, { paranoid })', async () => {
      const books = await Promise.all([
        await Book.create({ name: 'Book of Tyrael', price: 20 }),
        await Book.create({ name: 'Book of Cain', price: 10 }),
      ]);
      assert.equal(await Book.sum('price'), 30);
      await books[0].destroy();
      assert.equal(await Book.sum('price'), 10);
      assert.equal(await Book.sum('price', { paranoid: false }), 30);
  
      await books[0].destroy({ force: true });
      assert.equal(await Book.sum('price', { paranoid: false }), 10);
  
    });
  
    it('Model.increment()', async () => {
      const isbn = BigInt(9787550616950);
      const fakeDate = new Date(`2012-12-14 12:00:00`).getTime();
      const book = await Book.create({ isbn, name: 'Book of Cain', price: 10 });
      assert.notEqual(new Date(book.updatedAt).toString(), new Date(fakeDate).toString());
      const clock = sinon.useFakeTimers(fakeDate);
      await Book.increment('price', { where: { isbn } });
      await book.reload();
      assert.equal(book.price, 11);
      assert.equal(new Date(book.updatedAt).toString(), new Date(fakeDate).toString());
  
      await Book.increment({ price: 2 }, { where: { isbn } });
      await book.reload();
      assert.equal(book.price, 13);
      clock.restore();
    });
  
    it('Model.increment(, { paranoid })', async () => {
      const isbn = BigInt(9787550616950);
      const fakeDate = new Date(`2012-12-14 12:00:00`).getTime();
      const book = await Book.create({ isbn, name: 'Book of Cain', price: 10 });
      assert.notEqual(new Date(book.updatedAt).toString(), new Date(fakeDate).toString());
      const clock = sinon.useFakeTimers(fakeDate);
      await Book.increment('price', { where: { isbn } });
      await book.reload();
      assert.equal(book.price, 11);
      assert.equal(new Date(book.updatedAt).toString(), new Date(fakeDate).toString());
      clock.restore();
  
      await Book.increment({ price: 2 }, { where: { isbn } });
      await book.reload();
      assert.equal(book.price, 13);
  
      await book.destroy();
      await Book.increment({ price: 2 }, { where: { isbn } });
      await book.reload();
      assert.equal(book.price, 13);
      await Book.increment({ price: 2 }, { where: { isbn }, paranoid: false });
      await book.reload();
      assert.equal(book.price, 15);
    });
  
    it('Model.increment(, { silent })', async () => {
      const fakeDate = new Date(`2012-12-14 12:00-08:00`).getTime();
      const clock = sinon.useFakeTimers(fakeDate);
      const isbn = BigInt(9787550616950);
      const book = await Book.create({ isbn, name: 'Book of Cain', price: 10 });
      assert.equal(new Date(book.updatedAt).toString(), new Date(fakeDate).toString());
      clock.restore();
      await Book.increment('price', { where: { isbn }, silent: true });
      await book.reload();
      assert.equal(book.price, 11);
      assert.equal(new Date(book.updatedAt).toString(), new Date(fakeDate).toString());
    });

    it('Model.decrement()', async () => {
      const isbn = BigInt(9787550616950);
      const book = await Book.create({ isbn, name: 'Book of Cain', price: 10 });
      await Book.decrement('price', { where: { isbn } });
      await book.reload();
      assert.equal(book.price, 9);
  
      await Book.decrement({ price: 2 }, { where: { isbn } });
      await book.reload();
      assert.equal(book.price, 7);
    });
  });

  describe('=> Update', function() {
    it('Post.update()', async function() {
      await Post.bulkCreate([
        { title: 'Leah' },
        { title: 'Cain' },
      ]);
      await Post.update( { title: 'Diablo' }, { where: { title: 'Leah' } });
      assert.equal(await Post.findOne({ where: { title: 'Leah' }}), null);
      assert.equal((await Post.findOne({ where: { title: 'Cain' }})).title, 'Cain');
      assert.equal((await Post.findOne({ where: { title: 'Diablo' }})).title, 'Diablo');
    });

    it('post.update()', async function() {
      const post = await Post.create({ title: 'Tyrael' });
      assert.equal(post.title, 'Tyrael');
      const result = await post.update({ title: 'Stranger' });
      assert.equal(result, 1);
      await post.reload();
      assert.equal(post.title, 'Stranger');
      const result1 = await post.update({ title: 'Stranger', content: 'Yhorm' }, {
        fields: [ 'content' ],
      });
      assert.equal(result1, 1);
      await post.reload();
      assert.equal(post.title, 'Stranger');
      assert.equal(post.content, 'Yhorm');
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
      assert.equal((await Post.findAll()).length, 1);
      assert.equal((await Post.findOne()).title, 'Leah');
    });

    it('post.remove()', async function() {
      const post = await Post.create({ title: 'Untitled' });
      await post.remove();
      assert.equal((await Post.findAll()).length, 0);
    });

    it('spell.delete()', async function() {
      const [ post, post2 ] = await Post.bulkCreate([
        { title: 'Leah', wordCount: 20 },
        { title: 'Cain', wordCount: 10 },
      ]);

      const result = await Post.where({ title: 'Leah' }).delete();
      assert.equal(result.affectedRows, 1);

      assert.equal(await Post.count(), 1);
      assert.equal((await Post.findOne()).title, 'Cain');
    });
  });

  describe('=> Destroy', () => {
    it('Bone.destroy()', async () => {
      await Promise.all([
        Post.create({ title: 'By three they come' }),
        Post.create({ title: 'By three thy way opens' }),
      ]);
      const rowCount = await Post.destroy();
      assert.equal(rowCount, 2);
    });

    it('Bone.destroy({ force })', async () => {
      await Promise.all([
        Post.create({ title: 'By three they come' }),
        Post.create({ title: 'By three thy way opens' }),
      ]);
      const rowCount = await Post.destroy({ force: true });
      assert.equal(rowCount, 2);
    });

    it('bone.destroy()', async () => {
      const post = await Post.create({ title: 'By three they come' });
      class PostExtend extends Post {
        subType?: string;
      }

      const p1: PostExtend = await post.destroy() as Post;
      p1.subType = 'extend';
      assert.equal(p1.id, post.id);
    });
  })

  it('Model.removeAttribute()', async function() {
    assert(Like.attributes.userId);
    Like.removeAttribute('userId');
    assert(Like.attributes.userId == null);
  });

  it('transaction support pass null', async function() {
    const post = await Post.create({ title: 'By three they come' }, { transaction: null });
    const result = await Post.find({
      where: {
        title: 'By three they come',
      },
      transaction: null,
    });
    assert.equal(result!.id, post.id);
  });
});
