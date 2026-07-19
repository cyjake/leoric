'use strict';

const { Bone } =require('../../src');

const TARGET_TYPE = {
  post: 0,
  comment: 1,
};

class Like extends Bone {
  static get table() {
    return 'likes';
  }

  static get physicTables() {
    return ['likes'];
  }

  static get shardingKey() {
    return 'userId';
  }

  static initialize() {
    this.belongsTo('post', {
      foreignKey: 'targetId',
      where: { 'likes.targetType': TARGET_TYPE.post },
    });
  }
}

module.exports = Like;
