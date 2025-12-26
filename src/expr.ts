
import Raw from './raw';
import Spell from './spell';
import { AbstractBone } from './abstract_bone';
import { Literal } from './types/common';

export interface Identifier {
  type: 'id';
  value: string;
  qualifiers?: string[];
}

export interface ExprLiteral {
  type: 'literal';
  value: Literal | Literal[];
}

export interface ExprDataType {
  type: 'dataType';
  value: string;
  length?: string;
}

export interface JsonValueFunc {
  type: 'func';
  name: 'json_value';
  args: any[];
  dataType?: {
    type: 'dataType';
    value: string;
    length?: string;
  };
}

export interface Func {
  type: 'func';
  name: string;
  args: Expr[];
}

export interface Operator {
  type: 'op';
  name: string;
  args: Expr[];
}

export interface LogicalOperator {
  type: 'op';
  name: typeof LOGICAL_OPERATORS[number];
  args: Expr[];
}

export interface TernaryOperator {
  type: 'op';
  name: 'between' | 'not between';
  args: [Expr, Expr, Expr];
}

export interface Alias {
  type: 'alias';
  value: string;
  args: Expr[];
}

export interface Modifier {
  type: 'mod';
  name: string;
  args: Expr[];
}

export interface Wildcard {
  type: 'wildcard';
}

export type Token =
  | Identifier
  | ExprLiteral
  | ExprDataType
  | Operator
  | Modifier
  | Alias
  | Wildcard
  | Func;

export type Expr =
  | Token;

export interface Subquery<T extends typeof AbstractBone> {
  type: 'subquery';
  value: Spell<T>;
}

export interface RawExpr {
  type: 'raw';
  value: string;
}

/**
 * This module contains a simple SQL expression parser which parses `select_expr` and `expr` in `WHERE`/`HAVING`/`ON` conditions. Most of {@link Spell}'s functionalities are made possible because of this parser. Currently, it cannot parse a full SQL.
 * @module
 * @example
 * parseExpr('COUNT(1) AS count')
 * // => { type: 'alias', value: 'count',
 * //      args: [ { type: 'func', name: 'count', args: [ ... ] } ] }
 */

/**
 * A (drastically) simplified list of unary operators.
 * @const
 */
const UNARY_OPERATORS = [
  'not', '!', '-', '~'
];

/**
 * A (modestly) simplified list of binary operators.
 * @const
 */
const BINARY_OPERATORS = [
  'and', '&&',
  'as',
  '=',
  '>',
  '>=',
  'in',
  'is',
  'is not',
  '<',
  '<=',
  'like',
  '+',
  '-',
  'mod', '%',
  '!=', '<>',
  'not in',
  'not like',
  'or', '||',
  'xor',
  '*',
  '/',
  '^'
];

/**
 * A list of binary logical operators.
 * @const
 */
const LOGICAL_OPERATORS = [
  'and', 'not', 'or', 'xor'
];

const OPERATORS = new Set(
  ['between', 'not between', ...UNARY_OPERATORS, ...BINARY_OPERATORS].sort((a, b) => b.length - a.length)
);

/**
 * A map of operator alias. Operators like `&&` will be translated into `and` to make ast handling a bit easier.
 * @const
 */
const OPERATOR_ALIAS_MAP = {
  'is': '=',
  'is not': '!=',
  '!': 'not',
  '&&': 'and',
  '<>': '!=',
  '||': 'or',
  'mod': '%'
};

/**
 * A (drastically) simplified list of supported modifiers.
 * @const
 */
const MODIFIERS = ['distinct'];

/**
 * A (drastically) simplified list of operators ordered in priority precedences.
 * - https://dev.mysql.com/doc/refman/5.7/en/operator-precedence.html
 * @const
 */
const PRECEDENCES = [
  ['^'],  // left out unary minus on purpose
  ['*', '/', 'div', '%', 'mod'],
  ['-', '+'],
  ['=', '>=', '>', '<=', '<', '<>', '!=', 'like', 'in'],
  ['not'],
  ['and'],
  ['xor'],
  ['or']
];

