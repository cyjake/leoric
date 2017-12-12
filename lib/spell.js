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
  return /^[0-9a-z$_]+$/i.test(name)
}

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

function parseObjectValue(value) {
  if (value == null) {
    return { type: 'null' }
  }
  else if (Array.isArray(value)) {
    return { type: 'array', value }
  }
  else if (typeof value == 'string') {
    return { type: 'string', value }
  }
  else if (typeof value == 'number') {
    return { type: 'number', value }
  }
  else {
    throw new Error(`Unexpected object value ${value}`)
  }
}

function parseObjectConditions(conditions) {
  const result = []

  for (const name in conditions) {
    const value = conditions[name]

    if (value instanceof Spell) {
      value.cancelled = true
      result.push({
        type: 'op',
        name: 'in',
        args: [ parseExpr(name), { type: 'array', value } ]
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

function formatOrders(spell) {
  const formatOrder = ([name, order]) => {
    const column = formatColumn(spell.Model, name)
    return order == 'desc' ? `${column} DESC` : column
  }
  return spell.orders.map(formatOrder)
}

function formatColumn(Model, name) {
  const ast = walkExpr(parseExpr(name), node => {
    if (node.type == 'id') node.value = Model.unalias(node.value)
  })

  if (ast.type == 'id') {
    return formatIdentifier(ast)
  } else {
    return formatExpr(ast)
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
    case 'null':
      return escape(value)
    case 'array':
      return `(${value.toSqlString ? value.toSqlString() : escape(value)})`
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

function formatOpExpr(ast) {
  const { name, args } = ast
  const params = args.map(arg => formatExpr(arg))

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
  const { Model, attributes, whereConditions, groups, havingConditions, orders, limit, offset } = spell
  const chunks = []

  if (attributes.size > 0) {
    if (groups.size > 0) {
      for (const group of groups) attributes.add(group)
    }
    const columns = Array.from(attributes, formatColumn.bind(null, Model))
    chunks.push(`SELECT ${columns.join(', ')}`)
  } else {
    chunks.push('SELECT *')
  }

  const table = formatExpr(spell.table)
  chunks.push(`FROM ${table}`)
  if (spell.table.value instanceof spell.constructor) {
    chunks.push(`AS t${spell.subqueryIndex++}`)
  }

  if (whereConditions.length > 0) {
    chunks.push(`WHERE ${formatConditions(spell, whereConditions)}`)
  }

  if (groups.size > 0) {
    const groupColumns = []
    for (const name of groups) groupColumns.push(formatColumn(Model, name))
    chunks.push(`GROUP BY ${groupColumns.join(', ')}`)
  }

  if (havingConditions.length > 0) {
    chunks.push(`HAVING ${formatConditions(spell, havingConditions)}`)
  }

  if (orders.length > 0) chunks.push(`ORDER BY ${formatOrders(spell).join(', ')}`)
  if (limit > 0) chunks.push(`LIMIT ${limit}`)
  if (offset > 0) chunks.push(`OFFSET ${offset}`)

  return chunks.join(' ')
}

function walkExpr(ast, fn) {
  fn(ast)
  if (ast.args) {
    for (const arg of ast.args) walkExpr(arg, fn)
  }
  return ast
}

function formatSelectWithJoin(spell) {
  const { Model, attributes, whereConditions, groups, orders, limit, offset, joins } = spell
  const baseName = Model.alias
  const allAttrs = { [baseName]: [] }

  function appendColumn(node) {
    if (node.type == 'id' && node.qualifiers && node.qualifiers.length > 0) {
      const { qualifiers: [qualifier], value } = node
      if (Array.isArray(allAttrs[qualifier]) && (qualifier == baseName || qualifier in joins)) {
        allAttrs[qualifier].push(value)
      }
    }
  }

  for (const qualifier in joins) {
    const { on, attributes: select } = joins[qualifier]
    if (select) {
      allAttrs[qualifier] = select
    } else {
      allAttrs[qualifier] = '*'
    }
    walkExpr(on, appendColumn)
  }

  if (spell.attributes.size > 0) {
    for (const name of allAttrs[baseName]) spell.attributes.add(name)
    spell.attributes.add(Model.primaryKey)
  }
  allAttrs[baseName] = '*'
  const columns = []
  for (const qualifier in allAttrs) {
    const { Model: RefModel } = qualifier == baseName ? Model : joins[qualifier]
    const attrs = allAttrs[qualifier]
    if (attrs instanceof Set) {
      for (const name of attrs) {
        columns.push(`${escapeId(qualifier)}.${escapeId(RefModel.unalias(name))}`)
      }
    } else {
      columns.push(`${escapeId(qualifier)}.*`)
    }
  }

  const chunks = [
    `SELECT ${columns.join(', ')}`
  ]

  if (attributes.size > 0 || whereConditions.length > 0 || groups.size > 0 || orders.length > 0 || offset > 0 || limit > 0) {
    chunks.push(`FROM (${formatSelectWithoutJoin(spell)})`)
  } else {
    chunks.push(`FROM ${escapeId(Model.table)}`)
  }

  chunks.push(`AS ${escapeId(baseName)}`)

  for (const qualifier in joins) {
    const { Model: RefModel, on } = joins[qualifier]

    walkExpr(on, node => {
      if (node.type == 'id') {
        const { qualifiers } = node
        if (qualifiers && qualifiers.length > 0) {
          const qualifier = qualifiers[0]
          const Model = qualifier == baseName ? spell.Model : joins[qualifier].Model
          node.value = Model.unalias(node.value)
        }
      }
    })

    chunks.push(`LEFT JOIN ${escapeId(RefModel.table)} AS ${escapeId(qualifier)} ON ${formatExpr(on)}`)
  }

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
    return `DELETE FROM ${table} WHERE ${formatConditions(spell, whereConditions)}`
  } else {
    return `DELETE FROM ${table}`
  }
}

function formatConditions(spell, conditions) {
  const { Model } = spell
  const ast = conditions.length > 1
    ? { type: 'op', name: 'and', args: conditions }
    : conditions[0]

  walkExpr(ast, node => {
    if (node.type == 'id') node.value = Model.unalias(node.value)
  })

  return formatExpr(ast)
}

function formatInsert(spell) {
  const { Model } = spell
  const columns = []
  const values = []

  for (const name in spell.values) {
    columns.push(formatColumn(Model, name))
    values.push(Model.uncast(spell.values[name], Model.schema[name].type))
  }

  return `INSERT INTO ${escapeId(Model.table)} (${columns.join(', ')}) VALUES (${Object.values(values).map(val => escape(val)).join(', ')})`
}

function formatUpdate(spell) {
  const { Model, whereConditions } = spell
  const values = {}

  for (const name in spell.values) {
    values[Model.unalias(name)] = Model.uncast(spell.values[name], Model.schema[name].type)
  }

  return `UPDATE ${escapeId(Model.table)} SET ${escape(values)} WHERE ${formatConditions(spell, whereConditions)}`
}

/**
 * Taking advantage of MySQL's `on duplicate key update`, though knex does
 * not support this because it has got several databases to be compliant of.
 * PostgreSQL has got proper `upsert`. Maybe we can file a PR to knex
 * someday.
 *
 * References:
 * - http://dev.mysql.com/doc/refman/5.7/en/insert-on-duplicate.html
 * - https://github.com/tgriesser/knex/issues/701
 */
function formatUpsert(spell) {
  const insert = formatInsert(spell)
  const values = []
  for (const name in spell.values) {
    values.push(`${formatColumn(spell.Model, name)}=${escape(spell.values[name])}`)
  }
  return `${insert} ON DUPLICATE KEY UPDATE ${values.join(', ')}`
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
    const { select, throughRelation } = opts
    const attributes = select
      ? new Set(Array.from(RefModel.attributes).filter(spell.constructor.parseSelect(select)))
      : relation.attributes

    if (attributes) attributes.add(RefModel.primaryKey)
    spell.joins[refName] = {
      Model: RefModel,
      attributes,
      on: joinOnConditions(spell, BaseModel, baseName, refName, { relation }),
      hasMany: relation.hasMany || (throughRelation ? throughRelation.hasMany : false)
    }
    if (includes) joinRelation(spell, RefModel, refName, includes)
  }
}

class Spell {
  constructor(Model, fn) {
    this.promise = new Promise(resolve => {
      setImmediate(() => {
        if (!this.cancelled) resolve(fn(this.toSqlString()))
      })
    })
    this.Model = Model
    this.command = 'select'
    this.attributes = new Set()
    this.table = parseExpr(Model.table)
    this.whereConditions = []
    this.groups = new Set()
    this.orders = []
    this.havingConditions = []
    this.joins = {}
    this.subqueryIndex = 0
    this.scopes = [
      /**
       * If Model supports soft delete, and deletedAt isn't specified in whereConditions yet,
       * and the table isn't a subquery, append a default where({ deletedAt: null }).
       */
      function Spell_deletedAtIsNull() {
        const { Model, table, whereConditions } = this
        for (const ast of whereConditions) {
          const { type, value } = ast.args[0]
          if (type == 'id' && value == 'deletedAt') return
        }
        if (table.type == 'id' && Model.schema.deletedAt) {
          this.where({ deletedAt: null })
        }
      }
    ]
  }

  static parseSelect(select) {
    const type = typeof select

    if (type == 'function')  return select
    if (type == 'string') select = select.split(/\s+/)
    if (Array.isArray(select)) {
      return select.includes.bind(select)
    } else {
      throw new Error(`Invalid select ${select}`)
    }
  }

  get dispatchable() {
    const { attributes, Model } = this
    for (const name of attributes) {
      if (!(name in Model.schema)) return false
    }
    return this.groups.size == 0
  }

  get unscoped() {
    this.scopes = []
    return this
  }

  then(resolve, reject) {
    return this.promise.then(resolve, reject)
  }

  catch(reject) {
    return this.promise.catch(reject)
  }

  insert(values) {
    this.values = values
    this.command = 'insert'
    return this
  }

  upsert(values) {
    this.values = values
    this.command = 'upsert'
    return this
  }

  select(...names) {
    if (names.length == 1) names = names[0].split(/\s+/)
    for (const name of names) this.attributes.add(name)
    return this
  }

  update(values) {
    this.values = values
    this.command = 'update'
    return this
  }

  delete() {
    this.command = 'delete'
    return this
  }

  from(table) {
    if (table instanceof Spell) {
      table.cancelled = true
      this.table = { type: 'array', value: table }
    } else {
      this.table = parseExpr(table)
    }
    return this
  }

  where(conditions, ...values) {
    this.whereConditions.push(...parseConditions(conditions, ...values))
    return this
  }

  group(...names) {
    for (const name of names) this.groups.add(name)
    return this
  }

  order(name, order) {
    if (!order) {
      [name, order] = name.split(/\s+/)
    }
    if (!isIdentifier(name)) throw new Error(`Invalid order attribute ${name}`)
    this.orders.push([name, order.toLowerCase() == 'desc' ? 'desc' : 'asc'])
    return this
  }

  offset(offset) {
    offset = +offset
    if (Number.isNaN(offset)) throw new Error(`Invalid offset ${offset}`)
    this.offset = offset
    return this
  }

  limit(limit) {
    limit = +limit
    if (Number.isNaN(limit)) throw new Error(`Invalid limit ${limit}`)
    this.limit = limit
    return this
  }

  having(conditions, values) {
    this.havingConditions.push(...parseConditions(conditions, values))
    return this
  }

  count(name = '*') {
    name = isIdentifier(name) ? name : '*'
    this.attributes = new Set([`count(${name}) as count`])
    return this
  }

  /**
   * Example usage:
   *
   *     Post.find({}).with('attachment', 'comments')
   *     Post.find({}).with({ comments: { select: 'content' } })
   */
  with(...names) {
    for (const name of names) {
      if (typeof name == 'object') {
        for (const key in name) {
          joinRelation(this, this.Model, this.Model.alias, key, name[key])
        }
      } else {
        joinRelation(this, this.Model, this.Model.alias, name)
      }
    }
    return this
  }

  /**
   * Example usage:
   *
   *     Post.join(User, 'users.id = posts.authorId')
   *     Post.join(TagMap, 'tagMaps.targetId = posts.id and tagMaps.targetType = ?', 0)
   *
   * @param {Model}  Model
   * @param {string} onConditions
   * @param {...any} values
   */
  join(Model, onConditions, ...values) {
    if (typeof Model == 'string') {
      return this.with(...arguments)
    }

    const prop = Model.alias
    if (prop in this.joins) {
      throw new Error(`Invalid join target. ${prop} already defined.`)
    }
    this.joins[prop] = {
      Model,
      on: parseConditions(onConditions, ...values)[0]
    }

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
    this.cancelled = true
    return this.toSqlString()
  }
}

module.exports = Spell
