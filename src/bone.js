'use strict';

/**
 * The Bone to extend models from. This module consists of helper methods like `capitalize`, and the class {@link Bone}.
 * @module
 */
const util = require('util');
const deepEqual = require('deep-equal');
const debug = require('debug')('leoric');
const pluralize = require('pluralize');
const { executeValidator, LeoricValidateError } = require('./validator');
require('reflect-metadata');

const { default: DataTypes } = require('./data_types');
const Collection = require('./collection');
const Spell = require('./spell');
const Raw = require('./raw').default;
const { capitalize, camelCase, snakeCase } = require('./utils/string');
const { hookNames, setupSingleHook } = require('./setup_hooks');
const {
  TIMESTAMP_NAMES,
  LEGACY_TIMESTAMP_COLUMN_MAP,
  ASSOCIATE_METADATA_MAP,
  TIMESTAMP_ATTRIBUTE_NAMES,
  IS_LEORIC_BONE,
} = require('./constants');

const columnAttributesKey = Symbol('leoric#columnAttributes');
const synchronizedKey = Symbol('leoric#synchronized');
const tableKey = Symbol('leoric#table');

function looseReadonly(props) {
  return Object.keys(props).reduce((result, name) => {
    result[name] = {
      value: props[name],
      writable: false,
      enumerable: false,
      configurable: true,
    };
    return result;
  }, {});
}

function compare(attributes, columnMap) {
  const diff = {};
  const columnNames = new Set();

  for (const name in attributes) {
    const attribute = attributes[name];
    const { columnName } = attribute;
    columnNames.add(columnName);

    if (!attribute.equals(columnMap[columnName])) {
      diff[name] = {
        modify: columnMap.hasOwnProperty(columnName),
        ...attribute,
      };
    }
  }

  for (const columnName in columnMap) {
    if (!columnNames.has(columnName)) {
      diff[columnName] = { remove: true };
    }
  }

  return diff;
}

function setDefaultValue(record, attributes) {
  if (record == null || attributes == null) return;
  for (const name in attributes) {
    const value = record[name];
    // set defaultValues
    const { defaultValue } = attributes[name];
    if (value === undefined && defaultValue != null) record[name] = defaultValue;
  }
  return record;
}

/**
 * copy values for validation
 * @param {Object} values
 * @returns {Object} copied values
 */
function copyValues(values) {
  const copyValue = {};
  if (values && typeof values === 'object') {
    for (const key in values) {
      if (Object.hasOwnProperty.call(values, key)) {
        const v = values[key];
        if (v && ((v instanceof Raw) || v.__expr || (v instanceof Spell))) continue;
        copyValue[key] = v;
      }
    }
  }
  return copyValue;
}

function valuesValidate(values, attributes, ctx) {
  for (const valueKey in values) {
    const attribute = attributes[valueKey];
    if (!attribute) continue;
    const { validate = {}, name, allowNull, defaultValue } = attribute;
    const value = values[valueKey];
    if (value == null && defaultValue == null) {
      if (allowNull === false) throw new LeoricValidateError('notNull', name);
      if ((allowNull === true || allowNull === undefined) && validate.notNull === undefined) continue;
    }
    if (!validate) continue;
    for (const key in validate) {
      if (validate.hasOwnProperty(key)) executeValidator(ctx, key, attribute, value);
    }
  }
}

/**
 * The base class that provides Object-relational mapping. This class is never intended to be used directly. We need to create models that extends from Bone. Most of the query features of Bone is implemented by {@link Spell} such as {@link Spell#$group} and {@link Spell#$join}. With Bone, you can create models like this:
 *
 *     class Post extends Bone {
 *       static initialize() {
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
 * @property {Object} #raw
 * @property {Object} #rawSaved
 * @property {Object} #rawPrevious
 * @property {Set} #rawUnset
 * @property {Boolean} isNewRecord
 * @example
 * const post = new Post()
 * const post = new Post({ title: 'Leah' })
 */
class Bone {

  static DataTypes = DataTypes.invokable;

  // private variables
  #raw = {};
  #rawSaved = {};
  #rawUnset = new Set();
  #rawPrevious = {};

  // jsdoc gets examples of Bone confused with examples of constructor. Let's just put examples at class comments for now.
  /**
   * Create an instance of Bone. Accepts initial data values.
   * @param {Object} dataValues
   */
  constructor(dataValues, opts = {}) {
    // define isNewRecord
    Object.defineProperty(this, 'isNewRecord', {
      value: opts.isNewRecord !== undefined ? opts.isNewRecord : true,
      configurable: true,
      enumerable: false,
      writable: true,
    });
    // set default values first
    setDefaultValue(dataValues, this.constructor.attributes);
    // then execute setters
    if (dataValues) {
      for (const name in dataValues) {
        this[name] = dataValues[name];
      }
    }
  }

  static set synchronized(value) {
    this[synchronizedKey] = value;
  }

  static get synchronized() {
    return this[synchronizedKey];
  }

  /**
   * Get or set attribute value by name. This method is quite similiar to `jQuery.attr()`. If the attribute isn't selected when queried from database, an error will be thrown when accessing it.
   *
   *     const post = Post.select('title').first
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
   * @return {*}
   * @example
   * .attribute('title')                 // get the value of title
   * .attribute('title', 'New Post')  // set the value of title to 'New Post'
   */
  attribute(...args) {
    const [ name, value ] = args;
    const { attributes } = this.constructor;
    const attribute = attributes[name];

    if (!attribute) {
      throw new Error(`${this.constructor.name} has no attribute "${name}"`);
    }

    if (args.length > 1) {
      this.#raw[name] = value instanceof Raw ? value : attribute.cast(value);
      this.#rawUnset.delete(name);
      return this;
    }

    if (this.#rawUnset.has(name)) {
      return;
    }

    const rawValue = this.#raw[name];
    // make sure null is returned if value is undefined
    return rawValue == null ? null : rawValue;
  }

  /**
   * @protected clone instance
   * @param {Bone} target
   * @memberof Bone
   */
  _clone(target) {
    this.#raw = Object.assign({}, this.getRaw(), target.getRaw());
    this.#rawSaved = Object.assign({}, this.getRawSaved(), target.getRawSaved());
    this.#rawPrevious = Object.assign({}, this.getRawPrevious(), target.getRawPrevious());
    this.#rawUnset = target._getRawUnset();
  }

