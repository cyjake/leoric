'use strict';

const SqlString = require('sqlstring');

const { copyExpr, findExpr, walkExpr } = require('../../expr');
const { formatExpr, formatConditions, collectLiteral } = require('../../expr_formatter');

/**
 * Format orders into ORDER BY clause in SQL
 * @param {Spell}    spell
 * @param {Object[]} orders
 */
function formatOrders(spell, orders) {
  return orders.map(([token, order]) => {
    const column = formatExpr(spell, token);
    return order == 'desc' ? `${column} DESC` : column;
  });
}

/**
 * Format a spell without joins into a full SELECT query. This function is also used to format the subquery which is then used as a drived table in a SELECT with joins.
 * @param {Spell} spell
 */
function formatSelectWithoutJoin(spell) {
  const { columns, whereConditions, groups, havingConditions, orders, rowCount, skip } = spell;
  const chunks = ['SELECT'];
  const values = [];

  // see https://dev.mysql.com/doc/refman/8.0/en/optimizer-hints.html
  const hintStr = this.formatOptimizerHints(spell);

  if (hintStr) {
    chunks.push(hintStr);
  }

  if (columns.length > 0) {
    for (const column of columns) collectLiteral(spell, column, values);
    const selects = [];
    for (const token of columns) {
      const column = formatExpr(spell, token);
      if (!selects.includes(column)) selects.push(column);
    }
    chunks.push(`${selects.join(', ')}`);
  } else {
    chunks.push('*');
  }

  const table = formatExpr(spell, spell.table);
  chunks.push(`FROM ${table}`);
  if (spell.table.value instanceof spell.constructor) {
    chunks.push(`AS t${spell.subqueryIndex++}`);
  }

   // see https://dev.mysql.com/doc/refman/8.0/en/index-hints.html
  const indexHintStr = this.formatIndexHints(spell);
  if (indexHintStr) {
    chunks.push(indexHintStr);
  }

  if (whereConditions.length > 0) {
    for (const condition of whereConditions) collectLiteral(spell, condition, values);
    chunks.push(`WHERE ${formatConditions(spell, whereConditions)}`);
  }

  if (groups.length > 0) {
    const groupColumns = groups.map(group => formatExpr(spell, group));
    chunks.push(`GROUP BY ${groupColumns.join(', ')}`);
  }

  if (havingConditions.length > 0) {
    for (const condition of havingConditions) collectLiteral(spell, condition, values);
    chunks.push(`HAVING ${formatConditions(spell, havingConditions)}`);
  }

  if (orders.length > 0) {
    // ORDER BY FIND_IN_SET(`id`, '1,2,3')
    for (const [ expr ] of orders) collectLiteral(spell, expr, values);
    chunks.push(`ORDER BY ${formatOrders(spell, orders).join(', ')}`);
  }
  if (rowCount > 0) chunks.push(`LIMIT ${rowCount}`);
  if (skip > 0) chunks.push(`OFFSET ${skip}`);

  return { sql: chunks.join(' '), values };
}

/**
 * Create a subquery to make sure OFFSET and LIMIT on left table takes effect.
 * @param {Spell} spell
 */
