'use strict'

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
 * parse conditions in MongoDB style, which is quite polular in ORMs for JavaScript, e.g.
 *
 *     { foo: null }
 *     { foo: { $gt: new Date(2012, 4, 15) } }
 *     { foo: { $between: [1, 10] } }
 *
 * See OPERATOR_MAP for supported `$op`s.
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
    return select.includes.bind(select)
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
 *
 *    formatColumn({ type: 'id', value: 'title' })
 *    // => `title`
 *
 *    formatColumn({ type: 'func', name: 'year', args: [ { type: 'id', value: 'createdAt' } ] })
 *    // => YEAR(`createdAt`)
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

function formatIdentifier(ast) {
  const { value, qualifiers } = ast
  if (qualifiers && qualifiers.length > 0) {
    return `${qualifiers.map(escapeId).join('.')}.${escapeId(value)}`
  } else {
    return escapeId(value)
  }
}

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
    case 'id':
      return formatIdentifier(ast)
    case 'op':
      return formatOpExpr(ast)
    case 'func':
      return `${name.toUpperCase()}(${formatExpr(args[0])})`
    default:
      throw new Error(`Unexpected type ${type}`)
  }
}

function isLogicalOp({ type, name }) {
  return type == 'op' && ['and', 'or'].includes(name)
}

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
  else if (name == 'distinct') {
    return `${name} ${params[0]}`
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

function formatSelectWithoutJoin(spell) {
  const { columns, whereConditions, groups, havingConditions, orders, rowCount, skip } = spell
  const chunks = []

  if (columns.length > 0) {
    if (groups.length > 0) {
      for (const group of groups) columns.push(group)
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

function walkExpr(ast, fn) {
  fn(ast)
  if (ast.args) {
    for (const arg of ast.args) walkExpr(arg, fn)
  }
  return ast
}

function copyExpr(ast, fn) {
  ast = fn(ast) || ast
  if (ast.args) {
    for (let i = 0; i < ast.args.length; i++) {
      ast.args[i] = copyExpr(ast.args[i], fn)
    }
  }
  return ast
}

function formatSelectWithJoin(spell) {
  const { Model, columns, whereConditions, groups, havingConditions, orders, rowCount, skip, joins } = spell
  const subspell = spell.dup
  const baseName = Model.alias
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

function formatSelect(spell) {
  return Object.keys(spell.joins).length > 0
    ? formatSelectWithJoin(spell)
    : formatSelectWithoutJoin(spell)
}

function formatDelete(spell) {
  const { Model, whereConditions } = spell
  const table = escapeId(Model.table)

  if (whereConditions.length > 0) {
    return `DELETE FROM ${table} WHERE ${formatConditions(whereConditions)}`
  } else {
    return `DELETE FROM ${table}`
  }
}

function formatConditions(conditions) {
  return conditions
    .map(condition => {
      return isLogicalOp(condition) && condition.name == 'or'
        ? `(${formatExpr(condition)})`
        : formatExpr(condition)
    })
    .join(' AND ')
}

function formatInsert(spell) {
  const { Model, sets } = spell
  const columns = Object.keys(sets).map(escapeId)
  const values = Object.values(sets)
  return `INSERT INTO ${escapeId(Model.table)} (${columns.join(', ')}) VALUES (${escape(values)})`
}

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
 */
function formatUpsert(spell) {
  const insert = formatInsert(spell)
  return `${insert} ON DUPLICATE KEY UPDATE ${escape(spell.sets)}`
}

function joinOnConditions(spell, BaseModel, baseName, refName, { relation } = {}) {
  const { Model: RefModel, foreignKey, belongsTo, where } = relation
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
 * Parse relations into spell.joins
 *
 * @param {Spell}  spell     An instance of spell
 * @param {Model}  BaseModel A subclass of Bone
 * @param {string} baseName  Might be Model.alias, Model.table, or other names given by users
 * @param {string} refName   The name of the join target
 * @param {Object} opts      Extra options such as { select, throughRelation }
 */
function joinRelation(spell, BaseModel, baseName, refName, opts = {}) {
  const { joins } = spell
  const relation = BaseModel.relations[refName] || BaseModel.relations[pluralize(refName, 1)]

  if (refName in joins) throw new Error(`Duplicated ${refName} in join tables`)
  if (!relation) {
    throw new Error(`Unable to find relation ${refName} on ${BaseModel.name}`)
  }

  const { through, Model: RefModel, includes } = relation

  if (through) {
    const throughRelation = BaseModel.relations[through]
    joinRelation(spell, BaseModel, baseName, through)
    joinRelation(spell, throughRelation.Model, through, refName, {
      ...opts, throughRelation
    })
  } else {
    if (relation.select && !relation.attributes) {
      relation.attributes = RefModel.attributes.filter(parseSelect(relation.select))
    }
    const { select, throughRelation } = opts
    const attributes = select
      ? RefModel.attributes.filter(parseSelect(select))
      : relation.attributes

    if (attributes && !attributes.includes(RefModel.primaryKey)) {
      attributes.push(RefModel.primaryKey)
    }
    spell.joins[refName] = {
      Model: RefModel,
      attributes,
      on: joinOnConditions(spell, BaseModel, baseName, refName, { relation }),
      hasMany: relation.hasMany || (throughRelation ? throughRelation.hasMany : false)
    }
    if (includes) joinRelation(spell, RefModel, refName, includes)
  }
}

function isCalculation(func) {
  return ['count', 'average', 'minimun', 'maximum', 'sum'].includes(func )
}

function findModel(spell, qualifiers) {
  const qualifier = qualifiers && qualifiers[0]
  const Model = qualifier && qualifier != spell.Model.alias
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

class Spell {
  constructor(Model, factory, opts) {
    this.Model = Model
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
      scopes: [ Spell_deletedAtIsNull ],
      subqueryIndex: 0
    }, opts)
  }

  get dispatchable() {
    const { columns } = this
    for (const token of columns) {
      const { type, name: func } = token
      if (type == 'func' && isCalculation(func)) return false
      // currently `foo as bar` is parsed as `{ type: 'op', name: 'as', args: ['foo', 'bar'] }`
      if (type == 'op') return false
    }
    return this.groups.length == 0
  }

  get derivable() {
    const { groups, joins, Model } = this
    const joinNames = []
    const baseName = Model.alias

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
   * Fake this as a thenable object.
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
   * Same as above
   * @param {Function} reject
   */
  catch(reject) {
    return this.promise.catch(reject)
  }

  $insert(obj) {
    this.sets = parseSet(this, obj)
    this.command = 'insert'
    return this
  }

  $upsert(obj) {
    this.sets = parseSet(this, obj)
    this.command = 'upsert'
    return this
  }

  $select(...names) {
    if (names.length == 1 && !/ as /i.test(names)) names = names[0].split(/\s+/)
    for (const name of names) {
      this.columns.push(unalias(this, parseExpr(name)))
    }
    return this
  }

  $update(obj) {
    this.sets = parseSet(this, obj)
    this.command = 'update'
    return this
  }

  $delete() {
    this.command = 'delete'
    return this
  }

  $from(table) {
    this.table = table instanceof Spell
      ? { type: 'subquery', value: table }
      : parseExpr(table)
    return this
  }

  $where(conditions, ...values) {
    this.whereConditions.push(...parseConditions(conditions, ...values).map(unalias.bind(null, this)))
    return this
  }

  $group(...names) {
    const { groups } = this
    for (const name of names) {
      groups.push(unalias(this, parseExpr(name)))
    }
    return this
  }

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

  $offset(skip) {
    skip = +skip
    if (Number.isNaN(skip)) throw new Error(`Invalid offset ${skip}`)
    this.skip = skip
    return this
  }

  $limit(rowCount) {
    rowCount = +rowCount
    if (Number.isNaN(rowCount)) throw new Error(`Invalid limit ${rowCount}`)
    this.rowCount = rowCount
    return this
  }

  $having(conditions, values) {
    this.havingConditions.push(...parseConditions(conditions, values).map(unalias.bind(null, this)))
    return this
  }

  $count(name = '*') {
    name = isIdentifier(name) ? name : '*'
    this.columns = []
    this.$select(`count(${name}) as count`)
    return this
  }

  $average(name = '*') {
    name = isIdentifier(name) ? name: '*'
    this.columns = []
    this.$select(`avg(${name}) as average`)
    return this
  }

  $minimum(name = '*') {
    name = isIdentifier(name) ? name: '*'
    this.columns = []
    this.$select(`min(${name}) as minimum`)
    return this
  }

  $maximum(name = '*') {
    name = isIdentifier(name) ? name: '*'
    this.columns = []
    this.$select(`max(${name}) as maximum`)
    return this
  }

  $sum(name = '*') {
    name = isIdentifier(name) ? name: '*'
    this.columns = []
    this.$select(`sum(${name}) as sum`)
    return this
  }

  /**
   * Example usage:
   *
   *     Post.find({}).with('attachment', 'comments')
   *     Post.find({}).with({ comments: { select: 'content' } })
   */
  $with(...qualifiers) {
    for (const qualifier of qualifiers) {
      if (typeof qualifier == 'object') {
        for (const key in qualifier) {
          joinRelation(this, this.Model, this.Model.alias, key, qualifier[key])
        }
      } else {
        joinRelation(this, this.Model, this.Model.alias, qualifier)
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
   * Example usage:
   *
   *     Post.join(User, 'users.id = posts.authorId')
   *     Post.join(TagMap, 'tagMaps.targetId = posts.id and tagMaps.targetType = 0')
   *
   * @param {Model}  Model
   * @param {string} onConditions
   * @param {...any} values
   */
  $join(Model, onConditions, ...values) {
    if (typeof Model == 'string') {
      return this.$with(...arguments)
    }
    const qualifier = Model.alias
    const { joins } = this

    if (qualifier in joins) {
      throw new Error(`Invalid join target. ${qualifier} already defined.`)
    }
    joins[qualifier] = { Model }
    joins[qualifier].on = unalias(this, parseConditions(onConditions, ...values)[0])
    return this
  }

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

  toString() {
    return this.toSqlString()
  }
}

for (const method of Object.getOwnPropertyNames(Spell.prototype)) {
  if (method[0] == '$') {
    const descriptor = Object.getOwnPropertyDescriptor(Spell.prototype, method)
    Object.defineProperty(Spell.prototype, method.slice(1), Object.assign({}, descriptor, {
      value: function() {
        const spell = this.dup
        spell[method](...arguments)
        return spell
      }
    }))
  }
}

module.exports = Spell