  /**
   * instance.hasAttribute(name)
   * @param {string} name
   * @returns {boolean}
   * @memberof Bone
   */
  hasAttribute(name) {
    if (!name) return false;
    const { attributes } = this.constructor;
    return attributes.hasOwnProperty(name);
  }

  /**
   * Model.hasAttribute(name)
   *
   * @static
   * @param {string} name
   * @returns {boolean}
   * @memberof Bone
   */
  static hasAttribute(name) {
    if (!name) return false;
    const { attributes } = this;
    return attributes.hasOwnProperty(name);
  }

  /**
   * get attributes except virtuals
   */
  static get columnAttributes() {
    if (this[columnAttributesKey]) return this[columnAttributesKey];
    const { attributes } = this;
    this[columnAttributesKey] = {};
    for (const key in this.attributes) {
      if (!attributes[key].virtual) this[columnAttributesKey][key] = attributes[key];
    }
    return this[columnAttributesKey];
  }

  /**
   * get actual update/insert columns to avoid empty insert or update
   * @param {Object} data
   * @returns
   */
  static _getColumns(data) {
    if (!Object.keys(data).length) return data;
    const attributes = this.columnAttributes;
    const res = {};
    for (const key in data) {
      if (attributes[key]) res[key] = data[key];
    }
    return res;
  }

  getRaw(key) {
    if (key) return this.#raw[key];
    return this.#raw;
  }

  getRawSaved(key) {
    if (key) return this.#rawSaved[key];
    return this.#rawSaved;
  }

  getRawPrevious(key) {
    if (key) return this.#rawPrevious[key];
    return this.#rawPrevious;
  }

  // protected
  _setRaw(...args) {
    const [ name, value ] = args;
    if (args.length > 1) {
      this.#raw[name] = value;
    } else if (args.length === 1 && name !== undefined && typeof name === 'object') {
      this.#raw = name;
    }
  }

  // protected
  _getRawUnset() {
    return this.#rawUnset;
  }

  // protected
  _setRawSaved(key, value) {
    this.#rawSaved[key] = value;
  }

  /**
   * instance.validate()
   * @memberof Bone
   */
  validate() {
    this._validateAttributes();
  }

  /**
   * validate attributes, before writing operations: instance.create / save  / update
   * @private
   * @memberof Bone
   */
  _validateAttributes(values = {}) {
    const { attributes } = this.constructor;
    // check changed values
    const changes = this.changes();
    let changedValues = {};
    for (const key in changes) {
      if (changes[key].length === 2) {
        changedValues[key] = changes[key][1];
      }
    }

    // merge all changed values
    changedValues = Object.assign(changedValues, values);
    valuesValidate(changedValues, attributes, this);
  }

  /**
   * validate attributes, before writing operations: class.create / upsert / update
   * @private
   * @static
   * @param {Object} [values={}]
   * @memberof Bone
   */
  static _validateAttributes(values = {}) {
    const { attributes } = this;
    valuesValidate(values, attributes, this);
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
    const value = this.#rawSaved[name];
    return value == null ? null : value;
  }

