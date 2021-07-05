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
  static attributes = {
    id: {
      primaryKey: true,
      type: DataTypes.BIGINT
    },
    createdAt: { type: DataTypes.DATE, columnName: 'gmt_create' },
    updatedAt: { type: DataTypes.DATE, columnName: 'gmt_modified' },
    deletedAt: { type: DataTypes.DATE, columnName: 'gmt_deleted' },
    type:  DataTypes.INT,
    name: DataTypes.STRING,
    uuid: {
      type: DataTypes.STRING,
      unique: true,
    }
  }

  static beforeCreate(obj) {
    if (!obj.uuid) {
      obj.uuid = uid();
    }
  }
}

module.exports = Tag;