const RETURNING_TYPES = [
  'float',
  'double',
  'decimal',
  'signed',
  'unsigned',
  'date',
  'time',
  'datetime',
  'year', // mysql >= 8.0.22
  'char',
  'json',
];

/**
 * Compare the precedence of two operators. Operators with lower indices have higher priorities.
 * @example
 * precedes('and', 'or')  // => -1
 * precedes('and', 'and') // => 0
 * precedes('+', '/') // => 1
 * @param {string} left  - name of the left operator
 * @param {string} right - name of the right operator
 */
function precedes(left: string, right: string): number {
  if (left == right) return 0;

  let leftIndex = -1;
  let rightIndex = -1;

  for (const i of PRECEDENCES.keys()) {
    const operators = PRECEDENCES[i];
    if (operators.includes(left)) leftIndex = i;
    if (operators.includes(right)) rightIndex = i;
  }

  return leftIndex < rightIndex ? -1 : (leftIndex == rightIndex ? 0 : 1);
}

function parseValue(value: Literal | Literal[] | Set<Literal>): Literal | Literal[] {
  if (value instanceof Set) {
    return Array.from(value);
  } else {
    return value;
  }
}

/**
 * Parse sql expressions into ast for validations and sanitizations.
 * @param {string} str
 * @param {...*}   values
 */
