'use strict';

/**
 * Convert the first charactor of the string from lowercase to uppercase.
 * @param {string} str
 */
function capitalize(str) {
  return str.replace(/^([a-z])/, (m, chr) => chr.toUpperCase());
}

/**
 * Convert the first charactor of the string from uppercase to lowercase
 * @param {string} str
 */
function uncapitalize(str) {
  return str.replace(/^([A-Z])/, (m, chr) => chr.toLowerCase());
}

/**
 * Convert strings connected with hyphen or underscore into camel case. e.g.
 * @example
 * camelCase('FooBar')   // => 'fooBar'
 * camelCase('foo-bar')  // => 'fooBar'
 * camelCase('foo_bar')  // => 'fooBar'
 * @param {string} str
 * @returns {string}
 */
function camelCase(str) {
  return uncapitalize(str).replace(/[-_]([a-z])/g, (m, chr) => chr.toUpperCase());
}

/**
 * Convert strings from camelCase to snake_case.
 * @example
 * snakeCase('FooBar')  // => 'foo_bar'
 * snakeCase('fooBar')  // => 'foo_bar'
 * @param {string} str
 * @returns {string}
 */
function snakeCase(str) {
  return uncapitalize(str).replace(/([A-Z])/g, (m, chr) => `_${chr.toLowerCase()}`);
}

/**
 * Convert multiline SQL into single line for better logging
 * @param {string} text
 * @returns {string}
 */
function heresql(text) {
  return text.trim().split('\n').map(line => line.trim()).join(' ');
}

module.exports = {
  capitalize,
  camelCase,
  snakeCase,
  heresql,
};
