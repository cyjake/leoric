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
 * Convert the results to collection that consists of models with their associations set up according to `spell.joins`.
 * @private
 * @param {Spell} spell
 * @param {Object[]} rows
 * @param {Object[]} fields
 * @returns {Collection}
 */
function dispatch(spell, rows, fields) {
  const { groups, joins, columns, Model } = spell;
  const { tableAlias, table, primaryKey, primaryColumn, driver } = Model;

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
  let shouldFindJoinTarget = !columns.length;
  let targetColumns = [];
  if (driver.type === 'sqlite' && joined) {
    /**
     * { type: 'alias', value: 'posts:id', args: [ { type: 'id',qualifiers: [], value: 'ss' } ] },
     */
    if (columns.length) {
      const allColumns = [];
      for (const column of columns) {
        allColumns.push(...column.args);
      }
      targetColumns = allColumns.filter(c => 
        c.qualifiers && (c.qualifiers.includes(table) || c.qualifiers.includes(tableAlias))
      );
    }
    shouldFindJoinTarget = shouldFindJoinTarget || !targetColumns.length ||
      (targetColumns.length && targetColumns.find(c => c.value === primaryKey)) ;
  } else {
    targetColumns = columns.filter(c => !c.qualifiers || c.qualifiers.includes(table) || c.qualifiers.includes(tableAlias)).map(v => v.value);
    shouldFindJoinTarget = shouldFindJoinTarget || !targetColumns.length || targetColumns.length && targetColumns.includes(primaryKey);
  }
  
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
    if (shouldFindJoinTarget && result[primaryColumn] != null) {
      current = results.find(r => r[primaryKey] == result[primaryColumn]);
    }
    if (!current) {
      current = Model.instantiate(result);
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
    const { Model, hasMany } = spell.joins[qualifier];
    // mysql2 nests rows with table name instead of table alias.
    const values = row[qualifier] || row[Model.table];
    if (values) {
      if (hasMany) {
        const id = values[Model.primaryColumn];
        if (!current[qualifier]) current[qualifier] = new Collection();
        if (!Array.isArray(current[qualifier])) {
          const origin = !(current[qualifier] instanceof Model)? Model.instantiate(current[qualifier]) : current[qualifier];
          current[qualifier] = new Collection();
          if (Object.values(values).some(value => value != null)) {
            current[qualifier].push(origin);
          }
        }
        if (!id || current[qualifier].some(item => item[Model.primaryKey] === id) || Object.values(values).every(value => value == null)) continue;
        current[qualifier].push(Model.instantiate(values));
      } else {
        current[qualifier] = Object.values(values).some(value => value != null)
          ? Model.instantiate(values)
          : null;
      }
    }
  }
}

module.exports = Collection;
