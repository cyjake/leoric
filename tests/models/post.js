'use strict'

const { Bone } = require('../..')

class Post extends Bone {
  static get table() {
    return 'articles'
  }

  static describe() {
    this.hasOne('attachment', {
      foreignKey: 'postId'
    })
    this.hasMany('comments', {
      foreignKey: 'articleId'
    })
    this.hasMany('tagMaps', {
      foreignKey: 'targetId',
      where: { targetType: 0 }
    })
    this.hasMany('tags', { through: 'tagMaps' })

    this.attribute('extra', { type: JSON })
  }

  get slug() {
    return this.title.replace(/([A-Z])([a-z])/, function(m, CHR, chr) {
      return `-${CHR.toLowerCase()}${chr}`
    })
  }
}

module.exports = Post
