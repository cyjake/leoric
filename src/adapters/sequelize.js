'use strict';

const { setupSingleHook } = require('../setup_hooks');
const { compose, isPlainObject } = require('../utils');

function translateOptions(spell, options) {
  const { attributes, where, group, order, offset, limit, include, having } = options;

  if (attributes) spell.$select(attributes);
  if (include) {
    if (typeof include === 'string') spell.$with(include);
  }
  if (where) spell.$where(where);
  if (group) {
    if (Array.isArray(group)) spell.$group(...group);
    else spell.$group(group);
  }
  if (having) spell.$having(having);

  if (order) {
    if (typeof order === 'string') {
      spell.$order(order);
    } else if (Array.isArray(order) && order.length) {
      if (order.some(item => Array.isArray(item))) {
        // [['created_at', 'asc'], ['id', 'desc']]
        for (const pair of order) {
          if (pair[0]) spell.$order(pair[0], pair[1] || '');
        }
      } else if (order.some((item) => /^(.+?)\s+(asc|desc)$/i.test(item))) {
        // ['created_at desc', 'id asc']
        for (const pair of order) {
          if (pair) spell.$order(pair);
        }
      } else if (order.length && order[0]) {
        // ['created_at', 'asc']
        spell.$order(order[0], order[1] || '');
      }
    }
  }
  if (limit) spell.$limit(limit);
  if (offset) spell.$offset(offset);
}

const setScopeToSpell = (scope) => (spell) => {
  if (scope.where) {
    spell.$where(scope.where);
  }
  if (scope.order) {
    spell.$order(scope.order);
  }
  if (scope.limit) {
    spell.$limit(scope.limit);
  }
};

/**
 * @param {{
 *  where: Object,
 *  limit: Integer,
 *  order: String | Array,
 * }} scopes
 * @returns {Object}
 */
function mergeScope(scopes) {
  let merged = {};
  for (const scope of scopes) {
    if (scope.where) {
      merged.where = Object.assign({}, merged.where, scope.where);
    }
    if (scope.order) {
      merged.order = Object.assign({}, merged.order, scope.order);
    }
    if (scope.limit) {
      merged.limit = scope.limit;
    }
  }
  return merged;
};

/**
 * parse scope
 * @param {Object | Function | Array<Object> } scope
 * @returns {Function} scope
 */
function parseScope(scope) {
  if (!scope) return null;
  if (isPlainObject(scope)) {
    return setScopeToSpell(scope);
  }
  // scope function
  if (typeof scope === 'function') {
    scope.__isFunc = true;
    return scope;
  }
  if (Array.isArray(scope)) {
    // array should not contain function
    return setScopeToSpell(mergeScope(scope));
  }
  return scope;
}

/**
 * filter query options
 * @param {Object} [options={}]
 * @returns
 */
function filterOptions(options = {}) {
  const { order, where, limit, group, offset, include, attributes, ...otherOption }  = options;
  return otherOption;
}