function createSubspell(spell) {
  const { Model, columns, joins, whereConditions, orders } = spell;
  const baseName = Model.tableAlias;
  const subspell = spell.dup;

  subspell.columns = [];
  for (const token of columns) {
    walkExpr(token, ({ type, qualifiers, value }) => {
      if (type == 'id' && qualifiers[0] == baseName) {
        subspell.columns.push({ type, value });
      }
    });
  }

  // If columns were whitelisted, make sure JOIN columns are included.
  if (subspell.columns.length > 0) {
    for (const qualifier in joins) {
      const association = joins[qualifier];
      walkExpr(association.on, ({ type, qualifiers, value }) => {
        if (type == 'id' && qualifiers[0] == baseName) {
          subspell.columns.push({ type, value });
        }
      });
    }
  }

  // TODO: how to handle subqueries with GROUP?
  subspell.groups = [];

  subspell.whereConditions = [];
  for (let i = whereConditions.length - 1; i >= 0; i--) {
    const condition = whereConditions[i];
    let internal = true;
    walkExpr(condition, ({ type, qualifiers }) => {
      if (type == 'id' && qualifiers[0] != baseName) {
        internal = false;
      }
    });
    if (internal) {
      const token = copyExpr(condition, ({ type, value }) => {
        if (type === 'id') return { type, value };
      });
      subspell.whereConditions.unshift(token);
      whereConditions.splice(i, 1);
    }
  }

  subspell.orders = [];
  for (const order of orders) {
    const [token, direction] = order;
    const { type, qualifiers, value } = token;
    if (type == 'id' && qualifiers[0] == baseName) {
      subspell.orders.push([{ type, value }, direction]);
    }
  }

  return subspell;
}

/**
 * Make sure columns are qualified
 */
function qualify(spell) {
  const { Model, columns, groups, whereConditions, havingConditions, orders } = spell;
  const baseName = Model.tableAlias;
  const clarify = node => {
    if (node.type === 'id' && !node.qualifiers) {
      if (Model.attributes[node.value]) node.qualifiers = [baseName];
    }
  };

  for (const ast of columns.concat(groups, whereConditions, havingConditions)) {
    walkExpr(ast, clarify);
  }

  for (const [ast] of orders) {
    walkExpr(ast, clarify);
  }
}

/**
 * Format select list that indicates which columns to retrieve
 * @param {Spell} spell
 */
function formatSelectExpr(spell, values) {
  const { Model, columns, joins, groups } = spell;
  const { escapeId } = Model.driver;
  const baseName = Model.tableAlias;
  const selects = new Set();
  const map = {};

  for (const token of columns) {
    collectLiteral(spell, token, values);
    const selectExpr = formatExpr(spell, token);
    const qualifier = token.qualifiers ? token.qualifiers[0] : '';
    const list = map[qualifier] || (map[qualifier] = []);
    list.push(selectExpr);
  }

  for (const qualifier of [baseName].concat(Object.keys(joins))) {
    const list = map[qualifier];
    if (list) {
      for (const selectExpr of list) selects.add(selectExpr);
    } else if (groups.length === 0 && Model.driver.type !== 'sqlite') {
      selects.add(`${escapeId(qualifier)}.*`);
    }
  }

  if (map['']) {
    for (const selectExpr of map['']) selects.add(selectExpr);
  }

  return Array.from(selects);
}

/**
 * Format a spell with joins into a full SELECT query.
 * @param {Spell} spell
 */
function formatSelectWithJoin(spell) {
  // Since it is a JOIN query, make sure columns are always qualified.
  qualify(spell);

  const { Model, whereConditions, groups, havingConditions, orders, rowCount, skip, joins } = spell;
  const { escapeId } = Model.driver;
  const baseName = Model.tableAlias;

  const chunks = ['SELECT'];
  const values = [];
  const selects = formatSelectExpr(spell, values);

  // see https://dev.mysql.com/doc/refman/8.0/en/optimizer-hints.html
  const hintStr = this.formatOptimizerHints(spell);

  if (hintStr) {
    chunks.push(hintStr);
  }
  chunks.push(selects.join(', '));

  if (skip > 0 || rowCount > 0) {
    const subspell = createSubspell(spell);
    const subquery = this.formatSelectWithoutJoin(subspell);
    values.push(...subquery.values);
    chunks.push(`FROM (${subquery.sql}) AS ${escapeId(baseName)}`);
  } else {
    chunks.push(`FROM ${escapeId(Model.table)} AS ${escapeId(baseName)}`);
  }

  for (const qualifier in joins) {
    const { Model: RefModel, on } = joins[qualifier];
    collectLiteral(spell, on, values);
    chunks.push(`LEFT JOIN ${escapeId(RefModel.table)} AS ${escapeId(qualifier)} ON ${formatExpr(spell, on)}`);
  }

  // see https://dev.mysql.com/doc/refman/8.0/en/index-hints.html
  const indexHintStr = this.formatIndexHints(spell);
  if (indexHintStr) {
    chunks.push(indexHintStr);
  }

  if (whereConditions.length > 0) {
    for (const condition of whereConditions) collectLiteral(spell, condition, values);
    chunks.push(`WHERE ${formatConditions(spell, whereConditions)}`);
  }

  if (groups.length > 0) {
    chunks.push(`GROUP BY ${groups.map(group => formatExpr(spell, group)).join(', ')}`);
  }

  if (havingConditions.length > 0) {
    for (const condition of havingConditions) collectLiteral(spell, condition, values);
    chunks.push(`HAVING ${formatConditions(spell, havingConditions)}`);
  }

  if (orders.length > 0) chunks.push(`ORDER BY ${formatOrders(spell, orders).join(', ')}`);
  return { sql: chunks.join(' '), values };
}

