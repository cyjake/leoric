'use strict';

const { Bone, Model } = require('../../src');

class Comment extends Bone {
  static initialize() {
    this.belongsTo('post', {
      foreignKey: 'articleId'
    });
  }
}

module.exports = Model()(Comment);
