
import { isPlainObject } from './utils';
import { Expr, Identifier, Operator, parseExpr, RawExpr, Subquery } from './expr';
import Raw from './raw';
import { AbstractBone } from './types/abstract_bone';
import { Literal } from './types/common';
import Spell from './spell';

const LOGICAL_OPERATOR_MAP = {
  $and: 'and',
  $or: 'or',
  $not: 'not',
};

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

type LogicalOperator = keyof typeof LOGICAL_OPERATOR_MAP;

type ObjectCondition =
  | Record<string, Literal | Literal[] | Record<keyof typeof OPERATOR_MAP, Literal | Literal[]>>;

type LogicalObjectCondition =
  | Record<LogicalOperator, ObjectCondition | ObjectCondition[]>;

type MixedObjectCondition =
  | ObjectCondition | LogicalObjectCondition;

type QueryExpr = Expr | RawExpr | Subquery<typeof AbstractBone>;

/**
 * Parse object values as literal or subquery
 */
function parseValue<T extends typeof AbstractBone>(value: Spell<T> | Raw | Literal): Expr | RawExpr | Subquery<T> {
  if (value instanceof Spell) return { type: 'subquery', value: value as Spell<T> };
  if (value instanceof Raw) return { type: 'raw', value: value.value };
  return parseExpr('?', value) as Expr;
}

/**
 * Check if object condition is an operator condition, such as `{ $gte: 100, $lt: 200 }`.
 */
function isOperatorCondition(condition: ObjectCondition) {
  if (!isPlainObject(condition)) return false;
  for (const $op in condition) {
    if (OPERATOR_MAP.hasOwnProperty($op)) return true;
  }
  return false;
}

function merge(conditions: QueryExpr[], operator = 'and') {
  const result = conditions.reduce((res: QueryExpr | null, condition: QueryExpr) => {
    if (!res) return condition;
    return { type: 'op', name: operator, args: [ res, condition ] } as Operator;
  }, null);
  return result as QueryExpr;
}

/**
 * parse operator condition into expression ast
 * @example
 * parseOperator('id', { $gt: 0, $lt: 999999 });
 * // => { type: 'op', name: 'and', args: [ ... ]}
 * @param {string} name
 */
function parseOperator(name: string, condition: ObjectCondition) {
  const result: Array<Operator> = [];

  for (const [$op, val] of Object.entries(condition)) {
    const operator = $op === '$not' ? OPERATOR_MAP.$ne : OPERATOR_MAP[$op as keyof typeof OPERATOR_MAP];
    const args: QueryExpr[] = [ parseExpr(name) as Identifier ];

    if (Array.isArray(val) && (operator == 'between' || operator == 'not between')) {
      args.push(parseValue(val[0]), parseValue(val[1]));
    } else {
      args.push(parseValue(val));
    }

    result.push({ type: 'op', name: operator, args: args as Expr[] });
  }

  return merge(result);
}

/**
 * determin if operator is logical operator
 * @param {string} operator lowercased operator
 */
function isLogicalOperator(operator: string) {
  return LOGICAL_OPERATOR_MAP.hasOwnProperty(operator);
}

/**
 * determine if query object is logical condition
 * @param {Object} condition query object
 */
function isLogicalCondition(condition: Record<string, any>) {
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
function parseLogicalOperator($op: LogicalOperator, value: ObjectCondition | ObjectCondition[]) {
  const operator = LOGICAL_OPERATOR_MAP[$op];

  if (isPlainObject(value)) {
    value = Object.keys(value).reduce((res, key) => {
      return res.concat({ [key]: (value as ObjectCondition)[key] });
    }, [] as ObjectCondition[]);
  }

  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`unexpected logical operator value ${value}`);
  }

  // { title: { $not: [ { $like: '%foo%' }, { $like: '%bar%' } ] } }
  if (operator === 'not') {
    const args = merge(value.map(entry => merge(parseObject(entry) as QueryExpr[])));
    return { type: 'op', name: operator, args: [ args ] };
  }

  const result = merge(value.map(entry => merge(parseObject(entry) as QueryExpr[])), operator);
  const { args } = result as Operator;

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
 */
function parseNamedLogicalOperator(name: string, condition: LogicalObjectCondition) {
  for (const $op of Object.keys(condition) as LogicalOperator[]) {
    const operator = LOGICAL_OPERATOR_MAP[$op];
    const value = condition[$op];
    // { $not: [ 1, 2, 3 ] }
    if (operator === 'not' && Array.isArray(value) && !value.some(isPlainObject)) {
      return parseOperator(name, { $notIn: value });
    }
    const args = ([] as ObjectCondition[]).concat(value).map(entry => ({ [name]: entry }));
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
 */
export function parseObject(conditions: MixedObjectCondition) {
  const result = [];

  for (const [name, value] of Object.entries(conditions)) {
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
      result.push(parseLogicalOperator(name as LogicalOperator, value as ObjectCondition | ObjectCondition[]));
    } else if (isOperatorCondition(value as ObjectCondition)) {
      // { title: [ 'Nephalem', 'Stranger' ] }
      // { title: { $ne: 'Leah', $like: 'L%h' } }
      result.push(parseOperator(name, value as ObjectCondition));
    } else if (isLogicalCondition(value as LogicalObjectCondition)) {
      // { title: { $or: [ 'Leah', { $ne: 'Diablo' } ] } }
      result.push(parseNamedLogicalOperator(name, value as LogicalObjectCondition));
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
