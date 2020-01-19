'use strict';

/**
 * Make class/function able to be invoked without new
 * @param {function} DataType
 */
function invokable(DataType) {
  let dataType;

  return new Proxy(DataType, {
    // STRING(255)
    apply(target, thisArg, args) {
      return new target(...args);
    },

    // new STRING(255)
    construct(target, args) {
      return new target(...args);
    },

    // INTEGER.UNSIGNED
    get(target, p) {
      if (!dataType) dataType = new target();
      return dataType[p];
    }
  });
};

module.exports = invokable;
