'use strict';

const { Bone, DataTypes } = require('../..');

class User extends Bone {
  get isValid() {
    return this.status === 1;
  }
};

// test init
User.init({
  id: DataTypes.BIGINT,
  gmt_create: DataTypes.DATE,
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
  }
}, {}, {
  isValid: {
    get() {
      return this.status !== 1;
    }
  }
})

module.exports = User;
