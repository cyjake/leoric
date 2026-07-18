'use strict';

const { Bone, Model } = require('../../src');

class TagMap extends Bone {
  static initialize() {
    this.belongsTo('post', {
      foreignKey: 'targetId',
      where: { targetType: 0 }
    });
    this.belongsTo('tag');
  }
}

module.exports = Model()(TagMap);
