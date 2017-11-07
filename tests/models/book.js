'use strict'

const { Bone } = require('../..')

class Book extends Bone {
  static get primaryKey() {
    return 'isbn'
  }
}

module.exports = Book
