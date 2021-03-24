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

function getPropertyNames(obj) {
  if (obj == null) return [];
  const propertyNames = [];
  // avoid to deep clone obj
  let muteObj = Object.getPrototypeOf(obj);
  do {
    propertyNames.push(...Object.getOwnPropertyNames(muteObj));
    muteObj = Object.getPrototypeOf(muteObj);
    // the loop while reach to Leoric#Bone, filter __proto__, Object.getPrototypeOf(Bone) = {}, ({}).constructor.name = 'Object'
  } while (muteObj && muteObj.constructor.name !== 'Object');
  // get own properties
  propertyNames.push(...Object.getOwnPropertyNames(obj));
  // get unique properties' names
  const propertyNamesSet = new Set(propertyNames);
  return Array.from(propertyNamesSet);
}

const logger = {};

[ 'log', 'warn', 'debug', 'info', 'error' ].forEach(key => {
  logger[key] = function() {
    console[key]('[leoric]', ...arguments);
  };
});

module.exports = {
  isPlainObject,
  compose,
  getPropertyNames,
  logger,
};
