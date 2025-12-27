import 'reflect-metadata';
import Spell from './spell';
import { AbstractBone } from './abstract_bone';
import { rawQuery } from './raw';
import {
  BoneColumns,
  Collection,
  Literal,
  QueryOptions,
  ResultSet,
  WhereConditions,
} from './types/common';
import Raw from './raw';

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
   * Restore soft-deleted rows by clearing deletedAt.
   * @example
   * Bone.restore({ title: 'aaa' })
   * Bone.restore({ title: 'aaa' }, { hooks: false })
   */
  static restore<T extends typeof Bone>(this: T, conditions: WhereConditions<T>, opts: QueryOptions = {}) {
    const { deletedAt } = this.timestamps as { deletedAt: string };
    if (deletedAt == null) {
      throw new Error('Model is not paranoid');
    }
    // Use un-paranoid update to clear deletedAt
    return this._find(conditions, { ...opts, paranoid: false }).$update({ [deletedAt]: null }) as Spell<T, number>;
  }

  /**
   * Discard all the applied scopes.
   * Bone.unscoped includes soft-deleted rows
   */
  static get unscoped(): Spell<typeof Bone> {
    return this._find().unscoped;
  }

  /**
   * Execute a raw query
   * @example
   * Bone.query('SELECT * FROM posts WHERE id = ?', [1])
   * Bone.query('SELECT * FROM posts WHERE id = :id', { replacements: { id: 1 } })
   */
  static async query<T extends typeof Bone>(this: T, sql: string, values?: Literal[] | QueryOptions, opts: QueryOptions = {}): Promise<{ rows?: any[]; fields?: { table: string; name: string }[] }> {
    return await rawQuery(this.driver, sql, values as any, { model: this as any, ...opts });
  }
}