  /**
   * @deprecated {attributeChanged} is deprected, use {@link Bone#changed} instead
   * Check if the value of attribute is changed or not ({@link Bone#rawSaved}).
   * @param {string} name - attribute name
   * @example
   * const post = await Post.findOne({ title: 'Leah' })
   * post.title = 'Deckard Cain'
   * post.attributeChanged('title')  // => true
   * post.title = 'Leah'
   * post.attributeChanged('title')  // => false
   */
  attributeChanged(name) {
    if (this.#rawUnset.has(name)) return false;
    if (this.#rawUnset.has(name) || !this.hasAttribute(name)) return false;
    const value = this.attribute(name);
    const valueWas = this.attributeWas(name);
    return !deepEqual(value, valueWas);
  }

  /**
   * Get previous attribute changes. Please be noted that {@link Bone#changes} is about the changes made after the record is saved, and {@link Bone#previousChanges} only returns the changes made before the record was previously saved.
   *
   *     previousChanges ➡️ [saved] ➡️ changes ➡️ [current]
   *
   * @param {string?} name
   * @returns {string | Array<string>} changed attribute(s)' name that compare(s) to previous persisted value(s): {@link Bone.raw} compares to {@link Bone.rawPrevious}
   * @memberof Bone
   * @example
   * bone.previousChanges('a');  // => { a: [ 1, 2 ] }
   * bone.previousChanges();     // => { a: [ 1, 2 ], b: [ true, false ] }
   */
  previousChanged(name) {
    const result = Object.keys(this.previousChanges(name));
    if (name != null) return !!result.length;
    return result.length > 0 ? result : false;
  }

  /**
   *
   * @param {string?} name
   * @returns {Object.<string, Array>} changed values comparing current values {@link Bone.raw} against previous values {@link Bone.rawPrevious}
   * @memberof Bone
   */
  previousChanges(name) {
    if (name != null) {
      if (this.#rawUnset.has(name) || this.#rawPrevious[name] === undefined || !this.hasAttribute(name)) return {};
      const value = this.attribute(name);
      const valueWas = this.#rawPrevious[name] == null ? null : this.#rawPrevious[name];
      if (deepEqual(value, valueWas)) return {};
      return { [name]: [ valueWas, value ] };
    }
    const result = {};
    for (const attrKey of Object.keys(this.constructor.attributes)) {
      if (this.#rawUnset.has(attrKey) || this.#rawPrevious[attrKey] === undefined) continue;
      const value = this.attribute(attrKey);
      const valueWas = this.#rawPrevious[attrKey] == null ? null : this.#rawPrevious[attrKey];
      if (!deepEqual(value, valueWas)) result[attrKey] = [ valueWas, value ];
    }
    return result;
  }

  /**
   *
   * @param {string?} name
   * @returns {Object.<string, Array>} changed attributes comparing current values {@link Bone.raw} against persisted values {@link Bone.rawSaved}
   * @memberof Bone
   * @example
   * bone.changes('a');  // => { a: [ 1, 2 ] }
   * bone.changes();     // => { a: [ 1, 2 ], b: [ true, false ] }
   */
  changes(name) {
    if (name != null) {
      if (this.#rawUnset.has(name) || !this.hasAttribute(name)) return {};
      const value = this.attribute(name);
      const valueWas = this.attributeWas(name);
      if (deepEqual(value, valueWas)) return {};
      return { [name]: [ valueWas, value ] };
    }
    const result = {};
    for (const attrKey of Object.keys(this.constructor.attributes)) {
      if (this.#rawUnset.has(attrKey)) continue;
      const value = this.attribute(attrKey);
      const valueWas = this.attributeWas(attrKey);

      if (!deepEqual(value, valueWas)) {
        result[attrKey] = [ valueWas, value ];
      }
    }
    return result;
  }

  /**
   * attribute changed or not
   * @param {string} name
   * @returns {boolean | Array<string>} changed or not | attribute name array
   * @memberof Bone
   * @example
   * bone.changed('a');  // true
   * bone.changed();     // [ 'a', 'b' ]
   */
  changed(name) {
    const result = Object.keys(this.changes(name));
    if (name != null) return !!result.length;
    return result.length > 0 ? result : false;
  }

  /**
   * Gets called when `console.log(instance)` is invoked.
   * @example
   * const post = await Post.first
   * post.inspect()  // => 'Post { "id": 1, ... }'
   * @return {string}
   */
  [util.inspect.custom]() {
    return this.constructor.name + ' ' + util.inspect(this.toJSON());
  }

  /**
   * Gets called when `JSON.stringify(instance)` is invoked.
   * {@link Bone#toJSON} might be called on descents of Bone that does not have attributes defined on them directly, hence for..in is preferred.
   * - https://developer.mozilla.org/en-US/docs/Web/JavaScript/Enumerability_and_ownership_of_properties
   * @example
   * const post = await Post.first
   * post.toJSON()  // => { id: 1, ... }
   * @return {Object}
   */
  toJSON() {
    const obj = {};

    for (const key in this) {
      if (this.#rawUnset.has(key)) continue;
      if (typeof this[key] !== 'function') {
        const value = this[key];
        if (value != null) {
          obj[key] = value instanceof Bone ? value.toJSON() : value;
        }
      }
    }

    return obj;
  }

  /**
   * This is the loyal twin of {@link Bone#toJSON} because when generating the result object, the raw values of attributes are used, instead of the values returned by custom getters (if any).
   * {@link Bone#toObject} might be called on descents of Bone that does not have attributes defined on them directly, hence for..in is preferred.
   * - https://developer.mozilla.org/en-US/docs/Web/JavaScript/Enumerability_and_ownership_of_properties
   * @example
   * const post = await Post.first
   * post.toObject()  // => { id: 1, ... }
   * @return {Object}
   */
  toObject() {
    const obj = {};

    for (const key in this) {
      if (this.#rawUnset.has(key)) continue;
      if (typeof this[key] !== 'function') {
        const value = this[key];
        obj[key] = value != null && typeof value.toObject === 'function'
          ? value.toObject()
          : value;
      }
    }
    return obj;
  }

  /**
   * Save the changes to database. If the instance isn't persisted to database before, an INSERT query will be executed. Otherwise, an upsert-like query is chosen to make sure only one instance of the specified primaryKey is created. If the primaryKey is positive but unchanged, an UPDATE will be executed.
   * @public
   * @returns {Bone} saved model itself
   * @memberof Bone
   * @example
   * new Post({ title: 'Leah' }).save()
   * // same as Post.create({ title: 'Leah' })
   *
   * const post = Post.first
   * post.title = 'Decard Cain'
   * post.save()
   */
  save(opts = {}) {
    return this._save(opts);
  }

  /**
   * @private
   * @return {Bone} current instance
   */
  async _save(opts = {}) { // hooks maybe false
    const { primaryKey } = this.constructor;
    if (this.#rawUnset.has(primaryKey)) throw new Error(`unset primary key ${primaryKey}`);
    if (this[primaryKey] == null) {
      await this.create(opts);
    } else if (this.changed(primaryKey)) {
      await this.upsert(opts);
    } else {
      const changeValues = {};
      const changedKeys = this.changed();
      if (changedKeys) {
        for (const name of changedKeys) {
          changeValues[name] = this.attribute(name);
        }
      }
      await this.update(changeValues, opts);
    }
    return this;
  }

  /**
   * Sync changes made in {@link Bone.raw} back to {@link Bone.rawSaved}.
   * @private
   */
  syncRaw() {
    const { attributes } = this.constructor;
    this.isNewRecord = false;
    for (const name of Object.keys(attributes)) {
      const attribute = attributes[name];
      // Take advantage of uncast/cast to create new copy of value
      let value;
      try {
        value = attribute.uncast(this.#raw[name]);
      } catch (error) {
        console.error(error);
        // do not interrupt sync raw
        value = this.#raw[name];
      }
      if (this.#rawSaved[name] !== undefined) {
        this.#rawPrevious[name] = this.#rawSaved[name];
      } else if (this.#rawPrevious[name] === undefined && this.#raw[name] != null) {
        // first persisting
        this.#rawPrevious[name] = null;
      }
      this.#rawSaved[name] = attribute.cast(value);
    }
  }

  /**
   * Look for current instance in the database, then:
   *
   * - If found, save the changes to existing one.
   * - If not found, create a new record.
   *
   * Returns number of affectedRows.
   * @public
   * @returns {number}
   * @memberof Bone
   */
  upsert(opts = {}) {
    return this._upsert(opts);
  }
  /**
   * @private
   * @return {number}
   */
  _upsert(opts = {}) {
    const data = {};
    const Model = this.constructor;
    const { attributes, primaryKey } = Model;
    for (const name in attributes) {
      if (this.changed(name)) data[name] = this.attribute(name);
    }

    if (!Object.keys(Model._getColumns(data)).length) {
      this.syncRaw();
      return Promise.resolve(0);
    }

    const { createdAt, updatedAt } = Model.timestamps;

    if (attributes[createdAt] && !this[createdAt]) {
      data[createdAt] = new Date();
    }

    if (attributes[updatedAt] && !(this[updatedAt] && this.changed('updatedAt'))) {
      data[updatedAt] = new Date();
    }

    if (this[primaryKey]) data[primaryKey] = this[primaryKey];
    if (opts.validate !== false) {
      this._validateAttributes(data);
    }

    // About LAST_INSERT_ID()
    // - http://dev.mysql.com/doc/refman/5.7/en/information-functions.html#function_last-insert-id
    const spell = new Spell(Model, opts).$upsert(data);
    return spell.later(result => {
      // LAST_INSERT_ID() breaks on TDDL, and on OceanBase if primary key is not integer
      if (this[primaryKey] == null) this[primaryKey] = result.insertId;
      this.syncRaw();
      return result.affectedRows;
    });
  }

  /**
   * Persist changes on current instance back to database with `UPDATE`.
   * @public
   * @param {Object} values
   * @param {Object?} options
   * @returns {Promise<number>} affected rows
   * @memberof Bone
   */
  async update(values, options = {}) {
    const changes = {};
    const originalValues = Object.assign({}, this.#raw);
    const { fields = [] } = options;
    if (typeof values === 'object') {
      for (const name in values) {
        if (values[name] !== undefined && this.hasAttribute(name) && (!fields.length || fields.includes(name))) {
          // exec custom setters in case it exist
          this[name] = values[name];
          changes[name] = this.attribute(name);
        }
      }
    }
    try {
      const res = await this._update(Object.keys(changes).length? changes : values, options);
      return res;
    } catch (error) {
      // revert value in case update failed
      this._setRaw(originalValues);
      throw error;
    }
  }

  /**
   * Persist changes on current instance back to database with `UPDATE`.
   * @private
   * @return {Promise<number>}
   */
  async _update(values, options = {}) {
    const Model = this.constructor;
    const { attributes, primaryKey, shardingKey } = Model;
    const changes = {};
    if (values == null) {
      for (const name in attributes) {
        if (this.changed(name)) changes[name] = this.attribute(name);
      }
    } else {
      for (const key in values) {
        if (values[key] !== undefined && this.hasAttribute(key)) {
          changes[key] = values[key];
        }
      }
    }

    if (!Object.keys(Model._getColumns(changes)).length) {
      this.syncRaw();
      return Promise.resolve(0);
    }
    if (this[primaryKey] == null) {
      throw new Error(`unset primary key ${primaryKey}`);
    }

    const where = { [primaryKey]: this[primaryKey] };
    if (shardingKey) where[shardingKey] = this[shardingKey];

    const { updatedAt, deletedAt } = Model.timestamps;
    if (attributes[updatedAt] && !changes[updatedAt] && !changes[deletedAt] && !options.silent) {
      changes[updatedAt] = new Date();
    }
    if (options.validate !== false) {
      this._validateAttributes(changes);
    }
    const spell = new Spell(Model, options).$where(where).$update(changes);
    return await spell.later(result => {
      // sync changes (changes has been formatted by custom setters, use this.attribute(name, value) directly)
      for (const key in changes) {
        this.attribute(key, changes[key]);
      }
      this.syncRaw();
      return result.affectedRows;
    });
  }

  /**
   * @public
   * @returns {Bone} created instance
   * @memberof Bone
   */
  create(opts = {}) {
    return this._create(opts);
  }

  /**
   * Insert current instance into database. Unlike {@link Bone#upsert}, this method use `INSERT` no matter primary key presents or not.
   * @private
   * @returns {Bone} created instance
   */
  _create(opts = {}) {
    const Model = this.constructor;
    const { primaryKey, attributes } = Model;
    const data = {};
    const { createdAt, updatedAt } = Model.timestamps;

    if (attributes[createdAt] && !this[createdAt]) {
      this[createdAt] = new Date();
    }

    if (attributes[updatedAt] && !this[updatedAt]) {
      this[updatedAt] = this[createdAt] || new Date();
    }

    const validateValues = {};
    for (const name in attributes) {
      const value = this.attribute(name);
      const { defaultValue } = attributes[name];
      if (value != null) {
        data[name] = value;
      } else if (value === undefined && defaultValue != null) {
        data[name] = defaultValue;
      }
      if (attributes[name].primaryKey) continue;
      validateValues[name] = data[name];
    }

    if (opts.validate !== false) {
      this._validateAttributes(validateValues);
    }

    if (!Object.keys(Model._getColumns(data)).length) {
      this.syncRaw();
      return this;
    }

    const spell = new Spell(Model, opts).$insert(data);
    return spell.later(result => {
      // LAST_INSERT_ID() breaks on TDDL, and on OceanBase if primary key is not integer
      if (this[primaryKey] == null) this[primaryKey] = result.insertId;
      // this.#rawSaved[primaryKey] = null;
      this.syncRaw();
      return this;
    });
  }

  async reload() {
    const { primaryKey, shardingKey } = this.constructor;
    const conditions = { [primaryKey]: this[primaryKey] };
    if (shardingKey) conditions[shardingKey] = this[shardingKey];
    const spell = this.constructor._find(conditions).$get(0);
    spell.scopes = [];
    const instance = await spell;
    if (instance) this._clone(instance);
    return instance;
  }

  /**
   * @public
   * @param {boolean} forceDelete
   * @param {Object?} opts
   * @returns {number} effected rows
   * @memberof Bone
   */
  async remove(forceDelete, opts = {}) {
    return await this._remove(forceDelete, opts);
  }

  /**
   * Delete current instance. If `deletedAt` attribute exists, calling {@link Bone#remove} does not actually delete the record from the database. Instead, it updates the value of `deletedAt` attribute to current date. This is called [soft delete](../querying#scopes). To force a regular `DELETE`, use `.remove(true)`.
   * @private
   * @param {boolean} forceDelete
   * @returns {number} affected rows
   * @example
   * const post = await Post.first
   * post.remove()      // update the `deletedAt`
   * post.remove(true)  // delete record
   */
  async _remove(forceDelete, opts) {
    const Model = this.constructor;
    const { primaryKey, shardingKey, attributes, timestamps } = Model;
    const { deletedAt } = timestamps;

    if (this[primaryKey] == null) {
      throw new Error('instance is not persisted yet.');
    }

    const condition = { [primaryKey]: this[primaryKey] };
    if (shardingKey) condition[shardingKey] = this[shardingKey];


    if (!forceDelete && attributes[deletedAt]) {
      const result = this._update({
        [deletedAt]: new Date(),
      }, opts);
      return result;
    }
    return await Model._remove(condition, forceDelete, opts);
  }

  /**
   * restore data
   * @param {Object?} query options
   * @returns {Bone} instance
   */
  async restore(opts = {}) {
    const Model = this.constructor;
    const { primaryKey, shardingKey } = Model;

    const { deletedAt } = Model.timestamps;

    if (this[primaryKey] == null) {
      throw new Error('instance is not persisted yet.');
    }

    if (deletedAt == null) {
      throw new Error('Model is not paranoid');
    }

    const conditions = {
      [primaryKey]: this[primaryKey],
      [deletedAt]: { $ne: null },
    };
    if (shardingKey) conditions[shardingKey] = this[shardingKey];
    await this.update({ [deletedAt]: null }, { ...opts, paranoid: false });
    return this;
  }

  /**
   * restore rows
   * @param {Object} conditions query conditions
   * @param {Object?} opts query options
   * @returns {Spell}
   */
  static restore(conditions, opts = {}) {
    const { deletedAt } = this.timestamps;
    if (deletedAt == null) {
      throw new Error('Model is not paranoid');
    }
    return Bone.update.call(this, conditions, { [deletedAt]: null }, { ...opts, paranoid: false });
  }

  /**
   * Model.upsert
   * Returns number of affectedRows.
   * @static
   * @param {object} values
   * @param {object} options
   * @returns number of affectedRows.
   */
  static upsert(values, options = {}) {
    const data = {};
    const Model = this;
    const { attributes } = Model;
    for (const key in attributes) {
      const attribute = attributes[key];
      if (values[key] == null && attribute.defaultValue != null) {
        data[key] = attribute.defaultValue;
      } else if (values[key] !== undefined) {
        data[key] = values[key];
      }
    }

    if (!Object.keys(Model._getColumns(data)).length) {
      this.syncRaw();
      return Promise.resolve(0);
    }

    const { createdAt, updatedAt } = Model.timestamps;

    if (attributes[createdAt] && !data[createdAt]) {
      data[createdAt] = new Date();
    }

    if (attributes[updatedAt] && !data[updatedAt]) {
      data[updatedAt] = new Date();
    }

    if (options.validate !== false) {
      this._validateAttributes(data);
    }

    // About LAST_INSERT_ID()
    // - http://dev.mysql.com/doc/refman/5.7/en/information-functions.html#function_last-insert-id
    const spell = new Spell(Model, options).$upsert(data);
    return spell.later(result => {
      return result.affectedRows;
    });
  }

  /**
   * Override attribute metadata. Currently only `type` is needed to be overriden with this method.
   * @param {string} name
   * @param {Object} meta
   * @example
   * class Post extends Bone {
   *   static initialize() {
   *     Post.attribute('extra', { type: JSON })
   *   }
   * }
   */
  static attribute(name, meta = {}) {
    const attribute = this.attributes[name];
    if (!attribute) {
      throw new Error(`${this.name} has no attribute called ${name}`);
    }
    const { type: jsType } = meta;
    // TODO: needs better approach
    if (jsType === global.JSON) attribute.type = new this.driver.DataTypes.JSON();
    Object.assign(attribute, { jsType });
  }

  /**
   * Generate attributes from column definitions.
   * @private
   * @param {Object[]} columns - `information_schema.columns` of certain table
   */
  static load(columns = []) {
    const { Attribute } = this.driver;
    const { associations = {}, attributes, options } = this;
    const attributeMap = {};
    const table = this.table || snakeCase(pluralize(this.name));
    const tableAlias = camelCase(pluralize(this.name || table));

    // if there is no primaryKey added, add it to attributes automatically
    if (Object.values(attributes).every(attribute => !attribute.primaryKey)) {
      attributes[this.primaryKey] = {
        type: new DataTypes.BIGINT(),
        allowNull: false,
        autoIncrement: true,
        columnName: snakeCase(this.primaryKey),
        ...attributes[this.primaryKey],
        primaryKey: true,
      };
    }

    const columnMap = columns.reduce((result, entry) => {
      result[entry.columnName] = entry;
      return result;
    }, {});

    for (const name of Object.keys(attributes)) {
      const attribute = new Attribute(name, attributes[name], options.define);
      attributeMap[attribute.columnName] = attribute;
      attributes[name] = attribute;
      if (TIMESTAMP_ATTRIBUTE_NAMES.includes(name)) {
        const { columnName } = attribute;
        const legacyColumnName = LEGACY_TIMESTAMP_COLUMN_MAP[columnName];
        if (!columnMap[columnName] && legacyColumnName && columnMap[legacyColumnName]) {
          // correct columname
          attribute.columnName = legacyColumnName;
          attributeMap[attribute.columnName] = attribute;
        }
      }
      const columnInfo = columnMap[attribute.columnName];
      // if datetime or timestamp precision not defined, default to column info
      if (columnInfo && attribute.type instanceof DataTypes.DATE && attribute.type.precision == null) {
        attribute.type.precision = columnInfo.datetimePrecision;
      }
    }

    const primaryKey = Object.keys(attributes).find(key => attributes[key].primaryKey);
    const timestamps = {};
    for (const key of TIMESTAMP_NAMES) {
      const name = attributes.hasOwnProperty(key) ? key : snakeCase(key);
      const attribute = attributes[name];

      if (attribute && columnMap[attribute.columnName]) {
        timestamps[key] = name;
      }
    }
    for (const name in attributes) this.loadAttribute(name);
    const diff = compare(attributes, columnMap);

    Object.defineProperties(this, looseReadonly({
      timestamps,
      primaryKey,
      columns,
      attributeMap,
      associations,
      tableAlias,
    }));

    this[tableKey] = table;
    this[synchronizedKey] = Object.keys(diff).length === 0;

    if (!this.synchronized) {
      debug('[load] %s `%s` out of sync %j', this.name, this.table, Object.keys(diff));
    }

    for (const hookName of hookNames) {
      if (this[hookName]) setupSingleHook(this, hookName, this[hookName]);
    }
    this[columnAttributesKey] = null;
  }

  /**
   * Override this method to setup associations, rename attributes, etc.
   * @example
   * class Post extends Bone {
   *   static didLoad() {
   *     this.belongsTo('author', { className: 'User' })
   *     this.renameAttribute('content', 'body')
   *   }
   * }
   */
  static initialize() {
    for (const [key, metadataKey] of Object.entries(ASSOCIATE_METADATA_MAP)) {
      const result = Reflect.getMetadata(metadataKey, this);
      for (const property in result) this[key].call(this, property, result[property]);
    }
  }

  /**
   * The primary key of the model, in camelCase.
   * @type {string}
   */
  static primaryKey = 'id';

  /**
   * The primary column of the model, in snake_case, usually.
   * @type {string}
   */
  static get primaryColumn() {
    return this.unalias(this.primaryKey);
  }

  static get shardingColumn() {
    if (this.shardingKey) return this.unalias(this.shardingKey);
  }

  static get physicTable() {
    const { physicTables } = this;
    if (physicTables && physicTables.length > 0) {
      return physicTables[0];
    }
    // table name might be undefined, the default one will get set later.
    return this.table || snakeCase(pluralize(this.name));
  }

  static set table(value) {
    this[tableKey] = value;
  }

  static get table() {
    return this[tableKey];
  }

  /**
   * get the connection pool of the driver
   */
  static get pool() {
    return this.driver && this.driver.pool;
  }

  /**
   * Get the attribute name of column, or translate the whole object
   * @private
   * @param {string|Record<string, Literal>} name
   * @return {string|Record<string, Literal>}
   */
  static alias(data) {
    const { attributeMap } = this;

    if (typeof data === 'string') {
      const result = attributeMap[data];
      return result ? result.name : data;
    }

    const result = {};
    for (const key in data) {
      const value = data[key];
      const attribute = attributeMap[key];
      result[attribute ? attribute.name : key] = value;
    }
    return result;
  }

  /**
   * Get the column name from the attribute name
   * @private
   * @param {string} name
   * @return {string}
   */
  static unalias(name) {
    if (name in this.attributes) {
      return this.attributes[name].columnName;
    }
    return name;
  }

  /**
   * Load attribute definition to merge default getter/setter and custom descriptor on prototype
   * @param {string} name attribute name
   */
  static loadAttribute(name) {
    const descriptor = Object.getOwnPropertyDescriptor(this.prototype, name);
    const customDescriptor = Object.keys(descriptor || {}).reduce((result, key) => {
      if (descriptor[key] != null) result[key] = descriptor[key];
      return result;
    }, {});
    Object.defineProperty(this.prototype, name, {
      get() {
        return this.attribute(name);
      },
      set(value) {
        return this.attribute(name, value);
      },
      ...customDescriptor,
      enumerable: true,
      configurable: true,
    });
  }

  /**
   * Rename attribute. Since Bone manages a separate set of names called attributes instead of using the raw columns, we can rename the attribute names, which is transformed from the column names by convention, to whatever name we fancy.
   * @param {string} originalName
   * @param {string} newName
   */
  static renameAttribute(originalName, newName) {
    const { attributes, attributeMap } = this;

    if (attributes.hasOwnProperty(newName)) {
      throw new Error(`unable to override existing attribute "${newName}"`);
    }

    if (attributes.hasOwnProperty(originalName)) {
      const info = attributes[originalName];
      info.name = newName;
      attributes[newName] = info;
      attributeMap[info.columnName] = info;
      delete attributes[originalName];
      Reflect.deleteProperty(this.prototype, originalName);
      this.loadAttribute(newName);
    }
    this[columnAttributesKey] = null;
  }

  /**
   * Set a `hasOne` association to another model. The model is inferred by `opts.className` or the association `name` by default.
   * @param {string}  name
   * @param {Object} [opts]
   * @param {string} [opts.className]
   * @param {string} [opts.foreignKey]
   */
  static hasOne(name, options) {
    options = ({
      className: capitalize(name),
      foreignKey: camelCase(`${this.name}Id`),
      ...options,
    });

    if (options.through) options.foreignKey = '';

    this.associate(name, options);
  }

  /**
   * Set a `hasMany` association to another model. The model is inferred by `opts.className` or the association `name` by default.
   * @param {string}  name
   * @param {Object} [opts]
   * @param {string} [opts.className]
   * @param {string} [opts.foreignKey]
   */
  static hasMany(name, options) {
    options = {
      className: capitalize(pluralize(name, 1)),
      foreignKey: camelCase(`${this.name}Id`),
      ...options,
      hasMany: true,
    };

    if (options.through) options.foreignKey = '';

    this.associate(name, options);
  }

  /**
   * Set a `belongsTo` association to another model. The model is inferred by `opts.className` or the association `name` by default.
   * @param {string}  name
   * @param {Object} [opts]
   * @param {string} [opts.className]
   * @param {string} [opts.foreignKey]
   */
  static belongsTo(name, options = {}) {
    const { className = capitalize(name) } = options;
    options = {
      className,
      foreignKey: camelCase(`${className}Id`),
      ...options,
    };

    this.associate(name, { ...options, belongsTo: true });
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
  static associate(name, opts = {}) {
    if (name in this.associations) {
      throw new Error(`duplicated association "${name}" on model ${this.name}`);
    }
    const { className } = opts;
    const Model = this.models[className];
    if (!Model) throw new Error(`unable to find associated model "${className}" (model ${this.name})`);
    if (opts.foreignKey && Model.attributes[opts.foreignKey] && Model.attributes[opts.foreignKey].virtual) {
      throw new Error(`unable to use virtual attribute ${opts.foreignKey} as foreign key in model ${Model.name}`);
    }

    const { deletedAt } = Model.timestamps;
    if (Model.attributes[deletedAt]) opts.where = { [deletedAt]: null, ...opts.where };
    this.associations[name] = { ...opts, Model };
  }

  /**
   * Instantiate model from raw data packet returned by driver.
   * @private
   * @param {Object} row
   * @return {Bone}
   */
  static instantiate(row) {
    const { attributes, attributeMap } = this;
    const instance = new this();

    for (const columnName in row) {
      const value = row[columnName];
      const attribute = attributeMap[columnName];
      if (attribute) {
        // to make sure raw and rawSaved hold two different objects
        instance._setRaw(attribute.name, attribute.cast(value));
        instance._setRawSaved(attribute.name, attribute.cast(value));
      } else {
        if (value != null && typeof value == 'object') instance[columnName] = value;
        else if (!isNaN(value)) instance[columnName] = Number(value);
        else if (!isNaN(Date.parse(value))) instance[columnName] = new Date(value);
        else instance[columnName] = value;
      }
    }

    for (const name in attributes) {
      const attribute = attributes[name];
      if (!(attribute.columnName in row) && !attribute.virtual) {
        instance._getRawUnset().add(name);
      }
    }

    instance.isNewRecord = false;
    return instance;
  }

  /**
   * An alias of {@link Bone.find} without any conditions. To get all records in database, including those ones marked deleted, use {@link spell#$unscoped}. This getter returns all records by querying them at once, which can be inefficient if table contains loads of data. It is recommended to consume data by {@link spell#$batch}.
   * @example
   * Post.all           // fetches at once.
   * Post.all.unscoped  // fetches (soft) deleted records too.
   * Post.all.batch()   // fetches records 1000 by 1000s.
   * @return {Spell}
   */
  static get all() {
    return this._find();
  }

  /**
   * Start a find query by creating and returning an instance of {@link Spell}. The `conditions` and `values` are handed over to {@link spell#$where}.
   * @param {string|Object} conditions
   * @param {...*} values
   * @return {Spell}
   */
  static find(conditions, ...values) {
    return this._find(conditions, ...values);
  }

  /**
   * Start a find query by creating and returning an instance of {@link Spell}. The `conditions` and `values` are handed over to {@link spell#$where}.
   * @private
   * @param {string|Object} conditions
   * @param {...*} values
   * @return {Spell}
   */
  static _find(conditions, ...values) {
    const conditionsType = typeof conditions;
    const options = values.length == 1 && typeof values[0] === 'object' ? values[0] : undefined;
    const spell = new Spell(this, options);

    if (Array.isArray(conditions) || conditionsType == 'number') {
      // find(1)
      // find([ 1, 2, 3 ])
      spell.$where({ [this.primaryKey]: conditions });
    } else if (typeof conditions === 'object' && options) {
      // find({}, { offset: 1, limit: 1, ...etc })
      spell.$where(conditions);
    } else if (conditions) {
      // find('title = ?', 'foo')
      spell.$where(conditions, ...values);
    }

    if (options) {
      for (const method of [ 'order', 'limit', 'offset', 'select' ]) {
        const value = options[method];
        if (value != null) spell[`$${method}`](value);
      }
    }

    return spell.later(Collection.init);
  }

  /**
   * Start a find query like {@link Bone.find} with results limit to one, hence only one instance gets returned.
   * @param {string|Object} conditions
   * @param {...*} values
   * @return {Spell}
   * @example
   * Post.findOne()
   * Post.findOne('title = ?', ['Leah', 'Deckard Cain'])
   * Post.findOne().unscoped
   */
  static findOne(conditions, ...values) {
    return this._find(conditions, ...values).$get(0);
  }

  /**
   * Start a join query by including associations by name. The associations should be predefined in model's static `describe()` method. See {@link Bone.belongsTo}, {@link Bone.hasMany}, and {@link Bone.hasOne} for more information.
   * @example
   * class Post extends Bone {
   *   static initialize() {
   *     this.hasMany('comments')
   *     this.belongsTo('author')
   *   }
   * }
   * Post.include('comments')
   * Post.include('author', 'comments')
   * @param {...string} names - association names defined in {@link Bone.initialize}
   */
  static include(...names) {
    return this._find().$with(...names);
  }

  /**
   * Insert data into database, or update corresponding records if primary key exists. This method use {@link Bone#create} as the underlying method. Hence calling `Post.create({})` is basically the same as `new Post({}).save()`.
   * @example
   * Post.create({ title: 'Leah' })
   * Post.create({ id: 1, title: 'Diablo III', createdAt: new Date(2012, 4, 15) })
   * @param {Object} values
   * @return {Spell}
   */
  static create(values, opts = {}) {
    const data = Object.assign({}, values);
    const instance = new this(data);
    // static create proxy to instance.create
    return instance.create({
      ...opts,
    });
  }

  static async bulkCreate(records, options = {}) {
    if (!records || !records.length) return records;
    const { driver, attributes, primaryKey, primaryColumn } = this;

    const { createdAt, updatedAt } = this.timestamps;
    const now = new Date();
    for (const entry of records) {
      if (createdAt && entry[createdAt] == null) entry[createdAt] = now;
      if (updatedAt && entry[updatedAt] == null) entry[updatedAt] = now;
      setDefaultValue(entry, attributes);
    }

    const unset = records.every(entry => entry[primaryKey] == null);
    const allset = records.every(entry => entry[primaryKey] != null);
    const opts = { ...options, attributes, primaryKey: primaryColumn };

    if (driver.type === 'postgres') opts.returning = [ primaryColumn ];

    const attribute = attributes[primaryKey];
    const autoIncrement = attribute.autoIncrement
      || (attribute.jsType == Number && attribute.primaryKey);

    // validate
    if (options.validate !== false) {
      records.map(entry => this._validateAttributes(entry));
    }

    const instances = records.map(entry => new this(entry));
    if (options.individualHooks) {
      await Promise.all(instances.map((instance) => instance.save(options)));
      return instances;
    }

    // unalias first
    if (Array.isArray(opts.updateOnDuplicate)) {
      opts.updateOnDuplicate = opts.updateOnDuplicate.map((field) => this.unalias(field));
    }

    if (Array.isArray(opts.uniqueKeys)) {
      opts.uniqueKeys = opts.uniqueKeys.map((field) => this.unalias(field));
    }

    // records might change when filter through custom setters
    records = instances.map(instance => instance.getRaw());

    // bulk create with instances is possible only if
    // 1) either all of records primary key are set
    // 2) or none of records priamry key is set and primary key is auto incremented
    if (!(autoIncrement && unset || allset)) {
      // validate first
      if (options.validate !== false) {
        for (const record of records) this._validateAttributes(record);
      }
      return await new Spell(this, options).$bulkInsert(records);
    }

    const result = await new Spell(this, options).$bulkInsert(records);
    const { affectedRows, rows } = result;
    let { insertId } = result;

    if (Array.isArray(rows)) {
      // PostgreSQL returns rows specified with RETURNING columns
      for (let i = 0; i < rows.length; i++) {
        const value = attribute.jsType(rows[i][primaryColumn]);
        Object.assign(instances[i], { [primaryKey]: value });
      }
    } else if (unset && affectedRows === instances.length) {
      // otherwise, use last insert id to generate bulk inserted ids
      if (['sqlite', 'sqljs'].includes(driver.type)) {
        for (let i = instances.length - 1; i >= 0; i--) {
          instances[i][primaryKey] = insertId--;
        }
      } else {
        for (const entry of instances) entry[primaryKey] = insertId++;
      }
    }

    for (const entry of instances) entry.syncRaw();
    return instances;
  }

  /**
   * Update any record that matches `conditions`.
   * @example
   * Post.update({ title: 'Leah' }, { title: 'Diablo III' })
   * @param {Object} conditions
   * @param {Object} values
   * @return {Spell}
   */
  static update(conditions, values = {}, options = {}) {
    const { attributes } = this;

    // values should be immutable
    const data = Object.assign({}, values);
    const { updatedAt, deletedAt } = this.timestamps;
    if (attributes[updatedAt] && !data[updatedAt] && !data[deletedAt] && !options.silent) {
      data[updatedAt] = new Date();
    }

    if (!options || options.validate !== false) {
      // validate, values may change, deep clone it
      const validateData = copyValues(values);
      const instance = new this(validateData);
      instance._validateAttributes(validateData);
    }
    let spell = new Spell(this, options).$where(conditions).$update(data);
    if (options && options.paranoid === false) spell = spell.unparanoid;
    return spell.later(result => {
      return result.affectedRows;
    });
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
   * @return {Spell}
   */
  static remove(conditions, forceDelete = false, options) {
    return this._remove(conditions, forceDelete, options);
  }

  /**
   * private method for internal calling
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
   * @return {Spell}
   */
  static _remove(conditions, forceDelete = false, options) {
    const { deletedAt } = this.timestamps;
    if (forceDelete !== true && this.attributes[deletedAt]) {
      return Bone.update.call(this, conditions, { [deletedAt]: new Date() }, {
        ...options,
        hooks: false, // should not run hooks again
      });
    }

    const spell = new Spell(this, options).unscoped.$where(conditions).$delete();
    return spell.later(result => {
      return result.affectedRows;
    });
  }

  static query(spell) {
    return this.driver.cast(spell);
  }

  static async transaction(callback) {
    const connection = await this.driver.getConnection();
    const begin = async () => await this.driver.begin({ Model: this, connection });
    const commit = async () => await this.driver.commit({ Model: this, connection });
    const rollback = async () => await this.driver.rollback({ Model: this, connection });

    let result;
    if (callback.constructor.name === 'AsyncFunction') {
      // if callback is an AsyncFunction
      await begin();
      try {
        result = await callback({ connection, commit, rollback });
        await commit();
      } catch (err) {
        await rollback();
        throw err;
      } finally {
        connection.release();
      }
    } else if (callback.constructor.name === 'GeneratorFunction') {
      const gen = callback({ connection, commit, rollback });

      try {
        await begin();
        while (true) {
          const { value: spell, done } = gen.next(result);
          if (spell instanceof Spell) spell.connection = connection;
          result = spell && typeof spell.then === 'function' ? await spell : spell;
          if (done) break;
        }
        await commit();
      } catch (err) {
        await rollback();
        throw err;
      } finally {
        connection.release();
      }
    } else {
      throw new Error('unexpected transaction function, should be GeneratorFunction or AsyncFunction.');
    }
    return result;
  }

  static init(attributes = {}, opts = {}, overrides = {}) {
    const { hooks, paranoid, tableName: table, timestamps } = {
      underscored: true,
      timestamps: true,
      tableName: this.table,
      hooks: {},
      ...(this.options && this.options.define),
      ...opts,
    };

    if (timestamps) {
      const names = [ 'createdAt', 'updatedAt' ];
      if (paranoid) names.push('deletedAt');
      for (const name of names) {
        if (!attributes[name] && !attributes[snakeCase(name)]) {
          attributes[name] = DataTypes.DATE;
        }
      }
    }

    const customDescriptors = Object.getOwnPropertyDescriptors(overrides);
    Object.defineProperties(this.prototype, customDescriptors);

    const hookMethods = hookNames.reduce(function(result, key) {
      const method = hooks[key];
      if (typeof method === 'function') result[key] = method;
      return result;
    }, {});

    this[columnAttributesKey] = null;
    this[tableKey] = table;
    Object.defineProperties(this, looseReadonly({ ...hookMethods, attributes }));
  }

  static async sync({ force = false, alter = false } = {}) {
    const { driver, physicTable: table } = this;
    const { database } = this.options;

    // a model that is not connected before
    if (!this.hasOwnProperty(synchronizedKey)) {
      const schemaInfo = await driver.querySchemaInfo(database, [ table ]);
      this.load(schemaInfo[table]);
    }

    if (this.synchronized) return;

    if (this.physicTables) {
      throw new Error('unable to sync model with custom physic tables');
    }

    const { columnAttributes: attributes, columns } = this;
    const columnMap = columns.reduce((result, entry) => {
      result[entry.columnName] = entry;
      return result;
    }, {});

    if (columns.length === 0) {
      await driver.createTable(table, attributes);
    } else {
      if (force) {
        await driver.dropTable(table);
        await driver.createTable(table, attributes);
      } else if (alter) {
        await driver.alterTable(table, compare(attributes, columnMap));
      } else {
        console.warn('[synchronize_fail] %s couldn\'t be synchronized, please use force or alter to specify execution', this.name);
      }
    }

    const schemaInfo = await driver.querySchemaInfo(database, table);
    this.load(schemaInfo[table]);
  }

  static async describe() {
    const { driver, physicTable: table } = this;
    return await driver.describeTable(table);
  }

  static async drop() {
    return await this.driver.dropTable(this.table);
  }

  static async truncate(options = {}) {
    return await this.driver.truncateTable(this.table, options);
  }
}

const Spell_methods = [
  'select', 'join', 'where', 'group', 'order', 'get', 'count', 'average', 'minimum', 'maximum', 'sum', 'from',
];
for (const method of Spell_methods) {
  Object.defineProperty(Bone, method, {
    configurable: true,
    writable: true,
    value(...args) {
      return this._find()[`$${method}`](...args);
    },
  });
}

const Spell_getters = [ 'first', 'last', 'unscoped' ];
for (const getter of Spell_getters) {
  Object.defineProperty(Bone, getter, {
    configurable: true,
    get() {
      return this._find()[getter];
    },
  });
}

Reflect.defineMetadata(IS_LEORIC_BONE, true, Bone);

module.exports = Bone;
