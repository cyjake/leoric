'use strict'

/**
 * The Bone to extend models from. This module consists of helper methods like `capitalize`, and the class {@link Bone}.
 * @module
 */
const deepEqual = require('deep-equal')
const util = require('util')
const pluralize = require('pluralize')

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
 * @param {string} str
 * @example
 * camelCase('FooBar')   // => 'fooBar'
 * camelCase('foo-bar')  // => 'fooBar'
 * camelCase('foo_bar')  // => 'fooBar'
 */
function camelCase(str) {
  return uncapitalize(str).replace(/[-_]([a-z])/g, (m, chr) => chr.toUpperCase())
}

/**
 * Convert strings from camelCase to snake_case.
 * @param {string} str
 * @example
 * snakeCase('FooBar')  // => 'foo_bar'
 * snakeCase('fooBar')  // => 'foo_bar'
 */
function snakeCase(str) {
  return uncapitalize(str).replace(/([A-Z])/g, (m, chr) => `_${chr.toLowerCase()}`)
}

/**
 * The base class that provides Object-relational mapping. This class is never intended to be used directly. We need to create models that extends from Bone. Most of the query features of Bone is implemented by {@link Spell} such as {@link Spell#$group} and {@link Spell#$join}. With Bone, you can create models like this:
 *
 *     class Post extends Bone {
 *       static describe() {
 *         this.hasMany('comments')
 *         this.belongsTo('author', { className: 'User' })
 *         this.attribute('extra', { type: JSON })
 *       }
 *     }
 *
 * And then query posts by lots of means:
 *
 *     Post.first
 *     Post.where('title = ? && authorId = ?', 'Leah', 42)
 *     Post.include('comments').group('posts.id').count('comments.*').order('count')
 *
 * @alias Bone
 * @property {Object} raw
 * @property {Object} rawOriginal
 * @property {Set} rawUnset
 * @example
 * const post = new Post()
 * const post = new Post({ title: 'Leah' })
 */
class Bone {
  // jsdoc gets examples of Bone confused with examples of constructor. Let's just put examples at class comments for now.
  /**
   * Create an instance of Bone. Accepts initial attributes.
   * @param {Object} attributes
   */
  constructor(attributes) {
    Object.defineProperties(this, {
      raw: {
        value: {},
        writable: false,
        enumerable: false
      },
      rawOriginal: {
        value: {},
        writable: false,
        enumerable: false
      },
      rawUnset: {
        value: new Set(),
        writable: false,
        enumerable: false
      }
    })

    if (attributes) {
      for (const name in attributes) {
        this.attribute(name, attributes[name])
      }
    }
  }

  /**
   * Get or set attribute value by name. This method is quite similiar to `jQuery.attr()`. If the attribute isn't selected when queried from database, an error will be thrown when accessing it.
   *
   *     const post = Post.select('title').first
   *     post.createdAt   // throw Error('Unset attribute createdAt')
   *
   * This is the underlying method of attribute getter/setters:
   *
   *     Object.defineProperty(Post.prototype, 'title', {
   *         get: function() { return this.attribute('title') },
   *         set: function(value) { return this.attribute('title', value) }
   *     })
   *
   * These `getter`s and `setter`s are automatically generated while {@link Bone.describe} is called.
   * @param {string}  name   - attribute name
   * @param {*}      [value] - attribute value
   * @returns {*}
   * @example
   * .attribute('title')                 // get the value of title
   * .attribute('title', 'New Post')  // set the value of title to 'New Post'
   */
  attribute(name, value) {
    const { schema } = this.constructor
    if (!(name in schema)) {
      throw new Error(`${this.constructor.name} has no attribute called ${name}`)
    }
    if (arguments.length > 1) {
      this.raw[name] = value
      this.rawUnset.delete(name)
    } else {
      if (this.rawUnset.has(name)) throw new Error(`Unset attribute ${name}`)
      const value = this.raw[name]
      // make sure null is returned if value is undefined
      return value == null ? null : value
    }
  }

