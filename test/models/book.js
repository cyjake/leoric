'use strict'

const { Bone } = require('../..')

class Book extends Bone {
  static get primaryKey() {
    return 'isbn'
  }

  set isbn(value) {
    if (!value) throw new Error('invalid isbn')
    this.attribute('isbn', value)
  }

  get price() {
    const price = this.attribute('price')
    return Math.round(price * 100) / 100
  }
}

module.exports = Book
