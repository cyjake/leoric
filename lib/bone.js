'use strict'

const deepEqual = require('deep-equal')
const util = require('util')
const pluralize = require('pluralize')
const debug = require('debug')('leoric')

const Collection = require('./collection')
const Spell = require('./spell')

/**
 * Convert the first charactor of the string from lowercase to uppercase.
 * @param {string} str
 */
function capitalize(str) {
  return str.replace(/^([a-z])/, (m, chr) => chr.toUpperCase())
}

/**
 * Convert the first charactor of the string from uppercase to lowercase
 * @param {string} str
 */
function uncapitalize(str) {
  return str.replace(/^([A-Z])/, (m, chr) => chr.toLowerCase())
}

/**
 * Convert strings connected with hyphen or underscore into camel case. e.g.
 *
 *     camelCase('FooBar') => 'fooBar'
 *     camelCase('foo-bar') => 'fooBar'
 *     camelCase('foo_bar') => 'fooBar'
 *
 * @param {string} str
 */
function camelCase(str) {
  return uncapitalize(str).replace(/[-_]([a-z])/, (m, chr) => chr.toUpperCase())
}

/**
 * Convert strings from camelCase to snake_case.
 * @param {string} str
 */
function snakeCase(str) {
  return uncapitalize(str).replace(/([A-Z])/, (m, chr) => `_${chr.toLowerCase()}`)
}

class Bone {
  constructor(attributes) {
    Object.defineProperties(this, {
      raw: {
        value: {},
        writable: true,
        enumerable: false
      },
      rawOriginal: {
        value: {},
        writable: true,
        enumerable: false
      }
    })

    if (attributes) {
      for (const name in attributes) {
        this.attribute(name, attributes[name])
      }
    }
  }

  attribute(name, value) {
    if (!(name in this.constructor.schema)) {
      throw new Error(`${this.constructor.name} has no ${name} attribute`)
    }
    const { column } = this.constructor.schema[name]

    if (arguments.length > 1) {
      this.raw[column] = value
    } else {
      const value = this.raw[column]
      // make sure null is returned if value is undefined
      return value == null ? null : value
    }
  }

  attributeWas(name) {
    const { column } = this.constructor.schema[name]
    const value = this.rawOriginal[column]
    return value == null ? null : value
  }

  attributeChanged(name) {
    const value = this.attribute(name)
    const valueWas = this.attributeWas(name)
    return !(Object.is(value, valueWas) || deepEqual(value, valueWas))
  }

  /**
   * Override console.log behavior
   * @returns {String}
   */
  inspect() {
    return this.constructor.name + ' ' + util.inspect(this.toJSON())
  }

  /**
   * Override JSON.stringify behavior
   * @returns {Object}
   */
  toJSON() {
    let obj = {}

    for (let name in this.constructor.schema) {
      if (this[name] != null) {
        obj[name] = this[name]
      }
    }

    for (let name in this) {
      if (this.hasOwnProperty(name) &&  this[name] != null) {
        obj[name] = this[name]
      }
    }

    return obj
  }

  /**
   * @returns {Object}
   */
  toObject() {
    let obj = {}

    for (let name in this.constructor.schema) {
      obj[name] = this.attribute(name)
    }

    for (let name in this) {
      if (this.hasOwnProperty(name)) {
        obj[name] = this[name]
      }
    }

    return obj
  }

  /**
   * @returns this
   */
  save() {
    const { primaryKey } = this.constructor
    if (this[primaryKey] == null) {
      return this.create().then(() => this)
    } else if (this.attributeChanged(primaryKey)) {
      return this.upsert().then(() => this)
    } else {
      return this.update().then(() => this)
    }
  }

  syncRaw() {
    const { schema } = this.constructor

    for (const name in schema) {
      const { column, type } = schema[name]
      const value = this.constructor.uncast(this.raw[column], type)
      this.rawOriginal[column] = this.constructor.cast(value, type)
    }
  }

  /**
   * @returns {number}  of affectedRows
   */
  upsert() {
    const data = {}
    const Model = this.constructor
    const { schema, pool, primaryKey } = Model

    if (schema.createdAt && !this.createdAt) this.createdAt = new Date()
    if (schema.updatedAt && !(this.updatedAt && this.attributeChanged('updatedAt'))) {
      this.updatedAt = new Date()
    }

    for (const name in schema) {
      if (this.attributeChanged(name)) data[name] = this.attribute(name)
    }

    if (Object.keys(data).length === 0) {
      return Promise.resolve()
    }

    // About LAST_INSERT_ID()
    // - http://dev.mysql.com/doc/refman/5.7/en/information-functions.html#function_last-insert-id
    const spell = new Spell(Model, sql => {
      debug(sql)
      return new Promise((resolve, reject) => {
        pool.query(sql, (err, results) => {
          const { affectedRows, insertId } = results
          this[primaryKey] = insertId
          this.syncRaw()
          resolve(affectedRows)
        })
      })
    })

    return spell.$upsert(data)
  }

