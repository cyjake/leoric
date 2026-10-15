'use strict';

const assert = require('assert').strict;
const fs = require('fs');
const path = require('path');
const Realm = require('../../src');

const AsyncFunction = Object.getPrototypeOf(async function() {}).constructor;
const root = path.resolve(__dirname, '../..');

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

function blocks(file) {
  return Array.from(read(file).matchAll(/```js\r?\n([\s\S]*?)```/g), match => match[1]);
}

describe('documented database examples', function() {
  let realm;
  let Post;

  beforeEach(async function() {
    realm = new Realm({ dialect: 'sqlite', database: ':memory:', connectionLimit: 1, subclass: true });
    Post = realm.define('Post', { title: Realm.DataTypes.STRING });
    await realm.sync();
    await Post.create({ title: 'New Post' });
  });

  afterEach(async function() {
    await realm.disconnect();
  });

  it('runs the README CRUD and association example on an isolated database', async function() {
    const { INTEGER, STRING } = realm.DataTypes;
    await realm.driver.addColumn('posts', 'author_id', { type: INTEGER });
    await realm.driver.createTable('users', { id: { type: INTEGER, primaryKey: true } });
    await realm.driver.createTable('comments', {
      id: { type: INTEGER, primaryKey: true },
      post_id: INTEGER,
      content: STRING,
    });
    // Use the configured in-memory realm instead of the documentation's example host.
    const example = blocks('Readme.md')[0]
      .replace(/^import .*$/m, '')
      .replace(/^const realm = new Realm.*$/m, '');
    const { main, Post: ExamplePost } = await new AsyncFunction('realm', 'Bone',
      `${example}\nreturn { main, Post };`)(realm, realm.Bone);
    await main();
    assert.equal(await ExamplePost.where({ title: 'New Post' }).count(), 0);
    assert.equal(await ExamplePost.where({ title: 'Untitled' }).count(), 2);
    assert.equal(ExamplePost.associations.author.Model.name, 'User');
  });

  for (const language of ['', 'zh/']) {
    const prefix = `docs/${language}`;

    it(`${prefix}raw-query returns the requested model instance`, async function() {
      const example = blocks(`${prefix}raw-query.md`).find(code => code.includes('model: Post'));
      const post = await new AsyncFunction('realm', 'Post', `${example}\nreturn post;`)(realm, Post);
      assert.ok(post instanceof Post);
      assert.equal(post.title, 'New Post');
    });

    it(`${prefix}basics removes a single model instance`, async function() {
      const Shop = realm.define('Shop', { name: Realm.DataTypes.STRING });
      await Shop.sync();
      await Shop.create({ name: 'Barracks' });
      const example = blocks(`${prefix}basics.md`).find(code => code.includes('await shop.remove(true)'));
      await new AsyncFunction('Shop', example)(Shop);
      assert.equal(await Shop.count(), 0);
    });

    it(`${prefix}migrations backfills existing rows without changing the new-row default`, async function() {
      await realm.driver.createTable('users', { id: { type: Realm.DataTypes.INTEGER, primaryKey: true } });
      await realm.query('INSERT INTO users (id) VALUES (?)', [1]);
      const example = blocks(`${prefix}migrations.md`).find(code => code.includes('wants_marketing_email'));
      const migration = { exports: {} };
      new Function('module', example)(migration);
      await migration.exports.up(realm.driver, realm.DataTypes);
      await realm.query('INSERT INTO users (id) VALUES (?)', [2]);
      const { rows } = await realm.query('SELECT wants_marketing_email FROM users ORDER BY id');
      assert.deepEqual(rows.map(row => row.wants_marketing_email), [1, 0]);
      await migration.exports.down(realm.driver, realm.DataTypes);
      const columns = await realm.driver.describeTable('users');
      assert.equal(columns.wants_marketing_email, undefined);
    });

    it(`${prefix}transactions aborts when the external operation fails`, async function() {
      const example = blocks(`${prefix}transactions.md`).find(code => code.includes('someExternalService'));
      await assert.rejects(
        new AsyncFunction('Bone', 'Post', 'someExternalService', example)(
          realm.Bone, Post, async () => ({ ok: false })
        ),
        /External operation failed|外部操作失败/,
      );
      assert.equal(await Post.count(), 1);
    });

    it(`${prefix}querying reads an ungrouped count as a number`, async function() {
      const example = blocks(`${prefix}querying.md`).find(code => code.includes('this.body = { posts, count }'));
      const Shop = realm.define('Shop', { title: Realm.DataTypes.STRING });
      await Shop.sync();
      await Shop.create({ title: 'Post King' });
      const context = {};
      await new AsyncFunction('Post', example).call(context, Shop);
      assert.equal(context.body.count, 1);
    });
  }
});
