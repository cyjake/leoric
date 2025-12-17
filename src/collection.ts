import { AbstractBone } from './types/abstract_bone';
import Spell from './spell';
import { Literal, Values } from './types/common';
import { Alias } from './expr';

/**
 * An extended Array to represent collections of models.
 */
class Collection<T extends object> extends Array<T> {
  /**
   * Convert results by determining whether the result is instantiable or not.
   */
  static init<T extends typeof AbstractBone>(
    { spell, rows, fields, insertId, affectedRows }:
    { spell: Spell<T>; rows: any[]; fields: any[]; insertId?: number; affectedRows?: number },
  ) {
    if (spell.command !== 'select') return { insertId, affectedRows };
    return dispatch(spell, rows, fields);
  }

  /**
   * Override JSON.stringify behavior
   */
  toJSON() {
    return Array.from(this, function(element: any) {
      if (element == null) return element;
      if (typeof element.toJSON === 'function') return element.toJSON();
      return element;
    });
  }

  /**
   * Convert the collection to a plain object array
   */
  toObject() {
    return Array.from(this, function(element: any) {
      if (element == null) return element;
      if (typeof element.toObject === 'function') return element.toObject();
      return element;
    });
  }

  /**
   * Save the collection. Currently the changes are made concurrently but NOT in a transaction.
   */
  async save() {
    if (this.length === 0) return this;

    if (!this.every((element: any) => element && typeof element.save === 'function')) {
      throw new Error('Collection contains element that cannot be saved.');
    }

    return await Promise.all(this.map(element => {
      return (element as { save: () => Promise<any> }).save();
    }));
  }
}

/**
 * Check if the query result of spell is instantiatable by examining the query structure.
 * - https://www.yuque.com/leoric/blog/ciiard#XoI4O (zh-CN)
 * @param {Spell} spell
 */
function instantiatable<T extends typeof AbstractBone>(spell: Spell<T>) {
  const { columns, groups, Model } = spell;
  const { columnAttributes, tableAlias } = Model;

  if (groups.length > 0) return false;
  if (columns.length === 0) return true;

  return columns
    .filter(({ qualifiers }) => (!qualifiers || qualifiers.includes(tableAlias)))
    .every(({ value }) => columnAttributes[value]);
}

type CollectionItem<U extends typeof AbstractBone> = Record<string, InstanceType<U> | Collection<InstanceType<U>> | Literal>

/**
 * Convert the results to collection that consists of models with their associations set up according to `spell.joins`.
 * @private
 * @param {Spell} spell
 * @param {Object[]} rows
 * @param {Object[]} fields
 */
function dispatch<T extends typeof AbstractBone, U extends typeof AbstractBone>(
  spell: Spell<T>,
  rows: Record<string, Record<string, Literal>>[],
  fields: Record<string, any>[],
) {
  const { groups, joins, columns, Model } = spell;
  const { tableAlias, table, primaryKey, primaryColumn, attributeMap } = Model;

  // await Post.count()
  if (rows.length <= 1 && columns.length === 1 && groups.length === 0) {
    const { type, value, args } = columns[0] as Alias;
    if (type === 'alias' && args && args[0].type === 'func') {
      const row = rows[0];
      const record = row && (row[''] || row[table]);
      const result = record && record[value];
      return result;
    }
  }

  const joined = Object.keys(joins).length > 0;
  const canInstantiate = instantiatable(spell);

  const results: Collection<InstanceType<T> | Record<string, Literal>> = new Collection();
  for (const row of rows) {
    const result = Object.keys(row).reduce((res: Record<string, Literal>, prop) => {
      const data = row[prop];
      const qualifier = prop === table ? tableAlias : prop;
      if (qualifier === '' || qualifier === tableAlias) {
        Object.assign(res, data);
      } else {
        if (Object.values(data).some(value => value != null)) {
          res[prop] = data;
        }
      }
      return res;
    }, {});
    let current: InstanceType<T> | Record<string, Literal> | undefined;
    if (joined && result[primaryColumn] != null) {
      current = results.find(r => r[primaryKey as keyof typeof r] == result[primaryColumn]);
    }
    if (!current) {
      current = canInstantiate || (groups.length === 0 && Object.keys(result).every(key => attributeMap[key]))
        ? Model.instantiate(result as Values<InstanceType<T>>)
        : Model.alias(result);
      results.push(current);
    }
    if (joined) {
      dispatchJoins<T, U>(current as CollectionItem<U>, spell, row, fields);
    }
  }

  return results;
}

function dispatchJoins<T extends typeof AbstractBone, U extends typeof AbstractBone>(
  // actully mixed with InstanceType<T>
  current: CollectionItem<U>,
  spell: Spell<T>,
  row: Record<string, Record<string, Literal>>,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  fields: Record<string, any>[],
) {
  for (const qualifier in spell.joins) {
    const join = spell.joins[qualifier];
    const { Model, hasMany } = join;
    // mysql2 nests rows with table name instead of table alias.
    const values = row[qualifier] || row[Model.table];

    if (!values) continue;
    if (hasMany) {
      const id = values[Model.primaryColumn];
      if (!current[qualifier]) current[qualifier] = new Collection();
      if (!Array.isArray(current[qualifier])) {
        const instance = Model.instantiate(current[qualifier]);
        current[qualifier] = new Collection<InstanceType<U>>();
        if (Object.values(values).some(value => value != null)) {
          current[qualifier].push(instance as InstanceType<T>);
        }
      }
      // TODO: add a test case to cover the loose equality check
      // bigint primary key in cartesian product will be string if mysql supportBigNumbers is true
      if (!id || current[qualifier].some((item: InstanceType<U>) => item[Model.primaryKey as keyof typeof item] == id)) {
        continue;
      }
      current[qualifier].push(Model.instantiate(values) as InstanceType<T>);
    } else {
      current[qualifier] = Object.values(values).some(value => value != null)
        ? Model.instantiate(values) as InstanceType<T>
        : null;
    }
  }
}

export default Collection;
