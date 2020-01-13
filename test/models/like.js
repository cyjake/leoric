'use strict';

const { Bone } =require('../..');

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
}

module.exports = Like;