function parseExprList(str: any, ...values: Literal[]) {
  if (str instanceof Raw) return [ str ];
  let i = 0;
  let chr = str[i];
  let valueIndex = 0;

  function next() {
    chr = str[++i];
  }

  function space() {
    while (/\s/.test(chr)) next();
  }

  function string(): ExprLiteral {
    let value = '';
    let escaped = false;
    const quote = chr;
    next();
    while (chr && (chr !== quote || escaped)) {
      if (chr === '\\' && !escaped) {
        escaped = true;
      } else {
        value += chr;
        escaped = false;
      }
      next();
    }
    if (chr !== quote) {
      throw new Error(`Unexpected end of string: ${value}`);
    }
    next();
    return { type: 'literal', value };
  }

  function dataType(): ExprDataType {
    let value = '';
    while (chr && /[a-z0-9$_.]/i.test(chr)) {
      value += chr;
      next();
    }
    value = value.toLowerCase();
    if (!RETURNING_TYPES.includes(value)) {
      throw new Error(`Unexpected RETURNING type of JSON_VALUE(): ${value}`);
    }
    if (chr === '(') {
      let length = '';
      next();
      while (chr && chr !== ')') {
        length += chr;
        next();
      }
      next();
      return { type: 'dataType', value, length };
    }
    return { type: 'dataType', value };
  }

  // JSON_VALUE(json_doc, path [RETURNING type] [on_empty] [on_error])\
  // JSON_VALUE(j, '$.id' RETURNING UNSIGNED)
  function jsonValue(name: 'json_value') {
    const args = [];
    next();
    args.push(expr());
    next();
    space();
    args.push(string());
    space();
    const result: JsonValueFunc = { type: 'func', name, args };
    while (chr && chr !== ')') {
      let value = '';
      while (chr && /[a-z0-9$_.]/i.test(chr)) {
        value += chr;
        next();
      }
      if (value.toLowerCase() === 'returning') {
        space();
        result.dataType = dataType();
      }
    }
    // the trailing ')'
    next();
    return result;
  }

  function func(name: string): Func | JsonValueFunc {
    if (name === 'json_value') return jsonValue(name);
    const args = [];
    do {
      next();
      const arg = expr();
      if (arg) args.push(arg);
      space();
    } while (chr === ',');
    next();
    return { type: 'func', name, args };
  }

  function wildcard(): Wildcard {
    next();
    return { type: 'wildcard' };
  }

  function placeholder(): ExprLiteral {
    next();
    if (valueIndex >= values.length) {
      throw new Error('Unexpected placeholder');
    }
    return { type: 'literal', value: parseValue(values[valueIndex++]) };
  }

  function array(): ExprLiteral {
    const items = [];
    next();
    while (chr && chr !== ')') {
      space();
      const item = token();
      if (item.type === 'literal') {
        items.push(item.value);
      } else {
        throw new Error(`Unexpected token ${item.type}`);
      }
      next();
    }
    return { type: 'literal', value: items };
  }

  function identifier(value: string): Identifier {
    const parts = value.split('.');
    return parts.length > 1
      ? { type: 'id', value: parts.pop() as string, qualifiers: parts }
      : { type: 'id', value: value };
  }

  function token(): Token {
    if (/['"]/.test(chr)) return string();
    if (chr === '?') return placeholder();
    if (chr === '(') return array();

    for (const name of OPERATORS) {
      const j = i + name.length;
      const chunk = str.slice(i, j);
      if (chunk.toLowerCase() === name && (str[j] === ' ' || !/[a-z]$/.test(name))) {
        i += name.length;
        chr = str[i];
        return {
          type: 'op',
          name: OPERATOR_ALIAS_MAP[name as keyof typeof OPERATOR_ALIAS_MAP] || name,
          args: [],
        };
      }
    }

    let value = '';
    while (chr && /[a-z0-9$_.]/i.test(chr)) {
      value += chr;
      next();
    }
    const lowerCase = value.toLowerCase();

    if (!value) {
      throw new Error(`Unexpected token ${chr}`);
    }
    else if (MODIFIERS.includes(lowerCase)) {
      return { type: 'mod', name: lowerCase, args: [] };
    }
    else if (chr === '(') {
      return func(lowerCase);
    }
    else if (lowerCase == 'null') {
      return { type: 'literal', value: null };
    }
    else if (Number.isFinite(Number(value))) {
      return { type: 'literal', value: Number(value) };
    }
    else {
      return identifier(value);
    }
  }

  function between(op: TernaryOperator, t: Expr): TernaryOperator {
    space();
    const start = token();
    space();
    const conj = token();
    if (!('name' in conj && conj.name === 'and')) throw new Error(`Unexpected conj ${conj}`);
    space();
    const end = token();
    return { ...op, args: [ t, start, end ] };
  }

  function alias(t: Expr): Alias {
    space();
    return { type: 'alias', value: (token() as Identifier).value, args: [ t ]};
  }

  function unary(op: Operator | Modifier | Func): Expr {
    const arg = chr === '(' ? expr() : token();
    if (!arg) throw new Error(`Unexpected end of expression after unary operator ${op.name}`);
    if (op.name === '-' && arg.type === 'literal' && Number.isFinite(arg.value)) {
      return { type: 'literal', value: -(arg.value as number) };
    } else {
      return { ...op, args: [arg] };
    }
  }

  function operator(t: Token): Operator | Alias {
    const op = token() as Operator;
    if (op.name === 'as') return alias(t);
    if (['between', 'not between'].includes(op.name)) {
      return between(op as TernaryOperator, t);
    }
    if (BINARY_OPERATORS.includes(op.name)) {
      space();
      const isLower = chr === '(';
      const operand = LOGICAL_OPERATORS.includes(op.name) ? expr() : token();
      if (!operand) throw new Error(`Unexpected end of expression after operator ${op.name}`);
      // parseExpr('1 > -1')
      if ('name' in operand && UNARY_OPERATORS.includes(operand.name) && operand.args.length == 0) {
        return { ...op, args: [t, unary(operand)] };
      }
      else if (operand.type === 'op' && operand.args.length < 2) {
        throw new Error(`Unexpected token ${operand.name}`);
      }
      // parseExpr('a = 1 && b = 2 && c = 3')
      else if (operand.type === 'op' && !isLower && precedes(op.name, operand.name) <= 0) {
        const { args } = operand;
        operand.args = [{ ...op, args: [t, args[0]] }, args[1]];
        return operand;
      }
      // parseExpr('a + b * c')
      else if (operand.type !== 'op' && t.type === 'op' && precedes(op.name, t.name) < 0) {
        t.args[1] = { ...op, args: [t.args[1], operand] };
        return t;
      }
      else {
        return { ...op, args: [t, operand] };
      }
    }
    else {
      throw new Error(`Unexpected token ${op.name}`);
    }
  }

  function expr(): Expr | undefined {
    let node;
    while (chr && chr !== ',' && chr !== ')') {
      space();
      if (node) {
        // check arguments length to differentiate unary minus and binary minus
        if ('name' in node && UNARY_OPERATORS.includes(node.name) && node.args.length === 0) {
          node = unary(node);
        }
        else if ('name' in node && MODIFIERS.includes(node.name as typeof MODIFIERS[number])) {
          node.args[0] = token();
        }
        else {
          node = operator(node);
        }
      }
      else if (chr === '(') {
        next();
        node = expr();
        next();
      }
      else if (chr === '*') {
        node = wildcard();
      }
      else {
        node = token();
      }
      space();
    }
    return node;
  }

  const results = [];
  while (chr) {
    results.push(expr());
    if (chr && chr !== ',') throw new Error(`Unexpected token ${chr}`);
    next();
  }
  return results;
}

/**
 * @example
 * parseExpr('COUNT(id) + 1')
 *   -> { type: 'op',
 *        name: '+',
 *        args:
 *         [ { type: 'func',
 *             name: 'count',
 *             args: [ { type: 'id', value: 'id' } ] },
 *           { type: 'literal', value: 1 } ] }
 *
 * // Logical operators can be used in conditional expressions too.
 * parseExpr('YEAR(createdAt) <= 2017 AND MONTH(createdAt) BETWEEN 4 AND 9')
 *   -> { type: 'op',
 *        name: 'and',
 *        args:
 *         [ { type: 'op',
 *             name: '<=',
 *             args:
 *              [ { type: 'func', name: 'year',
 *                  args: [ { type: 'id', value: 'createdAt' } ] },
 *                { type: 'literal', value: 2017 } ] },
 *           { type: 'op',
 *             name: 'between',
 *             args:
 *              [ { type: 'func',
 *                  name: 'month',
 *                  args: [ { type: 'id', value: 'createdAt' } ] },
 *                { type: 'literal', value: 4 },
 *                { type: 'literal', value: 9 } ] } ] }
 */
function parseExpr(str: string, ...values: any[]) {
  return parseExprList(str, ...values)[0];
}

/**
 * Traversing ast to find expresssion that matches `opts`.
 * @param {Spell} spell
 * @param {Object} opts
 */
function findExpr(ast: Expr, opts: Partial<Expr>): Expr | undefined {
  let found;
  walkExpr(ast, node => {
    for (const [prop, value] of Object.entries(opts)) {
      if (node[prop as keyof Expr] !== value) return;
    }
    found = node;
  });
  return found;
}

/**
 * Walk through an ast, starting from the root token.
 * @param {Object}   ast
 * @param {Function} fn
 */
function walkExpr(ast: Expr, fn: (ast: Expr) => void): Expr {
  fn(ast);
  if ('args' in ast) {
    for (const arg of ast.args) walkExpr(arg, fn);
  }
  return ast;
}

/**
 * Walk through an ast with returned tokens preferred over the originals, which is convenient to update the ast.
 * @example
 * // update all of the identifiers' qualifiers:
 * copyExpr(ast, ({ type, value }) => {
 *   if (type == 'id') return { type, qualifiers: ['posts'], value }
 * });
 * @param {Object}   ast
 * @param {function} fn
 */
function copyExpr(ast: Expr, fn: (ast: Expr) => Expr | undefined): Expr {
  ast = fn(ast) || ast;
  if ('args' in ast) {
    ast.args = ast.args.map(arg => copyExpr(arg, fn));
  }
  return ast;
}

export {
  parseExpr,
  parseExprList,
  precedes,
  walkExpr,
  findExpr,
  copyExpr,
};
