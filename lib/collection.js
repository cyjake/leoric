'use strict'

class Collection extends Array {
  /**
   * Override JSON.stringify behavior
   * @returns {Array}
   */
  toJSON() {
    return this.map(function(element) {
      if (typeof element.toJSON === 'function') {
        return element.toJSON()
      } else {
        return element
      }
    })
  }

  /**
   * @returns {Object}
   * @memberOf Collection
   */
  toObject() {
    return this.map(function(element) {
      if (typeof element.toObject === 'function') {
        return element.toObject()
      } else {
        return element
      }
    })
  }

  /**
   * Override #map to make sure the returned value is an instance of Collection
   * rather than Array. SpiderMonkey's got this right, but V8 hasn't yet.
   *
   * @param  {Function}   callback
   * @param  {Obejct}     thisArg
   * @return {Collection}
   */
  map(callback, thisArg) {
    return Collection.of(...super.map(callback, thisArg))
  }

  /**
   * Same as #map
   *
   * @param  {Function}   callback
   * @param  {Object}     thisArg
   * @return {Collection}
   */
  filter(callback, thisArg) {
    return Collection.of(...super.filter(callback, thisArg))
  }

  save() {
    if (this.length === 0) return this

    if (this.some(element => !element.save)) {
      throw new Error('Collection contains element that cannot be saved.')
    }

    return Promise.all(this.map(element => element.save()))
  }
}


module.exports = Collection
