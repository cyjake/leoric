import { HookFunc, setupSingleHook } from '../setup_hooks';
import { compose, isPlainObject } from '../utils';
import Raw from '../raw';
import { AbstractBone, columnAttributesKey, synchronizedKey, tableKey } from '../abstract_bone';
import type Spell from '../spell';
import type { BoneColumns, Collection, Literal, QueryOptions, WhereConditions } from '../types/common';
import util from 'util';
import Attribute from '../drivers/abstract/attribute';

interface SequelizeDestroyOptions extends QueryOptions {
  force?: boolean;
}

interface BaseSequelizeConditions<T extends typeof SequelizeBone & typeof AbstractBone> extends QueryOptions {
  where?: WhereConditions<T>;
  order?: string | Array<any> | Raw | Record<string, 'asc' | 'desc' | 'ASC' | 'DESC'>;
  limit?: number;
  offset?: number;
  include?: string;
  group?: string | string[];
  having?: any;
  attributes?: BoneColumns<T> | string | Raw | Array<BoneColumns<T> | string | Raw>;
}

interface SequelizeUpdateOptions<T extends typeof SequelizeBone & typeof AbstractBone> extends BaseSequelizeConditions<T> {
  individualHooks?: boolean;
  force?: boolean;
  validate?: boolean;
  fields?: BoneColumns<T> | string | Raw | Array<BoneColumns<T> | string | Raw>;
  paranoid?: boolean;
}

interface SequelizeInstanceUpdateOptions<T extends typeof SequelizeBone & typeof AbstractBone> extends QueryOptions {
  attributes?: BoneColumns<T> | string | Raw | Array<BoneColumns<T> | string | Raw>;
  fields?: Array<BoneColumns<T> | string | Raw> | BoneColumns<T>;
}

interface CountSequelizeOptions<T extends typeof SequelizeBone & typeof AbstractBone> extends BaseSequelizeConditions<T> {
  col?: string;
  paranoid?: boolean;
}

interface SequelizeConditions<T extends typeof SequelizeBone & typeof AbstractBone> extends BaseSequelizeConditions<T> {
  paranoid?: boolean;
}

interface FindOrCreateOptions<T extends typeof SequelizeBone & typeof AbstractBone> extends BaseSequelizeConditions<T> {
  defaults?: Record<string, Literal>;
  validate?: boolean;
  paranoid?: boolean;
}

interface FindOrBuildOptions<T extends typeof SequelizeBone & typeof AbstractBone> extends BaseSequelizeConditions<T> {
  defaults?: Record<string, Literal>;
  validate?: boolean;
  paranoid?: boolean;
}

interface DestroyOptions<T extends typeof SequelizeBone & typeof AbstractBone> extends SequelizeConditions<T> {
  force?: boolean;
}

interface ScopeOptions {
  override?: boolean;
}

type aggregators = 'count' | 'average' | 'minimum' | 'maximum' | 'sum';

function translateOptions<T extends typeof SequelizeBone & typeof AbstractBone>(spell: Spell<T>, options: SequelizeConditions<T>) {
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
    if (typeof order === 'string' || order instanceof Raw || isPlainObject(order)) {
      spell.$order(order as any);
    } else if (Array.isArray(order) && order.length) {
      let found = false;
      for (const item of order) {
        if (item instanceof Raw || /^(.+?)\s+(asc|desc)$/i.test(item)) {
          // ['created_at desc', 'id asc']
          // [Raw('FIND_IN_SET(id, '1,2,3')), Raw('FIND_IN_SET(id, '4,5,6'))]
          spell.$order(item);
          found = true;
        } else if (Array.isArray(item) && item.length) {
          // [['created_at', 'asc'], ['id', 'desc']]
          spell.$order(item[0], item[1] || '');
          found = true;
        }
      }
      if (typeof order[0] === 'string' && !found) {
        // ['created_at', 'asc']
        spell.$order(order[0], order[1] || '');
      }
    }
  }
  if (limit) spell.$limit(limit);
  if (offset) spell.$offset(offset);
}

const setScopeToSpell = <T extends typeof SequelizeBone & typeof AbstractBone>(scope: SequelizeConditions<T>) => (spell: Spell<T>) => {
  translateOptions(spell, scope);
};

