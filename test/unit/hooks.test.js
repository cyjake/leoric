'use strict';

const assert = require('assert').strict;
const { connect } = require('../..');
const { Bone, DataTypes, sequelize } = require('../..');

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

describe('hooks', function() {
  const Spine = sequelize(Bone);

  describe('create', async () => {
    class User extends Bone {
      constructor(opts) {
        super(opts);
      }
    }
    User.init(attributes, {
      hooks: {
        beforeCreate(obj) {
          if (!obj.email) {
            obj.email = 'hello@yo.com';
          }
        },
        afterCreate(obj){
          console.log(obj);
          obj.status = 10;
        }
      }
    });

    beforeEach(async () => {
      await connect({
        port: process.env.MYSQL_PORT,
        user: 'root',
        database: 'leoric',
        models: [ User ],
      });
    });

    afterEach(async () => {
      await User.remove({}, true);
      Bone.driver = null;
    });

    it('create', async () => {
      const user = await User.create({ nickname: 'testy', meta: { foo: 1, bar: 'baz'}, status: 1 });
      assert(user.email === 'hello@yo.com');
      assert(user.meta.foo === 1);
      assert(user.status === 10);
    });

    it('create skip hooks', async () => {
      assert.rejects(async () => {
        await User.create({ nickname: 'testy', meta: { foo: 1, bar: 'baz'}, status: 1 }, { hooks: false });
      });
    }, /Error: ER_NO_DEFAULT_FOR_FIELD: Field 'email' doesn't have a default value/);

  });

  describe('update', () => {
    class User extends Bone {
      constructor(opts) {
        super(opts);
      }
    }
    User.init(attributes, {
      hooks: {
        beforeUpdate(obj, opts) {
          if (opts.email) {
            opts.email = 'ho@y.com';
          }
        },
        afterUpdate(obj) {
          if (typeof obj === 'object') {
            obj.status = 11;
          }
        },
      }
    });

    beforeEach(async () => {
      await connect({
        port: process.env.MYSQL_PORT,
        user: 'root',
        database: 'leoric',
        models: [ User ],
      });
    });

    afterEach(async () => {
      await User.remove({}, true);
      Bone.driver = null;
    });

    it('update', async () => {
      const user = await User.create({ nickname: 'tim', email: 'h@h.com' ,meta: { foo: 1, bar: 'baz'}, status: 1 });
      assert(user.email === 'h@h.com');
      assert.equal(user.nickname, 'tim');
      await user.update({
        email: 'jik@y.com',
      });
      assert.equal(user.email, 'ho@y.com');
      assert.equal(user.status, 11);
    });

    it('update skip hooks', async () => {
      const user = await User.create({ nickname: 'tim', email: 'h@h.com' ,meta: { foo: 1, bar: 'baz'}, status: 1 });
      assert(user.email === 'h@h.com');
      assert.equal(user.nickname, 'tim');
      await user.update({
        email: 'jik@y.com',
      }, { hooks: false });
      assert.equal(user.email, 'jik@y.com');
      assert.equal(user.status, 1);
    });

    it('static update', async () => {
      const user = await User.create({ nickname: 'tim', email: 'h@h.com' ,meta: { foo: 1, bar: 'baz'}, status: 1 });
      assert(user.email === 'h@h.com');
      assert.equal(user.nickname, 'tim');
      await User.update({
        id: user.id,
      }, {
        nickname: 'Jimmy'
      });
      const updatedUser = await User.findOne({
        id: user.id,
      });
      assert.equal(updatedUser.nickname, 'Jimmy');
    });

    it('static update skip hooks', async () => {
      const user = await User.create({ nickname: 'tim', email: 'h@h.com' ,meta: { foo: 1, bar: 'baz'}, status: 1 });
      assert(user.email === 'h@h.com');
      assert.equal(user.nickname, 'tim');
      await User.update({
        id: user.id,
      }, {
        nickname: 'Jimmy'
      }, { hooks: false });
      const updatedUser = await User.findOne({
        id: user.id,
      });
      assert.equal(updatedUser.nickname, 'Jimmy');
      assert.equal(user.status, 1);
    });
  });

  describe('remove', () => {
    class User extends Bone {
      constructor(opts) {
        super(opts);
      }
    }

    let beforeProbe;
    let afterProbe;
    User.init(attributes, {
      hooks: {
        beforeRemove(obj) {
          if (obj.email) {
            obj.email = 'ho@y.com';
          }
          beforeProbe = 'before';
        },
        afterRemove(obj) {
          if (typeof obj === 'object') {
            obj.status = 11;
          }
          afterProbe = 'after';
        }
      }
    });

    beforeEach(async () => {
      await connect({
        port: process.env.MYSQL_PORT,
        user: 'root',
        database: 'leoric',
        models: [ User ],
      });
    });

    afterEach(async () => {
      await User.remove({}, true);
      Bone.driver = null;
      beforeProbe = null;
      afterProbe = null;
    });

    it('remove', async () => {
      const user = await User.create({ nickname: 'tim', email: 'h@h.com' ,meta: { foo: 1, bar: 'baz'}, status: 1 });
      assert(user.email === 'h@h.com');
      assert.equal(user.nickname, 'tim');
      await user.remove();
      assert.equal(user.email, 'ho@y.com');
      assert.equal(user.status, 11);
      const updatedUser = await User.findOne({
        id: user.id,
      });
      assert(!updatedUser);
      assert(beforeProbe === 'before');
      assert(afterProbe === 'after');

    });

    it('remove skip hooks', async () => {
      const user = await User.create({ nickname: 'tim', email: 'h@h.com' ,meta: { foo: 1, bar: 'baz'}, status: 1 });
      assert(user.email === 'h@h.com');
      assert.equal(user.nickname, 'tim');
      await user.remove(true, { hooks: false });
      assert.equal(user.email, 'h@h.com');
      assert.equal(user.status, 1);
      assert(!beforeProbe);
      assert(!afterProbe);
    });

    it('static remove', async () => {
      const user = await User.create({ nickname: 'tim', email: 'h@h.com' ,meta: { foo: 1, bar: 'baz'}, status: 1 });
      assert(user.email === 'h@h.com');
      assert.equal(user.nickname, 'tim');
      await User.remove({
        id: user.id,
      });
      const updatedUser = await User.findOne({
        id: user.id,
      });
      assert(!updatedUser);
      assert(beforeProbe === 'before');
      assert(afterProbe === 'after');
    });

    it('static remove skip hooks', async () => {
      const user = await User.create({ nickname: 'tim', email: 'h@h.com' ,meta: { foo: 1, bar: 'baz'}, status: 1 });
      assert(user.email === 'h@h.com');
      assert.equal(user.nickname, 'tim');
      await User.remove({
        id: user.id,
      }, true, { hooks: false });
      const updatedUser = await User.findOne({
        id: user.id,
      });
      assert(!updatedUser);
      assert(!beforeProbe);
      assert(!afterProbe);
    });
  });

  describe('upsert', () => {
    class User extends Bone {
      constructor(opts) {
        super(opts);
      }
    }

    let beforeProbe;
    let afterProbe;
    User.init(attributes, {
      hooks: {
        beforeUpsert(obj) {
          obj.desc = 'jimmydaddy';
          beforeProbe = 'before';
        },
        afterUpsert(obj) {
          if (typeof obj === 'object') {
            obj.status = 11;
          }
          afterProbe = 'after';
        }
      }
    });

    beforeEach(async () => {
      await connect({
        port: process.env.MYSQL_PORT,
        user: 'root',
        database: 'leoric',
        models: [ User ],
      });
    });

    afterEach(async () => {
      await User.remove({}, true);
      Bone.driver = null;
      beforeProbe = null;
      afterProbe = null;
    });

    it('upsert', async () => {
      const user = await User.create({ nickname: 'tim', email: 'h@h.com' ,meta: { foo: 1, bar: 'baz'}, status: 1 });
      assert.equal(user.email, 'h@h.com');
      user.nickname = 'hell';
      user.status = 2;
      user.email = 'ho@y.com';
      await user.upsert();
      assert.equal(user.email, 'ho@y.com');
      // after hook effect
      assert.equal(user.status, 11);
      // before hook effect
      assert.equal(user.desc, 'jimmydaddy');
      assert(beforeProbe === 'before');
      assert(afterProbe === 'after');
      const updatedUser = await User.findOne({
        id: user.id,
      });
      assert.equal(updatedUser.email, 'ho@y.com');
      assert.equal(updatedUser.status, 2);
      assert.equal(updatedUser.nickname, 'hell');
    });

    it('upsert skip hooks', async () => {
      const user = await User.create({ nickname: 'tim', email: 'h@h.com' ,meta: { foo: 1, bar: 'baz'}, status: 1 });
      assert.equal(user.email, 'h@h.com');
      assert.equal(user.nickname, 'tim');
      user.email = 'ho@y.com';
      user.nickname = 'hell';
      user.status = 2;
      await user.upsert({ hooks: false });
      assert.equal(user.email, 'ho@y.com');
      assert.equal(user.status, 2);
      assert(!user.desc);
      const updatedUser = await User.findOne({
        id: user.id,
      });
      assert.equal(updatedUser.email, 'ho@y.com');
      assert.equal(updatedUser.status, 2);
      assert.equal(updatedUser.nickname, 'hell');

      assert(!beforeProbe);
      assert(!afterProbe);
    });
  });

  describe('destroy', () => {
    class User extends Spine {
      constructor(opts) {
        super(opts);
      }
    }

    let beforeProbe;
    let afterProbe;
    User.init(attributes, {
      hooks: {
        beforeDestroy(obj) {
          if (obj.email) {
            obj.email = 'ho@y.com';
          }
          beforeProbe = 'before';
        },
        afterDestroy(obj) {
          if (typeof obj === 'object') {
            obj.status = 11;
          }
          afterProbe = 'after';
        },
        beforeBulkDestroy() {
          beforeProbe = 'before';
        },
        afterBulkDestroy() {
          afterProbe = 'after';
        }
      }
    });

    beforeEach(async () => {
      await connect({
        port: process.env.MYSQL_PORT,
        user: 'root',
        database: 'leoric',
        models: [ User ],
      });
    });

    afterEach(async () => {
      await User.remove({}, true);
      Bone.driver = null;
      beforeProbe = null;
      afterProbe = null;
    });

    it('destroy', async () => {
      const user = await User.create({ nickname: 'tim', email: 'h@h.com' ,meta: { foo: 1, bar: 'baz'}, status: 1 });
      assert(user.email === 'h@h.com');
      assert.equal(user.nickname, 'tim');
      await user.destroy();
      assert.equal(user.email, 'ho@y.com');
      assert.equal(user.status, 11);
      const updatedUser = await User.findOne(user.id);
      assert(!updatedUser);
      assert(beforeProbe === 'before');
      assert(afterProbe === 'after');

    });

    it('destroy skip hooks', async () => {
      const user = await User.create({ nickname: 'tim', email: 'h@h.com' ,meta: { foo: 1, bar: 'baz'}, status: 1 });
      assert(user.email === 'h@h.com');
      assert.equal(user.nickname, 'tim');
      await user.destroy(true, { hooks: false });
      assert.equal(user.email, 'h@h.com');
      assert.equal(user.status, 1);
      assert(!beforeProbe);
      assert(!afterProbe);
    });

    it('static destroy', async () => {
      const user = await User.create({ nickname: 'tim', email: 'h@h.com' ,meta: { foo: 1, bar: 'baz'}, status: 1 });
      assert(user.email === 'h@h.com');
      assert.equal(user.nickname, 'tim');
      await User.destroy({
        id: user.id,
      });
      const updatedUser = await User.findOne(user.id);
      assert(!updatedUser);
      assert(beforeProbe === 'before');
      assert(afterProbe === 'after');
    });

    it('static destroy skip hooks', async () => {
      const user = await User.create({ nickname: 'tim', email: 'h@h.com' ,meta: { foo: 1, bar: 'baz'}, status: 1 });
      assert(user.email === 'h@h.com');
      assert.equal(user.nickname, 'tim');
      await User.destroy({
        id: user.id,
      }, { hooks: false });
      const updatedUser = await User.findOne(user.id);
      assert(!updatedUser);
      assert(!beforeProbe);
      assert(!afterProbe);
    });
  });

  describe('addHooks', () => {

    describe('hook', () => {
      class User extends Spine {
        constructor(opts) {
          super(opts);
        }
      }
      User.init(attributes);

      beforeEach(async () => {
        await connect({
          port: process.env.MYSQL_PORT,
          user: 'root',
          database: 'leoric',
          models: [ User ],
        });
      });

      afterEach(async () => {
        await User.remove({}, true);
        Bone.driver = null;
      });

      it('create hooks', async () => {
        let beforeProbe;
        User.addHook('beforeCreate', 'test', (obj) => {
          beforeProbe = 'before';
          obj.email = 'ji@i.com';
        });
        let afterProbe;
        User.addHook('afterCreate', 'test', (obj) => {
          afterProbe = 'after';
        });
        const user = await User.create({ nickname: 'tim', email: 'h@h.com' ,meta: { foo: 1, bar: 'baz'}, status: 1 });
        assert.equal(user.email, 'ji@i.com');
        assert.equal(beforeProbe, 'before');
        assert.equal(afterProbe, 'after');
        beforeProbe = null;
        afterProbe = null;
        // skip hook should work
        const user1 = await User.create({ nickname: 'tim', email: 'hy@h.com' ,meta: { foo: 1, bar: 'baz'}, status: 1 }, { hooks: false });
        assert.equal(user1.email, 'hy@h.com');
        assert.equal(beforeProbe, null);
        assert.equal(afterProbe, null);
      });

      it('update hooks', async () => {
        let beforeProbe;
        User.addHook('beforeUpdate', 'test', (obj) => {
          beforeProbe = 'before';
          obj.email = 'hello@i.com';
        });
        let afterProbe;
        User.addHook('afterUpdate', (obj) => {
          afterProbe = 'after';
        });
        const user = await User.create({ nickname: 'tim', email: 'h@h.com' ,meta: { foo: 1, bar: 'baz'}, status: 1 });
        await User.update({
          nickname: 'jim'
        }, {
          where: {
            id: user.id,
          }
        });
        const updatedUser = await User.findOne(user.id);
        assert.equal(updatedUser.email, 'hello@i.com');
        assert.equal(updatedUser.nickname, 'jim');
        assert.equal(beforeProbe, 'before');
        assert.equal(afterProbe, 'after');
        // skip hook should work
        beforeProbe = null;
        afterProbe = null;
        await User.update({
          nickname: 'jim1'
        }, {
          where: {
            id: user.id,
          }
        }, { hooks: false });
        const updatedUser1 = await User.findOne(user.id);

        assert.equal(updatedUser1.email, 'hello@i.com');
        assert.equal(updatedUser1.nickname, 'jim1');
        assert.equal(beforeProbe, null);
        assert.equal(afterProbe, null);
      });

      it('remove hooks', async () => {
        let beforeProbe;
        User.addHook('beforeRemove', 'test', (obj) => {
          beforeProbe = 'before';
        });
        let afterProbe;
        User.addHook('afterRemove', 'test', (obj) => {
          afterProbe = 'after';
        });
        const user = await User.create({ nickname: 'tim', email: 'h@h.com' ,meta: { foo: 1, bar: 'baz'}, status: 1 });
        await User.remove({
          id: user.id,
        });
        const updatedUser = await User.findOne(user.id);
        assert(!updatedUser);
        assert.equal(beforeProbe, 'before');
        assert.equal(afterProbe, 'after');
        // skip hook should work
        beforeProbe = null;
        afterProbe = null;
        const user1 = await User.create({ nickname: 'tim', email: 'h@h.com' ,meta: { foo: 1, bar: 'baz'}, status: 1 });
        assert(user1);
        await User.remove({
          id: user1.id,
        }, false, { hooks: false });
        const updatedUser1 = await User.findOne(user1.id);

        assert(!updatedUser1);
        assert.equal(beforeProbe, null);
        assert.equal(afterProbe, null);
      });

      it('upsert hooks', async () => {
        let beforeProbe;
        User.addHook('beforeUpsert', 'test', (obj) => {
          beforeProbe = 'before';
        });
        let afterProbe;
        User.addHook('afterUpsert', 'test', (obj) => {
          afterProbe = 'after';
        });

        await User.upsert({ nickname: 'tim', email: 'h@h.com' ,meta: { foo: 1, bar: 'baz'}, status: 1 });
        const user = await User.findOne({
          where: {
            nickname: 'tim'
          }
        });

        assert.equal(user.email, 'h@h.com');
        assert.equal(beforeProbe, 'before');
        assert.equal(afterProbe, 'after');
         // skip hook should work
        beforeProbe = null;
        afterProbe = null;
        await User.upsert({ nickname: 'tim1', email: 'h1@h.com' ,meta: { foo: 1, bar: 'baz'}, status: 1 }, {}, { hooks: false });
        const user1 = await User.findOne({
          where: {
            nickname: 'tim1'
          }
        });
        assert.equal(user1.email, 'h1@h.com');
        assert.equal(beforeProbe, null);
        assert.equal(afterProbe, null);
      });

      it('bulkDestroy hooks', async () => {
        let beforeProbe;
        User.addHook('beforeBulkDestroy', 'test', (obj) => {
          beforeProbe = 'before';
        });
        let afterProbe;
        User.addHook('afterBulkDestroy', 'test', (obj) => {
          afterProbe = 'after';
        });

        await User.create({ nickname: 'tim', email: 'h@h.com' ,meta: { foo: 1, bar: 'baz'}, status: 1 }, { hooks: false });
        await User.destroy({
          where: {
            nickname: 'tim'
          }
        });

        assert.equal(beforeProbe, 'before');
        assert.equal(afterProbe, 'after');

        await User.create({ nickname: 'tim1', email: 'h1@h.com' ,meta: { foo: 1, bar: 'baz'}, status: 1 }, { hooks: false });

        // skip hook should work
        beforeProbe = null;
        afterProbe = null;

        await User.destroy({
          where: {
            nickname: 'tim1'
          }
        }, { hooks: false });

        assert.equal(beforeProbe, null);
        assert.equal(afterProbe, null);
      });

      it('destroy hooks', async () => {
        let beforeProbe;
        User.addHook('beforeDestroy', 'test', (obj) => {
          beforeProbe = 'before';
        });
        let afterProbe;
        User.addHook('afterDestroy', 'test', (obj) => {
          afterProbe = 'after';
        });

        const user = await User.create({ nickname: 'tim', email: 'h@h.com' ,meta: { foo: 1, bar: 'baz'}, status: 1 }, { hooks: false });
        await user.destroy();
        assert.equal(beforeProbe, 'before');
        assert.equal(afterProbe, 'after');

        await User.create({ nickname: 'tim1', email: 'h1@h.com' ,meta: { foo: 1, bar: 'baz'}, status: 1 }, { hooks: false });
        await User.destroy({
          where: {
            nickname: 'tim1'
          }
        });

        // skip hook should work
        beforeProbe = null;
        afterProbe = null;
        assert.equal(beforeProbe, null);
        assert.equal(afterProbe, null);
      });
    });

    describe('multiple hooks', () => {

      class User extends Spine {
        constructor(opts) {
          super(opts);
        }
      }
      let beforeProbe;
      let afterProbe;
      User.init(attributes, {
        hooks: {
          beforeCreate(obj) {
            if (obj.email) {
              obj.email = 'ho@y.com';
            }
            beforeProbe = 'before';
          },
          afterCreate(obj) {
            if (typeof obj === 'object') {
              obj.status = 11;
            }
            afterProbe = 'after';
          }
        }
      });

      beforeEach(async () => {
        await connect({
          port: process.env.MYSQL_PORT,
          user: 'root',
          database: 'leoric',
          models: [ User ],
        });
      });

      afterEach(async () => {
        await User.remove({}, true);
        Bone.driver = null;
        beforeProbe = null;
        afterProbe = null;
      });

      it('addHook should work', async () => {
        let innerProbe;
        User.addHook('beforeCreate', 'test', (obj) => {
          innerProbe = 'before';
        });
        const user = await User.create({ nickname: 'tim', email: 'h@h.com' ,meta: { foo: 1, bar: 'baz'}, status: 1 });
        // init hooks should work
        assert.equal(user.email, 'ho@y.com');
        assert.equal(beforeProbe, 'before');
        assert.equal(innerProbe, 'before');
        assert.equal(afterProbe, 'after');
        innerProbe = null;
        // skip hook should work
        const user1 = await User.create({ nickname: 'tim', email: 'h@h.com' ,meta: { foo: 1, bar: 'baz'}, status: 1 }, { hooks: false });
        assert.equal(user1.email, 'h@h.com');
        assert.equal(innerProbe, null);

      });
    });
  });
});
