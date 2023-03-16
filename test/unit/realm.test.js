'use strict';

const assert = require('assert').strict;
const path = require('path');
const Realm = require('../../index');
const { connect, Bone, DataTypes, Logger, Spell, SqliteDriver, SequelizeBone } = Realm;

const attributes = {
  id: DataTypes.BIGINT,
  gmt_create: DataTypes.DATE,
  gmt_deleted: DataTypes.DATE,
  email: {
    type: DataTypes.STRING(256),
    allowNull: false,
    unique: true,
  },
  nickname: {
    type: DataTypes.STRING(256),
    allowNull: false,
  },
  meta: {
    type: DataTypes.JSON,
  },
  status: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1,
  },
  desc: {
    type: DataTypes.STRING,
  }
};

describe('=> Realm', () => {
  describe('exports', function() {
    it('should export foundational modules', async () => {
      assert.ok(connect);
      assert.ok(Bone);
      assert.ok(DataTypes);
      assert.ok(Logger);
      assert.ok(Spell);
    });
  });

  describe('constructor(opts)', function() {
    it('should not subclass Bone unless asked specifically', async () => {
      const arda = new Realm();
      assert.equal(arda.Bone, Bone);

      const realm = new Realm({ subclass: true });
      assert.ok(realm.Bone.prototype instanceof Bone);
    });

    it('should subclass with sequelize api if opts.sequelize', async () => {
      const realm = new Realm({ sequelize: true });
      const { Bone: Spine } = realm;
      assert.ok(typeof Spine.prototype.setDataValue === 'function');
      assert.equal(Spine, SequelizeBone);
    });

    it('should accept opts.Bone if it is subclass of Bone', async function() {
      class Spine extends Bone {}
      const realm = new Realm({ Bone: Spine });
      assert.ok(realm.Bone);
      assert.notEqual(realm.Bone, Bone);
      assert.equal(realm.Bone, Spine);
    });

    it('should rename opts.db to opts.database', async () => {
      const realm = new Realm({ db: 'leoric' });
      assert.equal(realm.options.database, 'leoric');
    });

    it('should rename opts.storage to opts.database', async () => {
      const realm = new Realm({ dialect: 'sqlite', storage: '/tmp/leoric.sqlite3' });
      assert.equal(realm.options.database, '/tmp/leoric.sqlite3');
    });

    it('should be able to switch client with opts.dialectModule', async () => {
      assert.throws(function() {
        new Realm({ dialectModulePath: 'maria' });
      }, /Cannot find module 'maria'/);

      const realm = new Realm({
        dialectModulePath: 'mysql2',
        host: 'localhost',
        port: process.env.MYSQL_PORT,
        user: 'root',
        database: 'leoric',
        models: path.resolve(__dirname, '../models')
      });
      assert.equal(realm.driver.pool.constructor.name, 'Pool');
    });

    it('should work with custom driver', async () => {
      class CustomDriver extends SqliteDriver {
      }
      const realm = new Realm({ driver: CustomDriver, storage: '/tmp/leoric.sqlite3' });
      assert.equal(realm.driver.type, 'sqlite');
      assert.equal(realm.driver.dialect, 'custom');
      assert.equal(realm.options.database, '/tmp/leoric.sqlite3');
    });

    it('should be able to customize logger with function', async () => {
      const queries = [];
      const realm = new Realm({
        port: process.env.MYSQL_PORT,
        user: 'root',
        database: 'leoric',
        logger(sql) {
          queries.push(sql);
        }
      });
      await realm.connect();
      await realm.driver.query('SELECT 1');
      assert.equal(queries[0], 'SELECT 1');
    });

    it('should be able to customize logger with object', async () => {
      const queries = [];
      const realm = new Realm({
        port: process.env.MYSQL_PORT,
        user: 'root',
        database: 'leoric',
        logger: {
          logQuery(sql) {
            queries.push(sql);
          }
        }
      });
      await realm.connect();
      await realm.driver.query('SELECT 1');
      assert.equal(queries[0], 'SELECT 1');
    });

    it('should reject if models option is not valid', async function() {
      await assert.rejects(async function() {
        const realm = new Realm({
          port: process.env.MYSQL_PORT,
          user: 'root',
          database: 'leoric',
          models: true,
        });
        await realm.connect();
      }, /Unexpected models dir/);
    });

    it('should hold models as object in realm.models', async function() {
      class User extends Bone {}
      class Post extends Bone {
        static table = 'articles'
      }
      const realm = new Realm({
        port: process.env.MYSQL_PORT,
        user: 'root',
        database: 'leoric',
        models: [ Post, User ],
      });
      assert.equal(Object.keys(realm.models).length, 2);
      assert.equal(realm.models.User, User);
      assert.equal(realm.models.Post, Post);
    });
  });

  describe('DataTypes', () => {
    it('invokable', () => {
      const realm = new Realm({ subclass: true });
      assert(realm.DataTypes.INTEGER.UNSIGNED);
      assert(realm.Bone.DataTypes.INTEGER.UNSIGNED instanceof DataTypes.INTEGER);
      assert(realm.Bone.DataTypes.INTEGER.ZEROFILL instanceof DataTypes.INTEGER);

      assert(realm.Bone.DataTypes.BIGINT.UNSIGNED instanceof DataTypes.INTEGER);
      assert(realm.Bone.DataTypes.BIGINT.ZEROFILL instanceof DataTypes.INTEGER);

      assert.equal(realm.Bone.DataTypes.INTEGER.UNSIGNED.unsigned, true);
      assert.equal(realm.Bone.DataTypes.BIGINT.UNSIGNED.unsigned, true);

      assert.equal(realm.Bone.DataTypes.INTEGER.ZEROFILL.zerofill, true);
      assert.equal(realm.Bone.DataTypes.BIGINT.ZEROFILL.zerofill, true);

    });
  });

  describe('realm.query', async () => {

    class Post extends Bone {
      static get table() {
        return 'articles';
      }
    }

    class User extends Bone {}
    User.init(attributes);

    afterEach(async () => {
      await Post.truncate();
      await User.truncate();
    });

    it('realm.query should work', async () => {
      const queries = [];
      const realm = new Realm({
        port: process.env.MYSQL_PORT,
        user: 'root',
        database: 'leoric',
        logger: {
          logQuery(sql) {
            queries.push(sql);
          }
        },
        models: [ User, Post ],
      });
      await realm.connect();
      await realm.query('SELECT 1');
      assert.equal(queries[1], 'SELECT 1');
    });

    it('realm.query bind to Model should work with mysql ', async () => {
      const realm = new Realm({
        port: process.env.MYSQL_PORT,
        user: 'root',
        database: 'leoric',
        models: [ User, Post ],
      });

      await realm.connect();
      const createdAt = new Date();
      const post = await Post.create({ title: 'title', authorId: 1, createdAt });
      const { rows } = await realm.query('SELECT * FROM articles', [], { model: Post });
      assert(rows.length === 1);
      assert(rows[0] instanceof Post);
      assert(post.authorId === rows[0].authorId);

      // work with join table
      const user = await User.create({ id: 1, nickname: 'userName', status: 1, email: 'aaa@h.com' });
      const { rows: rows1 } = await realm.query('SELECT Post.*, users.nickname as authorName FROM articles as Post LEFT JOIN users ON users.id = Post.author_id', [], { model: Post });
      assert(rows1.length === 1);
      assert(rows1[0] instanceof Post);
      assert(post.authorId === rows1[0].authorId);
      assert(user.nickname === rows1[0].authorName);
    });

    it('realm.query bind to Model should work with postgres', async () => {
      const realm = new Realm({
        dialect: 'postgres',
        host: process.env.POSTGRES_HOST || '127.0.0.1',
        port: process.env.POSTGRES_PORT,
        user: process.env.POSTGRES_USER || '',
        password: process.env.POSTGRES_PASSWORD || '',
        database: 'leoric',
        models: [ User, Post ],
      });

      await realm.connect();

      const createdAt = new Date();
      const post = await Post.create({ title: 'title', authorId: 1, createdAt });
      const { rows } = await realm.query('SELECT * FROM articles', [], { model: Post });
      assert(rows.length === 1);
      assert(rows[0] instanceof Post);
      assert(post.authorId === rows[0].authorId);

      // work with join table
      const user = await User.create({ id: 1, nickname: 'userName', status: 1, email: 'aaa@h.com' });
      const { rows: rows1 } = await realm.query('SELECT Post.*, users.nickname as authorName FROM articles as Post LEFT JOIN users ON users.id = Post.author_id', [], { model: Post });
      assert(rows1.length === 1);
      assert(rows1[0] instanceof Post);
      assert(post.authorId === rows1[0].authorId);
      // postgres cant use camelCase alias in raw query
      assert(user.nickname === rows1[0].authorname);
    });

    it('realm.query bind to Model should work with sqlite3', async () => {

      const realm = new Realm({
        dialect: 'sqlite',
        database: '/tmp/leoric.sqlite3',
        models: [ Post, User ],
      });

      await realm.connect();
      await Post.truncate();
      await User.truncate();

      const createdAt = new Date();
      const user = await User.create({ nickname: 'userName', status: 1, email: 'aaa@h.com' });
      const post = await Post.create({ title: 'title', authorId: user.id, createdAt });
      const { rows } = await realm.query('SELECT * FROM articles', [], { model: Post });
      assert.equal(rows.length, 1);
      assert(rows[0] instanceof Post);
      assert(post.authorId === rows[0].authorId);

      // work with join table
      const { rows: rows1 } = await realm.query('SELECT Post.*, users.nickname as authorName FROM articles as Post LEFT JOIN users ON users.id = Post.author_id', [], { model: Post });
      assert(rows1.length === 1);
      assert(rows1[0] instanceof Post);
      assert(post.authorId === rows1[0].authorId);
      assert(user.nickname === rows1[0].authorName);
    });

    describe('query with replacements', () => {
      it('should work with ?', async () => {
        const realm = new Realm({
          port: process.env.MYSQL_PORT,
          user: 'root',
          database: 'leoric',
          models: [ User, Post ],
        });

        await realm.connect();
        const createdAt = new Date();
        const post = await Post.create({ title: 'title', authorId: 1, createdAt });
        const post1 = await Post.create({ title: 'title1', authorId: 2, createdAt });
        const { rows } = await realm.query('SELECT * FROM articles where title = ?', ['title1'], { model: Post });
        assert(rows.length === 1);
        assert(rows[0] instanceof Post);
        assert(post1.authorId === rows[0].authorId);

        // work with join table
        const user = await User.create({ id: 1, nickname: 'userName', status: 1, email: 'aaa@h.com' });

        const { rows: rows1 } = await realm.query(`
        SELECT Post.*, users.nickname as authorName
          FROM articles as Post
          LEFT JOIN users
          ON users.id = Post.author_id
          WHERE users.id = ?
        `, [ user.id ], { model: Post });
        assert(rows1.length === 1);
        assert(rows1[0] instanceof Post);
        assert(post.authorId === rows1[0].authorId);
        assert(user.nickname === rows1[0].authorName);
      });

      it('should work with replacements object', async () => {
        const realm = new Realm({
          port: process.env.MYSQL_PORT,
          user: 'root',
          database: 'leoric',
          models: [ User, Post ],
        });

        await realm.connect();
        const createdAt = new Date();
        const post = await Post.create({ title: 'title', authorId: 1, createdAt });
        const post1 = await Post.create({ title: 'title1', authorId: 2, createdAt });
        const { rows } = await realm.query('SELECT * FROM articles where title = :title', {
          title: post1.title
        }, { model: Post });
        assert(rows.length === 1);
        assert(rows[0] instanceof Post);
        assert(post1.authorId === rows[0].authorId);

        // work with join table
        const user = await User.create({ id: 1, nickname: 'userName', status: 1, email: 'aaa@h.com' });

        const { rows: rows1 } = await realm.query(`
          SELECT Post.*, users.nickname as authorName
            FROM articles as Post
            LEFT JOIN users
            ON users.id = Post.author_id
            WHERE users.id = :userId
        `, {
          userId: user.id
        }, { model: Post });
        assert(rows1.length === 1);
        assert(rows1[0] instanceof Post);
        assert(post.authorId === rows1[0].authorId);
        assert(user.nickname === rows1[0].authorName);
      });

      it('should work with replacements and opts', async () => {
        const realm = new Realm({
          port: process.env.MYSQL_PORT,
          user: 'root',
          database: 'leoric',
          models: [ User, Post ],
        });

        await realm.connect();
        const createdAt = new Date();
        const post = await Post.create({ title: 'title', authorId: 1, createdAt });
        const post1 = await Post.create({ title: 'title1', authorId: 2, createdAt });
        const { rows } = await realm.query('SELECT * FROM articles where title = :title AND author_id = :authorId LIMIT :limit', {
          replacements: {
            title: post1.title,
            authorId: 2,
            limit: 1,
          },
          model: Post
        });
        assert(rows.length === 1);
        assert(rows[0] instanceof Post);
        assert(post1.authorId === rows[0].authorId);

        // work with join table
        const user = await User.create({ id: 1, nickname: 'userName', status: 1, email: 'aaa@h.com' });

        const { rows: rows1 } = await realm.query(`
        SELECT Post.*, users.nickname as authorName
          FROM articles as Post
          LEFT JOIN users
          ON users.id = Post.author_id
          WHERE users.id = :userId
          AND users.status = :status
        `, {
          replacements: {
            userId: user.id,
            status: 1
          },
          model: Post
        });
        assert(rows1.length === 1);
        assert(rows1[0] instanceof Post);
        assert(post.authorId === rows1[0].authorId);
        assert(user.nickname === rows1[0].authorName);
      });

      it('should work with empty args', async () => {
        const realm = new Realm({
          dialect: 'sqlite',
          database: '/tmp/leoric.sqlite3',
          models: [ Post ],
        });

        await realm.connect();

        const createdAt = new Date();
        await Post.create({ title: 'title', authorId: 1, createdAt });
        const { rows } = await realm.query('SELECT * FROM articles');
        assert(rows.length === 1);
      });

      it('should error', async () => {
        const realm = new Realm({
          port: process.env.MYSQL_PORT,
          user: 'root',
          database: 'leoric',
          models: [ User, Post ],
        });

        await realm.connect();
        const createdAt = new Date();
        const post1 = await Post.create({ title: 'title1', authorId: 2, createdAt });
        await assert.rejects(async () => {
          await realm.query('SELECT * FROM articles where title = :title AND author_id = :authorId', {
            title: post1.title
          }, { model: Post });
        }, /Error: unable to replace: authorId/);

        await assert.rejects(async () => {
          await realm.query('SELECT * FROM articles where title = :title AND author_id = :authorId', {
            replacements: {
              title: post1.title,
            }
          }, { model: Post });
        }, /Error: unable to replace: authorId/);

        await assert.rejects(async () => {
          await realm.query('SELECT * FROM articles where title = :title AND author_id = :authorId', {
            replacements: {
              title: post1.title,
              hello: 'ye'
            }
          }, { model: Post });
        }, /Error: unable to replace: authorId/);

        await assert.rejects(async () => {
            await realm.query('SELECT * FROM articles where title = :title', {
              replacements: null
            }, { model: Post });
        }, /Error: unable to replace: title/);

        await assert.rejects(async () => {
          await realm.query('SELECT * FROM articles where title = :title', null, { model: Post });
        }, /Error: unable to replace: title/);

      });
    });
  });

  describe('realm.escape', () => {

    it('MySQL', async() => {
      const realm = new Realm({
        port: process.env.MYSQL_PORT,
        user: 'root',
        database: 'leoric',
      });
      await realm.connect();
      assert(realm.escape('sss') === '\'sss\'');
    });

    it('postgres', async () => {
      const realm = new Realm({
        dialect: 'postgres',
        host: process.env.POSTGRES_HOST || '127.0.0.1',
        port: process.env.POSTGRES_PORT,
        user: process.env.POSTGRES_USER || '',
        password: process.env.POSTGRES_PASSWORD || '',
        database: 'leoric',
      });
      await realm.connect();
      assert(realm.escape('sss') === '\'sss\'');
    });

    it('sqlite', async () => {
      const realm = new Realm({
        dialect: 'sqlite',
        database: '/tmp/leoric.sqlite3',
      });
      await realm.connect();
      assert(realm.escape('sss') === '\'sss\'');
    });
  });

  describe('realm.transaction', () => {

    it('realm.transaction generator callback should work', async () => {
      const queries = [];
      const email = 'lighting@valhalla.ne';
      let result;
      const realm = new Realm({
        port: process.env.MYSQL_PORT,
        user: 'root',
        database: 'leoric',
        logger: {
          logQuery(sql) {
            queries.push(sql);
          }
        },
      });
      await realm.connect();
      // clean all prev data in users
      await realm.query('TRUNCATE TABLE users');
      await assert.rejects(async () => {
        result = await realm.transaction(function *({ connection }) {
          const sql = 'INSERT INTO users (gmt_create, email, nickname, status) VALUES (?, ?, ?, ?)';
          yield realm.query(sql, [ new Date(), email, 'Thor', 1 ], { connection });
          yield realm.query(sql, [ new Date(), email, 'Loki', 1 ], { connection });
        }); // rollback
      }, `Error: ER_DUP_ENTRY: Duplicate entry '${email}' for key 'users.email'`);
      const { rows } = await realm.query(`SELECT * FROM users WHERE email = '${email}'`);
      assert(rows.length === 0);
      assert(queries.includes('ROLLBACK'));
      assert(!result);
    });

    it('realm.transaction async callback should work', async () => {
      const queries = [];
      const email = 'lighting@valhalla.ne';
      const realm = new Realm({
        port: process.env.MYSQL_PORT,
        user: 'root',
        database: 'leoric',
        logger: {
          logQuery(sql) {
            queries.push(sql);
          }
        },
      });
      await realm.connect();
      // clean all prev data in users
      await realm.query('TRUNCATE TABLE users');
      await assert.rejects(async () => {
        await realm.transaction(async ({ connection }) => {
          const sql = 'INSERT INTO users (gmt_create, email, nickname, status) VALUES (?, ?, ?, ?)';
          await realm.query(sql, [ new Date(), email, 'Thor', 1 ], { connection });
          await realm.query(sql, [ new Date(), email, 'Loki', 1 ], { connection });
        }); // rollback
      }, `Error: ER_DUP_ENTRY: Duplicate entry '${email}' for key 'users.email'`);
      const { rows } = await realm.query(`SELECT * FROM users WHERE email = '${email}'`);
      assert(rows.length === 0);
      assert(queries.includes('ROLLBACK'));
    });

    it('realm.transaction async callback should work', async () => {
      const queries = [];
      const realm = new Realm({
        port: process.env.MYSQL_PORT,
        user: 'root',
        database: 'leoric',
        logger: {
          logQuery(sql) {
            queries.push(sql);
          }
        },
      });
      await realm.connect();
      // clean all prev data in users
      await realm.query('TRUNCATE TABLE users');
      await assert.rejects(async () => {
        await realm.transaction(async ({ connection }) => {
          const sql = 'INSERT INTO users (gmt_create, email, nickname, status) VALUES (?, ?, ?, ?)';
          await realm.query(sql, [ new Date(), 'lighting@valhalla.ne', 'Thor', 1 ], { connection });
          await realm.query(sql, [ new Date(), 'trick@valhalla.ne', 'Loki', 1 ], { connection });
          throw new Error('Odin Here');
        }); // rollback
      }, /Odin Here/);
      const { rows } = await realm.query('SELECT * FROM users');
      assert(rows.length === 0);
      assert(queries.includes('ROLLBACK'));
    });

    it('realm.transaction generator manual rollback should work', async () => {
      const queries = [];
      const email = 'lighting@valhalla.ne';
      let result;
      const realm = new Realm({
        port: process.env.MYSQL_PORT,
        user: 'root',
        database: 'leoric',
        logger: {
          logQuery(sql) {
            queries.push(sql);
          }
        },
      });
      await realm.connect();
      // clean all prev data in users
      await realm.query('TRUNCATE TABLE users');
      await assert.doesNotReject(async () => {
        result = await realm.transaction(function *({ connection, rollback }) {
          const sql = 'INSERT INTO users (gmt_create, email, nickname, status) VALUES (?, ?, ?, ?)';
          yield realm.query(sql, [ new Date(), email, 'Thor', 1 ], { connection });
          yield rollback(); // rollback
        });
      });
      const { rows } = await realm.query(`SELECT * FROM users WHERE email = '${email}'`);
      assert(rows.length === 0);
      assert(queries.includes('ROLLBACK'));
      assert(!result);
    });

    it('realm.transaction async manual rollback should work', async () => {
      const queries = [];
      const email = 'lighting@valhalla.ne';
      const realm = new Realm({
        port: process.env.MYSQL_PORT,
        user: 'root',
        database: 'leoric',
        logger: {
          logQuery(sql) {
            queries.push(sql);
          }
        },
      });
      await realm.connect();
      // clean all prev data in users
      await realm.query('TRUNCATE TABLE users');
      await assert.doesNotReject(async () => {
        await realm.transaction(async ({ connection, rollback }) => {
          const sql = 'INSERT INTO users (gmt_create, email, nickname, status) VALUES (?, ?, ?, ?)';
          await realm.query(sql, [ new Date(), email, 'Thor', 1 ], { connection });
          await rollback();
        }); // rollback
      });
      const { rows } = await realm.query(`SELECT * FROM users WHERE email = '${email}'`);
      assert(rows.length === 0);
      assert(queries.includes('ROLLBACK'));
    });

    it('realm.transaction async manual commit should work', async () => {
      const queries = [];
      const realm = new Realm({
        port: process.env.MYSQL_PORT,
        user: 'root',
        database: 'leoric',
        logger: {
          logQuery(sql) {
            queries.push(sql);
          }
        },
      });
      await realm.connect();
      // clean all prev data in users
      await realm.query('TRUNCATE TABLE users');
      await assert.rejects(async () => {
        await realm.transaction(async ({ connection, commit }) => {
          const sql = 'INSERT INTO users (gmt_create, email, nickname, status) VALUES (?, ?, ?, ?)';
          await realm.query(sql, [ new Date(), 'lighting@valhalla.ne', 'Thor', 1 ], { connection });
          await realm.query(sql, [ new Date(), 'trick@valhalla.ne', 'Loki', 1 ], { connection });
          await commit();
          throw new Error('Odin Here');
        }); // rollback
      }, /Odin Here/);
      const { rows } = await realm.query('SELECT * FROM users');
      assert(rows.length, 2);
      assert(queries.includes('COMMIT'));
    });

    it('realm.transaction generator manual commit should work', async () => {
      const queries = [];
      const realm = new Realm({
        port: process.env.MYSQL_PORT,
        user: 'root',
        database: 'leoric',
        logger: {
          logQuery(sql) {
            queries.push(sql);
          }
        },
      });
      await realm.connect();
      // clean all prev data in users
      await realm.query('TRUNCATE TABLE users');
      await assert.rejects(async () => {
        await realm.transaction(function *({ connection, commit }) {
          const sql = 'INSERT INTO users (gmt_create, email, nickname, status) VALUES (?, ?, ?, ?)';
          yield realm.query(sql, [ new Date(), 'lighting@valhalla.ne', 'Thor', 1 ], { connection });
          yield realm.query(sql, [ new Date(), 'trick@valhalla.ne', 'Loki', 1 ], { connection });
          yield commit();
          throw new Error('Odin Here');
        }); // rollback
      }, /Odin Here/);
      const { rows } = await realm.query('SELECT * FROM users');
      assert.equal(rows.length, 2);
      assert(queries.includes('COMMIT'));
    });

  });

  describe('realm.transaction (CRUD)', () => {
    class User extends Bone {}

    User.init(attributes);

    before(async () => {
      Bone.driver = null;
      await connect({
        port: process.env.MYSQL_PORT,
        user: 'root',
        database: 'leoric',
        models: [ User ],
      });
    });

    beforeEach(async () => {
      await User.truncate();
    });

    afterEach(async () => {
      await User.truncate();
    });

    it('should work with create', async () => {
      await assert.rejects(async () => {
        await Bone.transaction(async ({ connection }) => {
          await User.create({ nickname: 'tim', email: 'h@h.com' ,meta: { foo: 1, bar: 'baz'}, status: 1 }, { connection });
          await User.create({ nickname: 'tim', email: 'h@h.com' ,meta: { foo: 1, bar: 'baz'}, status: 1 }, { connection });
        });
      }, 'Error: ER_DUP_ENTRY: Duplicate entry \'h@h.com\' for key \'users.email\'');
      const users = await User.find();
      assert.equal(users.length, 0);
    });

    it('should work with update', async () => {
      const user1 = await User.create({ nickname: 'tim', email: 'h@h.com' ,meta: { foo: 1, bar: 'baz'}, status: 1 });
      await User.create({ nickname: 'tim1', email: 'h1@h.com' ,meta: { foo: 1, bar: 'baz'}, status: 1 });

      await assert.rejects(async () => {
        await Bone.transaction(async ({ connection }) => {
          await User.update({ email: 'h@h.com' }, { email: 'h1@h.com' }, { connection });
        });
      }, 'Error: ER_DUP_ENTRY: Duplicate entry \'h1@h.com\' for key \'users.email\'');

      const userRes = await User.findOne({
        nickname: 'tim'
      });
      assert(userRes.email === 'h@h.com');

      await user1.reload();

      await assert.rejects(async () => {
        await Bone.transaction(async ({ connection }) => {
          await user1.update({ email: 'h1@h.com' }, { connection });
        });
      }, 'Error: ER_DUP_ENTRY: Duplicate entry \'h1@h.com\' for key \'users.email\'');

      await user1.reload();

      assert(user1.email === 'h@h.com');

    });

    it('should work with save', async () => {
      const user1 = await User.create({ nickname: 'tim', email: 'h@h.com' ,meta: { foo: 1, bar: 'baz'}, status: 1 });
      await User.create({ nickname: 'tim1', email: 'h1@h.com' ,meta: { foo: 1, bar: 'baz'}, status: 1 });

      await assert.rejects(async () => {
        await Bone.transaction(async ({ connection }) => {
          user1.email = 'h22@h.com';
          await user1.save({ connection });
          throw new Error('lighting');
        });
      }, /lighting/);

      await user1.reload();

      assert(user1.email === 'h@h.com');
    });

    it('should work with remove', async () => {
      const user1 = await User.create({ nickname: 'tim', email: 'h@h.com' ,meta: { foo: 1, bar: 'baz'}, status: 1 });
      await User.create({ nickname: 'tim1', email: 'h1@h.com' ,meta: { foo: 1, bar: 'baz'}, status: 1 });

      await assert.rejects(async () => {
        await Bone.transaction(async ({ connection }) => {
          await user1.remove({ connection });
          throw new Error('lighting');
        });
      }, /lighting/);

      await user1.reload();

      assert(user1.email === 'h@h.com');

      await assert.rejects(async () => {
        await Bone.transaction(async ({ connection }) => {
          await User.remove({ nickname: 'tim' } , true, { connection });
          throw new Error('lighting');
        });
      }, /lighting/);

    });

    it('should work with upsert', async () => {
      const user1 = await User.create({ nickname: 'tim', email: 'h@h.com' ,meta: { foo: 1, bar: 'baz'}, status: 1 });
      await User.create({ nickname: 'tim1', email: 'h1@h.com' ,meta: { foo: 1, bar: 'baz'}, status: 1 });

      const user2 = new User({
        nickname: 'tim2', email: 'h@h.com', status: 1
      });

      await assert.rejects(async () => {
        await Bone.transaction(async ({ connection }) => {
          await user2.upsert({ connection });
          throw new Error('lighting');
        });
      }, /lighting/);

      const userRes = await User.findOne({
        nickname: 'tim2'
      });
      assert(!userRes);

      await user1.reload();
      assert(user1.nickname==='tim');
    });

    it('should work with find', async () => {
      const user1 = await User.create({ nickname: 'tim', email: 'h@h.com', meta: { foo: 1, bar: 'baz'}, status: 1 });
      await User.create({ nickname: 'tim1', email: 'h1@h.com', meta: { foo: 1, bar: 'baz'}, status: 1 });

      await assert.rejects(async () => {
        await Bone.transaction(async ({ connection }) => {
          const user2 = new User({ nickname: 'tim', email: 'h2@h.com', status: 1 });
          await user2.save({ connection });
          const users = await User.find({
            nickname: 'tim',
          }, { connection });
          if (users.length >= 2) {
            throw new Error('duplicated nickname');
          }
        });
      }, /duplicated nickname/);

      let userRes = await User.findOne({
        email: 'h2@h.com'
      });
      assert(!userRes);

      await assert.rejects(async () => {
        await Bone.transaction(async ({ connection }) => {
          const user2 = new User({ nickname: 'tim', email: 'h2@h.com', status: 1 });
          await user2.save({ connection });
          const users = await User.find([ user1.id, user2.id ], { connection });
          if (users.length >= 2 && users[0].nickname === 'tim' && users[1].nickname === 'tim') {
            throw new Error('duplicated nickname');
          }
        });
      }, /duplicated nickname/);

      userRes = await User.findOne({
        email: 'h2@h.com'
      });
      assert(!userRes);
    });

    it('should work with bulkCreate', async () => {
      await assert.rejects(async () => {
        await Bone.transaction(async ({ connection }) => {
          await User.bulkCreate([{
            nickname: 'Thor',
            email: 'lighting@valhalla.ne',
            status: 1
          }, {
            nickname: 'Loki',
            email: 'trick@valhalla.ne',
            status: 1
          }], { connection });
          const users = await User.find({}, { connection });
          if (users.length >= 2) {
            throw new Error('too many');
          }
        });
      }, /too many/);

      let all = await User.all;
      assert(all.length === 0);

      await assert.rejects(async () => {
        await Bone.transaction(async ({ connection }) => {
          await User.bulkCreate([{
            nickname: 'Thor',
            email: 'lighting@valhalla.ne',
            status: 1
          }, {
            nickname: 'Loki',
            email: 'trick@valhalla.ne',
            status: 1
          }], { connection, individualHooks: true });
          const users = await User.find({}, { connection });
          if (users.length >= 2) {
            throw new Error('too many');
          }
        });
      }, /too many/);

      all = await User.all;
      assert(all.length === 0);
    });

    it('should error with wrong type of callback', async () => {
      await assert.rejects(async () => {
        await Bone.transaction(({ connection }) => {
          console.log('should not be executed');
        });
      }, /Error: unexpected transaction function, should be GeneratorFunction or AsyncFunction./);
    });
  });

  describe('realm.define', () => {
    it('should work', async () => {
      const realm = new Realm({
        port: process.env.MYSQL_PORT,
        user: 'root',
        database: 'leoric',
        Bone: class extends Bone {},
      });

      const User = realm.define('User', {
        id: DataTypes.BIGINT,
        gmt_create: DataTypes.DATE,
        gmt_deleted: DataTypes.DATE,
        email: {
          type: DataTypes.STRING(256),
          allowNull: false,
          unique: true,
        },
        nickname: {
          type: DataTypes.STRING(256),
          allowNull: false,
        },
        meta: {
          type: DataTypes.JSON,
        },
        status: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 1,
        },
        desc: {
          type: DataTypes.STRING,
        },
        birthday: DataTypes.DATE,
        sex: DataTypes.STRING,
      });

      assert(realm.Bone.models.User);
      assert(realm.Bone.models.User === User);
    });
  });

  describe('realm.sync', function() {
    beforeEach(async function() {
      const realm = new Realm({
        port: process.env.MYSQL_PORT,
        user: 'root',
        database: 'leoric',
      });
      await realm.driver.dropTable('clients');
      await realm.driver.dropTable('recipients');
    });

    it('should be able to create tables', async function() {
      const realm = new Realm({
        port: process.env.MYSQL_PORT,
        user: 'root',
        database: 'leoric',
      });
      const Client = realm.define('Client', {
        id: DataTypes.BIGINT,
        name: DataTypes.STRING,
      });
      await realm.sync();
      const columns = await Client.describe();
      assert.deepEqual(Object.keys(columns), [ 'id', 'name', 'created_at', 'updated_at' ]);
    });

    it('should be not to alter tables if tables already exists', async function() {
      const realm = new Realm({
        port: process.env.MYSQL_PORT,
        user: 'root',
        database: 'leoric',
      });
      await realm.driver.createTable('clients', {
        id: DataTypes.BIGINT,
      });
      const Client = realm.define('Client', {
        id: DataTypes.BIGINT,
        name: DataTypes.STRING,
      });
      await realm.sync();
      const columns = await Client.describe();
      assert.deepEqual(Object.keys(columns), ['id']);
    });

    it('should alter work', async function() {
      const realm = new Realm({
        port: process.env.MYSQL_PORT,
        user: 'root',
        database: 'leoric',
      });
      await realm.driver.createTable('clients', {
        id: DataTypes.BIGINT,
      });
      await realm.driver.query('INSERT INTO clients (id) VALUES (1);');
      const Client = realm.define('Client', {
        id: DataTypes.BIGINT,
        name: DataTypes.STRING,
      });
      await realm.sync({ alter: true });
      const columns = await Client.describe();
      const { rows } = await realm.driver.query('SELECT * FROM clients');
      assert.deepEqual(Object.keys(columns), [ 'id', 'name', 'created_at', 'updated_at' ]);
      assert(rows.length === 1);
      assert(rows[0].id === 1);
      assert.deepEqual(Object.keys(rows[0]), [ 'id', 'name', 'created_at', 'updated_at' ]);
    });

    it('should force work', async function() {
      const realm = new Realm({
        port: process.env.MYSQL_PORT,
        user: 'root',
        database: 'leoric',
      });
      await realm.driver.createTable('clients', {
        id: DataTypes.BIGINT,
      });
      const Client = realm.define('Client', {
        id: DataTypes.BIGINT,
        name: DataTypes.STRING,
      });
      await realm.sync({ force: true });
      const columns = await Client.describe();
      assert.deepEqual(Object.keys(columns), [ 'id', 'name', 'created_at', 'updated_at' ]);
    });

    it('should not reset model associations after sync', async function() {
      const realm = new Realm({
        port: process.env.MYSQL_PORT,
        user: 'root',
        database: 'leoric',
      });

      class Client extends realm.Bone {
        static attributes = {
          id: DataTypes.BIGINT,
          name: DataTypes.STRING,
        }
        static initialize() {
          this.hasMany('recipients', { foreignKey: 'clientId' });
        }
      }

      class Recipient extends realm.Bone {
        static attributes = {
          id: DataTypes.BIGINT,
          clientId: DataTypes.BIGINT,
          name: DataTypes.STRING,
          address: DataTypes.STRING,
        }
        static initialize() {
          this.belongsTo('client', { foreignkey: 'clientId' });
        }
      }

      realm.models[Client.name] = Client;
      realm.models[Recipient.name] = Recipient;
      await realm.sync();
      assert.deepEqual(Object.keys(Recipient.associations), [ 'client' ]);

      const { id: clientId } = await Client.create({ name: 'Daisy & Friends' });
      await Recipient.create({ name: 'Daisy', address: 'Hangzhou, China', clientId });
      const client = await Client.first.with('recipients');
      assert.ok(client);
      assert.ok(Array.isArray(client.recipients));
      assert.equal(client.recipients.length, 1);
    });
  });

  describe('realm.raw', function() {
    it('should throw if sql is not string', function() {
      assert.throws(function() {
        const realm = new Realm({
          port: process.env.MYSQL_PORT,
          user: 'root',
          database: 'leoric',
        });
        realm.raw({});
      });
    });
  });

  describe('realm.connect', function() {
    /**
     * If models are cached and connected already, skip connecting them again because it would raise issues like duplicated associations or redundant class property definition etc.
     */
    it('should skip synchronized models', async function() {
      class User extends Bone {}
      const realm = new Realm({
        port: process.env.MYSQL_PORT,
        user: 'root',
        database: 'leoric',
        models: [ User ],
      });
      await realm.connect();

      await assert.doesNotReject(async function() {
        const realm2 = new Realm({
          port: process.env.MYSQL_PORT,
          user: 'root',
          database: 'leoric',
          models: [ User ],
        });
        await realm2.connect();
      });

      class Post extends Bone {
        static table = 'articles'
      }
      await assert.doesNotReject(async function() {
        const realm2 = new Realm({
          port: process.env.MYSQL_PORT,
          user: 'root',
          database: 'leoric',
          models: [ User, Post ],
        });
        await realm2.connect();
      });
      assert.ok(Post.synchronized);
    });

    it('should init attributes if attributes not defined', async function() {
      class User extends Bone {}
      const realm = new Realm({
        port: process.env.MYSQL_PORT,
        user: 'root',
        database: 'leoric',
        models: [ User ],
      });
      await realm.connect();
      assert.ok(User.attributes.createdAt);
      assert.equal(User.attributes.createdAt.columnName, 'gmt_create');
      // without adding extra timestamps
      assert.equal(User.attributes.updatedAt, undefined);
    });

    it('should rename legacy timestamp attributes', async function() {
      class Post extends Bone {
        static table = 'articles';
      }
      const realm = new Realm({
        port: process.env.MYSQL_PORT,
        user: 'root',
        database: 'leoric',
        models: [ Post ],
      });
      await realm.connect();
      assert.ok(Post.attributes.createdAt);
      assert.ok(Post.attributes.updatedAt);
      assert.ok(Post.attributes.deletedAt);
      assert.equal(Post.attributes.createdAt.columnName, 'gmt_create');
      assert.equal(Post.attributes.updatedAt.columnName, 'gmt_modified');
      assert.equal(Post.attributes.deletedAt.columnName, 'gmt_deleted');
    });

    it('should auto assign driver if not exist', async function () {

      class User extends Bone {}

      const realFilePath = require.resolve('../../src/bone');
      const boneRequireCache = require.cache[realFilePath];
      // delete bone cache
      delete require.cache[realFilePath];
      const MyBone = require('../../src/bone');
      class Bone1 extends MyBone {
        constructor (...args) {
          super(...args);
        }
      }

      class Post extends Bone1 {
        static table = 'articles';
      }

      // restore cache
      require.cache[realFilePath] = boneRequireCache;

      const realm = new Realm({
        port: process.env.MYSQL_PORT,
        user: 'root',
        database: 'leoric',
        models: [ Post, User ],
      });
      await realm.connect();
      assert.deepEqual(Post.driver, realm.Bone.driver);
      assert.deepEqual(Post.options, realm.options);
      assert.deepEqual(User.driver, realm.Bone.driver);
      assert.deepEqual(User.options, realm.options);
    });
  });

  describe('realm.DataTypes', function() {
    it('DataTypes should be invokable', async function() {
      const realm = new Realm({
        port: process.env.MYSQL_PORT,
        user: 'root',
        database: 'leoric',
      });
      await realm.connect();
      assert.equal(realm.DataTypes, DataTypes);
      const { STRING } = realm.DataTypes;
      const Note = realm.define('Note', {
        name: { type: STRING(255) },
      });
      await Note.sync({ force: true });
      await Note.create({ name: 'Link' });
    });
  });
});
