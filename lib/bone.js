'use strict';

/**
 * The Bone to extend models from. This module consists of helper methods like `capitalize`, and the class {@link Bone}.
 * @module
 */
const deepEqual = require('deep-equal');
const util = require('util');
const pluralize = require('pluralize');

const DataTypes = require('./data_types');
const Collection = require('./collection');
const Spell = require('./spell');
const { walkExpr } = require('./expr');
const { capitalize, camelCase, snakeCase } = require('./utils/string');

/**
 * If Model supports soft delete, and deletedAt isn't specified in whereConditions yet, and the table isn't a subquery, append a default where({ deletedAt: null }).
 */
function scopeDeletedAt(spell) {
  const { table, whereConditions } = spell;

  // from subquery
  if (table.type !== 'id') return;

  // deletedAt already specified
  for (const condition of whereConditions) {
    let found = false;
    walkExpr(condition, ({ type, value }) => {
      if (type == 'id' && value == 'deletedAt') {
        found = true;
      }
    });
    if (found) return;
  }

  spell.$where({ deletedAt: null });
}

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

function compareDefinition(definition, columnInfo) {
  if (!definition || !columnInfo) return false;

  for (const prop of [ 'dataType', 'defaultValue', 'allowNull', 'primaryKey' ]) {
    const def = definition[prop];
    const info = columnInfo[prop];

    if (prop === 'dataType') {
      return def && info && (def === info || (def == 'int' && info == 'integer'));
    }
    return Object.is(def, info);
  }
};

function compare(attributes, columns) {
  const diff = {};
  const columnMap = columns.reduce((result, entry) => {
    result[entry.columnName] = entry;
    return result;
  }, {});

  for (const name in attributes) {
    const definition = attributes[name];
    const { columnName } = definition;

    if (!compareDefinition(definition, columnMap[columnName])) {
      diff[name] = {
        modify: columnMap.hasOwnProperty(columnName),
        ...definition,
      };
    }
  }

  return diff;
}

/**
 * Find the corresponding JavaScript type of the type in database.
 * @param {string} dataType
 */
