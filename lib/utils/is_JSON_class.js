'use strict';

/**
 * type is JSON class or not
 * @param {*} type
 * @returns
 */
function isJSONClass(type) {
  if (type && typeof type.parse === 'function' ) {
    const symbols = Object.getOwnPropertySymbols(type);
    // JSON["Symbol(Symbol.toStringTag)"] === "JSON"
    if (symbols && symbols[0] && type[symbols[0]] === 'JSON') {
      return true;
    }
  }
  return false;
}

module.exports = isJSONClass;
