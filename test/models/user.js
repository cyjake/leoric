'use strict';

const { Bone, DataTypes } = require('../..');

const formatter = {
  formatName(value) {
    if (value) {
      return value.toUpperCase();
    }
    return value;
  }
};
class User extends Bone {
  constructor(opts) {
    super(opts);
  }
  get isValid() {
    return this.status === 1;
  }

  static get formatter() {
    return formatter;
  }
}

// test init
User.init({
  id: {
    primaryKey: true,
    type: DataTypes.BIGINT
  },
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
  },
  level: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1,
  },
  sex: {
    type: DataTypes.STRING,
  },
  birthday: {
    type: DataTypes.DATE,
  },
}, {}, {
  get isValid() {
    return this.status !== 1;
  },
  set nickname(value) {
    if (value === 'Zeus') {
      this.attribute('nickname', 'V');
    } else {
      this.attribute('nickname', this.constructor.formatter.formatName(value));
    }
  },
  set status(value = 0) {
    this.attribute('status', value - 2);
  },
  get status() {
    const status = this.attribute('status');
    return status + 2;
  }
});

module.exports = User;
