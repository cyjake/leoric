'use strict';

const { Bone } = require('../..');

class Post extends Bone {
  static get table() {
    return 'articles';
  }

  static describe() {
    this.hasOne('attachment', {
      foreignKey: 'postId'
    });
    this.hasMany('comments', {
      foreignKey: 'articleId'
    });
    this.hasMany('tagMaps', {
      foreignKey: 'targetId',
      where: { targetType: 0 }
    });
    this.hasMany('topics', { through: 'tagMaps',  where: { type: 1 }, className: 'Tag' });
    this.hasMany('tags', { through: 'tagMaps', where: { type: 0 } });

    this.attribute('extra', { type: JSON });
  }

  get slug() {
    return this.title.replace(/([A-Z])([a-z])/, function(m, CHR, chr) {
      return `-${CHR.toLowerCase()}${chr}`;
    });
  }
}

module.exports = Post;
