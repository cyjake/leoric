'use strict'

/**
 * This module consist of two major parts, helper functions like {@link module:lib/spell~formatSelect}, and the {@link Spell} class. The helper functions are left out as inner functions to keep Spell prototype clean. Most of the helper functions deal with the AST parsed by {@link module:lib/expr}.
 * @module
 */
const mysql = require('mysql')
const pluralize = require('pluralize')
const parseExpr = require('./expr')

const { escapeId, escape } = mysql

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
}

const AGGREGATOR_MAP = {
  count: 'count',
  average: 'avg',
  minimum: 'min',
  maximum: 'max',
  sum: 'sum'
}

/**
 * Check if the name passed in is an identifier or not.
 * - https://dev.mysql.com/doc/refman/5.7/en/identifiers.html
 * @param {string} name
 */
function isIdentifier(name) {
  return /^[0-9a-z$_.]+$/i.test(name)
}

/**
 * Allows two types of params:
 *
 *     parseConditions({ foo: { $op: value } })
 *     parseConditions('foo = ?', value)
 *
 * @param {(string|Object)} conditions
 * @param {...*} values
 */
function parseConditions(conditions, ...values) {
  if (typeof conditions == 'object') {
    return parseObjectConditions(conditions)
  }
  else if (typeof conditions == 'string') {
    return [parseExpr(conditions, ...values)]
  }
  else {
    throw new Error(`Unsupported conditions ${conditions}`)
  }
}

/**
 * A wrapper of parseExpr to help parsing values in object conditions.
 * @param {*} value
 */
function parseObjectValue(value) {
  try {
    return parseExpr('?', value)
  }
  catch (err) {
    throw new Error(`Unexpected object value ${value}`)
  }
}

/**
 * parse conditions in MongoDB style, which is quite polular in ORMs for JavaScript. See {@link module:lib/spell~OPERATOR_MAP} for supported `$op`s.
 * @example
 * { foo: null }
 * { foo: { $gt: new Date(2012, 4, 15) } }
 * { foo: { $between: [1, 10] } }
 * @param {Object} conditions
 */
function parseObjectConditions(conditions) {
  const result = []

  for (const name in conditions) {
    const value = conditions[name]

    if (value instanceof module.exports) {
      result.push({
        type: 'op',
        name: 'in',
        args: [ parseExpr(name), { type: 'subquery', value } ]
      })
    }
    else if (value != null && typeof value == 'object' && !Array.isArray(value) && Object.keys(value).length == 1) {
      for (const $op in value) {
        const op = OPERATOR_MAP[$op]
        const args = [ parseExpr(name) ]
        const val = value[$op]
        if (op == 'between' || op == 'not between') {
          args.push(parseObjectValue(val[0]), parseObjectValue(val[1]))
        } else {
          args.push(parseObjectValue(val))
        }
        result.push({ type: 'op', name: op, args })
      }
    }
    else {
      result.push({
        type: 'op',
        name: '=',
        args: [ parseExpr(name), parseObjectValue(value) ]
      })
    }
  }

  return result
}

/**
 * A helper method that translates select to filter function from following types:
 *
 *     name => ['foo', 'bar'].includes(name)  // as is
 *     'foo bar'                              //
 *     ['foo', 'bar']                         // as the arrow function above
 *
 * @param {(function|string|string[])} select
 */
function parseSelect(select) {
  const type = typeof select

  if (type == 'function')  return select
  if (type == 'string') select = select.split(/\s+/)
  if (Array.isArray(select)) {
    return name => select.includes(name)
  } else {
    throw new Error(`Invalid select ${select}`)
  }
}

/**
 * Translate key-value pairs of attributes into key-value pairs of columns. Get ready for the SET part when generating SQL.
 * @param {Spell}  spell
 * @param {Object} obj   - key-value pairs of attributes
 */
function parseSet(spell, obj) {
  const { Model } = spell
  const sets = {}
  for (const name in obj) {
    if (!isIdentifier(name)) throw new Error(`Invalid column ${name}`)
    sets[Model.unalias(name)] = Model.uncast(obj[name], Model.schema[name].type)
  }
  return sets
}

/**
 * Format orders into ORDER BY clause in SQL
 * @param {Object[]} orders
 */
function formatOrders(orders) {
  const formatOrder = ([token, order]) => {
    const column = formatColumn(token)
    return order == 'desc' ? `${column} DESC` : column
  }
  return orders.map(formatOrder)
}

/**
 * Format token into identifiers/functions/etc. in SQL
 * @example
 * formatColumn({ type: 'id', value: 'title' })
 * // => `title`
 *
 * formatColumn({ type: 'func', name: 'year', args: [ { type: 'id', value: 'createdAt' } ] })
 * // => YEAR(`createdAt`)
 *
 * @param {(string|Object)} token
 */
