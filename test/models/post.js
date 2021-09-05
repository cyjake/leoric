'use strict';

const { Bone } = require('../..');

class Post extends Bone {
  static table = 'articles';

  static initialize() {
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
    return this.attribute('title')
      .replace(/^([A-Z])/, (m, chr) => chr.toLowerCase())
      .replace(/ ([A-Z])/g, (m, chr) => `-${chr.toLowerCase()}`);
  }

  // custom getters in class syntax should not make attributes not enumerable
  get title() {
    return this.attribute('title').replace(/^([a-z])/, function(m, chr) {
      return chr.toUpperCase();
    });
  }

  get settings() {
    const value = this.attribute('settings');
    try {
      return JSON.parse(value);
    } catch (err) {
      console.warn(`unable to parse 'settings': ${value}`, err);
    }
    return {};
  }

  set settings(value) {
    if (typeof value !== 'string') value = JSON.stringify(value);
    this.attribute('settings', value);
  }
}

Object.defineProperty(Post.prototype, 'slug', {
  ...Object.getOwnPropertyDescriptor(Post.prototype, 'slug'),
  enumerable: true,
});

module.exports = Post;
