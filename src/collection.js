'use strict';

/**
 * An extended Array to represent collections of models.
 */
class Collection extends Array {
  /**
   * Convert results by determining whether the result is instantiable or not.
   * @param {Spell} spell
   * @param {Array} rows
   * @param {Array} fields
   * @returns {Collection|Array}
   */
  static init({ spell, rows, fields, insertId, affectedRows}) {
    if (spell.command !== 'select') return { insertId, affectedRows };
    return dispatch(spell, rows, fields);
  }

  /**
   * Override JSON.stringify behavior
   * @returns {Object[]}
   */
  toJSON() {
    return Array.from(this, function(element) {
      if (typeof element.toJSON === 'function') return element.toJSON();
      return element;
    });
  }

  /**
   * @returns {Object[]}
   */
  toObject() {
    return Array.from(this, function(element) {
      if (typeof element.toObject === 'function') return element.toObject();
      return element;
    });
  }

  /**
   * Save the collection. Currently the changes are made concurrently but NOT in a transaction.
   * @returns {Bone[]}
   */
  async save() {
    if (this.length === 0) return this;

    if (this.some(element => !element.save)) {
      throw new Error('Collection contains element that cannot be saved.');
    }

    return await Promise.all(this.map(element => element.save()));
  }
}

/**
 * Check if the query result of spell is instantiatable by examining the query structure.
 * - https://www.yuque.com/leoric/blog/ciiard#XoI4O (zh-CN)
 * @param {Spell} spell
 * @returns {boolean}
 */
function instantiatable(spell) {
  const { columns, groups, Model } = spell;
  const { columnAttributes, tableAlias } = Model;

  if (groups.length > 0) return false;
  if (columns.length === 0) return true;

  return columns
    .filter(({ qualifiers }) => (!qualifiers || qualifiers.includes(tableAlias)))
    .every(({ value }) => columnAttributes[value]);
}

/**
 * Convert the results to collection that consists of models with their associations set up according to `spell.joins`.
 * @private
 * @param {Spell} spell
 * @param {Object[]} rows
 * @param {Object[]} fields
 * @returns {Collection}
 */
function dispatch(spell, rows, fields) {
  const { groups, joins, columns, Model } = spell;
  const { tableAlias, table, primaryKey, primaryColumn, attributeMap } = Model;

  // await Post.count()
  if (rows.length <= 1 && columns.length === 1 && groups.length === 0) {
    const { type, value, args } = columns[0];
    if (type === 'alias' && args && args[0].type === 'func') {
      const row = rows[0];
      const record = row && (row[''] || row[table]);
      const result = record && record[value];
      return result;
    }
  }

  const joined = Object.keys(joins).length > 0;
  const canInstantiate = instantiatable(spell);

  const results = new Collection();
  for (const row of rows) {
    const result = Object.keys(row).reduce((res, prop) => {
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
    let current;
    if (joined && result[primaryColumn] != null) {
      current = results.find(r => r[primaryKey] == result[primaryColumn]);
    }
    if (!current) {
      current = canInstantiate || (groups.length === 0 && Object.keys(result).every(key => attributeMap[key]))
        ? Model.instantiate(result)
        : Model.alias(result);
      results.push(current);
    }
    if (joined) {
      dispatchJoins(current, spell, row, fields);
    }
  }

  return results;
}

function dispatchJoins(current, spell, row, fields) {
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
        current[qualifier] = new Collection();
        if (Object.values(values).some(value => value != null)) {
          current[qualifier].push(instance);
        }
      }
      if (!id || current[qualifier].some(item => item[Model.primaryKey] === id)) continue;
      current[qualifier].push(Model.instantiate(values));
    } else {
      current[qualifier] = Object.values(values).some(value => value != null)
        ? Model.instantiate(values)
        : null;
    }
  }
}

module.exports = Collection;
