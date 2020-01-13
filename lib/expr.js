'use strict';

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
  ['between', 'not between', ...UNARY_OPERATORS, ...BINARY_OPERATORS].sort((a, b) => {
    if (a.length > b.length) return -1;
    else if (a.length < b.length) return 1;
    else return 0;
  })
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

/**
 * Compare the precedence of two operators. Operators with lower indices have higher priorities.
 * @example
 * precedes('and', 'or')  // => -1
 * precedes('and', 'and') // => 0
 * precedes('+', '/') // => 1
 * @param {string} left  - name of the left operator
 * @param {string} right - name of the right operator
 */
function precedes(left, right) {
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

function parseValue(value) {
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
 * @returns {Object[]}
 */
function parseExprList(str, ...values) {
  let i = 0;
  let chr = str[i];
  let valueIndex = 0;

  function next() {
    chr = str[++i];
  }

  function space() {
    while (/\s/.test(chr)) next();
  }

  function string() {
    let value = '';
    const quote = chr;
    next();
    while (chr != quote) {
      value += chr;
      next();
    }
    next();
    return { type: 'literal', value };
  }

  function func(name) {
    const args = [];
    do {
      next();
      const arg = expr();
      if (arg) args.push(arg);
      space();
    } while (chr == ',');
    next();
    return { type: 'func', name, args };
  }

  function wildcard() {
    next();
    return { type: 'wildcard' };
  }

  function placeholder() {
    next();
    if (valueIndex >= values.length) {
      throw new Error('Unexpected placeholder');
    }
    return { type: 'literal', value: parseValue(values[valueIndex++]) };
  }

  function array() {
    const items = [];
    next();
    while (chr && chr != ')') {
      space();
      const item = token();
      if (item.type == 'literal') {
        items.push(item.value);
      } else {
        throw new Error(`Unexpected token ${item.type}`);
      }
      next();
    }
    return { type: 'literal', value: items };
  }

  function identifier(value) {
    const parts = value.split('.');
    return parts.length > 1
      ? { type: 'id', value: parts.pop(), qualifiers: parts }
      : { type: 'id', value: value };
  }

  function token() {
    if (/['"]/.test(chr)) return string();
    if (chr == '?') return placeholder();
    if (chr == '(') return array();

    for (const name of OPERATORS) {
      const j = i + name.length;
      const chunk = str.slice(i, j);
      if (chunk.toLowerCase() == name && (str[j] == ' ' || !/[a-z]$/.test(name))) {
        i += name.length;
        chr = str[i];
        return { type: 'op', name: OPERATOR_ALIAS_MAP[name] || name, args: [] };
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
    else if (chr == '(') {
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

  function between(op, t) {
    space();
    const start = token();
    space();
    const conj = token();
    if (conj.name != 'and') throw new Error(`Unexpected conj ${conj}`);
    space();
    const end = token();
    return { ...op, args: [ t, start, end ] };
  }

  function alias(t) {
    space();
    return { type: 'alias', value: token().value, args: [ t ]};
  }

  function unary(op) {
    const arg = chr == '(' ? expr() : token();
    if (op.name == '-' && arg.type == 'literal' && Number.isFinite(arg.value)) {
      return { type: 'literal', value: -arg.value };
    } else {
      return { ...op, args: [arg] };
    }
  }

  function operator(t) {
    const op = token();
    if (op.name == 'as') return alias(t);
    if (op.name == 'between' || op.name == 'not between') {
      return between(op, t);
    }
    if (BINARY_OPERATORS.includes(op.name)) {
      space();
      const isLower = chr == '(';
      const operand = LOGICAL_OPERATORS.includes(op.name) ? expr() : token();
      // parseExpr('1 > -1')
      if (UNARY_OPERATORS.includes(operand.name) && operand.args.length == 0) {
        return { ...op, args: [t, unary(operand)] };
      }
      else if (operand.type == 'op' && operand.args.length < 2) {
        throw new Error(`Unexpected token ${operand.name}`);
      }
      // parseExpr('a = 1 && b = 2 && c = 3')
      else if (operand.type == 'op' && !isLower && precedes(op.name, operand.name) <= 0) {
        const { args } = operand;
        operand.args = [{ ...op, args: [t, args[0]] }, args[1]];
        return operand;
      }
      // parseExpr('a + b * c')
      else if (operand.type !== 'op' && t.type == 'op' && precedes(op.name, t.name) < 0) {
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

  function expr() {
    let node;
    while (chr && chr != ',' && chr != ')') {
      space();
      if (node) {
        // check arguments length to differentiate unary minus and binary minus
        if (UNARY_OPERATORS.includes(node.name) && node.args.length == 0) {
          node = unary(node);
        }
        else if (MODIFIERS.includes(node.name)) {
          node.args[0] = token();
        }
        else {
          node = operator(node);
        }
      }
      else if (chr == '(') {
        next();
        node = expr();
        next();
      }
      else if (chr == '*') {
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
    if (chr == ',') next();
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
 * @param {string} str
 * @param {...*}   values
 * @returns {Object}
 */
function parseExpr(str, ...values) {
  return parseExprList(str, ...values)[0];
}

/**
 * Traversing ast to find expresssion that matches `opts`.
 * @param {Spell} spell
 * @param {Object} opts
 */
function findExpr(ast, opts) {
  let found;
  walkExpr(ast, node => {
    for (const prop in opts) {
      if (node[prop] !== opts[prop]) return;
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
function walkExpr(ast, fn) {
  fn(ast);
  if (ast.args) {
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
function copyExpr(ast, fn) {
  ast = fn(ast) || ast;
  if (ast.args) {
    for (let i = 0; i < ast.args.length; i++) {
      ast.args[i] = copyExpr(ast.args[i], fn);
    }
  }
  return ast;
}

module.exports = {
  parseExpr, parseExprList,
  precedes,
  walkExpr, findExpr, copyExpr,
};
