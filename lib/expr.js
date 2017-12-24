'use strict'

const UNARY_OPERATORS = [
  'not', '!'
]

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
  '-',
  'mod', '%',
  '!=', '<>',
  'not in',
  'not like',
  'or', '||',
  '*'
]

const LOGICL_OPERATORS = [
  'and', 'not', 'or', 'xor'
]

const OPERATOR_ALIAS_MAP = {
  '!': 'not',
  '&&': 'and',
  '<>': '!=',
  '||': 'or',
  '%': 'mod'
}

const MODIFIERS = ['distinct']

// https://dev.mysql.com/doc/refman/5.7/en/operator-precedence.html
const PRECEDENCES = [
  'not',
  'and',
  'xor',
  'or'
]

/**
 * Check if the left operator has higher precedence over the right one.
 * @param {string} left  - name of the left operator
 * @param {string} right - name of the right operator
 */
function isEqualOrHigher(left, right) {
  return left == right || PRECEDENCES.indexOf(left) < PRECEDENCES.indexOf(right)
}

/**
 * Parse sql expressions into ast for validations and sanitizations.
 *
 * COUNT(id) + 1
 *   -> { type: 'op',
 *        name: '+',
 *        args:
 *         [ { type: 'func',
 *             name: 'count',
 *             args: [ { type: 'id', value: 'id' } ] },
 *           { type: 'number', value: 1 } ] }
 *
 * YEAR(createdAt) <= 2017 AND MONTH(createdAt) BETWEEN 4 AND 9
 *   -> { type: 'op',
 *        name: 'and',
 *        args:
 *         [ { type: 'op',
 *             name: '<=',
 *             args:
 *              [ { type: 'func', name: 'year',
 *                  args: [ { type: 'id', value: 'createdAt' } ] },
 *                { type: 'number', value: 2017 } ] },
 *           { type: 'op',
 *             name: 'between',
 *             args:
 *              [ { type: 'func',
 *                  name: 'month',
 *                  args: [ { type: 'id', value: 'createdAt' } ] },
 *                { type: 'number', value: 4 },
 *                { type: 'number', value: 9 } ] } ] }
 *
 * @param {string} str
 * @param {...any} values
 */
function parseExpr(str, ...values) {
  let i = 0
  let chr = str[i]
  let valueIndex = 0

  function next() {
    chr = str[++i]
  }

  function space() {
    while (/\s/.test(chr)) next()
  }

  function string() {
    let value = ''
    const quote = chr
    next()
    while (chr != quote) {
      value += chr
      next()
    }
    next()
    return { type: 'string', value }
  }

  function func(name) {
    let args = []
    next()
    args.push(expr())
    next()
    return { type: 'func', name: name.toLowerCase(), args }
  }

  function wildcard() {
    next()
    return { type: 'wildcard' }
  }

  function placeholder() {
    const value = values[valueIndex++]

    next()
    if (value == null) {
      return { type: 'null' }
    }
    else if (Array.isArray(value)) {
      return { type: 'array', value }
    }
    else if (value instanceof Date) {
      return { type: 'date', value }
    }
    else if (value instanceof Set) {
      return { type: 'array', value: Array.from(value) }
    }
    else if (typeof value == 'number') {
      return { type: 'number', value }
    }
    else if (typeof value == 'string') {
      return { type: 'string', value }
    }
    else if (typeof value == 'boolean') {
      return { type: 'boolean', value }
    }
    else if (typeof value.toSqlString == 'function') {
      return { type: 'subquery', value }
    }
    else {
      throw new Error(`Unexpected value ${value} at ${valueIndex - 1}`)
    }
  }

  function array() {
    const value = []
    next()
    while (chr && chr != ')') {
      space()
      value.push(token())
      next()
    }
    return { type: 'array', value }
  }

  function identifier(value) {
    const parts = value.split('.')
    return parts.length > 1
      ? { type: 'id', value: parts.pop(), qualifiers: parts }
      : { type: 'id', value: value }
  }

  function token() {
    if (/['"]/.test(chr)) return string()
    if (chr == '*') return wildcard()
    if (chr == '?') return placeholder()
    if (chr == '(') return array()

    let value = ''
    while (chr && /[a-z0-9$_.]/i.test(chr)) {
      value += chr
      next()
    }

    if (chr == '(') return func(value)
    if (chr == '!') {
      next()
      return { type: 'op', name: 'not', args: [] }
    }
    if (chr && !/[), ]/.test(chr)) throw new Error(`Unexpected token ${chr}`)

    const lowerCase = value.toLowerCase()
    if (UNARY_OPERATORS.includes(lowerCase)) {
      return { type: 'op', name: lowerCase, args: [] }
    }
    else if (MODIFIERS.includes(lowerCase)) {
      return { type: 'mod', name: lowerCase, args: [] }
    }
    else if (lowerCase == 'null') {
      return { type: 'null' }
    }
    else if (Number.isFinite(Number(value))) {
      return { type: 'number', value: Number(value) }
    }
    else {
      return identifier(value)
    }
  }

  function keyword() {
    let value = ''
    while (chr && chr != ' ') {
      value += chr
      next()
    }
    if (/^not$/i.test(value) && /^\s+(?:between|in|like)/i.test(str.slice(i))) {
      space()
      value += ` ${keyword()}`
    }
    else if (/^is$/i.test(value) && /^\s+not/i.test(str)) {
      space()
      value += ' not'
    }
    return OPERATOR_ALIAS_MAP[value] || value.toLowerCase()
  }

  function between(name, t) {
    space()
    const start = token()
    space()
    const conj = keyword()
    if (conj != 'and') throw new Error(`Unexpected conj ${conj}`)
    space()
    const end = token()
    return { type: 'op', name, args: [ t, start, end ] }
  }

  function alias(t) {
    space()
    return { type: 'alias', args: [ t, token() ]}
  }

  function operator(t) {
    let name = keyword()
    if (name == 'as') return alias(t)
    if (name == 'between' || name == 'not between') {
      return between(name, t)
    }
    else if (BINARY_OPERATORS.includes(name)) {
      space()
      const isLower = chr == '('
      const operand = LOGICL_OPERATORS.includes(name) ? expr() : token()
      if (operand.type == 'op' && !isLower && isEqualOrHigher(name, operand.name)) {
        const { args } = operand
        operand.args = [
          { type: 'op', name, args: [ t, args[0] ] },
          args[1]
        ]
        return operand
      } else {
        return { type: 'op', name, args: [ t, operand ] }
      }
    }
    else {
      throw new Error(`Unexpected keyword ${name}`)
    }
  }

  function expr() {
    let node
    while (chr && chr != ')') {
      space()
      if (node) {
        if (UNARY_OPERATORS.includes(node.name)) {
          node.args[0] = expr()
        } else if (MODIFIERS.includes(node.name)) {
          node.args[0] = token()
        } else {
          node = operator(node)
        }
      }
      else if (chr == '(') {
        next()
        node = expr()
      }
      else {
        node = token()
      }
      space()
    }
    if (chr == ')') next()
    return node
  }

  return expr(str)
}

module.exports = parseExpr
