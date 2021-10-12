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
  static init({ spell, rows, fields }) {
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
 * get all columns
 * @param {Spell} spell
 * @returns {Array<String>} columns
 */
function getColumns(spell) {
  const { joins, columns, Model } = spell;
  const { tableAlias, table, driver } = Model;
  if (!columns.length) return [];
  let targetColumns = [];
  const joined = Object.keys(joins).length > 0;
  if (driver.type === 'sqlite' && joined) {
    /**
     * { type: 'alias', value: 'posts:id', args: [ { type: 'id', qualifiers: [ 'posts' ], value: 'ss' } ] },
     */
    if (columns.length) {
      for (const column of columns) {
        targetColumns.push(...column.args.filter(
          c => c.qualifiers && (c.qualifiers.includes(table) || c.qualifiers.includes(tableAlias))
        ).map(c => c.value));
      }
    }
  } else {
    targetColumns = columns.filter(c => !c.qualifiers || c.qualifiers.includes(table) || c.qualifiers.includes(tableAlias)).map(v => v.value);
  }
  return targetColumns;
}

/**
 * join target instantiatable or not
 * @param {Object} join
 * @returns {boolean}
 */
function joinedInstantiatable(join) {
  const { on, Model } = join;
  const { tableAlias, table } = Model;
  let columns = [];
  if (on && on.args && on.args.length) {
    for (const arg of on.args) {
      const { type } = arg;
      // { type: 'op', ..., args: [{ value: '', qualifiers: [] }] }
      if (type === 'op' && arg.args && arg.args.length) {
        columns.push(...arg.args.filter(
          c => c.qualifiers && (c.qualifiers.includes(table) || c.qualifiers.includes(tableAlias))
        ).map(c => c.value));
      } else if (arg.value && arg.qualifiers && (arg.qualifiers.includes(table) || arg.qualifiers.includes(tableAlias))) {
        // { type: 'id', value: '', qualifiers: [] }
        columns.push(arg.value);
      }
    }
  }
  if (!columns.length) return true;
  const attributeKeys = Object.keys(Model.attributes);
  return columns.some(r => attributeKeys.includes(r));
}

/**
 * @param {Spell} spell
 * @returns duplicate main Model
 */
function shouldFindJoinTarget(spell) {
  const { Model } = spell;
  const { primaryKey } = Model;
  const columns = getColumns(spell);
  return !columns.length || columns.length && columns.includes(primaryKey);
}

/**
 * Check if the query result is instantiatable
 * @param {Spell} spell
 * @returns {boolean}
 */
function instantiatable(spell) {
  const { Model, groups } = spell;
  const { attributes } = Model;
  const columns = getColumns(spell);
  if (groups.length > 0) return false;
  if (!columns.length) return true;
  const attributeKeys = Object.keys(attributes);
  return columns.some(r => attributeKeys.includes(r));
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
  const { tableAlias, table, primaryKey, primaryColumn, attributes } = Model;

  // await Post.count()
  if (rows.length <= 1 && columns.length === 1 && groups.length === 0) {
    const { type, value, args } = columns[0];
    if (type === 'alias' && args && args[0].type === 'func') {
      const row = rows[0];
      const result = row && (row[''] || row[table]);
      return result && result[value] || 0;
    }
  }

  const joined = Object.keys(joins).length > 0;
  const shouldFindDuplicate = shouldFindJoinTarget(spell);
  const canInstantiate = instantiatable(spell);
  const attributeKeys = Object.keys(attributes);

  const results = new Collection();
  for (const row of rows) {
    const result = {};
    for (const prop in row) {
      const data = row[prop];
      const qualifier = prop === table ? tableAlias : prop;
      if (qualifier === '' || qualifier === tableAlias) {
        Object.assign(result, data);
      } else {
        if (Object.values(data).some(value => value != null)) result[prop] = data;
      }
    }
    let current;
    if (shouldFindDuplicate && result[primaryColumn] != null) {
      current = results.find(r => r[primaryKey] == result[primaryColumn]);
    }
    if (!current) {
      const resultKeys = Object.keys(result);
      current = canInstantiate || (!groups.length && resultKeys.some(c => attributeKeys.includes(c)))? Model.instantiate(result) : result;
      results.push(current);
    }
    if (joined) {
      dispatchJoins(current, spell, row, fields);
    }
  }

  return results;
}

function dispatchJoins(current, spell, row, fields) {
  const instantiatableMap = {};
  for (const qualifier in spell.joins) {
    const join = spell.joins[qualifier];
    const { Model, hasMany } = join;
    if (instantiatableMap[qualifier] === undefined) instantiatableMap[qualifier] = joinedInstantiatable(join);
    const joinInstantiatable = instantiatableMap[qualifier];
    // mysql2 nests rows with table name instead of table alias.
    const values = row[qualifier] || row[Model.table];
    if (values) {
      if (hasMany) {
        const id = values[Model.primaryColumn];
        if (!current[qualifier]) current[qualifier] = new Collection();
        if (!Array.isArray(current[qualifier])) {
          const origin = !(current[qualifier] instanceof Model) && joinInstantiatable? Model.instantiate(current[qualifier]) : current[qualifier];
          current[qualifier] = new Collection();
          if (Object.values(values).some(value => value != null)) {
            current[qualifier].push(origin);
          }
        }
        if (!id || current[qualifier].some(item => item[Model.primaryKey] === id) || Object.values(values).every(value => value == null)) continue;
        current[qualifier].push(joinInstantiatable? Model.instantiate(values) : values);
      } else {
        current[qualifier] = Object.values(values).some(value => value != null)
          ? (joinInstantiatable? Model.instantiate(values) : values)
          : null;
      }
    }
  }
}

module.exports = Collection;
