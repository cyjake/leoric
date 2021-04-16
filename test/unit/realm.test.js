'use strict';

const assert = require('assert').strict;
const Realm = require('../..');
const { connect, Bone, DataTypes } = Realm;

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
  it('should export foundational modules', async () => {
    assert.ok(connect);
    assert.ok(Bone);
    assert.ok(DataTypes);
  });

  it('should subclass Bone unless specified by user', async () => {
    const realm = new Realm();
    assert.ok(realm.Bone.prototype instanceof Bone);

    const arda = new Realm({ Bone });
    assert.equal(arda.Bone, Bone);
  });

  it('should subclass with sequelize api if opts.sequelize', async () => {
    const realm = new Realm({ sequelize: true });
    const { Bone: Spine } = realm;
    assert.ok(typeof Spine.prototype.setDataValue === 'function');
  });

  it('should rename opts.db to opts.database', async () => {
    const realm = new Realm({ db: 'leoric' });
    assert.equal(realm.options.database, 'leoric');
  });

  it('should rename opts.storage to opts.database', async () => {
    const realm = new Realm({ dialect: 'sqlite', storage: '/tmp/leoric.sqlite3' });
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
      }
    });
    await realm.connect();
    await realm.query('SELECT 1');
    assert.equal(queries[0], 'SELECT 1');
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

  describe('transaction', () => {
    it('realm.transaction generator callback should work', async () => {
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
        await realm.transaction(function *({ connection }) {
          const sql = 'INSERT INTO users (gmt_create, email, nickname, status) VALUES (?, ?, ?, ?)';
          yield realm.query(sql, [ new Date(), email, 'Thor', 1 ], { connection });
          yield realm.query(sql, [ new Date(), email, 'Loki', 1 ], { connection });
        }); // rollback
      }, `Error: ER_DUP_ENTRY: Duplicate entry '${email}' for key 'users.email'`);
      const { rows } = await realm.query(`SELECT * FROM users WHERE email = '${email}'`);
      assert(rows.length === 0);
      assert(queries.includes('ROLLBACK'));
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

    describe('integration with bone', () => {
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
        assert(users.length === 0);
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
        const user1 = await User.create({ nickname: 'tim', email: 'h@h.com' ,meta: { foo: 1, bar: 'baz'}, status: 1 });
        await User.create({ nickname: 'tim1', email: 'h1@h.com' ,meta: { foo: 1, bar: 'baz'}, status: 1 });

        const user2 = new User({
          nickname: 'tim', email: 'h2@h.com', status: 1
        });

        await assert.rejects(async () => {
          await Bone.transaction(async ({ connection }) => {
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

        // TODO How to rollback value assigning ?
        user2.id = undefined;

        await assert.rejects(async () => {
          await Bone.transaction(async ({ connection }) => {
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
    });
  });
});
