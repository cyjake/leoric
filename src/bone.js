'use strict';

/**
 * The Bone to extend models from. This module consists of helper methods like `capitalize`, and the class {@link Bone}.
 * @module
 */
const util = require('util');
const pluralize = require('pluralize');
const { executeValidator, LeoricValidateError } = require('./validator');

const DataTypes = require('./data_types');
const Collection = require('./collection');
const Spell = require('./spell');
const { capitalize, camelCase, snakeCase } = require('./utils/string');
const { setupHooks } = require('./setup_hooks');
const { logger } = require('./utils/index');

const LEGACY_TIMESTAMP_MAP = {
  gmtCreate: 'createdAt',
  gmtModified: 'updatedAt',
  gmtDeleted: 'deletedAt',
};

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

function compare(attributes, columns) {
  const diff = {};
  const columnMap = columns.reduce((result, entry) => {
    result[entry.columnName] = entry;
    return result;
  }, {});

  for (const name in attributes) {
    const attribute = attributes[name];
    const { columnName } = attribute;

    if (!attribute.equals(columnMap[columnName])) {
      diff[name] = {
        modify: columnMap.hasOwnProperty(columnName),
        ...attribute,
      };
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
        if (v && (v.__raw || v.__expr || (v instanceof Spell))) continue;
        copyValue[key] = v;
      }
    }
  }
  return copyValue;
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


  /**
   * Get or set attribute value by name. This method is quite similiar to `jQuery.attr()`. If the attribute isn't selected when queried from database, an error will be thrown when accessing it.
   *
   *     const post = Post.select('title').first
   *     post.content   // throw Error('Unset attribute "content"')
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

    if (!attributes.hasOwnProperty(name)) {
      throw new Error(`${this.constructor.name} has no attribute "${name}"`);
    }
    if (args.length > 1) {
      // execute validators
      this.#raw[name] = value;
      this.#rawUnset.delete(name);
      return this;
    }
    if (this.#rawUnset.has(name)) logger.warn(`unset attribute "${name}"`);
    const rawValue = this.#raw[name];
    // make sure null is returned if value is undefined
    return rawValue == null ? null : rawValue;

  }

  /**
   *
   * clone instance
   * @param {Bone} target
   * @memberof Bone
   */
  _clone(target) {
    Object.assign(this.#raw, target.getRaw());
    Object.assign(this.#rawSaved, target.getRawSaved());
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
  _setRaw(key, value) {
    this.#raw[key] = value;
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

    for (const valueKey in changedValues) {
      const attribute = attributes[valueKey];
      if (!attribute) continue;
      const { validate = {}, name, allowNull, defaultValue } = attribute;
      const value = changedValues[valueKey];
      if (value == null && defaultValue == null) {
        if (allowNull === false) throw new LeoricValidateError('notNull', name);
        if ((allowNull === true || allowNull === undefined) && validate.notNull === undefined ) return;
      }
      if (!validate) return;
      for (const key in validate) {
        if (validate.hasOwnProperty(key)) executeValidator(this, key, attribute, value);
      }
    }
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
    for (const valueKey in values) {
      const attribute = attributes[valueKey];
      // If valueKey is not an attribute of the Model, go to the next loop instead of throw 'No Such Attribute' Error,
      // in case it is a custom property of the Model which defined by custom setters/getters.
      if (!attribute) return;
      const { validate = {}, name, allowNull, defaultValue } = attribute;
      const value = values[valueKey];
      if (value == null && defaultValue == null) {
        if (allowNull === false) throw new LeoricValidateError('notNull', name);
        if ((allowNull === true || allowNull === undefined) && validate.notNull === undefined) return;
      }
      if (!validate) return;
      for (const key in validate) {
        if (validate.hasOwnProperty(key)) executeValidator(this, key, attribute, value);
      }
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
    if (this.#rawUnset.has(name)) throw new Error(`unset attribute "${name}"`);
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
    return !util.isDeepStrictEqual(value, valueWas);
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
      if (util.isDeepStrictEqual(value, valueWas)) return {};
      return { [name]: [ valueWas, value ] };
    }
    const result = {};
    for (const attrKey of Object.keys(this.constructor.attributes)) {
      if (this.#rawUnset.has(attrKey) || this.#rawPrevious[attrKey] === undefined) continue;
      const value = this.attribute(attrKey);
      const valueWas = this.#rawPrevious[attrKey] == null ? null : this.#rawPrevious[attrKey];
      if (!util.isDeepStrictEqual(value, valueWas)) result[attrKey] = [ valueWas, value ];
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
      if (util.isDeepStrictEqual(value, valueWas)) return {};
      return { [name]: [ valueWas, value ] };
    }
    const result = {};
    for (const attrKey of Object.keys(this.constructor.attributes)) {
      if (this.#rawUnset.has(attrKey)) continue;
      const value = this.attribute(attrKey);
      const valueWas = this.attributeWas(attrKey);

      if (!util.isDeepStrictEqual(value, valueWas)) {
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
          obj[key] = typeof value.toJSON === 'function' ? value.toJSON() : value;
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
  syncRaw(changes) {
    const { attributes, driver } = this.constructor;
    this.isNewRecord = false;
    for (const name of Object.keys(changes || attributes)) {
      const { jsType } = attributes[name];
      // Take advantage of uncast/cast to create new copy of value
      const value = driver.uncast(this.#raw[name], jsType);
      if (this.#rawSaved[name] !== undefined) {
        this.#rawPrevious[name] = this.#rawSaved[name];
      } else if (!changes && this.#rawPrevious[name] === undefined) {
        // first persisting
        this.#rawPrevious[name] = driver.cast(value, jsType);
      }
      this.#rawSaved[name] = driver.cast(value, jsType);
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

    if (Object.keys(data).length === 0) return Promise.resolve(0);

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
      // LAST_INSERT_ID() breaks on TDDL
      if (this[primaryKey] == null) this[primaryKey] = result.insertId;
      this.syncRaw();
      return result.affectedRows;
    });
  }

  /**
   * Persist changes on current instance back to database with `UPDATE`.
   * @public
   * @param {Object} changes
   * @param {Object?} options
   * @returns {number} affected rows
   * @memberof Bone
   */
  update(changes, options = {}) {
    return this._update(changes, options);
  }

  /**
   * Persist changes on current instance back to database with `UPDATE`.
   * @private
   * @return {number}
   */
  _update(values, options = {}) {
    const changes = {};
    const Model = this.constructor;
    const { attributes, primaryKey, shardingKey } = Model;

    if (values == null) {
      for (const name in attributes) {
        if (this.changed(name)) changes[name] = this.attribute(name);
      }
    } else if (typeof values === 'object') {
      for (const name in values) {
        const originValue = this.attribute(name);
        // exec custom setters in case it exist
        this[name] = values[name];
        changes[name] = this.attribute(name);
        // revert value in case update failed
        this.attribute(name, originValue);
      }
    }

    if (Object.keys(changes).length === 0) return Promise.resolve(0);
    if (this[primaryKey] == null) {
      throw new Error(`unset primary key ${primaryKey}`);
    }

    const where = { [primaryKey]: this[primaryKey] };
    if (shardingKey) where[shardingKey] = this[shardingKey];

    const { updatedAt, deletedAt } = Model.timestamps;
    if (attributes[updatedAt] && !changes[updatedAt] && !changes[deletedAt]) {
      changes[updatedAt] = new Date();
    }
    if (options.validate !== false ) {
      this._validateAttributes(changes);
    }
    const spell = new Spell(Model, options).$where(where).$update(changes);
    return spell.later(result => {
      // sync changes (changes has been formatted by custom setters, use this.attribute(name, value) directly)
      for (const key in changes) {
        this.attribute(key, changes[key]);
      }
      this.syncRaw(changes);
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
      this[updatedAt] = this[createdAt];
    }

    for (const name in attributes) {
      const value = this.attribute(name);
      const { defaultValue } = attributes[name];
      if (value != null) {
        data[name] = value;
      } else if (value === undefined && defaultValue != null) {
        data[name] = defaultValue;
      }
    }

    if (opts.validate !== false) {
      this._validateAttributes();
    }

    const spell = new Spell(Model, opts).$insert(data);
    return spell.later(result => {
      this[primaryKey] = result.insertId;
      this.syncRaw();
      return this;
    });
  }

  async reload() {
    const { primaryKey } = this.constructor;
    const instance = await this.constructor.findOne(this[primaryKey]).unscoped;
    if (instance) {
      this._clone(instance);
    }
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
    return await Model.remove(condition, forceDelete, { hooks: false, ...opts });
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
      deletedAt: { $ne: null },
    };
    if (shardingKey) conditions[shardingKey] = this[shardingKey];
    await this.update({ deletedAt: null }, { ...opts, paranoid: false });
    return this;
  }

  /**
   * restore rows
   * @param {Object} conditions query conditions
   * @param {Object?} opts query options
   * @returns
   */
  static restore(conditions, opts = {}) {
    const { deletedAt } = this.timestamps;
    if (deletedAt == null) {
      throw new Error('Model is not paranoid');
    }
    return Bone.update.call(this, conditions, { deletedAt: null }, { ...opts, paranoid: false });
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
    for (const name in values) {
      if (this.hasAttribute(name)) {
        data[name] = values[name];
      }
    }

    if (Object.keys(data).length === 0) return Promise.resolve(0);

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
   *   static describe() {
   *     Post.attribute('extra', { type: JSON })
   *   }
   * }
   */
  static attribute(name, meta = {}) {
    if (!this.attributes[name]) {
      throw new Error(`${this.name} has no attribute called ${name}`);
    }
    const { type: jsType } = meta;
    Object.assign(this.attributes[name], { jsType });
  }

  static normalize(attributes) {
    for (const name in LEGACY_TIMESTAMP_MAP) {
      const newName = LEGACY_TIMESTAMP_MAP[name];
      if (attributes.hasOwnProperty(name) && !attributes.hasOwnProperty(newName)) {
        attributes[newName] = attributes[name];
        delete attributes[name];
      }
    }

    // if there is no primaryKey added, add it to attributes automatically
    if (Object.values(attributes).every(attribute => !attribute.primaryKey)) {
      attributes[this.primaryKey] = {
        type: new DataTypes.BIGINT(),
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        columnName: snakeCase(this.primaryKey),
      };
    }
  }

  /**
   * Generate attributes from column definitions.
   * @private
   * @param {Object[]} columns - `information_schema.columns` of certain table
   */
  static load(columns = []) {
    const { Attribute } = this.driver;
    const { attributes, options } = this;
    const attributeMap = {};
    const table = this.table || snakeCase(pluralize(this.name));
    const aliasName = camelCase(pluralize(this.name || table));

    this.normalize(attributes);
    for (const name of Object.keys(attributes)) {
      const attribute = new Attribute(name, attributes[name], options.define);
      attributeMap[attribute.columnName] = attribute;
      attributes[name] = attribute;
    }

    const primaryKey = Object.keys(attributes).find(key => attributes[key].primaryKey);
    const timestamps = {};
    for (const name of [ 'createdAt', 'updatedAt', 'deletedAt' ]) {
      if (attributes.hasOwnProperty(name)) timestamps[name] = name;
      if (attributes.hasOwnProperty(snakeCase(name))) {
        timestamps[name] = snakeCase(name);
      }
    }

    const descriptors = {};
    for (const name in attributes) {
      const descriptor = Object.getOwnPropertyDescriptor(this.prototype, name);
      descriptors[name] = Object.assign({
        get() {
          return this.attribute(name);
        },
        set(value) {
          this.attribute(name, value);
        },
      }, Object.keys(descriptor || {}).reduce((result, key) => {
        if (descriptor[key] != null) result[key] = descriptor[key];
        return result;
      }, {}), {
        enumerable: true,
        configurable: true,
      });
    }
    Object.defineProperties(this.prototype, descriptors);

    Object.defineProperties(this, looseReadonly({
      timestamps,
      table,
      primaryKey,
      columns,
      attributeMap,
      associations: [],
      aliasName,
      synchronized: Object.keys(compare(attributes, columns)).length === 0,
    }));
  }

  /**
   * Override this method to setup associations, rename attributes, etc.
   * @deprecated use {@link Bone.didload} instead
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
   * Override this method to setup associations, rename attributes, etc.
   * @deprecated
   * @example
   * class Post extends Bone {
   *   static didLoad() {
   *     this.belongsTo('author', { className: 'User' })
   *     this.renameAttribute('content', 'body')
   *   }
   * }
   */
  static didLoad() {}

  /**
   * The primary key of the model, in camelCase.
   * @type {string}
   */
  static get primaryKey() {
    return 'id';
  }

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

  /**
   * get the connection pool of the driver
   */
  static get pool() {
    return this.driver && this.driver.pool;
  }

  /**
   * Get the column name from the attribute name
   * @private
   * @param   {string} name
   * @return {string}
   */
  static unalias(name) {
    if (name in this.attributes) {
      return this.attributes[name].columnName;
    }
    return name;
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
      Object.defineProperty(this.prototype, newName, Object.assign({
        get() {
          return this.attribute(newName);
        },
        set(value) {
          return this.attribute(newName, value);
        },
        enumerable: true,
        configurable: true,
      }, Object.getOwnPropertyDescriptor(this.prototype, newName)));
    }
  }

  /**
   * Set a `hasOne` association to another model. The model is inferred by `opts.className` or the association `name` by default.
   * @param {string}  name
   * @param {Object} [opts]
   * @param {string} [opts.className]
   * @param {string} [opts.foreignKey]
   */
  static hasOne(name, opts) {
    opts = Object.assign({
      className: capitalize(name),
      foreignKey: this.table + 'Id',
    }, opts);

    if (opts.through) opts.foreignKey = '';

    this.associate(name, opts);
  }

  /**
   * Set a `hasMany` association to another model. The model is inferred by `opts.className` or the association `name` by default.
   * @param {string}  name
   * @param {Object} [opts]
   * @param {string} [opts.className]
   * @param {string} [opts.foreignKey]
   */
  static hasMany(name, opts) {
    opts = Object.assign({
      className: capitalize(pluralize(name, 1)),
    }, opts, {
      hasMany: true,
    });

    if (opts.through) opts.foreignKey = '';

    this.associate(name, opts);
  }

  /**
   * Set a `belongsTo` association to another model. The model is inferred by `opts.className` or the association `name` by default.
   * @param {string}  name
   * @param {Object} [opts]
   * @param {string} [opts.className]
   * @param {string} [opts.foreignKey]
   */
  static belongsTo(name, opts) {
    opts = Object.assign({
      className: capitalize(name),
    }, opts);

    let { className, foreignKey } = opts;
    if (!foreignKey) foreignKey = camelCase(className) + 'Id';

    this.associate(name, Object.assign(opts, { foreignKey, belongsTo: true }));
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
    if (!Model) throw new Error(`unable to find model "${className}"`);

    const { deletedAt } = this.timestamps;
    if (Model.attributes[deletedAt] && !opts.where) {
      opts.where = { [deletedAt]: null };
    }
    this.associations[name] = { ...opts, Model };
  }

  /**
   * Instantiate model from raw data packet returned by driver.
   * @private
   * @param {Object} row
   * @return {Bone}
   */
  static instantiate(row) {
    const { attributes, driver } = this;
    const instance = new this();

    for (const name in attributes) {
      const { columnName, jsType } = attributes[name];
      if (columnName in row) {
        // to make sure raw and rawSaved hold two different objects
        instance._setRaw(name, driver.cast(row[columnName], jsType));
        instance._setRawSaved(name, driver.cast(row[columnName], jsType));
      } else {
        instance._getRawUnset().add(name);
      }
    }

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
    if (opts.validate !== false) {
      instance._validateAttributes(data); // call instance._validateAttributes manually to validate the raw value
    }
    // static create proxy to instance.create
    return instance.create({
      ...opts,
      validate: false, // should not validate again
    });
  }

  static async bulkCreate(records, options = {}) {
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

    // bulk create with instances is possible only if
    // 1) either all of records primary key are set
    // 2) or none of records priamry key is set and primary key is auto incremented
    if (!(autoIncrement && unset || allset)) {
      // validate first
      if (options.validate !== false) {
        records.map(record => {
          if (record instanceof Bone) record._validateAttributes();
          else this._validateAttributes(record);
        });
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
      if (driver.type === 'sqlite') {
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
    if (attributes[updatedAt] && !data[updatedAt] && !data[deletedAt]) {
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
    const { sql, values } = this.driver.format(spell);
    const query = { sql, nestTables: spell.command === 'select' };
    return this.driver.query(query, values, spell);
  }

  static async transaction(callback) {
    const connection = await this.driver.getConnection();
    if (callback.constructor.name === 'AsyncFunction') {
      // if callback is an AsyncFunction
      await this.driver.query('BEGIN', [], { connection, Model: this, command: 'BEGIN'  });
      try {
        await callback({ connection });
        await this.driver.query('COMMIT', [], { connection, Model: this, command: 'COMMIT'  });
      } catch (err) {
        await this.driver.query('ROLLBACK', [], { connection, Model: this, command: 'ROLLBACK' });
        throw err;
      } finally {
        connection.release();
      }
    } else if (callback.constructor.name === 'GeneratorFunction') {
      const gen = callback({ connection });
      let result;

      try {
        await this.driver.query('BEGIN', [], {  connection, Model: this, command: 'BEGIN' });
        while (true) {
          const { value: spell, done } = gen.next(result);
          if (done) break;
          if (spell instanceof Spell) spell.connection = connection;
          result = typeof spell.then === 'function' ? await spell : spell;
        }
        await this.driver.query('COMMIT', [], {  connection, Model: this, command: 'COMMIT' });
      } catch (err) {
        await this.driver.query('ROLLBACK', [], { connection, Model: this, command: 'ROLLBACK' });
        throw err;
      } finally {
        connection.release();
      }
    } else {
      throw new Error('unexpected transaction function, should be GeneratorFunction or AsyncFunction.');
    }
  }

  static init(attributes = {}, opts = {}, overrides = {}) {
    const { hooks, tableName: table } = {
      underscored: true,
      tableName: this.table,
      ...(this.options && this.options.define),
      ...opts,
    };

    const customDescriptors = Object.getOwnPropertyDescriptors(overrides);
    Object.defineProperties(this.prototype, customDescriptors);

    Object.defineProperties(this, looseReadonly({ attributes, table }));
    setupHooks(this, hooks);
  }

  static async sync() {
    const { driver, physicTable: table } = this;
    const { database } = this.options;

    // a model that is not connected before
    if (this.synchronized == null) {
      const schemaInfo = await driver.querySchemaInfo(database, [ table ]);
      this.load(schemaInfo[table]);
    }

    if (this.synchronized) return;

    if (this.physicTables) {
      throw new Error('unable to sync model with custom physic tables');
    }

    const { attributes, columns } = this;

    if (Object.keys(columns).length === 0) {
      await driver.createTable(table, attributes);
    } else {
      await driver.alterTable(table, compare(attributes, columns));
    }

    const schemaInfo = await driver.querySchemaInfo(database, table);
    this.load(schemaInfo[table]);
  }

  static async drop() {
    return await this.driver.dropTable(this.table);
  }

  static async truncate(options = {}) {
    return await this.driver.truncateTable(this.table, options);
  }
}

const Spell_methods = [
  'select', 'join', 'where', 'group', 'order', 'get', 'count', 'average', 'minimum', 'maximum', 'sum',
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

Object.assign(Bone, { DataTypes });

module.exports = Bone;
