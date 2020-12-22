'use strict';

const { Bone, DataTypes } = require('../..');

const formatter = {
  formatName(value) {
    if (value) {
      return value.toUpperCase();
    }
    return value;
  }
}
class User extends Bone {
  constructor(opts) {
    super(opts);
  }
  get isValid() {
    return this.status === 1;
  }
}

Object.defineProperty(User, 'formatter', {
  get() {
    return formatter;
  },
});

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
  get isValid() {
    return this.status !== 1;
  },
  set nickname(value) {
    if (value === 'Zeus') {
      this.attribute('nickname', 'V');
    } else {
      const { formatter: format } = this.constructor;
      this.attribute('nickname', format.formatName(value));
    }
  },
})

module.exports = User;