function formatColumn(token) {
  if (typeof token == 'string') token = parseExpr(token)

  if (token.type == 'id') {
    return formatIdentifier(token)
  } else {
    return formatExpr(token)
  }
}

/**
 * Format identifiers into escaped string with qualifiers.
 * @param {Object} ast
 */
function formatIdentifier(ast) {
  const { value, qualifiers } = ast
  if (qualifiers && qualifiers.length > 0) {
    return `${qualifiers.map(escapeId).join('.')}.${escapeId(value)}`
  } else {
    return escapeId(value)
  }
}

/**
 * Format the abstract syntax tree of an expression into escaped string.
 * @param {Object} ast
 */
function formatExpr(ast) {
  const { type, name, value, args } = ast

  switch (type) {
    case 'string':
    case 'number':
    case 'date':
    case 'boolean':
    case 'null':
      return escape(value)
    case 'subquery':
      return `(${value.toSqlString()})`
    case 'array':
      return `(${escape(value)})`
    case 'wildcard':
      return '*'
    case 'alias':
      return `${formatExpr(args[0])} AS ${formatIdentifier(args[1])}`
    case 'mod':
      return `${name.to.toUpperCase()} ${formatExpr(args[0])}`
    case 'id':
      return formatIdentifier(ast)
    case 'op':
      return formatOpExpr(ast)
    case 'func':
      return `${name.toUpperCase()}(${args.map(formatExpr).join(', ')})`
    default:
      throw new Error(`Unexpected type ${type}`)
  }
}

/**
 * Check if current token is logical operator or not, e.g. `AND`/`NOT`/`OR`.
 * @param {Object} ast
 */
function isLogicalOp({ type, name }) {
  return type == 'op' && ['and', 'not', 'or'].includes(name)
}

/**
 * Format `{ type: 'op' }` expressions into escaped string.
 * @param {Object} ast
 */
function formatOpExpr(ast) {
  const { name, args } = ast
  const params = args.map(arg => {
    return isLogicalOp(ast) && isLogicalOp(arg)
      ? `(${formatExpr(arg)})`
      : formatExpr(arg)
  })

  if (name == 'between' || name == 'not between') {
    return `${params[0]} ${name.toUpperCase()} ${params[1]} AND ${params[2]}`
  }
  else if (name == 'not') {
    return `NOT ${params[0]}`
  }
  else if (args[1].type == 'null') {
    if (['=', '!='].includes(name)) {
      const op = name == '=' ? 'IS' : 'IS NOT'
      return `${params[0]} ${op} NULL`
    } else {
      throw new Error(`Invalid operator ${name} against null`)
    }
  }
  else if (args[1].type == 'array') {
    let op = name
    if (name == '=') {
      op = 'in'
    } else if (name == '!=') {
      op = 'not in'
    }
    if (['in', 'not in'].includes(op)) {
      return `${params[0]} ${op.toUpperCase()} ${params[1]}`
    } else {
      throw new Error(`Invalid operator ${name} against ${args[1].value}`)
    }
  }
  else {
    return `${params[0]} ${name.toUpperCase()} ${params[1]}`
  }
}

/**
 * Format a spell without joins into a full SELECT query. This function is also used to format the subquery which is then used as a drived table in a SELECT with joins.
 * @param {Spell} spell
 */
function formatSelectWithoutJoin(spell) {
  const { columns, whereConditions, groups, havingConditions, orders, rowCount, skip } = spell
  const chunks = []

  if (columns.length > 0) {
    if (groups.length > 0) {
      outer:
      for (const group of groups) {
        for (const column of columns) {
          if (column.type == 'alias' && column.args[1].value == group.value) {
            continue outer
          }
        }
        columns.push(group)
      }
    }
    const selects = []
    for (const token of columns) {
      const column = formatColumn(token)
      if (!selects.includes(column)) selects.push(column)
    }
    chunks.push(`SELECT ${selects.join(', ')}`)
  } else {
    chunks.push('SELECT *')
  }

  const table = formatExpr(spell.table)
  chunks.push(`FROM ${table}`)
  if (spell.table.value instanceof spell.constructor) {
    chunks.push(`AS t${spell.subqueryIndex++}`)
  }

  if (whereConditions.length > 0) {
    chunks.push(`WHERE ${formatConditions(whereConditions)}`)
  }

  if (groups.length > 0) {
    const groupColumns = groups.map(formatColumn)
    chunks.push(`GROUP BY ${groupColumns.join(', ')}`)
  }

  if (havingConditions.length > 0) {
    chunks.push(`HAVING ${formatConditions(havingConditions)}`)
  }

  if (orders.length > 0) chunks.push(`ORDER BY ${formatOrders(orders).join(', ')}`)
  if (rowCount > 0) chunks.push(`LIMIT ${rowCount}`)
  if (skip > 0) chunks.push(`OFFSET ${skip}`)

  return chunks.join(' ')
}