  update() {
    const data = {}
    const { schema, primaryKey } = this.constructor

    if (schema.updatedAt && !this.updatedAt) {
      this.updatedAt = new Date()
    }

    for (let name in schema) {
      if (this.attributeChanged(name)) {
        data[name] = this.attribute(name)
      }
    }

    return this.constructor.update({
      [primaryKey]: this[primaryKey]
    }, data).then(count => {
      if (count === 1) this.syncRaw()
    })
  }

  create() {
    const Model = this.constructor
    const { pool, primaryKey, schema } = Model
    const data = {}

    if (schema.createdAt && !this.createdAt) this.createdAt = new Date()
    if (schema.updatedAt && !this.updatedAt) this.updatedAt = this.createdAt

    for (const name in schema) {
      const value = this.attribute(name)
      if (value != null) data[name] = value
    }

    const spell = new Spell(Model, sql => {
      debug(sql)
      return new Promise((resolve, reject) => {
        pool.query(sql, (err, results, fields) => {
          if (err) return reject(err)
          this[primaryKey] = results.insertId
          this.syncRaw()
          resolve(this)
        })
      })
    })

    return spell.$insert(data)
  }

  remove(forceDelete) {
    const Model = this.constructor
    const { primaryKey } = Model

    if (!this[primaryKey]) {
      throw new Error('The instance is not persisted yet.')
    }

    return Model.remove({ [primaryKey]: this[primaryKey] }, forceDelete)
  }

  static attribute(name, meta) {
    if (!this.schema[name]) {
      throw new Error('Missing column ' + name)
    }
    Object.assign(this.schema[name], meta)
  }

  static describeTable(columns) {
    const schema = {}

    for (const columnInfo of columns) {
      const { name: column, type: columnType, isNullable } = columnInfo
      const name = column == '_id' ? column : camelCase(column)

      schema[name] = {
        column,
        columnType,
        isNullable,
        type: this.reflectType(columnType)
      }
    }

    const descriptors = {}

    for (const name in schema) {
      if (!schema[name].column) {
        schema[name].column = snakeCase(name)
      }

      let descriptor = Object.assign({
        get() {
          return this.attribute(name)
        },
        set(value) {
          this.attribute(name, value)
        },
        enumerable: true
      }, Object.getOwnPropertyDescriptor(this.prototype, name))

      descriptors[name] = descriptor
    }

    Object.defineProperties(this.prototype, descriptors)
    Object.defineProperties(this, {
      schema: {
        value: schema,
        writable: false,
        enumerable: false
      },
      relations: {
        value: [],
        writable: false,
        enumerable: false
      }
    })

    this.renameAttribute('gmtCreate', 'createdAt')
    this.renameAttribute('gmtModified', 'updatedAt')
    this.renameAttribute('gmtDeleted', 'deletedAt')
  }

  static describe() {}

  /**
   * The camelized and pluralized Model.name
   * @returns {string}
   */
  static get alias() {
    return pluralize(camelCase(this.name))
  }

  /**
   * The real table name of the model.
   * @returns {string}
   */
  static get table() {
    return snakeCase(pluralize(this.name))
  }

  /**
   * The primary key of the model, in camelCase.
   * @returns {string}
   */
  static get primaryKey() {
    return 'id'
  }

  /**
   * The primary column of the model, in snake_case, usually.
   * @returns {string}
   */
  static get primaryColumn() {
    return this.unalias(this.primaryKey)
  }

  /**
   * The columns of the model.
   * @returns {Array}
   */
  static get columns() {
    return new Set(Object.keys(this.schema).map(name => this.schema[name].column))
  }

  /**
   * The attributes of the model.
   * @returns {Array}
   */
  static get attributes() {
    return new Set(Object.keys(this.schema))
  }

  /**
   * Unalias the column name to attribute name
   * @param   {string} name
   * @returns {string}
   */
  static unalias(name) {
    if (name in this.schema) {
      return this.schema[name].column
    } else {
      return name
    }
  }

  static renameAttribute(originalName, newName) {
    if (originalName in this.schema) {
      this.schema[newName] = this.schema[originalName]
      delete this.schema[originalName]

      Object.defineProperty(this.prototype, newName, Object.assign({
        get: function() {
          return this.attribute(newName)
        },
        set: function(value) {
          return this.attribute(newName, value)
        },
        enumerable: true
      }, Object.getOwnPropertyDescriptor(this.prototype, newName)))
    }
  }

  static reflectClass(ModelName) {
    for (const Model of this.models) {
      if (Model.name === ModelName) {
        return Model
      }
    }
    throw new Error('Cannot find Class definition of ' + ModelName)
  }

  static reflectType(columnType) {
    switch (columnType) {
      case 'bigint':
      case 'smallint':
      case 'tinyint':
      case 'int':
        return Number
      case 'datetime':
        return Date
      case 'longtext':
      case 'mediumtext':
      case 'text':
      case 'varchar':
      default:
        return String
    }
  }

  static cast(value, type) {
    switch (type) {
      case JSON:
        return value ? JSON.parse(value) : null
      default:
        return value
    }
  }

  static uncast(value, type) {
    switch (type) {
      case JSON:
        return JSON.stringify(value)
      default:
        return value
    }
  }