/**
 * @param scopes
 * @returns merged scope
 */
function mergeScope<T extends typeof SequelizeBone & typeof AbstractBone>(scopes: SequelizeConditions<T>[]): SequelizeConditions<T> {
  const merged: SequelizeConditions<T> = {};
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
}

/**
 * parse scope
 * @param scope
 * @returns scope function
 */
function parseScope<T extends typeof SequelizeBone & typeof AbstractBone>(
  scope: SequelizeConditions<T> | ((...args: any[]) => SequelizeConditions<T>) | Array<SequelizeConditions<T>> | undefined,
) {
  if (!scope) return null;
  if (isPlainObject(scope)) {
    return setScopeToSpell(scope as SequelizeConditions<T>);
  }
  // scope function
  if (typeof scope === 'function') {
    return Object.assign(scope, { __isFunc: true });
  }
  if (Array.isArray(scope)) {
    // array should not contain function
    return setScopeToSpell(mergeScope(scope));
  }
}

/**
 * filter query options
 * @param options
 * @returns filtered options
 */
function filterOptions(options: Record<string, any>): Record<string, any> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { order, where, limit, group, offset, include, attributes, ...otherOption } = options;
  return otherOption;
}

// https://sequelize.org/master/class/lib/model.js~Model.html
// https://sequelize.org/master/manual/model-querying-finders.html
export default function sequelize(Bone: typeof AbstractBone) {

  return class SequelizeBone extends Bone {

    static [columnAttributesKey]: { [key: string]: Attribute } | null;
    static [synchronizedKey]: boolean;
    static [tableKey]: string;

    /*
     * @protect
     * store all configured scopes
     */
    static _scopes: Record<string,
      | SequelizeConditions<typeof SequelizeBone & typeof AbstractBone>
      | ((...args: any[]) => SequelizeConditions<typeof SequelizeBone & typeof AbstractBone>) & { __isFunc?: boolean }
    > = {};
    // scope
    static _scope:
      | SequelizeConditions<typeof SequelizeBone & typeof AbstractBone>
      | ((spell: Spell<typeof SequelizeBone & typeof AbstractBone>) => void)
      | null;

    static get sequelize(): boolean {
      return true;
    }

    static get Instance() {
      return this;
    }

    static get rawAttributes() {
      return this.attributes;
    }

    /**
     * add hook
     * @static
     * @param hookName
     * @param fnNameOrFunc
     * @param func
     */
    static addHook<T extends typeof SequelizeBone & typeof AbstractBone>(this: T, hookName: string, fnNameOrFunc: string | HookFunc, func?: HookFunc): void {
      if (!hookName || (!fnNameOrFunc && !func)) return;
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      setupSingleHook(this, hookName, typeof fnNameOrFunc === 'function' ? fnNameOrFunc : func!);
    }

    /**
     * add scope see https://sequelize.org/master/class/lib/model.js~Model.html#static-method-addScope
     * @deprecated scope is not recommended to use
     * @param name
     * @param scope
     * @param options
     */
    static addScope<T extends typeof SequelizeBone & typeof AbstractBone>(
      this: T,
      name: string,
      scope: ((...args: any[]) => SequelizeConditions<T>) | SequelizeConditions<T>,
      options: ScopeOptions = {},
    ): void {
      if (!scope) return;
      const { override } = options;
      if (override || !this._scopes[name]) {
        this._scopes[name] = parseScope(scope) as SequelizeConditions<T>;
      }
    }

    /**
     * @deprecated scope is not recommended to use
     * @param name
     * @param args
     * @returns
     */
    static scope<T extends typeof SequelizeBone>(
      this: T,
      name?: string | ((...args: any[]) => SequelizeConditions<T>) | SequelizeConditions<T> | Array<SequelizeConditions<T>>,
      ...args: any[]
    ): any {
      const parentName = this.name;
      const parentTable = this.table;
      class ScopeClass extends (this as typeof SequelizeBone) {
        static get synchronized() {
          return super.synchronized;
        }
        static get table() {
          return parentTable;
        }
      }
      Object.defineProperty(ScopeClass, 'name', {
        value: parentName,
        writable: false,
        enumerable: false,
        configurable: true,
      });

      ScopeClass.setScope(name, ...args);
      return ScopeClass;
    }

    static get unscoped() {
      return (this as typeof SequelizeBone & typeof AbstractBone).scope();
    }

    /**
     * @deprecated scope is not recommended to use
     * @static
     * @param name
     */
    static setScope<T extends typeof SequelizeBone & typeof AbstractBone>(
      this: T,
      name?: string | ((...args: any) => SequelizeConditions<T>) | SequelizeConditions<T> | Array<SequelizeConditions<T>>,
      ...args: any[]
    ): void {
      if (typeof name === 'string') {
        const scopeFunc = this._scopes[name] as ((...args: any[]) => SequelizeConditions<T>) & { __isFunc?: boolean };
        if (scopeFunc?.__isFunc) {
          this._scope = parseScope(scopeFunc.call(this, ...args)) as SequelizeConditions<T>;
        } else {
          this._scope = scopeFunc;
        }
      } else {
        const scope = parseScope(name);
        if (scope && '__isFunc' in scope && scope.__isFunc) {
          this._scope = parseScope(scope.call(this, ...args)) as SequelizeConditions<T>;
        } else {
          this._scope = scope;
        }
      }
    }

    static init<T extends typeof SequelizeBone & typeof AbstractBone>(this: T, attributes: any, opts: any = {}, descriptors: any = {}): void {
      super.init(attributes, opts, descriptors);

      // sequelize opts.getterMethods | setterMethods
      const { getterMethods = {}, setterMethods = {}, defaultScope, scopes } = opts;
      const setProp = (obj: Record<string, unknown>, type: 'get' | 'set') => (result: Record<string, PropertyDescriptor>) => {
        Object.keys(obj).map(key => {
          if (!result[key]) {
            result[key] = {
              enumerable: true,
              configurable: true,
            };
          }
          (result[key] as any)[type] = obj[key];
        });
        return result;
      };
      const overrides = (compose as any)(setProp(setterMethods, 'set'), setProp(getterMethods, 'get'))({}) as PropertyDescriptorMap;
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

    static aggregate<T extends typeof SequelizeBone & typeof AbstractBone>(
      name: string,
      func: aggregators | Uppercase<aggregators>,
      options: SequelizeConditions<T> = {},
    ): Spell<T, any> {
      Object.assign({ plain: true }, options);
      const funcLower = func.toLowerCase();

      if (!['count', 'average', 'minimum', 'maximum', 'sum'].includes(funcLower)) {
        throw new Error(`unknown aggregator function ${func}`);
      }

      const { where } = options;
      const spell = super._find(where, options)[`$${funcLower}` as aggregators](name);
      if (options.paranoid === false) return spell.unparanoid;
      return spell;
    }

    static belongsToMany(): void {
      throw new Error('unimplemented');
    }

    static build(values: Record<string, Literal>, options: { raw?: boolean; isNewRecord?: boolean; validate?: boolean } = {}) {
      const { raw } = Object.assign({ raw: false, isNewRecord: true }, options);
      const { attributes } = this;

      let instance;
      if (raw) {
        //  ignore field and custom setters
        instance = new this(null as any, options as any);
        for (const name in attributes) {
          if (values.hasOwnProperty(name)) {
            instance.setDataValue(name, values[name]);
          }
        }
      } else {
        instance = new this(values as any, options as any);
      }

      return instance;
    }

    /**
     * see https://github.com/sequelize/sequelize/blob/a729c4df41fa3a58fbecaf879265d2fb73d80e5f/src/model.js#L2299
     * @param valueSets
     * @param options
     * @returns
     */
    static bulkBuild(valueSets: Record<string, Literal>[], options: { raw?: boolean; isNewRecord?: boolean; validate?: boolean } = {}) {
      if (!valueSets.length) return [];
      return valueSets.map(value => this.build(value, options));
    }

    static count(col?: string): Spell<any>;
    static count<T extends typeof SequelizeBone & typeof AbstractBone>(options: CountSequelizeOptions<T>): Spell<any>;
    static count<T extends typeof SequelizeBone & typeof AbstractBone>(options: string | CountSequelizeOptions<T> = {}): Spell<any> {
      if (typeof options === 'string') return super._find().$count(options);
      const { where, col, group, paranoid } = options;
      let spell = super._find(where, filterOptions(options));
      if (Array.isArray(group)) spell.$group(...group);
      if (paranoid === false) spell = spell.unparanoid;
      return spell.$count(col);
    }

    static decrement<T extends typeof SequelizeBone & typeof AbstractBone>(this: T, fields: string | string[] | Record<string, number>, options: SequelizeUpdateOptions<T> = {}) {
      const { where = {}, paranoid } = options;
      const spell = super._update(where, {}, options);

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

    static async destroy<T extends typeof SequelizeBone & typeof AbstractBone>(this: T, options: DestroyOptions<T> = {}) {
      const { where, individualHooks, paranoid } = options;
      if (individualHooks) {
        let findSpell = super._find(where, filterOptions(options)) as Spell<T, Collection<InstanceType<T>>>;
        if (paranoid === false) findSpell = findSpell.unparanoid;
        const instances = await findSpell;
        if (instances.length) {
          return await Promise.all(instances.map((instance: any) => instance.destroy(options)));
        }
      } else {
        return await this.bulkDestroy(options);
      }
    }

    // proxy to class.destroy({ individualHooks=false }) see https://github.com/sequelize/sequelize/blob/4063c2ab627ad57919d5b45cc7755f077a69fa5e/lib/model.js#L2895  before(after)BulkDestroy
    static bulkDestroy<T extends typeof SequelizeBone & typeof AbstractBone>(this: T, options: DestroyOptions<T> = {}): Spell<T, number> {
      const { where, force } = options;
      const spell = super._remove(where || {}, force, { ...options }) as Spell<T, number>;
      const transOptions = { ...options };
      delete transOptions.where;
      translateOptions(spell, transOptions);
      return spell as Spell<T, number>;
    }

    static findAll<T extends typeof SequelizeBone & typeof AbstractBone>(options: SequelizeConditions<T> = {}) {
      const spell = super._find({}, filterOptions(options)) as Spell<T, Collection<InstanceType<T>>>;
      translateOptions(spell, options);
      if (options.paranoid === false) return spell.unparanoid;
      return spell;
    }

    static find<T extends typeof SequelizeBone & typeof AbstractBone>(): Spell<T, InstanceType<T> | null>;
    static find<T extends typeof SequelizeBone & typeof AbstractBone>(options: SequelizeConditions<T>): Spell<T, InstanceType<T>> | null;
    static find<T extends typeof SequelizeBone & typeof AbstractBone>(...args: any[]): Spell<T, InstanceType<T>> | null {
      return this.findOne(...args);
    }

    static async findAndCountAll<T extends typeof SequelizeBone & typeof AbstractBone>(this: T, options: SequelizeConditions<T> = {}) {
      let spell = super._find({}, filterOptions(options)) as Spell<T, Collection<InstanceType<T>>>;
      translateOptions(spell, options);
      let spellCount = super._find({}, filterOptions(options)) as Spell<T, number>;
      const optionsCopy = { ...options };
      delete optionsCopy.attributes;
      translateOptions(spellCount, optionsCopy);
      delete spellCount.rowCount;
      spellCount.skip = 0;
      if (options.paranoid === false) {
        spell = spell.unparanoid;
        spellCount = spellCount.unparanoid;
      }
      const [rows, count] = await Promise.all([spell, spellCount.count()]);
      return { rows, count };
    }

    static findByPk<T extends typeof SequelizeBone & typeof AbstractBone>(value: Literal, options: SequelizeConditions<T> = {}) {
      let spell = super._find({ [this.primaryKey]: value }, options).$get(0) as Spell<T, InstanceType<T>>;
      translateOptions(spell, options);
      if (options.paranoid === false) spell = spell.unparanoid;
      return spell;
    }

    static async findCreateFind<T extends typeof SequelizeBone & typeof AbstractBone>(options: FindOrCreateOptions<T> = {}): Promise<InstanceType<T> | null> {
      const { where, defaults } = options;
      let instance = await this.findOne(options);

      if (!instance) {
        try {
          instance = await super.create({ ...defaults, ...where }, options) as InstanceType<T>;
        } catch (err) {
          instance = await this.findOne(options);
        }
      }

      return instance;
    }

    static findOne<T extends typeof SequelizeBone & typeof AbstractBone>(options?: SequelizeConditions<T> | null | number | string): Spell<T, InstanceType<T>> | null {
      // findOne(null)
      if (arguments.length > 0 && options == null) return null;

      let spell;
      // findOne(id)
      if (typeof options !== 'object') {
        spell = super._find(options);
      } else {
        // findOne({ where })
        // findOne()
        // findAll maybe override by developer, that will make it return a non-Spell object
        const opts = options || {};
        spell = super._find({}, filterOptions(opts)) as Spell<T, Collection<InstanceType<T>>>;
        translateOptions(spell, { ...opts, limit: 1 });
      }
      spell = spell.$get(0) as Spell<T, InstanceType<T>>;
      if (options && typeof options === 'object' && options.paranoid === false) return spell.unparanoid;
      return spell;
    }

    static async findOrBuild<T extends typeof SequelizeBone & typeof AbstractBone>(options: FindOrBuildOptions<T> = {}): Promise<[any, boolean]> {
      const { where, defaults, validate } = options;
      const instance = await this.findOne(options);
      const result = instance || this.build({ ...defaults, ...where }, { validate });
      return [result, !instance];
    }

    static async findOrCreate<T extends typeof SequelizeBone & typeof AbstractBone>(options: FindOrCreateOptions<T>): Promise<[any, boolean]> {
      const [result, built] = await this.findOrBuild(options);
      if (built) await result.save();
      return [result, built];
    }

    static getTableName(): string {
      return this.table;
    }

    static increment<T extends typeof SequelizeBone & typeof AbstractBone>(this: T, fields: string | string[] | Record<string, number>, options: SequelizeUpdateOptions<T> = {}) {
      const { where = {}, paranoid } = options;
      // pass options to update
      const spell = super._update(where, {}, options);

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

    static async max<T extends typeof SequelizeBone & typeof AbstractBone>(this: T, attribute: string, options: SequelizeConditions<T> = {}) {
      let spell = super._find(options.where, filterOptions(options)).$maximum(attribute);
      if (options.paranoid === false) spell = spell.unparanoid;
      return await spell;
    }

    static async min<T extends typeof SequelizeBone & typeof AbstractBone>(this: T, attribute: string, options: SequelizeConditions<T> = {}) {
      let spell = super._find(options.where, filterOptions(options)).$minimum(attribute);
      if (options.paranoid === false) spell = spell.unparanoid;
      return await spell;
    }

    static removeAttribute(name: string): void {
      const { attributes, attributeMap } = this;
      const columnInfo = attributes[name];
      delete attributes[name];
      delete attributeMap[columnInfo.columnName];
    }

    static restore<T extends typeof SequelizeBone & typeof AbstractBone>(this: T, options: SequelizeConditions<T> = {}) {
      return super._restore(options.where || {}, options);
    }

    static schema(): void {
      throw new Error('unimplemented');
    }

    static async sum<T extends typeof SequelizeBone & typeof AbstractBone>(this: T, attribute: string, options: SequelizeConditions<T> = {}) {
      let spell = super._find(options.where, filterOptions(options)).$sum(attribute);
      if (options.paranoid === false) spell = spell.unparanoid;
      return await spell;
    }

    static async update<T extends typeof SequelizeBone & typeof AbstractBone>(
      this: T,
      values: Record<string, Literal>,
      options: SequelizeUpdateOptions<T> = {},
    ) {
      const { where, paranoid, individualHooks } = options;
      if (individualHooks) {
        let findSpell = super._find(where, options) as Spell<T, Collection<InstanceType<T>>>;
        translateOptions(findSpell, options);
        if (paranoid === false) findSpell = findSpell.unparanoid;
        const instances = await findSpell;
        if (instances.length) {
          return await Promise.all(instances.map(instance => instance.update(values, options as any)));
        }
      } else {
        return this.bulkUpdate(values, options);
      }
    }

    // proxy to class.update({ individualHooks=false })
    // see https://github.com/sequelize/sequelize/blob/4063c2ab627ad57919d5b45cc7755f077a69fa5e/lib/model.js#L3083
    // before(after)BulkUpdate
    static bulkUpdate<T extends typeof SequelizeBone & typeof AbstractBone>(this: T, values: Record<string, Literal>, options: SequelizeUpdateOptions<T> = {}) {
      const { where, paranoid = false, validate } = options;
      const whereConditions = where || {};
      const spell = super._update(whereConditions, values, { validate, hooks: false, ...options }) as Spell<T, number>;
      const transOptions = { ...options };
      delete transOptions.where;
      translateOptions(spell, transOptions);
      if (!paranoid) return spell.unparanoid;
      return spell;
    }

    async update<T extends typeof SequelizeBone & typeof AbstractBone>(
      values: Record<string, Literal> = {},
      options: SequelizeInstanceUpdateOptions<T> = {},
    ) {
      const { fields = [] } = options;
      const changeValues: Record<string, Literal> = {};
      const originalValues = Object.assign({}, this.getRaw());
      for (const name in values) {
        if (values[name] !== undefined && this.hasAttribute(name) && (!fields.length || fields.includes(name))) {
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

      let changes: Record<string, Literal> = {};
      if (fields.length) {
        (fields as string[]).map(key => {
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
        const res = await this._update(changes, options);
        return res;
      } catch (err) {
        // revert value in case update failed
        this._setRaw(originalValues);
        throw err;
      }
    }

    decrement<T extends typeof SequelizeBone & typeof AbstractBone>(fields: string | string[] | Record<string, number>, options: SequelizeInstanceUpdateOptions<T> = {}) {
      const Model = this.constructor as T;
      const { primaryKey } = Model;
      if (this[primaryKey] == null) {
        throw new Error(`Unset primary key ${primaryKey}`);
      }

      // validate
      if (options.validate !== false) {
        const updateValues: Record<string, number> = {};
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
     * @param options
     * @returns
     */
    async destroy(options: SequelizeDestroyOptions = {}): Promise<any> {
      const removeResult = await this._remove(options.force, { ...options });
      if (options.force) return removeResult;
      return this;
    }

    equals(): void {
      throw new Error('unimplemented');
    }

    equalsOneOf(): void {
      throw new Error('unimplemented');
    }

    get(key?: string): any {
      if (key) return this[key];
      return this.toObject();
    }

    getDataValue(key?: string): Literal {
      // unset value should not throw error in sequelize
      return this.getRaw(key);
    }

    get dataValues(): Record<string, Literal> {
      return this.getRaw();
    }

    increment<T extends typeof SequelizeBone & typeof AbstractBone>(fields: string | string[] | Record<string, number>, options: SequelizeInstanceUpdateOptions<T> = {}) {
      const Model = this.constructor as T;
      const { primaryKey } = Model;
      if (this[primaryKey] == null) {
        throw new Error(`Unset primary key ${primaryKey}`);
      }

      // validate instance only
      if (options.validate !== false) {
        const updateValues: Record<string, number> = {};
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

    isSoftDeleted(): boolean {
      const { deletedAt } = (this.constructor as typeof SequelizeBone).timestamps;
      return this[deletedAt] != null;
    }

    previous(key?: string): Literal | Record<string, Literal> {
      if (key != null) return this.getRawPrevious(key);

      const result: Record<string, Literal> = {};
      for (const attrKey of Object.keys((this.constructor as typeof SequelizeBone).attributes)) {
        const prevValue = this.getRawPrevious(attrKey);
        if (prevValue !== undefined) result[attrKey] = prevValue;
      }
      return result;
    }

    set(key: string, value: Literal): void {
      this[key] = value;
    }

    setDataValue(key: string, value: Literal): void {
      if (this.hasAttribute(key)) this.attribute(key, value);
      else this[key] = value;
    }

    where(): Record<string, Literal> {
      const { primaryKey } = this.constructor as typeof SequelizeBone;
      return { [primaryKey]: this[primaryKey] };
    }

    /**
     * An alias of instance constructor. Some legacy code access model name from instance with `this.Model.name`.
     */
    get Model() {
      return this.constructor;
    }

    static removeHook(): void {
      throw new Error('unimplemented');
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
    [util.inspect.custom](): string {
      return this.constructor.name + ' ' + util.inspect(this.toJSON());
    }
  };
}

export const SequelizeBone = sequelize(AbstractBone);
