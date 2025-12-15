
/**
 * Convert the first charactor of the string from lowercase to uppercase.
 * @param {string} str
 */
export function capitalize(str: string): string {
  return str.replace(/^([a-z])/, (m, chr) => chr.toUpperCase());
}

/**
 * Convert the first charactor of the string from uppercase to lowercase
 * @param {string} str
 */
export function uncapitalize(str: string): string {
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
export function camelCase(str: string): string {
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
export function snakeCase(str: string): string {
  return uncapitalize(str).replace(/([A-Z])/g, (m, chr) => `_${chr.toLowerCase()}`);
}

/**
 * Convert multiline SQL into single line for better logging
 * @param {string|Function} text
 * @returns {string}
 * @example
 * heresql(`
 *   SELECT *
 *     FROM users
 *    WHERE age >= 35
 * `)
 */
export function heresql(text: string): string {
  return text.trim().split('\n').map(line => line.trim()).join(' ');
}