/**
 * To help choosing the right function when formatting a spell into SELECT query.
 * @param {Spell} spell
 */
function formatSelect(spell) {
  const { whereConditions } = spell;
  const { shardingKey, table } = spell.Model;

  if (shardingKey && !whereConditions.some(condition => findExpr(condition, { type: 'id', value: shardingKey }))) {
    throw new Error(`Sharding key ${table}.${shardingKey} is required.`);
  }

  if (spell.skip > 0 && spell.rowCount == null) {
    throw new Error('Unable to query with OFFSET yet without LIMIT');
  }

  return Object.keys(spell.joins).length > 0
    ? this.formatSelectWithJoin(spell)
    : this.formatSelectWithoutJoin(spell);
}

/**
 * Format the spell into a DELETE query.
 * @param {Spell} spell
 */
function formatDelete(spell) {
  const { Model, whereConditions } = spell;
  const { shardingKey } = Model;
  const { escapeId } = Model.driver;
  const table = escapeId(Model.table);

  if (shardingKey && !whereConditions.some(condition => findExpr(condition, { type: 'id', value: shardingKey }))) {
    throw new Error(`Sharding key ${Model.table}.${shardingKey} is required.`);
  }

  const chunks = ['DELETE'];

  // see https://dev.mysql.com/doc/refman/8.0/en/optimizer-hints.html
  const hintStr = this.formatOptimizerHints(spell);
  if (hintStr) {
    chunks.push(hintStr);
  }

  chunks.push(`FROM ${table}`);

  if (whereConditions.length > 0) {
    const values = [];
    for (const condition of whereConditions) collectLiteral(spell, condition, values);
    chunks.push(`WHERE ${formatConditions(spell, whereConditions)}`);
    return {
      sql: chunks.join(' '),
      values
    };
  } else {
    return { sql: chunks.join(' ') };
  }
}

/**
 * Format a spell into INSERT query.
 * @param {Spell} spell
 */