// https://sequelize.org/master/class/lib/model.js~Model.html
// https://sequelize.org/master/manual/model-querying-finders.html
module.exports = Bone => {
  return class Spine extends Bone {

    /*
     * @protect
     * store all configured scopes
     */
    static _scopes = {}
    // scope
    static _scope = null;

    static get sequelize() {
      return true;
    }

    static get Instance() {
      return this;
    }

    static get rawAttributes() {
      return this.attributes;
    }

    /**
     * add scope see https://sequelize.org/master/class/lib/model.js~Model.html#static-method-addScope
     *
     * @static
     * @param {string} name
     * @param {Object|Function} scope
     * @param {
     *  override: boolean
     * } options
     * @returns
     */
    static addScope(name, scope, options = {}) {
      if (!scope) return;
      const { override } = options;
      if (override || !this._scopes[name]) {
        this._scopes[name] = parseScope(scope);
      }
    }

    static scope(name, ...args) {
      const parentName = this.name;
      class ScopeClass extends this {
        static name = parentName;
      };
      ScopeClass.setScope(name, ...args);
      return ScopeClass;
    }

    static unscoped() {
      return this.scope();
    }

    /**
     * @static
     * @param {function|object|array} name
     */
    static setScope(name, ...args) {
      if (name && this._scopes[name]) {
        if (this._scopes[name].__isFunc) {
          this._scope = parseScope(this._scopes[name].call(this, ...args));
        } else {
          this._scope = this._scopes[name];
        }
      } else {
        const scope = parseScope(name);
        if (scope && scope.__isFunc) this._scope = parseScope(scope.call(this, ...args));
        else this._scope = scope;
      }
    }

    static init(attributes, opts = {}, descriptors = {}) {
      super.init(attributes, opts, descriptors);

      // sequelize opts.getterMethods | setterMethods
      const { getterMethods = {}, setterMethods = {}, defaultScope, scopes } = opts;
      const setProp = (obj, type) =>(result) => {
        Object.keys(obj).map(key => {
          if (!result[key]) {
            result[key] = {
              enumerable: true,
              configurable: true,
            };
          }
          result[key][type] = obj[key];
        });
        return result;
      };
      const overrides = compose(setProp(setterMethods, 'set'), setProp(getterMethods, 'get'))({});
      Object.defineProperties(this.prototype, overrides);

      if (defaultScope) {
        this.addScope('defaultScope', defaultScope);
        this.setScope('defaultScope');
      }
      if (scopes) {
        for (const key in scopes) {
          this.addScope(key, scopes[key]);
        }
      }
    }

    static aggregate(name, func, options = {}) {
      Object.assign({ plain: true }, options);
      func = func.toLowerCase();

      if (![ 'count', 'average', 'minimum', 'maximum', 'sum' ].includes(func)) {
        throw new Error(`unknown aggregator function ${func}`);
      }

      const { where } = options;
      let spell = this._find(where, options)[`$${func}`](name);
      if (options.paranoid === false) return spell.unparanoid;
      return spell;
    }

    // static belongsTo() {
    //   throw new Error('unimplemented');
    // }

    static belongsToMany() {
      throw new Error('unimplemented');
    }

    static build(values, options = {}) {
      const { raw } = Object.assign({ raw: false, isNewRecord: true }, options);
      const { attributes } = this;

      let instance;
      if (raw) {
        //  ignore field and custom setters
        instance = new this(null, options);
        for (const name in attributes) {
          if (values.hasOwnProperty(name)) {
            instance.setDataValue(name, values[name]);
          }
        }
      } else {
        instance = new this(values, options);
      }

      return instance;
    }

    /**
     * see https://github.com/sequelize/sequelize/blob/a729c4df41fa3a58fbecaf879265d2fb73d80e5f/src/model.js#L2299
     * @param {Array<Object>} valueSets 
     * @param {Object} options 
     * @returns 
     */
    static bulkBuild(valueSets, options = {}) {
      if (!valueSets.length) return [];
      return valueSets.map(value => this.build(value, options));
    }

    // EXISTS
    // static bulkCreate() {}

    static async count(options = {}) {
      const { where, col, group, paranoid } = options;
      let spell = super.find(where, filterOptions(options));
      if (Array.isArray(group)) spell.$group(...group);
      if (paranoid === false) spell = spell.unparanoid;
      return await spell.$count(col);
    }

    // EXISTS
    // static async create(props) {}

    static decrement(fields, options) {
      const { where, paranoid } = options;
      const spell = super.update(where, {}, options);

      if (Array.isArray(fields)) {
        for (const field of fields) spell.$decrement(field);
      } else if (fields != null && typeof fields === 'object') {
        for (const field in fields) spell.$decrement(field, fields[field]);
      } else if (typeof fields === 'string') {
        spell.$decrement(fields);
      } else {
        throw new Error(`Unexpected fields: ${fields}`);
      }
      if (paranoid === false) return spell.unparanoid;
      return spell;
    }

    // EXISTS
    // static async describe() {}

    static async destroy(options = {}) {
      const { where, individualHooks, paranoid } = options;
      if (individualHooks) {
        let findSpell = this._find(where, filterOptions(options));
        if (paranoid === false) findSpell = findSpell.unparanoid;
        const instances = await findSpell;
        if (instances.length) {
          return await Promise.all(instances.map((instance) => instance.destroy(options)));
        }
      } else {
        return await this.bulkDestroy(options);
      }
    }

    // proxy to class.destroy({ individualHooks=false }) see https://github.com/sequelize/sequelize/blob/4063c2ab627ad57919d5b45cc7755f077a69fa5e/lib/model.js#L2895  before(after)BulkDestroy
    static async bulkDestroy(options = {}) {
      const { where, force } = options;
      return await this.remove(where || {}, force, { ...options });
    }

    // EXISTS
    // static drop() {}

    static findAll(options = {}) {
      let spell = this._find({}, filterOptions(options));
      translateOptions(spell, options);
      if (options.paranoid === false) return spell.unparanoid;
      return spell;
    }

    static find(options = {}) {
      return this.findOne(options);
    }

    static async findAndCountAll(options = {}) {
      let spell = this._find({}, filterOptions(options));
      translateOptions(spell, options);
      let spellCount = this._find({}, filterOptions(options));
      delete options.attributes;
      translateOptions(spellCount, options);
      delete spellCount.rowCount;
      delete spellCount.skip;
      if (options.paranoid === false) {
        spell = spell.unparanoid;
        spellCount = spellCount.unparanoid;
      }
      const [ rows, count ] = await Promise.all([ spell, spellCount.count() ]);
      return { rows, count };
    }

    static findByPk(value, options = {}) {
      let spell = super.findOne({ [this.primaryKey]: value }, options);
      translateOptions(spell, options);
      if (options.paranoid === false) spell = spell.unparanoid;
      return spell;
    }

    static async findCreateFind(options = {}) {
      const { where, defaults } = options;
      let instance = await this.findOne(options);

      if (!instance) {
        try {
          instance = await this.create({ ...defaults, ...where }, options);
        } catch (err) {
          instance = await this.findOne(options);
        }
      }

      return instance;
    }

    static findOne(options) {
      // findOne(null)
      if (arguments.length > 0 && options == null) return null;

      let spell;
      // findOne(id)
      if (typeof options !== 'object') {
        spell = super.findOne(options);
      } else {
        // findOne({ where })
        // findOne()
        // findAll maybe override by developer, that will make it return a non-Spell object
        spell = this._find({}, filterOptions(options));
        translateOptions(spell, { ...options, limit: 1 });
        spell = spell.later(result => result[0] != null? result[0]: null);
      }
      if (options && options.paranoid === false) return spell.unparanoid;
      return spell;
    }

    static async findOrBuild(options = {}) {
      const { where, defaults, validate } = options;
      const instance = await this.findOne(options);
      const result = instance || this.build({ ...defaults, ...where }, { validate });
      return [ result, !instance ];
    }

    static async findOrCreate(options) {
      const [ result, built ] = await this.findOrBuild(options);
      if (built) await result.save();
      return [ result, built ];
    }

    static getTableName() {
      return this.table;
    }

    // BREAKING
    // static hasMany() {}

    // BREAKING
    // static hasOne() {}

    static increment(fields, options = {}) {
      const { where, paranoid } = options;
      // pass options to update
      const spell = super.update(where, undefined, options);

      if (Array.isArray(fields)) {
        for (const field of fields) spell.$increment(field, undefined, options);
      } else if (fields != null && typeof fields === 'object') {
        for (const field in fields) spell.$increment(field, fields[field], options);
      } else if (typeof fields === 'string') {
        spell.$increment(fields, undefined, options);
      } else {
        throw new Error(`Unexpected fields: ${fields}`);
      }
      if (paranoid === false) return spell.unparanoid;
      return spell;
    }

    static async max(attribute, options = {}) {
      let spell = super._find(options.where, filterOptions(options)).$maximum(attribute);
      if (options.paranoid === false) spell = spell.unparanoid;
      return await spell;
    }

    static async min(attribute, options = {}) {
      let spell = super._find(options.where, filterOptions(options)).$minimum(attribute);
      if (options.paranoid === false) spell = spell.unparanoid;
      return await spell;
    }

    static removeAttribute(name) {
      const { attributes, attributeMap } = this;
      const columnInfo = attributes[name];
      delete attributes[name];
      delete attributeMap[columnInfo.columnName];
    }

    static restore(options = {}) {
      return super.restore(options.where || {}, options);
    }

    static schema() {
      throw new Error('unimplemented');
    }

    static async sum(attribute, options = {}) {
      let spell = super.find(options.where, filterOptions(options)).$sum(attribute);
      if (options.paranoid === false) spell = spell.unparanoid;
      return await spell;
    }

    // EXISTS
    // static async sync() {}

    // EXISTS
    // static async truncate() {}

    static async update(values, options = {}) {
      const { where, paranoid, individualHooks } = options;
      if (individualHooks) {
        let findSpell = this._find(where, options);
        translateOptions(findSpell, options);
        if (paranoid === false) findSpell = findSpell.unparanoid;
        const instances = await findSpell;
        if (instances.length) {
          return await Promise.all(instances.map((instance) => instance.update(values, options)));
        }
      } else {
        return this.bulkUpdate(values, options);
      }
    }

    // proxy to class.update({ individualHooks=false }) see https://github.com/sequelize/sequelize/blob/4063c2ab627ad57919d5b45cc7755f077a69fa5e/lib/model.js#L3083  before(after)BulkUpdate
    static bulkUpdate(values, options = {}) {
      const { where, paranoid = false, validate } = options;
      const whereConditions = where || {};
      const spell = super.update(whereConditions, values, { validate, hooks: false, ...options });
      translateOptions(spell, options);
      if (!paranoid) return spell.unparanoid;
      return spell;
    }

    // EXISTS
    // static upsert(values, options)

    // EXISTS
    // get isNewRecord() {}

    async update(values = {}, options = {}) {
      const { fields } = options;
      const changeValues = {};
      const originalValues = Object.assign({}, this.getRaw());
      for (const name in values) {
        if (values[name] !== undefined && this.hasAttribute(name)) {
          // exec custom setters in case it exist
          this[name] = values[name];
          changeValues[name] = this.attribute(name);
        }
      }

      const changedKeys = this.changed();
      if (changedKeys) {
        for (const name of changedKeys) {
          // custom getter should be executed in case there is a custom setter
          if (!(name in changeValues)) changeValues[name] = this[name];
        }
      }

      let changes = {};
      if (fields && fields.length) {
        fields.map(key => {
          if (changeValues[key] !== undefined) changes[key] = changeValues[key];
          else if (values[key] !== undefined) changes[key] = values[key];
          else changes[key] = this.attribute(key);
        });
      } else {
        changes = {
          ...values,
          ...changeValues,
        };
      }
      // instance update don't need to be paranoid
      options.paranoid = false;
      try {
        const res = await super._update(changes, options);
        return res;
      } catch (err) {
        // revert value in case update failed
        this._setRaw(originalValues);
        throw err;
      }
    }

    // EXISTS
    // get isNewRecord() {}

    async decrement(fields, options = {}) {
      const Model = this.constructor;
      const { primaryKey } = Model;
      if (this[primaryKey] == null) {
        throw new Error(`Unset primary key ${primaryKey}`);
      }

      // validate
      if (options.validate !== false) {
        const updateValues = {};
        if (Array.isArray(fields)) {
          for (const field of fields) {
            const value = this[field];
            if (value != null) updateValues[field] = value - 1;
          }
        } else if (fields != null && typeof fields === 'object') {
          for (const field in fields) {
            const value = this[field];
            if (value != null) updateValues[field] = value - Number(fields[field]);
          }
        } else if (typeof fields === 'string') {
          const value = this[fields];
          if (value != null) updateValues[fields] = value - 1;
        } else {
          throw new Error(`Unexpected fields: ${fields}`);
        }
        this._validateAttributes(updateValues);
      }

      return Model.decrement(fields, {
        ...options,
        where: { [primaryKey]: this[primaryKey] },
      });
    }

    /**
     *
     *
     * @param {*} [options={}]
     * @returns
     */
    async destroy(options = {}) {
      const removeResult = await this._remove(options.force, { ...options });
      if (options.force) return removeResult;
      return this;
    }

    equals() {
      throw new Error('unimplemented');
    }

    equalsOneOf() {
      throw new Error('unimplemented');
    }

    get(key) {
      if (key) return this[key];
      return this.toObject();
    }

    getDataValue(key) {
      // unset value should not throw error in sequelize
      return this.getRaw(key);
    }

    get dataValues() {
      return this.getRaw();
    }

    increment(fields, options = {}) {
      const Model = this.constructor;
      const { primaryKey } = Model;
      if (this[primaryKey] == null) {
        throw new Error(`Unset primary key ${primaryKey}`);
      }

      // validate instance only
      if (options.validate !== false) {
        const updateValues = {};
        if (Array.isArray(fields)) {
          for (const field of fields) {
            const value = this[field];
            if (value != null) updateValues[field] = value + 1;
          }
        } else if (fields != null && typeof fields === 'object') {
          for (const field in fields) {
            const value = this[field];
            if (value != null) updateValues[field] = value + Number(fields[field]);
          }
        } else if (typeof fields === 'string') {
          const value = this[fields];
          if (value != null) updateValues[fields] = value + 1;
        } else {
          throw new Error(`Unexpected fields: ${fields}`);
        }
        this._validateAttributes(updateValues);
      }
      return Model.increment(fields, {
        ...options,
        where: { [primaryKey]: this[primaryKey] },
      });
    }

    isSoftDeleted() {
      const { deletedAt } = this.constructor.timestamps;
      return this[deletedAt] != null;
    }

    previous(key) {
      if (key != null) return this.getRawPrevious(key);

      const result = {};
      for (const attrKey of Object.keys(this.constructor.attributes)) {
        const prevValue = this.getRawPrevious(attrKey);
        if (prevValue !== undefined) result[attrKey] = prevValue;
      }
      return result;
    }

    // EXISTS
    // async reload() {}

    // EXISTS
    // restore() {}

    // EXISTS
    // async save() {}

    set(key, value) {
      this[key] = value;
    }

    setDataValue(key, value) {
      if (this.hasAttribute(key)) this.attribute(key, value);
      else this[key] = value;
    }

    // EXISTS
    // async update() {}

    // EXISTS
    // validate() {}

    where() {
      const { primaryKey } = this.constructor;
      return { [primaryKey]: this[primaryKey] };
    }

    /**
     * An alias of instance constructor. Some legacy code access model name from instance with `this.Model.name`.
     */
    get Model() {
      return this.constructor;
    }

    /**
     *
     *
     * @static
     * @param {*} hookName before/after create|destroy|upsert|remove|update
     * @param {*} fnNameOrFun function name or function
     * @param {*} func hook function
     */
    static addHook(hookName, fnNameOrFun, func) {
      if (!hookName || (!fnNameOrFun && !func)) return;
      setupSingleHook(this, hookName, typeof fnNameOrFun === 'function'? fnNameOrFun : func);
    }

    static removeHook() {
      throw new Error('unimplemented');
    }
  };
};
