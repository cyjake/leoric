'use strict'

const { Bone } = require('../..')

class Comment extends Bone {
  static describe() {
    this.belongsTo('post', {
      foreignKey: 'articleId'
    })
  }
}

module.exports = Comment