  /**
   * Get the original value of attribute. If the attribute isn't selected in the first place, an error will be thrown when accessing it.
   * @param {string} name - attribute name
   * @example
   * const post = await Post.findOne({ title: 'Leah' })
   * post.title = 'Deckard Cain'
   * post.attributeWas('title')  // => 'Leah'
   */
  attributeWas(name) {
    if (this.rawUnset.has(name)) throw new Error(`Unset attribute ${name}`)
    const value = this.rawOriginal[name]
    return value == null ? null : value
  }

  /**
   * Check if the value of attribute is changed or not.
   * @param {string} name - attribute name
   * @example
   * const post = await Post.findOne({ title: 'Leah' })
   * post.title = 'Deckard Cain'
   * post.attributeChanged('title')  // => true
   * post.title = 'Leah'
   * post.attributeChanged('title')  // => false
   */
  attributeChanged(name) {
    if (this.rawUnset.has(name)) return false
    const value = this.attribute(name)
    const valueWas = this.attributeWas(name)
    return !(Object.is(value, valueWas) || deepEqual(value, valueWas))
  }

  /**
   * Gets called when `console.log(instance)` is invoked.
   * @example
   * const post = await Post.first
   * post.inspect()  // => 'Post { "id": 1, ... }'
   * @returns {String}
   */
  [util.inspect.custom]() {
    return this.constructor.name + ' ' + util.inspect(this.toJSON())
  }

  /**
   * Gets called when `JSON.stringify(instance)` is invoked.
   * @example
   * const post = await Post.first
   * post.toJSON()  // => { id: 1, ... }
   * @returns {Object}
   */
  toJSON() {
    const obj = {}

    for (const name in this.constructor.schema) {
      if (!this.rawUnset.has(name) && this[name] != null) {
        obj[name] = this[name]
      }
    }

    for (const name in this) {
      if (this.hasOwnProperty(name) && this[name] != null) {
        obj[name] = this[name]
      }
    }

    return obj
  }

  /**
   * This is the loyal twin of {@link Bone#toJSON} because when generating the result object, the raw values of attributes are used, instead of the values returned by custom getters (if any).
   * @example
   * const post = await Post.first
   * post.toObject()  // => { id: 1, ... }
   * @returns {Object}
   */
  toObject() {
    const obj = {}

    for (const name in this.constructor.schema) {
      if (!this.rawUnset.has(name)) obj[name] = this.attribute(name)
    }

    for (const name in this) {
      if (this.hasOwnProperty(name)) {
        obj[name] = this[name]
      }
    }

    return obj
  }

  /**
   * Save the changes to database. If the instance isn't persisted to database before, an INSERT query will be executed. Otherwise, an upsert-like query is chosen to make sure only one instance of the specified primaryKey is created. If the primaryKey is positive but unchanged, an UPDATE will be executed.
   * @example
   * new Post({ title: 'Leah' }).save()
   * // same as Post.create({ title: 'Leah' })
   *
   * const post = Post.first
   * post.title = 'Decard Cain'
   * post.save()
   * @returns {Bone} current instance
   */
  save() {
    const { primaryKey } = this.constructor
    if (this.rawUnset.has(primaryKey)) throw new Error(`Unset primary key ${primaryKey}`)
    if (this[primaryKey] == null) {
      return this.create().then(() => this)
    } else if (this.attributeChanged(primaryKey)) {
      return this.upsert().then(() => this)
    } else {
      return this.update().then(() => this)
    }
  }

  /**
   * Sync changes made in {@link Bone.raw} back to {@link Bone.rawOriginal}. Mostly used after the changes are persisted to database, to make {@link Bone.attributeChanged} function properly.
   * @private
   */
  syncRaw() {
    const { schema } = this.constructor

    for (const name in schema) {
      const { type } = schema[name]
      // Take advantage of uncast/cast to create new copy of value
      const value = this.constructor.uncast(this.raw[name], type)
      this.rawOriginal[name] = this.constructor.cast(value, type)
    }
  }