/**
 * Walk through an ast, starting from the root token.
 * @param {Object}   ast
 * @param {Function} fn
 */
function walkExpr(ast, fn) {
  fn(ast)
  if (ast.args) {
    for (const arg of ast.args) walkExpr(arg, fn)
  }
  return ast
}

/**
 * Walk through an ast with returned tokens preferred over the originals, which is convenient to update the ast.
 * @example
 * // update all of the identifiers' qualifiers:
 * copyExpr(ast, ({ type, value }) => {
 *   if (type == 'id') return { type, qualifiers: ['posts'], value }
 * })
 * @param {Object}   ast
 * @param {function} fn
 */
function copyExpr(ast, fn) {
  ast = fn(ast) || ast
  if (ast.args) {
    for (let i = 0; i < ast.args.length; i++) {
      ast.args[i] = copyExpr(ast.args[i], fn)
    }
  }
  return ast
}

/**
 * Format a spell with joins into a full SELECT query.
 * @param {Spell} spell
 */
function formatSelectWithJoin(spell) {
  const { Model, columns, whereConditions, groups, havingConditions, orders, rowCount, skip, joins } = spell
  const subspell = spell.dup
  const baseName = Model.aliasName
  const selection = { [baseName]: [] }

  for (const token of columns) {
    let qualifier = baseName
    walkExpr(token, ({ type, qualifiers, value }) => {
      if (type == 'id' && qualifiers && qualifiers[0] != baseName) {
        [qualifier] = qualifiers
      }
    })
    if (!selection[qualifier]) selection[qualifier] = []
    selection[qualifier].push(token)
  }

  subspell.groups = []
  for (const token of groups) {
    let qualifier
    const group = copyExpr(JSON.parse(JSON.stringify(token)), ({ type, qualifiers, value }) => {
      if (type == 'id') {
        if (!qualifiers) qualifiers = [baseName]
        qualifier = qualifiers[0]
        return { type, qualifiers, value }
      }
    })
    selection[qualifier].push(group)
    const subgroup = copyExpr(JSON.parse(JSON.stringify(group)), ({ type, qualifiers, value }) => {
      if (type == 'id' && qualifiers[0] == baseName) return { type, value }
    })
    subspell.groups.push(subgroup)
  }

  subspell.columns = []
  for (const token of selection[baseName]) {
    const column = copyExpr(JSON.parse(JSON.stringify(token)), ({ type, qualifiers, value }) => {
      if (type == 'id') return { type, value }
    })
    subspell.columns.push(column)
  }
  if (spell.derivable) selection[baseName] = []

  for (const qualifier in joins) {
    const relation = joins[qualifier]
    if (!selection[qualifier]) {
      selection[qualifier] = relation.columns || []
    }
    if (selection[qualifier].length > 0 && spell.dispatchable) {
      selection[qualifier].push({ type: 'id', qualifiers: [qualifier], value: relation.Model.primaryColumn })
    }
    walkExpr(relation.on, ({ type, qualifiers, value }) => {
      if (type == 'id' && qualifiers[0] == baseName && subspell.columns.length > 0) {
        subspell.columns.push({ type, value })
      }
    })
  }

  subspell.whereConditions = []
  for (let i = whereConditions.length - 1; i >= 0; i--) {
    const condition = whereConditions[i]
    let internal = true
    walkExpr(condition, ({ type, qualifiers }) => {
      if (type == 'id' && qualifiers && qualifiers[0] != baseName) {
        internal = false
      }
    })
    if (internal) {
      subspell.whereConditions.unshift(condition)
      whereConditions.splice(i, 1)
    }
  }

  subspell.orders = []
  for (let i = orders.length - 1; i >= 0; i--) {
    const [token, order] = orders[i]
    const { type, qualifiers, value } = token
    if (type == 'id' && !qualifiers || qualifiers[0] == baseName) {
      subspell.orders.unshift([{ type, value }, order])
      token.qualifiers = [baseName]
    }
  }

  const selects = []
  for (const qualifier in selection) {
    const attrs = selection[qualifier]
    if (attrs.length > 0) {
      for (const token of attrs) {
        const column = formatColumn(token)
        if (!selects.includes(column)) selects.push(column)
      }
    } else {
      selects.push(`${escapeId(qualifier)}.*`)
    }
  }

  const chunks = [
    `SELECT ${selects.join(', ')}`
  ]

  if (spell.derivable && (subspell.columns.length > 0 || subspell.whereConditions.length > 0 || skip > 0 || rowCount > 0)) {
    chunks.push(`FROM (${formatSelectWithoutJoin(subspell)}) AS ${escapeId(baseName)}`)
  } else {
    chunks.push(`FROM ${escapeId(Model.table)} AS ${escapeId(baseName)}`)
  }

  for (const qualifier in joins) {
    const { Model: RefModel, on } = joins[qualifier]
    chunks.push(`LEFT JOIN ${escapeId(RefModel.table)} AS ${escapeId(qualifier)} ON ${formatExpr(on)}`)
  }

  if (whereConditions.length > 0) chunks.push(`WHERE ${formatConditions(whereConditions)}`)

  if (!spell.derivable) {
    if (groups.length > 0) {
      chunks.push(`GROUP BY ${groups.map(formatColumn).join(', ')}`)
    }

    if (havingConditions.length > 0) {
      chunks.push(`HAVING ${formatConditions(havingConditions)}`)
    }
  }

  if (orders.length > 0) chunks.push(`ORDER BY ${formatOrders(orders).join(', ')}`)

  return chunks.join(' ')
}

