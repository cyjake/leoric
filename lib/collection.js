'use strict';

const Spell = require('./spell');

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
    if (isDispatchable(spell)) return dispatch(spell, rows, fields);
    return convert(spell, rows, fields);
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
  save() {
    if (this.length === 0) return Promise.resolve(this);

    if (this.some(element => !element.save)) {
      throw new Error('Collection contains element that cannot be saved.');
    }

    return Promise.all(this.map(element => element.save()));
  }
}

/**
 * Check if current spell is eligible to build models.
 * @param {Spell} spell
 * @returns {boolean}
 */
function isDispatchable(spell) {
  const { columns, groups, table } = spell;

  for (const token of columns) {
    const { type } = token;
    if (type == 'func') return false;
    if (type == 'alias' && token.args[0].type == 'func') return false;
  }
  if (groups.length > 0) return false;
  if (table.value instanceof Spell && Object.keys(table.value.joins).length > 0) {
    return false;
  }
  return true;
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
  const { Model } = spell;

  if (Object.keys(spell.joins).length == 0) {
    return Collection.from(rows, row => Model.instantiate(Object.values(row)[0]));
  }

  const results = new Collection();
  const { aliasName, table, primaryColumn, primaryKey } = Model;

  for (const row of rows) {
    // If SQL contains subqueries, such as `SELECT * FROM (SELECT * FROM foo) AS bar`,
    // the table name of the columns in SQLite is the original table name instead of the alias.
    // Hence we need to fallback to original table name here.
    const main = row[aliasName] || row[table];
    let current = results.find(result => result[primaryKey] == main[primaryColumn]);

    if (!current) {
      current = Model.instantiate(main);
      results.push(current);
    }

    for (const qualifier in spell.joins) {
      const { Model, hasMany } = spell.joins[qualifier];
      // mysql2 nests rows with table name instead of table alias.
      const values = row[qualifier] || row[Model.table];
      const id = values[Model.primaryColumn];
      if (hasMany) {
        if (!current[qualifier]) current[qualifier] = new Collection();
        if (!id || current[qualifier].some(item => item[Model.primaryKey] == id)) continue;
        current[qualifier].push(Model.instantiate(values));
      } else {
        current[qualifier] = Object.values(values).some(value => value != null)
          ? Model.instantiate(values)
          : null;
      }
    }
  }

  return results;
}

/**
 * Convert returned rows to result set by translating columns (if found) to attributes.
 * @private
 * @param {Spell} spell
 * @param {Object[]} rows
 * @param {Object[]} fields
 * @returns {Object[]}
 */
function convert(spell, rows, fields) {
  const results = [];
  const { joins } = spell;
  const { table, aliasName } = spell.Model;

  // await Post.count()
  if (rows.length === 1 && spell.columns.length === 1) {
    const { type, value, args } = spell.columns[0];
    if (type === 'alias' && args && args[0].type === 'func') {
      const row = rows[0];
      return row && row[''] && row[''][value];
    }
  }

  for (const row of rows) {
    const result = { '': {} };
    for (let prop in row) {
      const data = row[prop];
      // mysql2 sometimes nests rows with table name instead of table alias
      const qualifier = prop == table ? aliasName : prop;
      const obj = result[qualifier] || (result[qualifier] = {});
      if (qualifier == '') {
        Object.assign(obj, data);
      }
      else if (qualifier in joins || qualifier == aliasName) {
        const { Model } = joins[qualifier] || spell;
        for (const columnName in data) {
          const definition = Model.attributeMap[columnName];
          if (definition) {
            obj[definition.name] = data[columnName];
          } else {
            result[''][columnName] = data[columnName];
          }
        }
      }
      else {
        throw new Error(`Unknown qualifier ${qualifier}`);
      }
    }
    results.push(result);
  }

  if (Object.keys(joins).length > 0) return results;
  return results.map(result => {
    const merged = {};
    for (const obj of Object.values(result)) Object.assign(merged, obj);
    return merged;
  });
}

module.exports = Collection;
