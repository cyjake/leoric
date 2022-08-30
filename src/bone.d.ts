import { Spell } from './spell';
import { AbstractBone } from './types/abstract_bone';
import { Collection, Literal, QueryOptions, ResultSet, WhereConditions } from './types/common';

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
  static find<T extends typeof Bone>(this: T, ): Spell<T, Collection<InstanceType<T>>>;

  /**
   * SELECT rows LIMIT 1. Besides limiting the results to one rows, the type of the return value is different from {@link Bone.find} too. If no results were found, {@link Bone.findOne} returns null. If results were found, it returns the found record instead of wrapping them as a collection.
   * @example
   * Bone.findOne('foo = ?', 1)
   * Bone.findOne({ foo: { $eq: 1 } })
   */
  static findOne<T extends typeof Bone>(this: T, whereConditions: WhereConditions<T>): Spell<T, InstanceType<T> | null>;
  static findOne<T extends typeof Bone>(this: T, whereConditions: string, ...values: Literal[]): Spell<T, InstanceType<T> | null>;
  static findOne<T extends typeof Bone>(this: T, primaryKey: number | number[] | bigint): Spell<T, InstanceType<T> | null>;
  static findOne<T extends typeof Bone>(this: T, ): Spell<T, InstanceType<T> | null>;

  static sum<T extends typeof Bone>(this: T, name?: string): Spell<T, ResultSet | number>;

  /**
   * restore rows
   * @example
   * Bone.restore({ title: 'aaa' })
   * Bone.restore({ title: 'aaa' }, { hooks: false })
   * @param conditions query conditions
   * @param opts query options
   */
  static restore<T extends typeof Bone>(this: T, conditions: Object, opts?: QueryOptions): Spell<T, number>;

  /**
   * UPDATE rows.
   */
  static update<T extends typeof Bone>(this: T, whereConditions: WhereConditions<T>, values?: Object, opts?: QueryOptions): Spell<T, number>;

  /**
   * Discard all the applied scopes.
   * @example
   * Bone.all.unscoped  // includes soft deleted rows
   */
  static unscoped: Spell<typeof Bone>;

}