/**
 * To help choosing the right function when formatting a spell into SELECT query.
 * @param {Spell} spell
 */
function formatSelect(spell) {
  return Object.keys(spell.joins).length > 0
    ? formatSelectWithJoin(spell)
    : formatSelectWithoutJoin(spell)
}

/**
 * Format the spell into a DELETE query.
 * @param {Spell} spell
 */
function formatDelete(spell) {
  const { Model, whereConditions } = spell
  const table = escapeId(Model.table)

  if (whereConditions.length > 0) {
    return `DELETE FROM ${table} WHERE ${formatConditions(whereConditions)}`
  } else {
    return `DELETE FROM ${table}`
  }
}

/**
 * Format an array of conditions into an expression. Conditions will be joined with `AND`.
 * @param {Object[]} conditions - An array of parsed where/having/on conditions
 */
function formatConditions(conditions) {
  return conditions
    .map(condition => {
      return isLogicalOp(condition) && condition.name == 'or'
        ? `(${formatExpr(condition)})`
        : formatExpr(condition)
    })
    .join(' AND ')
}

/**
 * Format a spell into INSERT query.
 * @param {Spell} spell
 */
function formatInsert(spell) {
  const { Model, sets } = spell
  const columns = Object.keys(sets).map(escapeId)
  const values = Object.values(sets)
  return `INSERT INTO ${escapeId(Model.table)} (${columns.join(', ')}) VALUES (${escape(values)})`
}

/**
 * Format a spell into UPDATE query
 * @param {Spell} spell
 */
function formatUpdate(spell) {
  const { Model, whereConditions } = spell
  return `UPDATE ${escapeId(Model.table)} SET ${escape(spell.sets)} WHERE ${formatConditions(whereConditions)}`
}

/**
 * Taking advantage of MySQL's `on duplicate key update`, though knex does not support this because it has got several databases to be compliant of. PostgreSQL has got proper `upsert`. Maybe we can file a PR to knex someday.
 *
 * References:
 * - http://dev.mysql.com/doc/refman/5.7/en/insert-on-duplicate.html
 * - https://github.com/tgriesser/knex/issues/701
 *
 * @param {Spell} spell
 */
function formatUpsert(spell) {
  const insert = formatInsert(spell)
  return `${insert} ON DUPLICATE KEY UPDATE ${escape(spell.sets)}`
}

/**
 * Construct on conditions as ast from associations.
 * @example
 * joinOnConditions(spell, Post, 'posts', 'comments', {
 *     relation: { Model: Comment, foreignKey: 'postId' }
 * })
 *
 * @param {Spell}  spell
 * @param {Model}  BaseModel
 * @param {string} baseName
 * @param {string} refName
 * @param {Object} opts
 * @param {Object} opts.relation - the relation between BaseModel and RefModel
 * @param {Object} opts.where    - used to override relation.where when processing `{ through }` relations
 */
function joinOnConditions(spell, BaseModel, baseName, refName, { where, relation } = {}) {
  const { Model: RefModel, foreignKey, belongsTo } = relation
  const [baseKey, refKey] = belongsTo
    ? [foreignKey, RefModel.primaryKey]
    : [BaseModel.primaryKey, foreignKey]

  const onConditions = {
    type: 'op', name: '=',
    args: [
      { type: 'id', value: baseKey, qualifiers: [baseName] },
      { type: 'id', value: refKey, qualifiers: [refName] }
    ]
  }
  if (!where) where = relation.where
  if (where) {
    const whereConditions = walkExpr(parseConditions(where)[0], node => {
      if (node.type == 'id') node.qualifiers = [refName]
    })
    return { type: 'op', name: 'and', args: [ onConditions, whereConditions ] }
  } else {
    return onConditions
  }
}

/**
 * Find relation by certain criteria.
 * @example
 * findRelation({ Model: Post })
 * @param {Object} relations - Model relations
 * @param {Object} opts      - Search criteria, e.g. { Model }
 */
