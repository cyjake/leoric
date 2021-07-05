'use strict';

const { Bone } = require('../..');

class Attachment extends Bone {
  static initialize() {
    this.renameAttribute('articleId', 'postId');
    this.belongsTo('post', {
      foreignKey: 'postId'
    });
  }
}

module.exports = Attachment;