function formatInsert(spell) {
  const { Model, sets, attributes: optAttrs, updateOnDuplicate } = spell;
  const { shardingKey } = Model;
  const { createdAt } = Model.timestamps;
  const { escapeId } = Model.driver;
  let columns = [];
  let updateOnDuplicateColumns = [];

  let values = [];
  let placeholders = [];
  if (Array.isArray(sets)) {
    // merge records to get the big picture of involved attributes
    const involved = sets.reduce((result, entry) => {
      return Object.assign(result, entry);
    }, {});
    const attributes = [];
    if (optAttrs) {
      for (const name in optAttrs) {
        if (involved.hasOwnProperty(name)) attributes.push(attributes[name]);
      }
    } else {
      for (const name in involved) {
        // upsert should not update createdAt
        if (updateOnDuplicate && createdAt && name === createdAt) continue;
        attributes.push(Model.attributes[name]);
      }
    }

    for (const entry of attributes) {
      columns.push(entry.columnName);
      if (updateOnDuplicate && createdAt && entry.name === createdAt) continue;
      updateOnDuplicateColumns.push(entry.columnName);
    }

    for (const entry of sets) {
      if (shardingKey && entry[shardingKey] == null) {
        throw new Error(`Sharding key ${Model.table}.${shardingKey} cannot be NULL.`);
      }
      for (const attribute of attributes) {
        const { name } = attribute;
        values.push(entry[name]);
      }
      placeholders.push(`(${new Array(attributes.length).fill('?').join(',')})`);
    }

  } else {
    if (shardingKey && sets[shardingKey] == null) {
      throw new Error(`Sharding key ${Model.table}.${shardingKey} cannot be NULL.`);
    }
    for (const name in sets) {
      const value = sets[name];
      // upsert should not update createdAt
      columns.push(Model.unalias(name));
      if (value && value.__raw) {
        values.push(SqlString.raw(value.value));
      } else {
        values.push(value);
      }
      if (updateOnDuplicate && createdAt && name === createdAt) continue;
      updateOnDuplicateColumns.push(Model.unalias(name));
    }
  }


  const chunks = ['INSERT'];

  // see https://dev.mysql.com/doc/refman/8.0/en/optimizer-hints.html
  const hintStr = this.formatOptimizerHints(spell);
  if (hintStr) {
    chunks.push(hintStr);
  }
  chunks.push(`INTO ${escapeId(Model.table)} (${columns.map(column => escapeId(column)).join(', ')})`);
  if (placeholders.length) {
    chunks.push(`VALUES ${placeholders.join(', ')}`);
  } else {
    chunks.push(`VALUES (${columns.map(_ => '?').join(', ')})`);
  }
  chunks.push(this.formatUpdateOnDuplicate(spell, updateOnDuplicateColumns));
  chunks.push(this.formatReturning(spell));
  return {
    sql: chunks.join(' ').trim(),
    values,
  };
}

/**
 * Format a spell into UPDATE query
 * @param {Spell} spell
 */
function formatUpdate(spell) {
  const { Model, sets, whereConditions } = spell;
  const { shardingKey } = Model;

  if (shardingKey) {
    if (sets.hasOwnProperty(shardingKey) && sets[shardingKey] == null) {
      throw new Error(`Sharding key ${Model.table}.${shardingKey} cannot be NULL`);
    }
    if (!whereConditions.some(condition => findExpr(condition, { type: 'id', value: shardingKey }))) {
      throw new Error(`Sharding key ${Model.table}.${shardingKey} is required.`);
    }
  }

  if (Object.keys(sets).length === 0) {
    throw new Error('Unable to update with empty set');
  }

  const chunks = ['UPDATE'];

  const values = [];
  const assigns = [];
  const { escapeId } = Model.driver;
  for (const name in sets) {
    const value = sets[name];
    if (value && value.__expr) {
      assigns.push(`${escapeId(Model.unalias(name))} = ${formatExpr(spell, value)}`);
      collectLiteral(spell, value, values);
    } else if (value && value.__raw) {
      assigns.push(`${escapeId(Model.unalias(name))} = ${value.value}`);
    } else {
      assigns.push(`${escapeId(Model.unalias(name))} = ?`);
      values.push(sets[name]);
    }
  }

  for (const condition of whereConditions) collectLiteral(spell, condition, values);
  // see https://dev.mysql.com/doc/refman/8.0/en/optimizer-hints.html
  const hintStr = this.formatOptimizerHints(spell);
  // see https://dev.mysql.com/doc/refman/8.0/en/index-hints.html
  const indexHintStr = this.formatIndexHints(spell);

  if (hintStr) {
    chunks.push(hintStr);
  }
  chunks.push(escapeId(Model.table));
  if (indexHintStr) {
    chunks.push(indexHintStr);
  }

  chunks.push(`SET ${assigns.join(', ')}`);
  chunks.push(`WHERE ${formatConditions(spell, whereConditions)}`);
  return {
    sql: chunks.join(' '),
    values,
  };
}

