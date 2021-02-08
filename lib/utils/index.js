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

function getPropertyNames (obj) {
  if (obj == null) return [];
  const propertyNames = [];
  // avoid to deep clone obj
  let muteObj = Object.getPrototypeOf(obj);
  do {
    propertyNames.push.apply(propertyNames, Object.getOwnPropertyNames(muteObj));
    muteObj = Object.getPrototypeOf(muteObj);
  } while (muteObj);
  muteObj = {};
  // get own properties
  propertyNames.push.apply(propertyNames, Object.getOwnPropertyNames(obj));
  // get unique properties' names, filter __proto__
  for (const name of propertyNames) {
    muteObj[name] = 1;
  }
  return Object.keys(muteObj);
}

module.exports = {
  isPlainObject,
  compose,
  getPropertyNames,
};
