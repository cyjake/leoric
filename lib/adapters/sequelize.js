'use strict';

const { setupSingleHook } = require('../setup_hooks');

const util = require('util');

function translateOptions(spell, options) {
  const { attributes, where, group, order, offset, limit, include } = options;

  if (attributes) spell.$select(attributes);
  if (include) {
    if (typeof include === 'string') spell.$with(include);
  }
  if (where) spell.$where(where);
  if (group) spell.$group(group);
  if (order) {
    if (typeof order === 'string') {
      spell.$order(order);
    } else if (Array.isArray(order)) {
      // [[ 'createdAt', 'desc' ]]
      for (const entry of order) {
        if (Array.isArray(entry)) spell.$order(entry[0], entry[1]);
      }
    }
  }
  if (limit) spell.$limit(limit);
  if (offset) spell.$offset(offset);
}

// https://sequelize.org/master/class/lib/model.js~Model.html
// https://sequelize.org/master/manual/model-querying-finders.html
module.exports = Bone => {
  return class Spine extends Bone {
    static get sequelize() {
      return true;
    }

    static addScope(name, scope) {
      throw new Error('unimplemented');
    }

    static aggregate(name, func, options = {}) {
      Object.assign({ plain: true }, options);
      func = func.toLowerCase();

      if (![ 'count', 'average', 'minimum', 'maximum', 'sum' ].includes(func)) {
        throw new Error(`unknown aggregator function ${func}`);
      }

      const { where } = options;
      return this.find(where)[`$${func}`](name);
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
      const instance = new this();

      if (raw) {
        for (const name in attributes) {
          if (values.hasOwnProperty(name)) {
            instance.setDataValue(name, values[name]);
          }
        }
      } else {
        for (const name in attributes) {
          if (values.hasOwnProperty(name)) {
            instance.set(name, values[name]);
          }
        }
      }

      return instance;
    }

    // EXISTS
    // static bulkCreate() {}

    static async count(options = {}) {
      const { where, col, group } = options;
      const spell = super.find(where);
      if (Array.isArray(group)) spell.$group(...group);
      return await spell.$count(col);
    }

    // EXISTS
    // static async create(props) {}

    static decrement(fields, options) {
      const { where } = options;
      const spell = super.update(where);

      if (Array.isArray(fields)) {
        for (const field of fields) spell.$decrement(field);
      } else if (fields != null && typeof fields === 'object') {
        for (const field in fields) spell.$decrement(field, fields[field]);
      } else if (typeof fields === 'string') {
        spell.$decrement(fields);
      } else {
        throw new Error(`Unexpected fields: ${fields}`);
      }

      return spell;
    }

    // static describe() {
    //   throw new Error('unimplemented');
    // }

    static async destroy(options = {}) {
      const { where } = options;
      return await this.remove(where || {}, { hooks: false });
    }

    // EXISTS
    // static drop() {}

    static findAll(options = {}) {
      const spell = this.find();
      translateOptions(spell, options);
      return spell;
    }

    static async findAndCountAll(options) {
      const spell = this.find();
      translateOptions(spell, options);
      const [ rows, count ] = await Promise.all([ spell, spell.count() ]);
      return { rows, count };
    }

    static async findByPk(value) {
      return await super.findOne({ [this.primaryKey]: value });
    }

    static async findCreateFind(options = {}) {
      const { where, defaults } = options;
      let instance = await this.findOne({ where });

      if (!instance) {
        try {
          instance = await this.create({ ...defaults, ...where });
        } catch (err) {
          instance = await this.findOne({ where });
        }
      }

      return instance;
    }

    static findOne(options) {
      // findOne(null)
      if (arguments.length > 0 && options == null) return null;

      // findOne(id)
      if (typeof options !== 'object') return super.findOne(options);

      // findOne({ where })
      // findOne()
      return this.findAll({ ...options, limit: 1 }).later(result => result[0]);
    }

    static async findOrBuild(options = {}) {
      const { where, defaults } = options;
      const instance = await this.findOne({ where });
      const result = instance || this.build({ ...defaults, ...where });
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
      const { where } = options;
      const spell = super.update(where);

      if (Array.isArray(fields)) {
        for (const field of fields) spell.$increment(field);
      } else if (fields != null && typeof fields === 'object') {
        for (const field in fields) spell.$increment(field, fields[field]);
      } else if (typeof fields === 'string') {
        spell.$increment(fields);
      } else {
        throw new Error(`Unexpected fields: ${fields}`);
      }

      return spell;
    }

    static async max(attribute, options = {}) {
      return await super.find(options.where).$maximum(attribute);
    }

    static async min(attribute, options = {}) {
      return await super.find(options.where).$minimum(attribute);
    }

    static removeAttribute(name) {
      const { definition, schema, schemaMap } = this;
      const columnInfo = schema[name];
      delete schema[name];
      delete schemaMap[columnInfo.columnName];
      delete definition[name];
    }

    static restore(options = {}) {
      return super.update(options.where || {}, { deletedAt: null });
    }

    static schema() {
      throw new Error('unimplemented');
    }

    static scope() {
      throw new Error('unimplemented');
    }

    static async sum(attribute, options = {}) {
      return await super.find(options.where).$sum(attribute);
    }

    // EXISTS
    // static async sync() {}

    static truncate() {
      throw new Error('unimplemented');
    }

    static unscoped() {
      const spell = this.find();
      spell.scopes = [];
      return spell;
    }

    static update(values, options = {}) {
      const { where } = options;
      const whereConditions = where || {};
      return super.update(whereConditions, values, { hooks: false });
    }

    static upsert(values, options = {}) {
      const instance = new this(values);
      return instance._upsert();
    }
    // EXISTS
    // get isNewRecord() {}

    changed(key) {
      if (key != null) {
        if (this.rawUnset.has(key)) return false;
        const value = this.attribute(key);
        const valueWas = this.rawPrevious[key];
        return !util.isDeepStrictEqual(value, valueWas);
      }

      const result = [];
      for (const attrKey of Object.keys(this.constructor.attributes)) {
        if (this.rawPrevious[attrKey]) result.push(attrKey);
      }
      return result.length > 0 ? result : false;
    }

    async decrement(fields, options) {
      const Model = this.constructor;
      const { primaryKey } = Model;
      if (this[primaryKey] == null) {
        throw new Error(`Unset primary key ${primaryKey}`);
      }
      return Model.decrement(fields, {
        ...options,
        where: { [primaryKey]: this[primaryKey] },
      });
    }

    async destroy(options = {}, runOpt) {
      return await this.remove(options.force, { ...runOpt, hooks: false });
    }

    equals() {
      throw new Error('unimplemented');
    }

    equalsOneOf() {
      throw new Error('unimplemented');
    }

    get(key) {
      return this[key];
    }

    getDataValue(key) {
      return this.attribute(key);
    }

    increment(fields, options) {
      const Model = this.constructor;
      const { primaryKey } = Model;
      if (this[primaryKey] == null) {
        throw new Error(`Unset primary key ${primaryKey}`);
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
      if (key != null) return this.rawPrevious[key];

      const result = {};
      for (const attrKey of Object.keys(this.attributes)) {
        result[attrKey] = this.rawPrevious[attrKey];
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
      this.attribute(key, value);
    }

    // EXISTS
    // toJSON() {}

    // EXISTS
    // async update() {}

    validate() {
      throw new Error('unimplemented');
    }

    where() {
      const { primaryKey } = this.constructor;
      return { [primaryKey]: this[primaryKey] };
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
