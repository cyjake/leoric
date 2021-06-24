'use strict';

const { Bone, DataTypes } = require('../..');

const CHARSET = 'abcdefghigklmnopqrstuvwxyz0123456789';

function uid() {
  let result = '';

  const charactersLength = CHARSET.length;
    for ( var i = 0; i < 6; i++ ) {
      result += CHARSET.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}

class Tag extends Bone {
  static describe() {
  }
}

Tag.init({
  id: {
    primaryKey: true,
    type: DataTypes.BIGINT
  },
  gmtCreate: DataTypes.DATE,
  gmtModified: DataTypes.DATE,
  gmtDeleted: DataTypes.DATE,
  type:  DataTypes.INT,
  name: DataTypes.STRING,
  uuid: {
    type: DataTypes.STRING,
    unique: true,
  }
}, {
  hooks: {
    beforeCreate(obj) {
      if (!obj.uuid) {
        obj.uuid = uid();
      }
    }
  }
});

module.exports = Tag;