function findRelation(relations, opts) {
  for (const qualifier in relations) {
    const relation = relations[qualifier]
    let found = true
    for (const name in opts) {
      if (opts[name] != relation[name]) {
        found = false
        break
      }
    }
    if (found) return relation
  }
  return null
}

/**
 * Parse relations into spell.joins
 * @param {Spell}  spell     - An instance of spell
 * @param {Model}  BaseModel - A subclass of Bone
 * @param {string} baseName  - Might be Model.aliasName, Model.table, or other names given by users
 * @param {string} refName   - The name of the join target
 * @param {Object} opts      - Extra options such as { select, throughRelation }
 */
function joinRelation(spell, BaseModel, baseName, refName, opts = {}) {
  const { joins } = spell
  let relation = BaseModel.relations[refName] || BaseModel.relations[pluralize(refName, 1)]

  if (refName in joins) throw new Error(`Duplicated ${refName} in join tables`)
  if (!relation && opts.targetRelation) {
    relation = findRelation(BaseModel.relations, { Model: opts.targetRelation.Model })
  }
  if (!relation) {
    throw new Error(`Unable to find relation ${refName} on ${BaseModel.name}`)
  }

  const { through, Model: RefModel, includes } = relation
  if (relation.select && !relation.attributes) {
    relation.attributes = RefModel.attributes.filter(parseSelect(relation.select))
  }
  if (through) {
    const throughRelation = BaseModel.relations[through]
    // multiple relations might be mounted through the same intermediate relation.
    // such as tagMaps => colorTags, tagMaps => styleTags
    // in this case, the intermediate relation shall be mounted only once.
    if (!joins[through]) joinRelation(spell, BaseModel, baseName, through)
    joinRelation(spell, throughRelation.Model, through, refName, {
      ...opts, throughRelation, targetRelation: relation
    })
  } else {
    const { select, throughRelation, targetRelation } = opts
    const where = targetRelation ? targetRelation.where : null
    const attributes = select
      ? RefModel.attributes.filter(parseSelect(select))
      : relation.attributes

    if (attributes && !attributes.includes(RefModel.primaryKey)) {
      attributes.push(RefModel.primaryKey)
    }
    spell.joins[refName] = {
      Model: RefModel,
      attributes,
      on: joinOnConditions(spell, BaseModel, baseName, refName, { where, relation }),
      hasMany: relation.hasMany || (throughRelation ? throughRelation.hasMany : false)
    }
    if (includes) joinRelation(spell, RefModel, refName, includes)
  }
}

/**
 * Check if current function is an aggreator such as COUNT/AVG/MIN/MAX/SUM.
 * @param {string} func
 */
function isAggregator(func) {
  return AGGREGATOR_MAP[func]
}

/**
 * Find model by qualifiers.
 * @example
 * findModel(spell, ['comments'])
 * findModel(spell)
 *
 * @param {Spell} spell
 * @param {string[]} qualifiers
 */
function findModel(spell, qualifiers) {
  const qualifier = qualifiers && qualifiers[0]
  const Model = qualifier && qualifier != spell.Model.aliasName
    ? spell.joins[qualifier].Model
    : spell.Model
  if (!Model) throw new Error(`Unabled to find model ${qualifiers}`)
  return Model
}

function unalias(spell, expr) {
  return walkExpr(expr, token => {
    if (token.type == 'id') {
      const Model = findModel(spell, token.qualifiers)
      token.value = Model.unalias(token.value)
    }
  })
}

/**
 * If Model supports soft delete, and deletedAt isn't specified in whereConditions yet, and the table isn't a subquery, append a default where({ deletedAt: null }).
 */
function Spell_deletedAtIsNull() {
  const { Model, table, whereConditions } = this
  const { schema } = Model

  if (!schema.deletedAt) return
  for (const condition of whereConditions) {
    let found = false
    walkExpr(condition, ({ type, value }) => {
      if (type != 'id') return
      if (value == 'deletedAt' || value == schema.deletedAt.column) {
        found = true
      }
    })
    if (found) return
  }
  if (table.type == 'id') this.$where({ deletedAt: null })
}