  static hasOne(name, opts) {
    opts = Object.assign({
      Model: capitalize(name),
      foreignKey: this.table + 'Id'
    }, opts)

    if (opts.through) opts.foreignKey = ''

    this.relate(name, opts)
  }

  static hasMany(name, opts) {
    opts = Object.assign({
      Model: capitalize(pluralize(name, 1))
    }, opts, {
      hasMany: true
    })

    if (opts.through) opts.foreignKey = ''

    this.relate(name, opts)
  }

  static belongsTo(name, opts) {
    opts = Object.assign({
      Model: capitalize(name)
    }, opts)

    let { Model, foreignKey } = opts

    if (!foreignKey) {
      foreignKey = camelCase(Model) + 'Id'
    }

    this.relate(name, Object.assign(opts, { foreignKey, belongsTo: true }))
  }

  static relate(name, opts) {
    if (name in this.relations) {
      throw new Error(this.name + ' has relation conflicts at: ' + name)
    }
    this.relations[name] = { ...opts, Model: this.reflectClass(opts.Model) }
  }

  static dispatch(spell, entries, fields) {
    const results = new Collection()
    let current = {}

    if (Object.keys(spell.joins).length == 0) {
      for (const entry of entries) {
        results.push(this.instantiate(Object.values(entry)[0]))
      }
    } else {
      for (const entry of entries) {
        for (const qualifier in entry) {
          const values = entry[qualifier]
          if (qualifier in spell.joins) {
            const { Model, hasMany } = spell.joins[qualifier]
            const model = Model.instantiate(values)
            if (hasMany && model[Model.primaryKey] != null) {
              if (!current[qualifier]) current[qualifier] = []
              current[qualifier].push(model)
            } else {
              current[qualifier] = model[Model.primaryKey] == null ? null : model
            }
          } else if (values[this.primaryColumn] != current[this.primaryKey]) {
            current = Object.assign(this.instantiate(values), current)
            results.push(current)
          }
        }
      }
    }

    return results
  }

  static instantiate(entry, table) {
    const instance = new this()
    const raw = {}
    const rawOriginal = {}

    for (let name in this.schema) {
      const { column, type } = this.schema[name]
      const columnAs = table ? `${table}:${column}` : column
      raw[column] = this.cast(entry[columnAs], type)
      rawOriginal[column] = this.cast(entry[columnAs], type)
    }

    instance.raw = raw
    instance.rawOriginal = rawOriginal

    return instance
  }

  static find(conditions, ...values) {
    const { pool } = this
    const spell = new Spell(this, sql => {
      debug(sql)
      return new Promise((resolve, reject) => {
        const nestTables = spell.dispatchable
        pool.query({ sql, nestTables }, (err, results, fields) => {
          if (err) reject(err)
          else resolve(nestTables ? this.dispatch(spell, results, fields) : results)
        })
      })
    })

    // find({}, { offset: 1, limit: 1 })
    if (typeof conditions == 'object' && values.length == 1 && typeof values[0] == 'object') {
      spell.$where(conditions)
      for (const method of ['order', 'limit', 'offset', 'select']) {
        const value = values[0][method]
        if (value != null) spell[`$${method}`](value)
      }
    } else if (conditions) {
      spell.$where(conditions, ...values)
    }

    return spell
  }

  static findOne(conditions, ...values) {
    const spell = this.find(conditions, ...values).$limit(1)
    spell.onresolve = results => {
      return results.length > 0 && results[0] instanceof this ? results[0] : null
    }
    return spell
  }

  static include(...names) {
    return this.find().$with(...names)
  }

  static where(conditions, ...values) {
    return this.find(conditions, ...values)
  }

  static select(...attributes) {
    return this.find().$select(...attributes)
  }

  static group(...names) {
    return this.find().$group(...names)
  }

  static join(Model, conditions, ...values) {
    return this.find().$join(Model, conditions, ...values)
  }

  static count(conditions, ...values) {
    return this.find(conditions, ...values).$count()
  }

  static create(values) {
    const instance = new this(values)
    return instance.create()
  }

  static update(conditions, values) {
    const { pool } = this
    const spell = new Spell(this, sql => {
      debug(sql)
      return new Promise((resolve, reject) => {
        pool.query(sql, (err, results) => {
          if (err) reject(err)
          else resolve(results.affectedRows)
        })
      })
    })

    spell.$where(conditions)
    if (this.schema.updatedAt && !values.updatedAt && !values.deletedAt) {
      values.updatedAt = new Date()
    }
    spell.$update(values)

    return spell
  }

  static remove(conditions, forceDelete) {
    const { pool } = this
    forceDelete = forceDelete === true

    if (forceDelete) {
      const spell = new Spell(this, sql => {
        debug(sql)
        return new Promise((resolve, reject) => {
          pool.query(sql, (err, results) => {
            if (err) reject(err)
            else resolve(results.affectedRows)
          })
        })
      })
      return spell.$where(conditions).$delete()
    }
    else if (this.schema.deletedAt) {
      return this.update(conditions, { deletedAt: new Date() })
    }
    else {
      throw new Error('Soft delete not available.')
    }
  }
}


module.exports = Bone
