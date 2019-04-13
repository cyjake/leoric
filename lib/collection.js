'use strict'

/**
 * An extended Array to represent collections of models.
 */
class Collection extends Array {
  /**
   * Override JSON.stringify behavior
   * @returns {Object[]}
   */
  toJSON() {
    return Array.from(this, function(element) {
      if (typeof element.toJSON === 'function') {
        return element.toJSON()
      } else {
        return element
      }
    })
  }

  /**
   * @returns {Object[]}
   */
  toObject() {
    return Array.from(this, function(element) {
      if (typeof element.toObject === 'function') {
        return element.toObject()
      } else {
        return element
      }
    })
  }

  /**
   * Save the collection. Currently the changes are made concurrently but NOT in a transaction.
   * @returns {Bone[]}
   */
  save() {
    if (this.length === 0) return this

    if (this.some(element => !element.save)) {
      throw new Error('Collection contains element that cannot be saved.')
    }

    return Promise.all(this.map(element => element.save()))
  }
}


module.exports = Collection