/**
 * Spell is the query builder of Leoric which has several important charactors that made a powerful querying interface possible.
 *
 * - Deferred
 * - Method chaining
 * - Parsing SQL expressions
 *
 * Some of the methods of Spell follow such pattern:
 *
 * - Methods that begin with `$`, such as {@link Spell#$group}, are methods that support chaining. For example, we can do `new Spell().$select('foo').$group('bar')` to construct an SQL query.
 * - These methods have twin methods without the `$`, which have the same functionalities but differ in only one thing, every call of these methods makes changes on a duplicate of current spell and returns the duplicated one. For example, `new Spell().select('foo').group('bar')` works and each call, `new Spell()`, `.select('foo')`, and `.group('bar')`, returns a new spell.
 *
 * Spell adapts this pattern to make following usage possible:
 *
 *     const query = Post.find('createdAt > ?', new Date(2012, 4, 15))
 *     const [ { count } ] = query.count()
 *     cosnt posts = query.offset(page * pageSize).limit(pageSize)
 *     this.body = { count, posts }
 *
 * `query.count()` and `query.offset()` won't interfere with each other because `new Spell` gets returned everytime these methods were called. For brevity, only the methods start with `$` are documented.
 *
 * For performance reason, {@link Bone} use the prefixed with `$` ones mostly.
 * @alias Spell
 */
class Spell {
  /**
   * Create a spell.
   * @param {Model}         Model   - A sub class of {@link Bone}.
   * @param {Spell~factory} factory - The factory function to call when spell.then is called.
   * @param {Object}        opts    - Extra attributes to be set.
   */
  constructor(Model, factory, opts) {
    /**
     * A sub-class of Bone.
     */
    this.Model = Model
    /**
     * The factory callback which gets the final SQL string, execute it on database, and return the dispatched results. The results might be an instance of model, a {@link Collection} of models, or a result set. See {@link Bone.find} for detail of this callback.
     * @callback Spell~factory
     * @param {Spell} - the final spell
     */
    this.factory = factory
    Object.assign(this, {
      command: 'select',
      columns: [],
      table: parseExpr(Model.table),
      whereConditions: [],
      groups: [],
      orders: [],
      havingConditions: [],
      joins: {},
      skip: 0,
      scopes: [ Spell_deletedAtIsNull ],
      subqueryIndex: 0
    }, opts)
  }

  get dispatchable() {
    const { columns } = this
    for (const token of columns) {
      const { type, name: func } = token
      if (type == 'func' && isAggregator(func)) return false
      if (type == 'alias') return false
    }
    return this.groups.length == 0
  }

  get derivable() {
    const { groups, joins, Model } = this
    const joinNames = []
    const baseName = Model.aliasName

    if (groups.length == 0) return true

    for (const qualifier in joins) {
      const { on } = joins[qualifier]
      walkExpr(on, ({ type, qualifiers, value }) => {
        if (type == 'id' && qualifiers[0] == baseName) {
          joinNames.push(value)
        }
      })
    }

    // If group columns contains all the columns in join conditions, derived table is still applicable.
    for (const name of joinNames) {
      let found = false
      for (const { type, qualifiers, value } of groups) {
        if (type == 'id' && (!qualifiers || qualifiers[0] == baseName) && value == name) {
          found = true
        }
      }
      if (!found) return false
    }

    return true
  }

  get unscoped() {
    const spell = this.dup
    spell.scopes = []
    return spell
  }

  get all() {
    return this
  }

  get first() {
    const spell = this.order(this.Model.primaryKey)
    return spell.$get(0)
  }

  get last() {
    const spell = this.order(this.Model.primaryKey, 'desc')
    return spell.$get(0)
  }

  /**
   * Get a duplicate of current spell.
   * @returns {Spell}
   */
  get dup() {
    return new Spell(this.Model, this.factory, {
      command: this.command,
      columns: [...this.columns],
      sets: this.sets,
      table: this.table,
      whereConditions: [...this.whereConditions],
      groups: [...this.groups],
      orders: [...this.orders],
      havingConditions: [...this.havingConditions],
      joins: this.joins,
      skip: this.skip,
      rowCount: this.rowCount,
      scopes: [...this.scopes]
    })
  }

  /**
   * Get the instance from collection by index. Helper method for {@link Bone#first} and {@link Bone#last}.
   * @param {number} index
   * @returns {Bone}
   */
  $get(index) {
    const { factory, Model } = this
    this.factory = spell => {
      return factory(spell).then(results => {
        const result = results[index]
        return result instanceof Model ? result : null
      })
    }
    return this
  }

  /**
   * Fake spell as a thenable object so it can be consumed like a regular Promise.
   * @example
   * const post = await Post.first
   * Post.last.then(post => handle(post))
   * @param {Function} resolve
   * @param {Function} reject
   */
  then(resolve, reject) {
    this.promise = new Promise(resolve => {
      setImmediate(() => {
        resolve(this.factory.call(null, this))
      })
    })
    return this.promise.then(resolve, reject)
  }

  /**
   * Same as {@link Spell#catch}
   * @param {Function} reject
   */
  catch(reject) {
    return this.promise.catch(reject)
  }

  /**
   * Generate an INSERT query.
   * @private
   * @param {Object} obj - key-values pairs
   */
  $insert(obj) {
    this.sets = parseSet(this, obj)
    this.command = 'insert'
    return this
  }

