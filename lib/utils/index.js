'use strict';

function isPlainObject(value) {
  return Object.prototype.toString.call(value) === '[object Object]';
}

function compose() {
  const funcs = Array.from(arguments);
  if (funcs.length === 0) return arg => arg;
  if (funcs.length === 1) return funcs[0];
  return funcs.reverse().reduce((a, b) => (...arg) => b(a(...arg)));
}

module.exports = {
  isPlainObject,
  compose,
};