/**
 * @param {Spell} spell
 * @param {Array} columns columns for value set
 */
function formatUpdateOnDuplicate(spell, columns) {
  const { updateOnDuplicate, uniqueKeys, Model } = spell;
  if (!updateOnDuplicate) return '';
  const { attributes, primaryColumn } = Model;
  const { escapeId } = Model.driver;
  const actualUniqueKeys = [];

  if (uniqueKeys) {
    for (const field of [].concat(uniqueKeys)) {
      actualUniqueKeys.push(escapeId(field));
    }
  } else {
    // conflict_target must be unique
    // get all unique keys
    if (attributes) {
      for (const key in attributes) {
        const att = attributes[key];
        // use the first unique key
        if (att.unique) {
          actualUniqueKeys.push(escapeId(att.columnName));
          break;
        }
      }
    }
    if (!actualUniqueKeys.length) actualUniqueKeys.push(escapeId(primaryColumn));
    // default use id as primary key
    if (!actualUniqueKeys.length) actualUniqueKeys.push(escapeId('id'));
  }

  if (Array.isArray(updateOnDuplicate) && updateOnDuplicate.length) {
    columns = updateOnDuplicate.map(column => (attributes[column] && attributes[column].columnName )|| column);
  } else if (!columns.length) {
    columns = Object.values(attributes).map(({ columnName }) => columnName);
  }
  const updateKeys = columns.map((column) => `${escapeId(column)}=EXCLUDED.${escapeId(column)}`);

  return `ON CONFLICT (${actualUniqueKeys.join(', ')}) DO UPDATE SET ${updateKeys.join(', ')}`;
}

/**
 * @param {Spell} spell
 * @returns returning sql string
 */
function formatReturning(spell) {
  const { Model, returning } = spell;
  const { primaryColumn } = Model;
  const { escapeId } = Model.driver;

  let returnings;
  if (returning === true) returnings = [ escapeId(primaryColumn) ];
  if (Array.isArray(returning)) {
    returnings = returning.map(escapeId);
  }
  return returnings && returnings.length? `RETURNING ${returnings.join(', ')}` : '';
}

/**
 * INSERT ... ON CONFLICT ... UPDATE SET
 * - https://www.postgresql.org/docs/9.5/static/sql-insert.html
 * - https://www.sqlite.org/lang_UPSERT.html
 * @param {Spell} spell
 */
function formatUpsert(spell) {
  if (!spell.updateOnDuplicate) {
    spell.updateOnDuplicate = true;
  }

  let { sql, values } = this.formatInsert(spell);
  return {
    sql,
    values,
  };
}

module.exports = {
  format(spell) {
    for (const scope of spell.scopes) scope(spell);

    switch (spell.command) {
      case 'insert':
      case 'bulkInsert':
        return this.formatInsert(spell);
      case 'select':
        return this.formatSelect(spell);
      case 'update':
        return this.formatUpdate(spell);
      case 'delete':
        return this.formatDelete(spell);
      case 'upsert':
        return this.formatUpsert(spell);
      default:
        throw new Error(`Unsupported SQL command ${spell.command}`);
    }
  },

  /**
   * @abstract
   * @returns {string} optimizer hints
   */
  formatOptimizerHints() {
    return '';
  },

  /**
   * @abstract
   * @returns {string} index hints
   */
  formatIndexHints() {
    return '';
  },

  formatInsert,
  formatSelect,
  formatUpdate,
  formatDelete,
  formatUpsert,
  formatSelectWithJoin,
  formatSelectWithoutJoin,
  formatUpdateOnDuplicate,
  formatReturning,
};