  /**
   * Look for current instance in the database, then:
   *
   * - If found, save the changes to existing one.
   * - If not found, create a new record.
   *
   * Returns number of affectedRows.
   * @private
   * @returns {number}
   */
  upsert() {
    const data = {}
    const Model = this.constructor
    const { schema, primaryKey } = Model

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
    const spell = new Spell(Model, async spell => {
      const result = await Model.query(spell)
      if (typeof this[primaryKey] === 'undefined') this[primaryKey] = result.insertId
      this.syncRaw()
      return result.affectedRows
    })

    return spell.$upsert(data)
  }

  /**
   * Persist changes on current instance back to database with `UPDATE`.
   * @private
   * @returns {number}
   */
  update() {
    const data = {}
    const { schema, primaryKey } = this.constructor

    for (let name in schema) {
      if (this.attributeChanged(name)) {
        data[name] = this.attribute(name)
      }
    }

    return this.constructor.update({
      [primaryKey]: this[primaryKey]
    }, data).then(count => {
      if (count === 1) this.syncRaw()
      return count
    })
  }

  /**
   * Insert current instance into database. Unlike {@link Bone#upsert}, this method use `INSERT` no matter primary key presents or not.
   * @private
   * @returns {Bone}
   */
  create() {
    const Model = this.constructor
    const { primaryKey, schema } = Model
    const data = {}

    if (schema.createdAt && !this.createdAt) this.createdAt = new Date()
    if (schema.updatedAt && !this.updatedAt) this.updatedAt = this.createdAt

    for (const name in schema) {
      const value = this.attribute(name)
      if (value != null) data[name] = value
    }

    const spell = new Spell(Model, async spell => {
      const result = await Model.query(spell)
      this[primaryKey] = result.insertId
      this.syncRaw()
      return this
    })

    return spell.$insert(data)
  }

  /**
   * Delete current instance. If `deletedAt` attribute exists, calling {@link Bone#remove} does not actually delete the record from the database. Instead, it updates the value of `deletedAt` attribute to current date. This is called [soft delete](../querying#scopes). To force a regular `DELETE`, use `.remove(true)`.
   * @param {boolean} forceDelete
   * @example
   * const post = await Post.first
   * post.remove()      // update the `deletedAt`
   * post.remove(true)  // delete record
   */
  remove(forceDelete) {
    const Model = this.constructor
    const { primaryKey, shardingKey } = Model

    if (this[primaryKey] == null) {
      throw new Error('The instance is not persisted yet.')
    }

    const condition = { [primaryKey]: this[primaryKey] }
    if (shardingKey) condition[shardingKey] = this[shardingKey]

    return Model.remove(condition, forceDelete)
  }

  /**
   * Override attribute metadata. Currently only `type` is needed to be overriden with this method.
   * @param {string} name
   * @param {Object} meta
   * @example
   * class Post extends Bone {
   *   static describe() {
   *     Post.attribute('extra', { type: JSON })
   *   }
   * }
   */
  static attribute(name, meta) {
    if (!this.schema[name]) {
      throw new Error(`${this.name} has no attribute called ${name}`)
    }
    Object.assign(this.schema[name], meta)
  }

