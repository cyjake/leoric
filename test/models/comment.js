'use strict';

const { Bone } = require('../../src');

class Comment extends Bone {
  static initialize() {
    this.belongsTo('post', {
      foreignKey: 'articleId'
    });
  }
}

module.exports = Comment;
