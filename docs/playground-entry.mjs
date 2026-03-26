import 'reflect-metadata';
import Realm from '../src/browser';
import { Bone, DataTypes, Spell, AbstractDriver, Raw, SequelizeBone } from '../src/browser';
import { raw } from '../src/raw';

const driver = new AbstractDriver({});

/**
 * Setup a model class for use in the playground (Leoric mode).
 * No database connection needed — only SQL generation via .toString().
 */
function setupModel(name, attributes) {
  const Model = { [name]: class extends Bone {} }[name];
  Model.driver = driver;
  Model.models = {};
  Model.options = { define: { underscored: true } };
  Model.associations = {};
  Model.init(attributes, { tableName: null, timestamps: true });
  Model.load([]);
  Model.models[name] = Model;
  return Model;
}

/**
 * Setup a model class for use in the playground (Sequelize mode).
 */
function setupSequelizeModel(name, attributes) {
  const Model = { [name]: class extends SequelizeBone {} }[name];
  Model.driver = driver;
  Model.models = {};
  Model.options = { define: { underscored: true } };
  Model.associations = {};
  Model.init(attributes, { tableName: null, timestamps: true });
  Model.load([]);
  Model.models[name] = Model;
  return Model;
}

/**
 * Setup associations between models after all models are created.
 */
function setupAssociations(models) {
  for (const name in models) {
    models[name].models = models;
  }
}

export { Bone, SequelizeBone, DataTypes, Spell, AbstractDriver, Raw, raw, setupModel, setupSequelizeModel, setupAssociations, Realm };
