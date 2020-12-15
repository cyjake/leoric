'use strict';

const { Bone, DataTypes } = require('../..');

class User extends Bone {};

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
    allowNull: false,
    type: DataTypes.INTEGER,
    defaultValue: 1,
  }
})

module.exports = User;
