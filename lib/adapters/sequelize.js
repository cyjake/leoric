'use strict';

function translateOptions(spell, options) {
  const { attributes, where, order, offset, limit, include } = options;

  if (where) spell.$where(where);
  if (order) {
    if (typeof order === 'string') {
      spell.$order(order);
    } else if (Array.isArray(order)) {
      // [[ 'createdAt', 'desc' ]]
      for (const entry of order) spell.$order(entry[0], entry[1]);
    }
  }
  if (limit) spell.$limit(limit);
  if (offset) spell.$offset(offset);
  if (attributes) spell.$select(attributes);
  if (include) {
    if (typeof include === 'string') spell.$with(include);
  }
}

// https://sequelize.org/master/class/lib/model.js~Model.html
// https://sequelize.org/master/manual/model-querying-finders.html
module.exports = Bone => {
  return class Spine extends Bone {
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
      const { raw } = Object.assign({ raw: false, isNewRecord: true });
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

    static bulkCreate() {
      throw new Error('unimplemented');
    }

    // EXISTS
    // static async count() {}

    // EXISTS
    // static async create(props) {}

    static decrement() {
      throw new Error('unimplemented');
    }

    // static describe() {
    //   throw new Error('unimplemented');
    // }

    static async destroy(options = {}) {
      const { where } = options;
      return await this.remove(where || {});
    }

    // EXISTS
    // static drop() {}

    static async findAll(options = {}) {
      const spell = this.find();
      translateOptions(spell, options);
      return await spell;
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

    static async findOne(options = {}) {
      const rows = await this.findAll({ ...options, limit: 1 });
      return rows[0];
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

    static increment() {
      throw new Error('unimplemented');
    }

    // EXISTS
    // static async max() {}

    // EXISTS
    // static async min() {}

    static removeAttribute(name) {
      const { definition, schema, schemaMap } = this;
      const columnInfo = schema[name];
      delete schema[name];
      delete schemaMap[columnInfo.columnName];
      delete definition[name];
    }

    static async restore(options = {}) {
      await super.update(options.where || {}, { deletedAt: null });
    }

    static schema() {
      throw new Error('unimplemented');
    }

    static scope() {
      throw new Error('unimplemented');
    }

    // EXISTS
    // static async sum() {}

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

    static async update(values, options = {}) {
      const { where } = options;
      const whereConditions = where || {};
      return await super.update(whereConditions, values);
    }

    static async upsert(values, options = {}) {
      const instance = new this(values);
      return await instance.upsert();
    }

    get isNewRecord() {
      throw new Error('unimplemented');
    }

    changed(key) {
      if (key != null) return this.attributeChanged(key);

      const result = [];
      for (const key of Object.keys(this.constructor.attributes)) {
        if (this.attributeChanged(key)) result.push(key);
      }
      return result.length > 0 ? result : false;
    }

    descrement() {
      throw new Error('unimplemented');
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

    increment() {
      throw new Error('unimplemented');
    }

    isSoftDeleted() {
      const { deletedAt } = this.constructor.timestamps;
      return this[deletedAt] != null;
    }

    previous(key) {
      if (key != null) return this.attributeWas(key);

      const result = {};
      for (const key of Object.keys(this.attributes)) {
        result[key] = this.attributeWas(key);
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
  };
};