  /**
   * Generate a upsert-like query which takes advantage of ON DUPLICATE KEY UPDATE.
   * @private
   * @param {Object} obj - key-value pairs to SET
   */
  $upsert(obj) {
    this.sets = parseSet(this, obj)
    this.command = 'upsert'
    return this
  }

  /**
   * Whitelist attributes to select. Can be called repeatedly to select more attributes.
   * @param {...string} names
   * @example
   * .select('title')
   * .select('title', 'createdAt')
   * .select('IFNULL(title, "Untitled")')
   */
  $select(...names) {
    const firstName = names[0]
    if (Array.isArray(firstName)) {
      names = firstName
    }
    else if (typeof firstName == 'function') {
      names = this.Model.attributes.filter(firstName)
    }
    for (const name of names) {
      this.columns.push(unalias(this, parseExpr(name)))
    }
    return this
  }

  /**
   * Make a UPDATE query with values updated by generating SET key=value from obj.
   * @private
   * @param {Object} obj - key-value pairs to SET
   */
  $update(obj) {
    this.sets = parseSet(this, obj)
    this.command = 'update'
    return this
  }

  /**
   * Set query command to DELETE.
   * @returns {Spell}
   */
  $delete() {
    this.command = 'delete'
    return this
  }

  /**
   * Set the table of the spell. If an instance of {@link Spell} is passed, it will be used as a derived table.
   * @param {string|Spell} table
   * @returns {Spell}
   */
  $from(table) {
    this.table = table instanceof Spell
      ? { type: 'subquery', value: table }
      : parseExpr(table)
    return this
  }

  /**
   * Set WHERE conditions. Both string conditions and object conditions are supported.
   * @example
   * .where({ foo: null })
   * .where('foo = ? and bar >= ?', null, 42)
   * @param {string|Object} conditions
   * @param {...*}          values     - only necessary when using templated string conditions
   * @returns {Spell}
   */
  $where(conditions, ...values) {
    this.whereConditions.push(...parseConditions(conditions, ...values).map(unalias.bind(null, this)))
    return this
  }

  /**
   * Set GROUP BY attributes. `select_expr` with `AS` is supported, hence following expressions have the same effect:
   *
   *     .group('YEAR(createdAt) AS year')
   *     // instead of
   *     .select('YEAR(createdAt)) AS year').group('year')
   *
   * @example
   * .group('city')
   * .group('city', 'province', 'nation')
   * .group('YEAR(createdAt)')
   * .group('YEAR(createdAt) AS year')
   * @param {...string} names
   * @returns {Spell}
   */
  $group(...names) {
    const { columns, groups } = this
    for (const name of names) {
      const token = unalias(this, parseExpr(name))
      if (token.type == 'alias') {
        columns.push(token)
        const { value, qualifiers } = token.args[1]
        const aliasName = { type: 'id', value }
        if (qualifiers) aliasName.qualifiers = qualifiers
        groups.push(aliasName)
      } else {
        groups.push(token)
      }
    }
    return this
  }

  /**
   * @example
   * .order('title')
   * .order('title', 'desc')
   * .order({ title: 'desc' })
   * @param {string|Object} name
   * @param {string}        order
   * @returns {Spell}
   */
  $order(name, order) {
    if (typeof name == 'object') {
      for (const prop in name) {
        this.$order(prop, name[prop] || 'asc')
      }
    }
    else if (!order) {
      [name, order] = name.split(/\s+/)
      this.$order(name, order || 'asc')
    }
    else {
      this.orders.push([
        unalias(this, parseExpr(name)),
        order && order.toLowerCase() == 'desc' ? 'desc' : 'asc'
      ])
    }
    return this
  }

  /**
   * Set the OFFSET of the query.
   * @param {number} skip
   * @returns {Spell}
   */
  $offset(skip) {
    skip = +skip
    if (Number.isNaN(skip)) throw new Error(`Invalid offset ${skip}`)
    this.skip = skip
    return this
  }

  /**
   * Set the LIMIT of the query.
   * @param {number} rowCount
   * @returns {Spell}
   */
  $limit(rowCount) {
    rowCount = +rowCount
    if (Number.isNaN(rowCount)) throw new Error(`Invalid limit ${rowCount}`)
    this.rowCount = rowCount
    return this
  }

  /**
   * @example
   * .having('average between ? and ?', 10, 20)
   * .having('maximum > 42')
   * .having({ count: 5 })
   *
   * @param {string|Object} conditions
   * @param {...*}          values
   * @returns {Spell}
   */
  $having(conditions, values) {
    this.havingConditions.push(...parseConditions(conditions, values).map(unalias.bind(null, this)))
    return this
  }

