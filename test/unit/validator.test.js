'use strict';

const assert = require('assert').strict;

const { connect, Bone, DataTypes } = require('../..');

describe('validator', () => {
  const attributes = {
    id: DataTypes.BIGINT,
    gmt_create: DataTypes.DATE,
    gmt_deleted: DataTypes.DATE,
    email: {
      type: DataTypes.STRING(256),
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
        is: '\\w+(@e.com)\\w{0}',
      }
    },
    nickname: {
      type: DataTypes.STRING(256),
      allowNull: false,
      validate: {
        isNumeric: false,
        notIn: [ [ 'Yhorm', 'Gwyn' ] ],
        notContains: 'closePease',
      }
    },
    meta: {
      type: DataTypes.JSON,
      validate: {
        hhh: true,
      }
    },
    status: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
      validate: {
        isNumeric: true,
        isIn: {
          args: [ [ '1', '2' ] ],
          msg: 'Error status',
        },
      }
    },
    desc: {
      type: DataTypes.STRING,
      validate: {
        notNull: true,
        notEmpty: true,
        isValid() {
          if (this.desc && this.desc.length < 2) {
            throw new Error('Invalid desc');
          }
        },
        lengthMax(value) {
          if (value && value.length >= 10) {
            return false;
          }
        },
        regex: /^\d{3}\w+/g,
      }
    },
    fingerprint: {
      type: DataTypes.TEXT,
      validate: {
        contains: 'finger',
        notRegex: /^\d{3}\w+/g,
        is: /\w+\d{2}$/g
      }
    }
  };

  class User extends Bone {}
  User.init(attributes);

  before(async function() {
    Bone.driver = null;
    await connect({
      models: [ User ],
      database: 'leoric',
      user: 'root',
      port: process.env.MYSQL_PORT,
    });
  });

  afterEach(async () => {
    await User.remove({}, true);
  });

  after(async () => {
    Bone.driver = null;
  });

  describe('rule', () => {
    it('is** true', async () => {
      await assert.rejects(async () => {
        await User.create({
          email: 'sss',
          nickname: 's',
        });
      }, /Validation isEmail on email failed/);
    });

    it('is** true', async () => {
      await assert.rejects(async () => {
        await User.create({
          email: 'sss@e.cn',
          nickname: 's',
        });
      }, /Validation is on email failed/);

      await User.create({
        email: 'sss@e.com',
        nickname: 's',
      });
    });


    it('is** false', async () => {
      await assert.rejects(async () => {
        await User.create({
          email: 'a@e.com',
          nickname: 1
        });
      }, /Validation isNumeric:false on nickname failed/);
      const user = await User.create({
        email: 'a@e.com',
        nickname: 'sss'
      });
      assert(user);
      assert(user.email);
      assert(user.nickname);
    });

    it('notNull', async () => {
      const user = new User({
        email: 'a@e.com',
        nickname: 'sss',
      });
      await user.save();
      user.nickname = null;
      await assert.rejects(async () => {
        await user.save();
      }, /Validation notNull on nickname failed/);
    });

    it('allowNull', async () => {
      await assert.rejects(async () => {
        await User.create({
          email: 'a@e.com',
          nickname: 'sss',
          desc: null,
        });
      }, /Validation notNull on desc failed/);
    });

    it('notIn', async () => {
      await assert.rejects(async () => {
        await User.create({
          email: 'a@e.com',
          nickname: 'Gwyn'
        });
      }, /Validation notIn on nickname failed/);
      const user = await User.create({
        email: 'a@e.com',
        nickname: 'sss'
      });
      assert(user);
      assert(user.email);
      assert(user.nickname);
    });

    it('notContaines', async () => {
      await assert.rejects(async () => {
        await User.create({
          email: 'a@e.com',
          nickname: 'hou closePease'
        });
      }, /Validation notContains on nickname failed/);
    });

    it('regex', async () => {
      await assert.rejects(async () => {
        await User.create({
          email: 'a@e.com',
          nickname: 'yes',
          desc: 'hhhawww'
        });
      }, /Validation regex on desc failed/);

      await User.create({
        email: 'a@e.com',
        nickname: 'yes',
        desc: '123hhha22'
      });
    });

    it('notRegex', async () => {
      await assert.rejects(async () => {
        await User.create({
          email: 'a@e.com',
          nickname: 'yes',
          fingerprint: '123yellowfingersss12',
        });
      }, /Validation notRegex on fingerprint failed/);

      await User.create({
        email: 'a@e.com',
        nickname: 'yes',
        fingerprint: 'yellofingerwsss12',
      });
    });

    it('is', async () => {
      await assert.rejects(async () => {
        await User.create({
          email: 'a@e.com',
          nickname: 'yes',
          fingerprint: 'yellowfingersss',
        });
      }, /Validation is on fingerprint failed/);

      await User.create({
        email: 'a@e.com',
        nickname: 'yes',
        fingerprint: 'yellofingerwsss12',
      });
    });

    it('notEmpty', async () => {
      await assert.rejects(async () => {
        await User.create({
          email: 'a@e.com',
          nickname: 'yes',
          desc: ''
        });
      }, /Validation notEmpty on desc failed/);

      await User.create({
        email: 'a@e.com',
        nickname: 'yes',
        desc: '123fin22',
      });
    });
  
    it('multiple validator and custom msg', async () => {
      await assert.rejects(async () => {
        await User.create({
          email: 'a@e.com',
          nickname: 'sss',
          status: 3
        });
      }, /Error status/);

      const user = await User.create({
        email: 'a2@e.com',
        nickname: 'sss',
        status: 1
      });
      assert(user);
    });

    it('custom validator', async () => {
      await assert.rejects(async () => {
        await User.create({
          email: 'a@e.com',
          nickname: 'sss',
          status: 1,
          desc: '2sjhhhsajhhsss'
        });
      }, /Validation lengthMax on desc failed/);

      await assert.rejects(async () => {
        await User.create({
          email: 'a@e.com',
          nickname: 'sss',
          status: 1,
          desc: '2'
        });
      }, /Invalid desc/);

      const user = await User.create({
        email: 'a1@e.com',
        nickname: 'sss1',
        status: 1,
        desc: '222www22'
      });
      assert(user);
    });

    it('contains', async () => {
      await assert.rejects(async () => {
        await User.create({
          email: 'a@e.com',
          nickname: 'sss',
          fingerprint: 'aaa12'
        });
      }, /Validation contains on fingerprint failed/);
      const user = await User.create({
        email: 'a1@e.com',
        nickname: 'sss1',
        fingerprint: 'fingerprints12'
      });
      assert(user);
    });

    it('should be a valid validator', async () => {
      await assert.rejects(async () => {
        await User.create({
          email: 'a@e.com',
          nickname: 'sss',
          status: 1,
          meta: {
            a: 1
          }
        });
      }, /Invalid validator function: hhh/);
    });
  });

  describe('create', () => {
    it('create(instance) should work', async () => {
      const user = new User({
        email: 'a@e.com',
        nickname: 'sss',
        fingerprint: 'aaa'
      });
      await assert.rejects(async () => {
        await user.create();
      }, /Validation contains on fingerprint failed/);
    });

    it('create(instance) skip validate should work', async () => {
      const user = new User({
        email: 'a@e.com',
        nickname: 'sss',
        fingerprint: 'aaa'
      });
      await user.create({ validate: false });
      assert(user.id);
    });
  });

  describe('update', () => {
    it('update(class) should work', async () => {
      const user = new User({
        email: 'a@e.com',
        nickname: 'sss',
        fingerprint: 'finger111'
      });
      await user.create();
      await assert.rejects(async () => {
        await User.update({ email: 'a@e.com', }, { fingerprint: 'aaa' });
      }, /Validation contains on fingerprint failed/);
      assert.equal(user.fingerprint, 'finger111');
    });

    it('update(class) skip validate should work', async () => {
      const user = new User({
        email: 'a@e.com',
        nickname: 'sss',
      });
      await user.create();
      await User.update({ email: 'a@e.com', }, { fingerprint: 'aaa' }, { validate: false });
      const user1 = await User.findOne({ email: 'a@e.com' });
      assert.equal(user1.fingerprint, 'aaa');
    });

    it('update(instance) should work', async () => {
      const user = new User({
        email: 'a@e.com',
        nickname: 'sss',
        fingerprint: 'finger111'
      });
      await user.create();
      await assert.rejects(async () => {
        await user.update({ fingerprint: 'aaa' });
      }, /Validation contains on fingerprint failed/);
      // fingerprint should not be assigned to 'aaa'
      assert.equal(user.fingerprint, 'finger111');
    });

    it('update(instance) skip validate should work', async () => {
      const user = new User({
        email: 'a@e.com',
        nickname: 'sss',
      });
      await user.create();
      await user.update({ fingerprint: 'aaa' }, { validate: false });
      assert.equal(user.fingerprint, 'aaa');
      const user1 = await User.findOne({ email: 'a@e.com' });
      assert.equal(user1.fingerprint, 'aaa');
    });
  });

  describe('save', () => {
    it('save should work', async () => {
      const user = new User({
        email: 'a@e.com',
        nickname: 'sss',
        fingerprint: 'aaa'
      });
      await assert.rejects(async () => {
        await user.save();
      }, /Validation contains on fingerprint failed/);
    });

    it('save with validate = false should work', async () => {
      const user = new User({
        email: 'a@e.com',
        nickname: 'sss',
        fingerprint: 'aaa'
      });
      await user.save({ validate: false });
      assert.equal(user.fingerprint, 'aaa');
      const user1 = await User.findOne({ email: 'a@e.com' });
      assert.equal(user1.fingerprint, 'aaa');
    });
  });

  describe('upsert', () => {
    it('upsert should work', async () => {
      const user = new User({
        email: 'a@e.com',
        nickname: 'sss',
        fingerprint: 'aaa'
      });
      await assert.rejects(async () => {
        await user.upsert();
      }, /Validation contains on fingerprint failed/);
    });

    it('upsert with validate = false should work', async () => {
      const user = new User({
        email: 'a@e.com',
        nickname: 'sss',
        fingerprint: 'aaa'
      });
      await user.upsert({ validate: false });
      assert(user.id);
      const user1 = await User.findOne({ email: 'a@e.com' });
      assert.equal(user1.fingerprint, 'aaa');
    });
  });

  describe('bulkCreate', () => {

    it('bulkCreate should work', async () => {
      let i = 0;
      const users = [];
      while (i < 10) {
        users.push({
          email: `a${i}@e.com`,
          nickname: `sss${i}`,
          fingerprint: 'aaa'
        });
        i ++;
      }

      await assert.rejects(async () => {
        await User.bulkCreate(users);
      }, /Validation contains on fingerprint failed/);
    });

    it('bulkCreate skip validate should work', async () => {
      let i = 0;
      const users = [];
      while (i < 10) {
        users.push({
          email: `a${i}@e.com`,
          nickname: `sss${i}`,
          fingerprint: 'aaa'
        });
        i ++;
      }

      await User.bulkCreate(users, { validate: false });

      const count = await User.count();
      assert.equal(count, 10);
    });

  });

  describe('executeValidator', () => {
    it('revert should work while validate faield', async () => {
      const user = await User.create({
        email: 'a@e.com',
        nickname: 'sss',
        desc: '231hjjj'
      });

      await assert.rejects(async () => {
        await user.update({
          desc: '1'
        });
      }, /Invalid desc/);

      assert(user.desc === '231hjjj');

      await user.update({
        desc: '121hhhh'
      });
      
      assert(user.getRawPrevious('desc') === '231hjjj');
    });
  });
});
