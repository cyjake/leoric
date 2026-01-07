import 'reflect-metadata';
import Spell from './spell';
import { AbstractBone } from './abstract_bone';
import {
  BoneColumns,
  Collection,
  Literal,
  QueryOptions,
  ResultSet,
  WhereConditions,
} from './types/common';
import Raw from './raw';
import { isPlainObject } from './utils';

export default class Bone extends AbstractBone {
  /**
   * SELECT rows
   * @example
   * Bone.find('foo = ?', 1)
   * Bone.find({ foo: { $eq: 1 } })
   */
  static find<T extends typeof Bone>(this: T, whereConditions: WhereConditions<T>): Spell<T, Collection<InstanceType<T>>>;
  static find<T extends typeof Bone>(this: T, whereConditions: string, ...values: Literal[]): Spell<T, Collection<InstanceType<T>>>;
  static find<T extends typeof Bone>(this: T, primaryKey: number | number[] | bigint): Spell<T, Collection<InstanceType<T>>>;
  static find<T extends typeof Bone>(this: T): Spell<T, Collection<InstanceType<T>>>;
  static find<T extends typeof Bone>(this: T, conditions?: WhereConditions<T> | string | number | number[] | bigint, ...values: Literal[]) {
    return this._find(conditions as any, ...values) as Spell<T, Collection<InstanceType<T>>>;
  }

  /**
   * SELECT rows LIMIT 1. If no results were found, returns null. If results were found, returns the found record.
   * @example
   * Bone.findOne('foo = ?', 1)
   * Bone.findOne({ foo: { $eq: 1 } })
   */
  static findOne<T extends typeof Bone>(this: T, whereConditions: WhereConditions<T>): Spell<T, InstanceType<T> | null>;
  static findOne<T extends typeof Bone>(this: T, whereConditions: string, ...values: Literal[]): Spell<T, InstanceType<T> | null>;
  static findOne<T extends typeof Bone>(this: T, primaryKey: number | number[] | bigint | bigint[]): Spell<T, InstanceType<T> | null>;
  static findOne<T extends typeof Bone>(this: T): Spell<T, InstanceType<T> | null>;
  static findOne<T extends typeof Bone>(this: T, conditions?: WhereConditions<T> | string | number | number[] | bigint | bigint[], ...values: Literal[]) {
    return this._find(conditions, ...values).$get(0) as Spell<T, InstanceType<T> | null>;
  }

  /**
   * Sum aggregate on a column or raw expression.
   */
  static sum<T extends typeof Bone>(this: T, name?: BoneColumns<T>): Spell<T, ResultSet<T> | number>;
  static sum<T extends typeof Bone>(this: T, name?: Raw): Spell<T, ResultSet<T> | number>;
  static sum<T extends typeof Bone>(this: T, name?: BoneColumns<T> | Raw) {
    return this._find().$sum(name) as Spell<T, ResultSet<T> | number>;
  }

  /**
   * Discard all the applied scopes.
   * Bone.unscoped includes soft-deleted rows
   */
  static get unscoped(): Spell<typeof Bone> {
    return this._find().unscoped;
  }

  static restore<T extends typeof Bone>(this: T, conditions: WhereConditions<T>, opts: QueryOptions = {}) {
    return super._restore(conditions, opts);
  }

  static update<T extends typeof Bone, Key extends BoneColumns<T>>(
    this: T,
    conditions: WhereConditions<T>,
    values: Record<Key, Literal | Raw>,
    options: QueryOptions = {},
  ) {
    return super._update(conditions, values, options);
  }

  /**
   * update rows
   * @param changes data changes
   * @param opts query options
   */
  async update(
    values: Record<string, Literal | Raw>,
    options: QueryOptions & { fields?: string[] } = {},
  ): Promise<number> {
    const changes: Record<string, Literal | Raw> = {};
    const originalValues = Object.assign({}, this.getRaw());
    const { fields = [] } = options;

    if (isPlainObject(values)) {
      for (const name in values) {
        const value = values[name];
        if (value instanceof Raw) {
          changes[name] = value;
        } else if (value !== undefined && this.hasAttribute(name) && (!fields.length || (fields as any).includes(name))) {
          this[name] = value;
          changes[name] = this.attribute(name);
        }
      }
    }

    try {
      const res = await super._update(Object.keys(changes).length ? changes : values, options);
      return res;
    } catch (error) {
      this._setRaw(originalValues);
      throw error;
    }
  }
}