  /**
   * Generate `schema`, `amehcs`, and attribute `getter`s/`setter`s from column informations.
   * @private
   * @param {Object[]} columns - column informations queried from `information_schema.columns`
   */
  static describeTable(columns) {
    /**
     * An Object that contains the metadata of attributes in following structure:
     *
     *     {
     *       [name]: {
     *         column,      // the real column name
     *         columnType,  // the column type
     *         isNullable,  // if the column accepts null
     *         type         // the attribute type in JavaScript
     *       }
     *     }
     * @type {Object}
     * @memberof Bone
     */
    const schema = {}

    /**
     * @type {Object}
     * @memberof Bone
     */
    const amehcs = {}

    for (const columnInfo of columns) {
      const { name: column, type: columnType, isNullable } = columnInfo
      const name = column == '_id' ? column : camelCase(column)

      schema[name] = {
        column,
        columnType,
        isNullable,
        type: this.reflectType(columnType)
      }
      amehcs[column] = name
    }

    const descriptors = {}

    for (const name in schema) {
      const descriptor = Object.getOwnPropertyDescriptor(this.prototype, name)
      descriptors[name] = Object.assign({
        get() {
          return this.attribute(name)
        },
        set(value) {
          this.attribute(name, value)
        }
      }, Object.keys(descriptor || {}).reduce((result, key) => {
        if (descriptor[key] != null) result[key] = descriptor[key]
        return result
      }, {}))
    }

    Object.defineProperties(this.prototype, descriptors)
    Object.defineProperties(this, {
      schema: {
        value: schema,
        writable: false,
        enumerable: false
      },
      amehcs: {
        value: amehcs,
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

  /**
   * Placeholder static method. Sub-classes of Bone can override this method to setup model informations such as associations, attribute renamings, etc.
   * @example
   * class Post extends Bone {
   *   static describe() {
   *     this.belongsTo('author', { className: 'User' })
   *     this.renameAttribute('content', 'body')
   *   }
   * }
   */
  static describe() {}

  /**
   * The camelized and pluralized Model.name
   * @type {string}
   */
  static get aliasName() {
    return pluralize(camelCase(this.name))
  }

  /**
   * The real table name of the model.
   * @type {string}
   */
  static get table() {
    return snakeCase(pluralize(this.name))
  }

  /**
   * The primary key of the model, in camelCase.
   * @type {string}
   */
  static get primaryKey() {
    return 'id'
  }

  /**
   * The primary column of the model, in snake_case, usually.
   * @type {string}
   */
  static get primaryColumn() {
    return this.unalias(this.primaryKey)
  }

  static get shardingColumn() {
    if (this.shardingKey) return this.unalias(this.shardingKey)
  }

  static get physicTable() {
    const { physicTables } = this
    return physicTables && physicTables.length > 0 ? physicTables[0] : this.table
  }

  /**
   * The columns of the model.
   * @type {Array}
   */
  static get columns() {
    return Object.keys(this.schema).map(name => this.schema[name].column)
  }

  /**
   * The attributes of the model.
   * @type {Array}
   */
  static get attributes() {
    return Object.keys(this.schema)
  }

  /**
   * Get the column name from the attribute name
   * @private
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

  /**
   * Rename attribute in the schema. Since Bone manages a separate set of names called attributes instead of using the raw columns, we can rename the attribute names, which is transformed from the column names by convention, to whatever name we fancy.
   * @param {string} originalName
   * @param {string} newName
   */
  static renameAttribute(originalName, newName) {
    if (originalName in this.schema) {
      this.schema[newName] = this.schema[originalName]
      this.amehcs[this.schema[newName].column] = newName
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

  /**
   * Find model by class name. Models are stored at {@link Bone.models}.
   * @param {string} className
   * @returns {Bone}
   */
  static reflectClass(className) {
    for (const Model of this.models) {
      if (Model.name === className) {
        return Model
      }
    }
    throw new Error(`Cannot find Class definition of ${className}`)
  }

  /**
   * Find the corresponding JavaScript type of the type in database.
   * @param {string} columnType
   */
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

  /**
   * Cast raw values from database to JavaScript types. When the raw packet is fetched from database, `Date`s and special numbers are transformed by drivers already. This method is used to cast said values to custom types set by {@link Bone.attribute}, such as `JSON`.
   * @private
   * @param {string} value
   * @param {*} type
   * @returns {*}
   */
  static cast(value, type) {
    if (value == null) return value

    switch (type) {
      case JSON:
        return value ? JSON.parse(value) : null
      case Date:
        return value instanceof Date ? value : new Date(value)
      default:
        return value
    }
  }

  /**
   * Uncast JavaScript values back to database types. This is the reverse version of {@link Bone.uncast}.
   * @private
   * @param {*} value
   * @param {string} type
   * @returns {boolean|number|string|Date}
   */
  static uncast(value, type) {
    switch (type) {
      case JSON:
        return JSON.stringify(value)
      default:
        return value
    }
  }

  /**
   * Set a `hasOne` association to another model. The model is inferred by {@link Bone.reflectClass} from `opts.className` or the association `name` by default.
   * @param {string}  name
   * @param {Object} [opts]
   * @param {string} [opts.className]
   * @param {string} [opts.foreignKey]
   */
  static hasOne(name, opts) {
    opts = Object.assign({
      className: capitalize(name),
      foreignKey: this.table + 'Id'
    }, opts)

    if (opts.through) opts.foreignKey = ''

    this.relate(name, opts)
  }

  /**
   * Set a `hasMany` association to another model. The model is inferred by {@link Bone.reflectClass} from `opts.className` or the association `name` by default.
   * @param {string}  name
   * @param {Object} [opts]
   * @param {string} [opts.className]
   * @param {string} [opts.foreignKey]
   */
  static hasMany(name, opts) {
    opts = Object.assign({
      className: capitalize(pluralize(name, 1))
    }, opts, {
      hasMany: true
    })

    if (opts.through) opts.foreignKey = ''

    this.relate(name, opts)
  }

  /**
   * Set a `belongsTo` association to another model. The model is inferred by {@link Bone.reflectClass} from `opts.className` or the association `name` by default.
   * @param {string}  name
   * @param {Object} [opts]
   * @param {string} [opts.className]
   * @param {string} [opts.foreignKey]
   */
  static belongsTo(name, opts) {
    opts = Object.assign({
      className: capitalize(name)
    }, opts)

    let { className, foreignKey } = opts
    if (!foreignKey) foreignKey = camelCase(className) + 'Id'

    this.relate(name, Object.assign(opts, { foreignKey, belongsTo: true }))
  }

  /**
   * Mount the association. If existing association were found, throw an `Error`.
   * @private
   * @param {string}  name
   * @param {Object}  opts
   * @param {boolean} opts.belongsTo
   * @param {string}  opts.className
   * @param {string}  opts.foreignKey
   * @param {boolean} opts.hasMany
   */
  static relate(name, opts) {
    if (name in this.relations) {
      throw new Error(this.name + ' has relation conflicts at: ' + name)
    }
    this.relations[name] = { ...opts, Model: this.reflectClass(opts.className) }
  }

  /**
   * Convert the results to collection that consists of models with their associations set up according to `spell.joins`.
   * @private
   * @param {Spell} spell
   * @param {Object[]} rows
   * @param {Object[]} fields
   * @returns {Collection}
   */
  static dispatch(spell, rows, fields) {
    const results = new Collection()

    if (Object.keys(spell.joins).length == 0) {
      for (const row of rows) {
        results.push(this.instantiate(Object.values(row)[0]))
      }
    } else {
      const { aliasName, table, primaryColumn, primaryKey } = this
      let current
      for (const row of rows) {
        // If SQL contains subqueries, such as `SELECT * FROM (SELECT * FROM foo) AS bar`,
        // the table name of the columns in SQLite is the original table name instead of the alias.
        // Hence we need to fallback to original table name here.
        const main = row[aliasName] || row[table]
        if (!current || current[primaryKey] != main[primaryColumn]) {
          current = this.instantiate(main)
          results.push(current)
        }
        for (const qualifier in spell.joins) {
          const values = row[qualifier]
          const { Model, hasMany } = spell.joins[qualifier]
          const id = values[Model.primaryColumn]
          if (hasMany) {
            if (!current[qualifier]) current[qualifier] = []
            if (!id || current[qualifier].some(item => item[Model.primaryKey] == id)) continue
            current[qualifier].push(Model.instantiate(values))
          } else {
            current[qualifier] = id ? Model.instantiate(values) : null
          }
        }
      }
    }

    return results
  }

  /**
   * Convert returned rows to result set by translating columns (if found) to attributes.
   * @private
   * @param {Spell} spell
   * @param {Object[]} rows
   * @param {Object[]} fields
   * @returns {Object[]}
   */
  static resultSet(spell, rows, fields) {
    const results = []
    const { joins } = spell

    for (const row of rows) {
      const result = {}
      for (const qualifier in row) {
        const data = row[qualifier]
        if (qualifier == '') {
          Object.assign(result, data)
        }
        else if (qualifier in joins || qualifier == spell.Model.aliasName || qualifier == spell.Model.table) {
          const { Model } = joins[qualifier] || spell
          for (const column in data) {
            const name = Model.amehcs[column]
            result[name || column] = data[column]
          }
        }
        else {
          throw new Error(`Unknown qualifier ${qualifier}`)
        }
      }
      results.push(result)
    }

    return results
  }

  /**
   * Instantiate model from raw data packet returned by driver.
   * @private
   * @param {Object} row
   * @returns {Bone}
   */
  static instantiate(row) {
    const instance = new this()
    const { raw, rawOriginal, rawUnset } = instance

    for (const name in this.schema) {
      const { column, type } = this.schema[name]
      if (column in row) {
        // to make sure raw and rawOriginal hold two different objcets
        raw[name] = this.cast(row[column], type)
        rawOriginal[name] = this.cast(row[column], type)
      } else {
        rawUnset.add(name)
      }
    }

    return instance
  }

  /**
   * An alias of {@link Bone.find} without any conditions. To get all records in database, including those ones marked deleted, use {@link Bone.unscoped}. This getter returns all records by querying them at once, which can be inefficient if table contains loads of data. It is recommended to consume data by {@link Bone.batch}.
   * @example
   * Post.all           // fetches at once.
   * Post.unscoped      // fetches (soft) deleted records too.
   * Post.all.batch()   // fetches records 1000 by 1000s.
   * @returns {Spell}
   */
  static get all() {
    return this.find()
  }

  /**
   * Start a find query by creating and returning an instance of {@link Spell}. The `conditions` and `values` are handed over to {@link spell#$where}.
   * @param {string|Object} conditions
   * @param {...*} values
   * @returns {Spell}
   */
  static find(conditions, ...values) {
    const spell = new Spell(this, async spell => {
      const { rows, fields } = await this.query(spell, values)
      return spell.dispatchable
        ? this.dispatch(spell, rows, fields)
        : this.resultSet(spell, rows, fields)
    })
    const conditionsType = typeof conditions
    if (Array.isArray(conditions) || conditionsType == 'number') {
      spell.$where({ id: conditions })
    }
    // find({}, { offset: 1, limit: 1 })
    else if (typeof conditions == 'object' && values.length == 1 && typeof values[0] == 'object') {
      spell.$where(conditions)
      for (const method of ['order', 'limit', 'offset', 'select']) {
        const value = values[0][method]
        if (value != null) spell[`$${method}`](value)
      }
    }
    else if (conditions) {
      spell.$where(conditions, ...values)
    }

    return spell
  }

  /**
   * Start a find query like {@link Bone.find} with results limit to one, hence only one instance gets returned.
   * @example
   * Post.findOne()
   * Post.findOne('title = ?', ['Leah', 'Deckard Cain'])
   * Post.findOne().unscoped
   * @param {string|Object} conditions
   * @param {...*} values
   * @returns {Spell}
   */
  static findOne(conditions, ...values) {
    const spell = this.find(conditions, ...values).$limit(1)
    return spell.$get(0)
  }

  /**
   * Start a join query by including associations by name. The associations should be predefined in model's static `describe()` method. See {@link Bone.belongsTo}, {@link Bone.hasMany}, and {@link Bone.hasOne} for more information.
   * @example
   * class Post extends Bone {
   *   static describe() {
   *     this.hasMany('comments')
   *     this.belongsTo('author')
   *   }
   * }
   * Post.include('comments')
   * Post.include('author', 'comments')
   * @param {...string} names - association names defined in {@link Bone.describe}
   */
  static include(...names) {
    return this.find().$with(...names)
  }

  /**
   * Insert data into database, or update corresponding records if primary key exists. This method use {@link Bone#create} as the underlying method. Hence calling `Post.create({})` is basically the same as `new Post({}).save()`.
   * @example
   * Post.create({ title: 'Leah' })
   * Post.create({ id: 1, title: 'Diablo III', createdAt: new Date(2012, 4, 15) })
   * @param {Object} values
   * @returns {Spell}
   */
  static create(values) {
    const instance = new this(values)
    return instance.create()
  }

  /**
   * Update any record that matches `conditions`.
   * @example
   * Post.update({ title: 'Leah' }, { title: 'Diablo III' })
   * @param {Object} conditions
   * @param {Object} values
   * @returns {Spell}
   */
  static update(conditions, values) {
    if (Object.keys(values).length <= 0) {
      // nothing to update
      return Promise.resolve(0)
    }

    const spell = new Spell(this, async spell => {
      const result = await this.query(spell, values)
      return result.affectedRows
    })

    spell.$where(conditions)
    if (this.schema.updatedAt && !values.updatedAt && !values.deletedAt) {
      values.updatedAt = new Date()
    }
    spell.$update(values)

    return spell
  }

  /**
   * Remove any record that matches `conditions`.
   * - If `forceDelete` is true, `DELETE` records from database permanently.
   * - If not, update `deletedAt` attribute with current date.
   * - If `forceDelete` isn't true and `deleteAt` isn't around, throw an Error.
   * @example
   * Post.remove({ title: 'Leah' })         // mark Post { title: 'Leah' } as deleted
   * Post.remove({ title: 'Leah' }, true)   // delete Post { title: 'Leah' }
   * Post.remove({}, true)                  // delete all data of posts
   * @param {Object}  conditions
   * @param {boolean} forceDelete
   * @returns {Spell}
   */
  static remove(conditions, forceDelete = false) {
    if (forceDelete !== true && this.schema.deletedAt) {
      return this.update(conditions, { deletedAt: new Date() })
    }

    const spell = new Spell(this, async spell => {
      const result = await this.query(spell)
      return result.affectedRows
    })
    return spell.unscoped.$where(conditions).$delete()
  }

  static query(spell) {
    const { sql, values } = spell.format()
    const nestTables = spell.command === 'select'
    const connection = spell.connection || this.pool

    return connection.Leoric_query({ sql, nestTables, spell }, values)
  }

  static async transaction(callback) {
    if (callback.constructor.name !== 'GeneratorFunction') {
      throw new Error('unexpected transaction function, should be GeneratorFunction.')
    }
    const connection = await this.pool.Leoric_getConnection()
    const gen = callback()
    let result

    try {
      await connection.Leoric_query('BEGIN')
      while (true) {
        const { value: spell, done } = gen.next(result)
        if (done) break
        if (spell instanceof Spell) spell.connection = connection
        result = typeof spell.then === 'function' ? await spell : spell
      }
      await connection.Leoric_query('COMMIT')
    } catch (err) {
      console.error(err.stack)
      await connection.Leoric_query('ROLLBACK')
    } finally {
      connection.release()
    }
  }
}

const Spell_methods = [
  'select', 'join', 'where', 'group', 'order', 'get', 'count', 'average', 'minimum', 'maximum', 'sum'
]
for (const method of Spell_methods) {
  Object.defineProperty(Bone, method, {
    configurable: true,
    writable: true,
    value: function(...args) {
      return this.find()[`$${method}`](...args)
    }
  })
}

const Spell_getters = [ 'first', 'last', 'unscoped' ]
for (const getter of Spell_getters) {
  Object.defineProperty(Bone, getter, {
    configurable: true,
    get: function() {
      return this.find()[getter]
    }
  })
}

module.exports = Bone
