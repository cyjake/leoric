'use strict';

const { Bone, Model } = require('../../src');

class Attachment extends Bone {
  static initialize() {
    this.renameAttribute('articleId', 'postId');
    this.belongsTo('post', {
      foreignKey: 'postId'
    });
  }
}

module.exports = Model()(Attachment);