  /**
   * @example
   * .with('attachment')
   * .with('attachment', 'comments')
   * .with({ comments: { select: 'content' } })
   *
   * @param {...string} qualifiers
   * @returns {Spell}
   */
  $with(...qualifiers) {
    for (const qualifier of qualifiers) {
      if (typeof qualifier == 'object') {
        for (const key in qualifier) {
          joinRelation(this, this.Model, this.Model.aliasName, key, qualifier[key])
        }
      } else {
        joinRelation(this, this.Model, this.Model.aliasName, qualifier)
      }
    }
    for (const qualifier in this.joins) {
      const relation = this.joins[qualifier]
      if (relation.attributes) {
        relation.columns = relation.attributes.map(name => {
          // since relation.attributes contains unqualified names only (no FUNC(), no AS)
          return unalias(this, parseExpr(`${qualifier}.${name}`))
        })
      }
      relation.on = unalias(this, relation.on)
    }
    return this
  }

  /**
   * @example
   * .join(User, 'users.id = posts.authorId')
   * .join(TagMap, 'tagMaps.targetId = posts.id and tagMaps.targetType = 0')
   *
   * @param {Model}         Model
   * @param {string|Object} onConditions
   * @param {...*}          values
   * @returns {Spell}
   */
  $join(Model, onConditions, ...values) {
    if (typeof Model == 'string') {
      return this.$with(...arguments)
    }
    const qualifier = Model.aliasName
    const { joins } = this

    if (qualifier in joins) {
      throw new Error(`Invalid join target. ${qualifier} already defined.`)
    }
    joins[qualifier] = { Model }
    joins[qualifier].on = unalias(this, parseConditions(onConditions, ...values)[0])
    return this
  }

  /**
   * Get the query results by batch. Returns an async iterator which can then be consumed with an async loop or the cutting edge `for await`. The iterator is an Object that contains a `next()` method:
   *
   *     const iterator = {
   *       i: 0,
   *       next: () => Promise.resolve(this.i++)
   *     }
   *
   * See examples to consume async iterators properly. Currently async iterator is [proposed](https://github.com/tc39/proposal-async-iteration) and [implemented by V8](https://jakearchibald.com/2017/async-iterators-and-generators/) but hasn't made into Node.js LTS yet.
   * @example
   * async function consume() {
   *   const batch = Post.all.batch()
   *   while (true) {
   *     const { done, value: post } = await batch.next()
   *     if (value) handle(post)
   *     if (done) break
   *   }
   * }
   * // or
   * for await (const post of Post.all.batch()) {
   *    handle(post)
   * }
   *
   * @param {number} size
   * @returns {Object}
   */
  batch(size = 1000) {
    const limit = parseInt(size, 10)
    if (!(limit > 0)) throw new Error(`Invalid batch limit ${size}`)
    // Duplicate the spell because spell.skip gets updated while iterating over the batch.
    const spell = this.limit(limit)
    const { factory } = spell
    let queue
    let i = 0
    const next = () => {
      if (!queue) queue = factory(spell)
      return queue.then(results => {
        if (results.length == 0) return Promise.resolve({ done: true })
        if (results[i]) {
          return {
            done: results.length < limit && i == results.length - 1,
            value: results[i++]
          }
        } else {
          queue = null
          i = 0
          spell.$offset(spell.skip + limit)
          return next()
        }
      })
    }
    return { next }
  }

  /**
   * Format current spell to SQL string.
   * @returns {string}
   */
  toSqlString() {
    for (const scope of this.scopes) scope.call(this)

    switch (this.command) {
      case 'insert':
        return formatInsert(this)
      case 'select':
        return formatSelect(this)
      case 'update':
        return formatUpdate(this)
      case 'delete':
        return formatDelete(this)
      case 'upsert':
        return formatUpsert(this)
      default:
        throw new Error(`Unsupported sql command ${this.command}`)
    }
  }

  /**
   * An alias of {@link Spell#toSqlString}
   * @returns {string}
   */
  toString() {
    return this.toSqlString()
  }
}

for (const aggregator in AGGREGATOR_MAP) {
  const func = AGGREGATOR_MAP[aggregator]
  Object.defineProperty(Spell.prototype, `$${aggregator}`, {
    configurable: true,
    writable: true,
    value: function Spell_aggreator(name = '*') {
      name = isIdentifier(name) ? name : '*'
      this.$select(`${func}(${name}) as ${aggregator}`)
      return this
    }
  })
}

for (const method of Object.getOwnPropertyNames(Spell.prototype)) {
  if (method[0] == '$') {
    const descriptor = Object.getOwnPropertyDescriptor(Spell.prototype, method)
    Object.defineProperty(Spell.prototype, method.slice(1), Object.assign({}, descriptor, {
      value: function Spell_dup() {
        const spell = this.dup
        spell[method](...arguments)
        return spell
      }
    }))
  }
}

module.exports = Spell
