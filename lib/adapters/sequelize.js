'use strict';

// https://sequelize.org/master/class/lib/model.js~Model.html
module.exports = Bone => {
  return class Model extends Bone {
    static addScope(name, scope) {
      throw new Error('unimplemented');
    }

    static aggregate() {
      throw new Error('unimplemented');
    }

    static belongsTo() {
      throw new Error('unimplemented');
    }

    static belongsToMany() {
      throw new Error('unimplemented');
    }

    static build() {
      throw new Error('unimplemented');
    }

    static bulkCreate() {
      throw new Error('unimplemented');
    }

    static count() {
      throw new Error('unimplemented');
    }

    static create() {
      throw new Error('unimplemented');
    }

    static decrement() {
      throw new Error('unimplemented');
    }

    static describe() {
      throw new Error('unimplemented');
    }

    static drop() {
      throw new Error('unimplemented');
    }

    static findAll() {
      throw new Error('unimplemented');
    }

    static findAndCountAll() {
      throw new Error('unimplemented');
    }

    static findByPk() {
      throw new Error('unimplemented');
    }

    static findCreateFind() {
      throw new Error('unimplemented');
    }

    static findOne() {
        throw new Error('unimplemented');
    }

    static findOrBuild() {
      throw new Error('unimplemented');
    }

    static findOrCreate() {
      throw new Error('unimplemented');
    }

    static getTableName() {
      return this.tableName;
    }

    static hasMany() {
      throw new Error('unimplemented');
    }

    static hasOne() {
      throw new Error('unimplemented');
    }

    static increment() {
      throw new Error('unimplemented');
    }

    static init() {
      throw new Error('unimplemented');
    }

    static max() {
      throw new Error('unimplemented');
    }

    static min() {
      throw new Error('unimplemented');
    }

    static removeAttribute() {
      throw new Error('unimplemented');
    }

    static restore() {
      throw new Error('unimplemented');
    }

    static schema() {
      throw new Error('unimplemented');
    }

    static scope() {
      throw new Error('unimplemented');
    }

    static sum() {
        throw new Error('unimplemented');
    }

    static sync() {
      throw new Error('unimplemented');
    }

    static truncate() {
      throw new Error('unimplemented');
    }

    static unscoped() {
      throw new Error('unimplemented');
    }

    static update() {
      throw new Error('unimplemented');
    }

    static upsert() {
      throw new Error('unimplemented');
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

    destroy() {
      throw new Error('unimplemented');
    }

    equals() {
      throw new Error('unimplemented');
    }

    equalsOneOf() {
      throw new Error('unimplemented');
    }

    get() {
      throw new Error('unimplemented');
    }

    getDataValue() {
      throw new Error('unimplemented');
    }

    increment() {
      throw new Error('unimplemented');
    }

    isSoftDeleted() {
      throw new Error('unimplemented');
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

    set() {
      throw new Error('unimplemented');
    }

    setDataValue() {
      throw new Error('unimplemented');
    }

    toJSON() {
      return super.toJSON();
    }

    update() {
      throw new Error('unimplemented');
    }

    validate() {
      throw new Error('unimplemented');
    }

    where() {
      throw new Error('unimplemented');
    }
  };
};