function findJsType(dataType) {
  switch (dataType.toLowerCase().split('(')[0]) {
    case 'bigint':
    case 'smallint':
    case 'tinyint':
    case 'int':
    case 'integer':
    case 'decimal':
      return Number;
    case 'datetime':
      return Date;
    case 'longtext':
    case 'mediumtext':
    case 'text':
    case 'varchar':
    default:
      return String;
  }
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
 * @property {Object} rawInitial
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
    Object.defineProperties(this, looseReadonly({
      raw: {},
      rawInitial: {},
      rawUnset: new Set(),
    }));

    if (attributes) {
      for (const name in attributes) {
        this.attribute(name, attributes[name]);
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
   * @returns {*}
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
      this.raw[name] = value;
      this.rawUnset.delete(name);
      return this;
    } else {
      if (this.rawUnset.has(name)) throw new Error(`Unset attribute "${name}"`);
      const value = this.raw[name];
      // make sure null is returned if value is undefined
      return value == null ? null : value;
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
    if (this.rawUnset.has(name)) throw new Error(`Unset attribute "${name}"`);
    const value = this.rawInitial[name];
    return value == null ? null : value;
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
    if (this.rawUnset.has(name)) return false;
    const value = this.attribute(name);
    const valueWas = this.attributeWas(name);
    return !(Object.is(value, valueWas) || deepEqual(value, valueWas));
  }

  /**
   * Gets called when `console.log(instance)` is invoked.
   * @example
   * const post = await Post.first
   * post.inspect()  // => 'Post { "id": 1, ... }'
   * @returns {String}
   */
  [util.inspect.custom]() {
    return this.constructor.name + ' ' + util.inspect(this.toJSON());
  }

  /**
   * Gets called when `JSON.stringify(instance)` is invoked.
   * @example
   * const post = await Post.first
   * post.toJSON()  // => { id: 1, ... }
   * @returns {Object}
   */
  toJSON() {
    const obj = {};

    for (const name in this.constructor.attributes) {
      if (!this.rawUnset.has(name) && this[name] != null) {
        obj[name] = this[name];
      }
    }

    for (const name of Object.keys(this)) {
      const value = this[name];
      if (value != null) {
        obj[name] = typeof value.toJSON === 'function' ? value.toJSON() : value;
      }
    }

    return obj;
  }

  /**
   * This is the loyal twin of {@link Bone#toJSON} because when generating the result object, the raw values of attributes are used, instead of the values returned by custom getters (if any).
   * @example
   * const post = await Post.first
   * post.toObject()  // => { id: 1, ... }
   * @returns {Object}
   */
  toObject() {
    const obj = {};

    for (const name in this.constructor.attributes) {
      if (!this.rawUnset.has(name)) obj[name] = this.attribute(name);
    }

    for (const name of Object.keys(this)) {
      const value = this[name];
      obj[name] = value != null && typeof value.toObject == 'function'
        ? value.toObject()
        : value;
    }

    return obj;
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
  async save() {
    const { primaryKey } = this.constructor;
    if (this.rawUnset.has(primaryKey)) throw new Error(`Unset primary key ${primaryKey}`);
    if (this[primaryKey] == null) {
      await this.create();
    } else if (this.attributeChanged(primaryKey)) {
      await this.upsert();
    } else {
      await this.update();
    }
    return this;
  }

  /**
   * Sync changes made in {@link Bone.raw} back to {@link Bone.rawInitial}. Mostly used after the changes are persisted to database, to make {@link Bone.attributeChanged} function properly.
   * @private
   */
  syncRaw() {
    const { attributes } = this.constructor;

    for (const name in attributes) {
      const { jsType } = attributes[name];
      // Take advantage of uncast/cast to create new copy of value
      const value = this.constructor.uncast(this.raw[name], jsType);
      this.rawInitial[name] = this.constructor.cast(value, jsType);
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
    const data = {};
    const Model = this.constructor;
    const { attributes, primaryKey } = Model;

    for (const name in attributes) {
      if (this.attributeChanged(name)) data[name] = this.attribute(name);
    }

    if (Object.keys(data).length === 0) return Promise.resolve(0);

    const { createdAt, updatedAt } = Model.timestamps;

    if (attributes[createdAt] && !this[createdAt]) {
      data[createdAt] = new Date();
    }

    if (attributes[updatedAt] &&
        !(this[updatedAt] && this.attributeChanged('updatedAt'))) {
      data[updatedAt] = new Date();
    }

    if (this[primaryKey]) data[primaryKey] = this[primaryKey];

    // About LAST_INSERT_ID()
    // - http://dev.mysql.com/doc/refman/5.7/en/information-functions.html#function_last-insert-id
    const spell = Model.createSpell(async spell => {
      const result = await Model.query(spell);
      // LAST_INSERT_ID() breaks on TDDL
      if (this[primaryKey] == null) this[primaryKey] = result.insertId;
      this.syncRaw();
      return result.affectedRows;
    });

    return spell.$upsert(data);
  }

  /**
   * Persist changes on current instance back to database with `UPDATE`.
   * @private
   * @returns {number}
   */
  update(opts) {
    const changes = opts != null && typeof opts === 'object' ? opts : {};
    const Model = this.constructor;
    const { attributes, primaryKey, shardingKey } = Model;

    if (opts == null) {
      for (const name in attributes) {
        if (this.attributeChanged(name)) {
          changes[name] = this.attribute(name);
        }
      }
    }

    if (Object.keys(changes).length === 0) return Promise.resolve(0);
    if (this[primaryKey] == null) {
      throw new Error(`Unable to UPDATE due to unset primary key ${primaryKey}`);
    }

    const where = { [primaryKey]: this[primaryKey] };
    if (shardingKey) where[shardingKey] = this[shardingKey];

    return Bone.update.call(Model, where, changes).then(count => {
      if (count === 1) this.syncRaw();
      return count;
    });
  }

  /**
   * Insert current instance into database. Unlike {@link Bone#upsert}, this method use `INSERT` no matter primary key presents or not.
   * @private
   * @returns {Bone}
   */
  create() {
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
      if (value != null) data[name] = value;
    }

    const spell = Model.createSpell(async spell => {
      const result = await Model.query(spell);
      this[primaryKey] = result.insertId;
      this.syncRaw();
      return this;
    });

    return spell.$insert(data);
  }

  async reload() {
    const { primaryKey } = this.constructor;
    const instance = await this.constructor.findOne(this[primaryKey]);
    if (instance) {
      Object.assign(this.raw, instance.raw);
      Object.assign(this.rawInitial, instance.rawInitial);
    }
  }

  /**
   * Delete current instance. If `deletedAt` attribute exists, calling {@link Bone#remove} does not actually delete the record from the database. Instead, it updates the value of `deletedAt` attribute to current date. This is called [soft delete](../querying#scopes). To force a regular `DELETE`, use `.remove(true)`.
   * @param {boolean} forceDelete
   * @example
   * const post = await Post.first
   * post.remove()      // update the `deletedAt`
   * post.remove(true)  // delete record
   */
  async remove(forceDelete) {
    const Model = this.constructor;
    const { primaryKey, shardingKey } = Model;

    if (this[primaryKey] == null) {
      throw new Error('The instance is not persisted yet.');
    }

    const condition = { [primaryKey]: this[primaryKey] };
    if (shardingKey) condition[shardingKey] = this[shardingKey];

    return await Model.remove(condition, forceDelete);
  }

  async restore() {
    const Model = this.constructor;
    const { primaryKey, shardingKey } = Model;

    if (this[primaryKey] == null) {
      throw new Error('The instance is not persisted yet.');
    }

    const conditions = {
      [primaryKey]: this[primaryKey],
      deletedAt: { $ne: null },
    };
    if (shardingKey) conditions[shardingKey] = this[shardingKey];

    return await Bone.update.call(Model, conditions, { deletedAt: null });
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

  /**
   * Generate attributes from column definitions.
   * @private
   * @param {Object[]} columns - `information_schema.columns` of certain table
   */
  static load(columns = []) {
    const { attributes } = this;
    const attributeMap = Object.keys(attributes).reduce((result, name) => {
      const definition = attributes[name];
      result[definition.columnName] = { ...definition, name };
      return result;
    }, {});

    const descriptors = {};
    for (const name in attributes) {
      const descriptor = Object.getOwnPropertyDescriptor(this.prototype, name);
      descriptors[name] = Object.assign({
        get() {
          return this.attribute(name);
        },
        set(value) {
          this.attribute(name, value);
        }
      }, Object.keys(descriptor || {}).reduce((result, key) => {
        if (descriptor[key] != null) result[key] = descriptor[key];
        return result;
      }, {}));
    }

    Object.defineProperties(this.prototype, descriptors);
    Object.defineProperties(this, looseReadonly({
      columns,
      attributeMap,
      synchronized: Object.keys(compare(attributes, columns)).length === 0,
    }));
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
   * Get the column name from the attribute name
   * @private
   * @param   {string} name
   * @returns {string}
   */
  static unalias(name) {
    if (name in this.attributes) {
      return this.attributes[name].columnName;
    } else {
      return name;
    }
  }

  /**
   * Rename attribute. Since Bone manages a separate set of names called attributes instead of using the raw columns, we can rename the attribute names, which is transformed from the column names by convention, to whatever name we fancy.
   * @param {string} originalName
   * @param {string} newName
   */
  static renameAttribute(originalName, newName) {
    const { attributes, attributeMap } = this;

    if (attributes.hasOwnProperty(newName)) {
      throw new Error(`Unable to override existing attribute "${newName}"`);
    }

    if (attributes.hasOwnProperty(originalName)) {
      const info = attributes[originalName];
      attributes[newName] = info;
      attributeMap[info.columnName] = info;
      delete attributes[originalName];

      Object.defineProperty(this.prototype, newName, Object.assign({
        get: function() {
          return this.attribute(newName);
        },
        set: function(value) {
          return this.attribute(newName, value);
        },
        enumerable: true
      }, Object.getOwnPropertyDescriptor(this.prototype, newName)));
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
    if (value == null) return value;

    switch (type) {
      case JSON:
        return value ? JSON.parse(value) : null;
      case Date:
        return value instanceof Date ? value : new Date(value);
      default:
        return value;
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
        return JSON.stringify(value);
      default:
        return value;
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
      foreignKey: this.table + 'Id'
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
      className: capitalize(pluralize(name, 1))
    }, opts, {
      hasMany: true
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
      className: capitalize(name)
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
      throw new Error(this.name + ' has duplicated association at: ' + name);
    }
    const { className } = opts;
    const Model = this.models[className];
    if (!Model) throw new Error(`Unable to find model "${className}"`);

    const { deletedAt } = this.timestamps;
    if (Model.attributes[deletedAt] && !opts.where) {
      opts.where = { [deletedAt]: null };
    }
    this.associations[name] = { ...opts, Model };
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
    if (Object.keys(spell.joins).length == 0) {
      return Collection.from(rows, row => this.instantiate(Object.values(row)[0]));
    }

    const results = new Collection();
    const { aliasName, table, primaryColumn, primaryKey } = this;

    for (const row of rows) {
      // If SQL contains subqueries, such as `SELECT * FROM (SELECT * FROM foo) AS bar`,
      // the table name of the columns in SQLite is the original table name instead of the alias.
      // Hence we need to fallback to original table name here.
      const main = row[aliasName] || row[table];
      let current = results.find(result => result[primaryKey] == main[primaryColumn]);

      if (!current) {
        current = this.instantiate(main);
        results.push(current);
      }

      for (const qualifier in spell.joins) {
        const { Model, hasMany } = spell.joins[qualifier];
        // mysql2 nests rows with table name instead of table alias.
        const values = row[qualifier] || row[Model.table];
        const id = values[Model.primaryColumn];
        if (hasMany) {
          if (!current[qualifier]) current[qualifier] = new Collection();
          if (!id || current[qualifier].some(item => item[Model.primaryKey] == id)) continue;
          current[qualifier].push(Model.instantiate(values));
        } else {
          current[qualifier] = Object.values(values).some(value => value != null)
            ? Model.instantiate(values)
            : null;
        }
      }
    }

    return results;
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
    const results = [];
    const { joins } = spell;
    const { table, aliasName } = spell.Model;

    // await Post.count()
    if (rows.length === 1 && spell.columns.length === 1) {
      const { type, value, args } = spell.columns[0];
      if (type === 'alias' && args && args[0].type === 'func') {
        const row = rows[0];
        return row && row[''] && row[''][value];
      }
    }

    for (const row of rows) {
      const result = { '': {} };
      for (let prop in row) {
        const data = row[prop];
        // mysql2 sometimes nests rows with table name instead of table alias
        const qualifier = prop == table ? aliasName : prop;
        const obj = result[qualifier] || (result[qualifier] = {});
        if (qualifier == '') {
          Object.assign(obj, data);
        }
        else if (qualifier in joins || qualifier == aliasName) {
          const { Model } = joins[qualifier] || spell;
          for (const columnName in data) {
            const definition = Model.attributeMap[columnName];
            if (definition) {
              obj[definition.name] = data[columnName];
            } else {
              result[''][columnName] = data[columnName];
            }
          }
        }
        else {
          throw new Error(`Unknown qualifier ${qualifier}`);
        }
      }
      results.push(result);
    }

    if (Object.keys(joins).length > 0) return results;
    return results.map(result => {
      const merged = {};
      for (const obj of Object.values(result)) Object.assign(merged, obj);
      return merged;
    });
  }

  /**
   * Instantiate model from raw data packet returned by driver.
   * @private
   * @param {Object} row
   * @returns {Bone}
   */
  static instantiate(row) {
    const instance = new this();
    const { raw, rawInitial, rawUnset } = instance;

    for (const name in this.attributes) {
      const { columnName, jsType } = this.attributes[name];
      if (columnName in row) {
        // to make sure raw and rawInitial hold two different objects
        raw[name] = this.cast(row[columnName], jsType);
        rawInitial[name] = this.cast(row[columnName], jsType);
      } else {
        rawUnset.add(name);
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
   * @returns {Spell}
   */
  static get all() {
    return this.find();
  }

  /**
   * Start a find query by creating and returning an instance of {@link Spell}. The `conditions` and `values` are handed over to {@link spell#$where}.
   * @param {string|Object} conditions
   * @param {...*} values
   * @returns {Spell}
   */
  static find(conditions, ...values) {
    const spell = this.createSpell(async spell => {
      const { rows, fields } = await this.query(spell, values);
      return spell.dispatchable
        ? this.dispatch(spell, rows, fields)
        : this.resultSet(spell, rows, fields);
    });
    const conditionsType = typeof conditions;
    if (Array.isArray(conditions) || conditionsType == 'number') {
      spell.$where({ id: conditions });
    }
    // find({}, { offset: 1, limit: 1 })
    else if (typeof conditions == 'object' && values.length == 1 && typeof values[0] == 'object') {
      spell.$where(conditions);
      for (const method of ['order', 'limit', 'offset', 'select']) {
        const value = values[0][method];
        if (value != null) spell[`$${method}`](value);
      }
    }
    else if (conditions) {
      spell.$where(conditions, ...values);
    }

    return spell;
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
    return this.find(conditions, ...values).$get(0);
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
    return this.find().$with(...names);
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
    const instance = new this(values);
    return instance.create();
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
      return Promise.resolve(0);
    }

    const spell = this.createSpell(async spell => {
      const result = await this.query(spell, values);
      return result.affectedRows;
    });

    spell.$where(conditions);
    const { updatedAt, deletedAt } = this.timestamps;
    if (this.attributes[updatedAt] &&
        !values[updatedAt] && !values[deletedAt]) {
      values[updatedAt] = new Date();
    }
    spell.$update(values);

    return spell;
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
    const { deletedAt } = this.timestamps;
    if (forceDelete !== true && this.attributes[deletedAt]) {
      return Bone.update.call(this, conditions, { [deletedAt]: new Date() });
    }

    const spell = this.createSpell(async spell => {
      const result = await this.query(spell);
      return result.affectedRows;
    });
    return spell.unscoped.$where(conditions).$delete();
  }

  static createSpell(callback) {
    if (!this.synchronized) {
      throw new Error(`Unable to query model ${this.name} which is out of sync `);
    }
    const spell = new Spell(this, callback);
    const { deletedAt } = this.timestamps;
    if (this.attributes[deletedAt]) {
      spell.scopes.push(scopeDeletedAt);
    }
    return spell;
  }

  static query(spell) {
    const { sql, values } = this.driver.format(spell);
    const query = { sql, nestTables: spell.command === 'select' };
    return this.driver.query(query, values, spell);
  }

  static async transaction(callback) {
    if (callback.constructor.name !== 'GeneratorFunction') {
      throw new Error('unexpected transaction function, should be GeneratorFunction.');
    }
    const connection = await this.driver.getConnection();
    const gen = callback();
    let result;

    try {
      await this.driver.query('BEGIN', [], { connection });
      while (true) {
        const { value: spell, done } = gen.next(result);
        if (done) break;
        if (spell instanceof Spell) spell.connection = connection;
        result = typeof spell.then === 'function' ? await spell : spell;
      }
      await this.driver.query('COMMIT', [], { connection });
    } catch (err) {
      await this.driver.query('ROLLBACK', [], { connection });
      throw err;
    } finally {
      connection.release();
    }
  }

  static init(attributes, opts = {}) {
    opts = {
      underscored: true,
      table: this.table || opts.tableName,
      ...(this.options && this.options.define),
      ...opts,
    };
    const result = {};
    const table = opts.table || snakeCase(pluralize(this.name));
    const aliasName = camelCase(pluralize(this.name || table));
    const { underscored } = opts;

    for (const name in attributes) {
      const opts = attributes[name];
      const definition = typeof opts === 'function' ? { type: opts } : opts;
      const { allowNull, defaultValue, ...others } = {
        columnName: underscored === false ? name : snakeCase(name),
        ...definition,
      };
      const dataType = definition.dataType || definition.type.type;

      result[name] = {
        dataType,
        ...others,
        jsType: findJsType(dataType),
        allowNull: allowNull == null ? true : allowNull,
        defaultValue: defaultValue == null ? null : defaultValue,
      };
    }

    const timestamps = {};
    for (const name of [ 'createdAt', 'updatedAt', 'deletedAt' ]) {
      if (attributes.hasOwnProperty(name)) timestamps[name] = name;
      if (attributes.hasOwnProperty(snakeCase(name))) {
        timestamps[name] = snakeCase(name);
      }
    }

    Object.defineProperties(this, looseReadonly({
      attributes: result,
      table,
      aliasName,
      associations: [],
      timestamps,
    }));
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
      throw new Error('Unable to sync model with custom physic tables');
    }

    const { attributes, columns } = this;

    if (Object.keys(columns).length === 0) {
      await driver.createTable(table, attributes);
    } else {
      await driver.alterTable(table, compare(attributes, columns));
    }

    const schemaInfo = await driver.querySchemaInfo(database, [ table ]);
    this.load(schemaInfo[table]);
  }

  static async drop() {
    return await this.driver.dropTable(this.table);
  }
}

const Spell_methods = [
  'select', 'join', 'where', 'group', 'order', 'get', 'count', 'average', 'minimum', 'maximum', 'sum'
];
for (const method of Spell_methods) {
  Object.defineProperty(Bone, method, {
    configurable: true,
    writable: true,
    value: function(...args) {
      return this.find()[`$${method}`](...args);
    }
  });
}

const Spell_getters = [ 'first', 'last', 'unscoped' ];
for (const getter of Spell_getters) {
  Object.defineProperty(Bone, getter, {
    configurable: true,
    get: function() {
      return this.find()[getter];
    }
  });
}

Object.assign(Bone, { DataTypes });

module.exports = Bone;
