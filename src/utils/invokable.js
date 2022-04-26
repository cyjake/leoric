'use strict';

/**
 * Make class/function able to be invoked without new
 * @param {function} DataType
 */
function invokable(DataType) {
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
      // ref: https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Function/length
      // Function.length = Function.arguments.length
      // invokable INTEGER.toSqlString() will default to return "INTEGER(1)"
      return target.hasOwnProperty(p) ? target[p] : new target()[p];
    }
  });
};

module.exports = invokable;
