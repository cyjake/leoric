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
        isEmail: true
      }
    },
    nickname: {
      type: DataTypes.STRING(256),
      allowNull: false,
      validate: {
        isNumeric: false,
      }
    },
    meta: {
      type: DataTypes.JSON,
    },
    status: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
      validate: {
        isNumeric: true,
        isIn: {
          args: [ '1', '2' ],
          msg: 'Error status',
        },
      }
    },
    desc: {
      type: DataTypes.STRING,
      validate: {
        isValid() {
          if (this.desc.length < 2) {
            throw new Error('Invalid desc');
          }
        },
        lengthMax(value) {
          if (value.length >= 10) {
            return false;
          }
        }
      }
    },
    fingerprint: {
      type: DataTypes.TEXT,
    }
  };

  class User extends Bone {}
  User.init(attributes);

  before(async function() {
    await connect({
      models: [ User ],
      database: 'leoric',
      user: 'root',
      port: process.env.MYSQL_PORT,
    });
  });

  after(async () => {
    await User.remove({}, true);
    Bone.driver = null;
  });

  it('is** true', async () => {
    await assert.rejects(async () => {
      await User.create({
        email: 'sss',
        nickname: 's'
      });
    }, /Validation isEmail on email failed/);
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
    }, /Validation on desc failed/);

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
      desc: '222'
    });
    assert(user);
  });
});