'use strict';

const util = require('util');
const { isPlainObject } = require('./utils');
const { parseExpr } = require('./expr');
// deferred to break cyclic dependencies
let Spell;

const OPERATOR_MAP = {
  $between: 'between',
  $eq: '=',
  $gt: '>',
  $gte: '>=',
  $in: 'in',
  $like: 'like',
  $lt: '<',
  $lte: '<=',
  $ne: '!=',
  $nin: 'not in',
  $notBetween: 'not between',
  $notLike: 'not like',
  $notIn: 'not in'
};

/**
 * Parse object values as literal or subquery
 * @param {Object} value
 * @returns {Array<Object>}
 */
function parseValue(value) {
  if (value instanceof Spell) return { type: 'subquery', value };
  if (value && value.__raw) return { type: 'raw', value: value.value };
  return parseExpr('?', value);
}

/**
 * Check if object condition is an operator condition, such as `{ $gte: 100, $lt: 200 }`.
 * @param {Object} condition
 * @returns {boolean}
 */
function isOperatorCondition(condition) {
  if (!isPlainObject(condition)) return false;
  for (const $op in condition) {
    if (OPERATOR_MAP.hasOwnProperty($op)) return true;
  }
  return false;
}

function merge(conditions, operator = 'and') {
  return conditions.reduce((res, condition) => {
    if (!res) return condition;
    return { type: 'op', name: operator, args: [ res, condition ] };
  }, null);
}

/**
 * parse operator condition into expression ast
 * @example
 * parseOperator('id', { $gt: 0, $lt: 999999 });
 * // => { type: 'op', name: 'and', args: [ ... ]}
 * @param {string} name
 * @param {Object} condition
 * @returns {Object}
 */
function parseOperator(name, condition) {
  const result = [];

  for (const $op in condition) {
    const operator = $op === '$not' ? OPERATOR_MAP.$ne : OPERATOR_MAP[$op];
    if (!operator) {
      throw new Error(util.format('unexpected operator in condition %s', condition));
    }
    const args = [ parseExpr(name) ];
    const val = condition[$op];

    if (operator == 'between' || operator == 'not between') {
      args.push(parseValue(val[0]), parseValue(val[1]));
    } else {
      args.push(parseValue(val));
    }

    result.push({ type: 'op', name: operator, args });
  }

  return merge(result);
}

const LOGICAL_OPERATOR_MAP = {
  $and: 'and',
  $or: 'or',
  $not: 'not',
};

/**
 * determin if operator is logical operator
 * @param {string} operator lowercased operator
 * @returns {boolean}
 */
function isLogicalOperator(operator) {
  return LOGICAL_OPERATOR_MAP.hasOwnProperty(operator);
}

/**
 * determine if query object is logical condition
 * @param {Object} condition query object
 * @returns {boolean}
 */
function isLogicalCondition(condition) {
  for (const name in condition) {
    if (LOGICAL_OPERATOR_MAP.hasOwnProperty(name)) return true;
  }
  return false;
}

/**
 * parse logical objects that is already in tree-like structure
 * @example
 * { $or: { title: 'Leah', content: 'Diablo' } }
 * { $or: [ { title: 'Leah' }, { content: 'Diablo' } ] }
 * { $not: [ { title: 'Leah' }, { title: { $like: '%jjj' }} ] }
 * @param {string} $op logical operators, such as `$or`, `$and`, and `$not`.
 * @param {Object|Object[]} value logical operands
 */
function parseLogicalOperator($op, value) {
  const operator = LOGICAL_OPERATOR_MAP[$op];

  if (isPlainObject(value)) {
    value = Object.keys(value).reduce((res, key) => {
      return res.concat({ [key]: value[key] });
    }, []);
  }

  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`unexpected logical operator value ${value}`);
  }

  // { title: { $not: [ { $like: '%foo%' }, { $like: '%bar%' } ] } }
  if (operator === 'not') {
    const args = merge(value.map(entry => merge(parseObject(entry))));
    return { type: 'op', name: operator, args: [ args ] };
  }

  const result = merge(value.map(entry => merge(parseObject(entry))), operator);
  const { args } = result;

  // { title: { $or: [ 'Leah' ] } }
  // { title: { $and: { $ne: 'Leah' } } }
  if (args.length === 1) return args[0];

  return result;
}

/**
 * parse logical objects that have column name lifted upper level
 * @example
 * { foo: { $not: { $gt: '2021-01-01', $lte: '2021-12-31' } } }
 * { foo: { $not: [ '2021-09-30', { $gte: '2021-10-07' } ] } }
 * { foo: { $not: [ 'Leah', 'Nephalem' ] } }
 * @param {string} name column name
 * @param {Object} condition logical query objects
 * @returns {Object}
 */
function parseNamedLogicalOperator(name, condition) {
  for (const $op of Object.keys(condition)) {
    const operator = LOGICAL_OPERATOR_MAP[$op];
    const value = condition[$op];
    // { $not: [ 1, 2, 3 ] }
    if (operator === 'not' && Array.isArray(value) && !value.some(isPlainObject)) {
      return parseOperator(name, { $notIn: value });
    }
    const args = [].concat(value).map(entry => ({ [name]: entry }));
    return parseLogicalOperator($op, args);
  }
}

/**
 * Parse query objects, which is a complete madness because the operator orders vary. The result would be normalized spell ast. See {@link module:src/query_object~OPERATOR_MAP} and {@link module:src/query_object~LOGICAL_OPERATOR_MAP} for supported `$op`s.
 * @example
 * { foo: null }
 * { foo: { $gt: new Date(2012, 4, 15) } }
 * { foo: { $between: [1, 10] } }
 * { foo: { $or: [ 'Leah', { $like: '%Leah%' } ] } }
 * { foo: [ 1, 2, 3 ] }
 * { foo: { $not: { $gt: '2021-01-01', $lte: '2021-12-31' } } }
 * { foo: { $not: [ '2021-09-30', { $gte: '2021-10-07' } ] } }
 * { foo: { $not: [ 'Leah', 'Nephalem' ] } }
 * { $or: { title: 'Leah', content: 'Diablo' } }
 * { $or: [ { title: 'Leah', content: 'Diablo' }, { title: 'Stranger' } ] }
 * @param {Object} conditions
 */
function parseObject(conditions) {
  if (!Spell) Spell = require('./spell');
  const result = [];

  for (const name of Object.keys(conditions)) {
    const value = conditions[name];

    if (value instanceof Spell) {
      // { tagId: Tag.where({ deletedAt: null }).select('id') }
      result.push({
        type: 'op',
        name: 'in',
        args: [ parseExpr(name), { type: 'subquery', value } ]
      });
    } else if (isLogicalOperator(name)) {
      // { $and: [ { title: 'Leah' }, { content: { $ne: 'Diablo' } } ] }
      // { $or: { title: 'Leah', content: { $like: '%Leah%' } } }
      result.push(parseLogicalOperator(name, value));
    } else if (isOperatorCondition(value)) {
      // { title: [ 'Nephalem', 'Stranger' ] }
      // { title: { $ne: 'Leah', $like: 'L%h' } }
      result.push(parseOperator(name, value));
    } else if (isLogicalCondition(value)) {
      // { title: { $or: [ 'Leah', { $ne: 'Diablo' } ] } }
      result.push(parseNamedLogicalOperator(name, value));
    } else {
      // { title: 'Leah' }
      result.push({
        type: 'op',
        name: '=',
        args: [ parseExpr(name), parseValue(value) ],
      });
    }
  }

  return result;
}

module.exports = { parseObject };
