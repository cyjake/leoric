'use strict';

const { Bone } = require('../../src');

class TagMap extends Bone {
  static initialize() {
    this.belongsTo('post', {
      foreignKey: 'targetId',
      where: { targetType: 0 }
    });
    this.belongsTo('tag');
  }
}

module.exports = TagMap;
