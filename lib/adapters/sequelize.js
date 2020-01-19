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

    // static async count() {
    //   return await super.count();
    // }

    // static async create(props) {
    //   return await super.create(props);
    // }

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

    // static drop() {
    //   throw new Error('unimplemented');
    // }

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

    static findCreateFind() {
      throw new Error('unimplemented');
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

    // static hasMany() {
    //   throw new Error('unimplemented');
    // }

    // static hasOne() {
    //   throw new Error('unimplemented');
    // }

    static increment() {
      throw new Error('unimplemented');
    }

    // static async max() {
    //   return await super.max();
    // }

    // static async min() {
    //   return await super.min();
    // }

    static removeAttribute(name) {
      const { definition, schema, schemaMap } = this;
      const columnInfo = schema[name];
      delete schema[name];
      delete schemaMap[columnInfo.columnName];
      delete definition[name];
    }

    static restore() {
      throw new Error('unimplemented');
    }

    // static schema() {
    //   throw new Error('unimplemented');
    // }

    static scope() {
      throw new Error('unimplemented');
    }

    // static async sum() {
    //   return await super.sum();
    // }

    // static async sync() {
    //   return await super.sync();
    // }

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

    changed() {
      throw new Error('unimplemented');
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
      return this.attribute(key);
    }

    getDataValue(key) {
      return this.raw[key];
    }

    increment() {
      throw new Error('unimplemented');
    }

    isSoftDeleted() {
      const { deletedAt } = this.constructor.timestamps;
      return this[deletedAt] != null;
    }

    previous() {
      throw new Error('unimplemented');
    }

    reload() {
      throw new Error('unimplemented');
    }

    save() {
      throw new Error('unimplemented');
    }

    set(key, value) {
      this.attribute(key, value);
    }

    setDataValue(key, value) {
      this.raw[key] = value;
    }

    toJSON() {
      return super.toJSON();
    }

    async update() {
      return await super.update();
    }

    validate() {
      throw new Error('unimplemented');
    }

    where() {
      throw new Error('unimplemented');
    }
  };
};
