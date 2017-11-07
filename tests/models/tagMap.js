'use strict'

const { Bone } = require('../..')

class TagMap extends Bone {
  static describe() {
    this.belongsTo('post', {
      foreignKey: 'targetId',
      where: { targetType: 0 }
    })
    this.belongsTo('tag')
  }
}

module.exports = TagMap
