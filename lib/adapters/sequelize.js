'use strict';

const { compose } = require('../utils');

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
    static addScope(name, scope) {
      throw new Error('unimplemented');
    }

    static init(attributes, opts = {}, descriptors = {}) {
      super.init(attributes, opts, descriptors);

      // sequelize opts.getterMethods | setterMethods
      const { getterMethods = {}, setterMethods = {} } = opts;
      const setProp = (obj, type) =>(result) => {
        Object.keys(obj).map(key => {
          if (!result[key]) {
            result[key] = {
              enumerable: false,
              configurable: true,
            };
          }
          result[key][type] = obj[key];
        });
        return result;
      };
      const overrides = compose(setProp(setterMethods, 'set'), setProp(getterMethods, 'get'))({});
      Object.defineProperties(this.prototype, overrides);
    }

    static aggregate(name, func, options = {}) {
      Object.assign({ plain: true }, options);
      func = func.toLowerCase();

      if (![ 'count', 'average', 'minimum', 'maximum', 'sum' ].includes(func)) {
        throw new Error(`unknown aggregator function ${func}`);
      }

      const { where } = options;
      let spell = this.find(where)[`$${func}`](name);
      if (options.paranoid === false) return spell.unscoped;
      return spell;
    }

    // static belongsTo() {
    //   throw new Error('unimplemented');
    // }

    static belongsToMany() {
      throw new Error('unimplemented');
    }

    static build(values, options = {}) {
      if (options.validate !== false) {
        this._validateAttributes(values);
      }
      const { raw } = Object.assign({ raw: false, isNewRecord: true }, options);
      const { attributes } = this;

      let instance;
      if (raw) {
        instance = new this();
        for (const name in attributes) {
          if (values.hasOwnProperty(name)) {
            instance.setDataValue(name, values[name]);
          }
        }
      } else {
        instance = new this(values);
      }
      return instance;
    }

    // EXISTS
    // static bulkCreate() {}

    static async count(options = {}) {
      const { where, col, group, paranoid } = options;
      let spell = super.find(where);
      if (Array.isArray(group)) spell.$group(...group);
      if (paranoid === false) spell = spell.unscoped;
      return await spell.$count(col);
    }

    // EXISTS
    // static async create(props) {}

    static decrement(fields, options) {
      const { where, paranoid } = options;
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
      if (paranoid === false) return spell.unscoped;
      return spell;
    }

    // static describe() {
    //   throw new Error('unimplemented');
    // }

    static async destroy(options = {}) {
      const { where, force } = options;
      return await this.remove(where || {}, force);
    }

    // EXISTS
    // static drop() {}

    static findAll(options = {}) {
      let spell = this.find();
      translateOptions(spell, options);
      if (options.paranoid === false) return spell.unscoped;
      return spell;
    }

    static async findAndCountAll(options = {}) {
      let spell = this.find();
      translateOptions(spell, options);
      if (options.paranoid === false) spell = spell.unscoped;
      const [ rows, count ] = await Promise.all([ spell, spell.count() ]);
      return { rows, count };
    }

    static async findByPk(value, options = {}) {
      let spell = super.findOne({ [this.primaryKey]: value });
      if (options.paranoid === false) spell = spell.unscoped;
      return await spell;
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

      let spell;
      // findOne(id)
      if (typeof options !== 'object') {
        spell = super.findOne(options);
      } else {
        // findOne({ where })
        // findOne()
        spell = this.findAll({ ...options, limit: 1 }).later(result => result[0]);
      }
      if (options && options.paranoid === false) return spell.unscoped;
      return spell;
    }

    static async findOrBuild(options = {}) {
      const { where, defaults, validate } = options;
      const instance = await this.findOne({ where });
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
      if (paranoid === false) return spell.unscoped;
      return spell;
    }

    static async max(attribute, options = {}) {
      let spell = super.find(options.where).$maximum(attribute);
      if (options.paranoid === false) spell = spell.unscoped;
      return await spell;
    }

    static async min(attribute, options = {}) {
      let spell = super.find(options.where).$minimum(attribute);
      if (options.paranoid === false) spell = spell.unscoped;
      return await spell;
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
      let spell = super.find(options.where).$sum(attribute);
      if (options.paranoid === false) spell = spell.unscoped;
      return await spell;
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
      const { where, paranoid = false, validate } = options;
      const whereConditions = where || {};
      const spell = super.update(whereConditions, values, { validate });
      if (!paranoid) return spell.unscoped;
      return spell;
    }

    static upsert(values, options = {}) {
      const instance = new this(values);
      return instance.upsert(options);
    }
    // EXISTS
    // get isNewRecord() {}

    async update(values = {}, options = {}) {
      const { fields } = options;
      const changeValues = {};
      const { attributes } = this.constructor;
      for (const name in attributes) {
        if (this.attributeChanged(name)) {
           // custom getter should be executed in case there is a custom setter
          changeValues[name] = this[name];
        }
      }
      let changes = {};
      if (fields && fields.length) {
        fields.map(key => changes[key] = values[key] || changeValues[key] || this.attribute(key));
      } else {
        changes = {
          ...changeValues,
          ...values,
        };
      }
      const spell = super.update(changes, options);
      // instance update don't need to be paranoid
      return spell.unscoped;
    }

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

    async destroy(options = {}) {
      return await this.remove(options.force);
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
      if (key != null) return this.rawPrevious[key];

      const result = {};
      for (const attrKey of Object.keys(this.constructor.attributes)) {
        if (this.rawPrevious[attrKey] !== undefined) result[attrKey] = this.rawPrevious[attrKey];
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

    // EXISTS
    // validate() {}

    where() {
      const { primaryKey } = this.constructor;
      return { [primaryKey]: this[primaryKey] };
    }
  };
};
