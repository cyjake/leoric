'use strict';

const SqlString = require('sqlstring');

const { findExpr, walkExpr, parseFunCall } = require('../../expr');
const { formatExpr, formatConditions, collectLiteral, isAggregatorExpr } = require('../../expr_formatter');
const Raw = require('../../raw').default;

/**
 * Make sure columns are qualified
 */
function qualify(spell) {
  const { Model, columns, groups, whereConditions, havingConditions, orders } = spell;
  const baseName = Model.tableAlias;
  const clarify = node => {
    if (node.type === 'id' && !node.qualifiers) {
      if (Model.columnAttributes[node.value]) node.qualifiers = [baseName];
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
  let isAggregate = false;

  for (const token of columns) {
    collectLiteral(spell, token, values);
    const selectExpr = formatExpr(spell, token);
    isAggregate = isAggregate || isAggregatorExpr(spell, token);
    const qualifier = token.qualifiers ? token.qualifiers[0] : '';
    const list = map[qualifier] || (map[qualifier] = []);
    list.push(selectExpr);
  }

  for (const qualifier of [baseName].concat(Object.keys(joins))) {
    const list = map[qualifier];
    if (list) {
      for (const selectExpr of list) selects.add(selectExpr);
    } else if (groups.length === 0 && !['sqlite', 'sqljs'].includes(Model.driver.type) && !isAggregate) {
      selects.add(`${escapeId(qualifier)}.*`);
    }
  }

  if (map['']) {
    for (const selectExpr of map['']) selects.add(selectExpr);
  }

  return Array.from(selects);
}

class SpellBook {
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
  }

  /**
   * @abstract
   * @returns {string} optimizer hints
   */
  formatOptimizerHints() {
    return '';
  }

  /**
   * @abstract
   * @returns {string} index hints
   */
  formatIndexHints() {
    return '';
  }

  /**
  * Format a spell into INSERT query.
  * @param {Spell} spell
  */
  formatInsert(spell) {
    const { Model, sets, columnAttributes: optAttrs, updateOnDuplicate } = spell;
    const { shardingKey } = Model;
    const { createdAt } = Model.timestamps;
    const { escapeId } = Model.driver;
    const columns = [];
    const updateOnDuplicateColumns = [];

    const values = [];
    const placeholders = [];
    if (Array.isArray(sets)) {
      // merge records to get the big picture of involved columnAttributes
      const involved = sets.reduce((result, entry) => {
        return Object.assign(result, entry);
      }, {});
      const columnAttributes = [];
      if (optAttrs) {
        for (const name in optAttrs) {
          if (involved.hasOwnProperty(name)) columnAttributes.push(columnAttributes[name]);
        }
      } else {
        for (const name in involved) {
          columnAttributes.push(Model.columnAttributes[name]);
        }
      }

      for (const entry of columnAttributes) {
        columns.push(entry.columnName);
        if (updateOnDuplicate && createdAt && entry.name === createdAt
          && !(Array.isArray(updateOnDuplicate) && updateOnDuplicate.includes(createdAt))) continue;
        updateOnDuplicateColumns.push(entry.columnName);
      }

      for (const entry of sets) {
        if (shardingKey && entry[shardingKey] == null) {
          throw new Error(`Sharding key ${Model.table}.${shardingKey} cannot be NULL.`);
        }
        for (const attribute of columnAttributes) {
          const { name } = attribute;
          values.push(entry[name]);
        }
        placeholders.push(`(${new Array(columnAttributes.length).fill('?').join(',')})`);
      }

    } else {
      if (shardingKey && sets[shardingKey] == null) {
        throw new Error(`Sharding key ${Model.table}.${shardingKey} cannot be NULL.`);
      }
      for (const name in sets) {
        const value = sets[name];
        columns.push(Model.unalias(name));
        if (value instanceof Raw) {
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
   * Format a spell without joins into a full SELECT query. This function is also used to format the subquery which is then used as a drived table in a SELECT with joins.
   * @param {Spell} spell
   */
  formatSelectWithoutJoin(spell) {
    const { columns, whereConditions, groups, havingConditions, orders, rowCount, skip, Model } = spell;
    const { escapeId } = Model.driver;
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
      const subTableAlias = spell.table.value.Model && spell.table.value.Model.tableAlias;
      chunks.push(`AS ${subTableAlias? escapeId(subTableAlias) : `t${spell.subqueryIndex++}`}`);
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
      chunks.push(`ORDER BY ${this.formatOrders(spell, orders).join(', ')}`);
    }
    if (rowCount > 0) chunks.push(`LIMIT ${rowCount}`);
    if (skip > 0) chunks.push(`OFFSET ${skip}`);

    return { sql: chunks.join(' '), values };
  }

  /**
   * INSERT ... ON CONFLICT ... UPDATE SET
   * - https://www.postgresql.org/docs/9.5/sql-insert.html
   * - https://www.sqlite.org/lang_UPSERT.html
   * @param {Spell} spell
   */
  formatUpsert(spell) {
    if (!spell.updateOnDuplicate) {
      spell.updateOnDuplicate = true;
    }

    const { sql, values } = this.formatInsert(spell);
    return {
      sql,
      values,
    };
  }

  /**
   * @param {Spell} spell
   * @returns returning sql string
   */
  formatReturning(spell) {
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
   * @param {Spell} spell
   * @param {Array} columns columns for value set
   */
  formatUpdateOnDuplicate(spell, columns) {
    const { updateOnDuplicate, uniqueKeys, Model, sets } = spell;
    if (!updateOnDuplicate) return '';
    const { columnAttributes, primaryColumn } = Model;
    const { escapeId } = Model.driver;
    const actualUniqueKeys = [];

    if (uniqueKeys) {
      for (const field of [].concat(uniqueKeys)) {
        actualUniqueKeys.push(escapeId(field));
      }
    } else {
      const setFields = Object.keys(sets);
      // conflict_target must be unique
      // get all unique keys
      if (columnAttributes) {
        for (const key in columnAttributes) {
          const att = columnAttributes[key];
          // use the first unique key
          if (att.unique || (att.primaryKey && setFields.includes(att.name))) {
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
      columns = updateOnDuplicate.map(column => (columnAttributes[column] && columnAttributes[column].columnName)|| column);
    } else if (!columns.length) {
      columns = Object.values(columnAttributes).map(({ columnName }) => columnName);
    }
    const updateKeys = columns.map((column) => `${escapeId(column)}=EXCLUDED.${escapeId(column)}`);

    return `ON CONFLICT (${actualUniqueKeys.join(', ')}) DO UPDATE SET ${updateKeys.join(', ')}`;
  }

  /**
   * Format a spell into UPDATE query
   * @param {Spell} spell
   */
  formatUpdate(spell) {
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
      const columnName = escapeId(Model.unalias(name));
      if (value && value.__expr) {
        assigns.push(`${columnName} = ${formatExpr(spell, value)}`);
        collectLiteral(spell, value, values);
      } else if (value instanceof Raw) {
        let expr = `${columnName} = ${value.value}`;
        const {values: val, expression} = parseFunCall(`UPDATE ${Model.table} SET ${expr}`);
        if (val.length) {
          expr = `${columnName} = ${expression}`;;
          values.push(...val);
        }
        assigns.push(expr);
      } else {
        assigns.push(`${columnName} = ?`);
        values.push(sets[name]);
      }
    }

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
    if (whereConditions.length > 0) {
      for (const condition of whereConditions) collectLiteral(spell, condition, values);
      chunks.push(`WHERE ${formatConditions(spell, whereConditions)}`);
    }
    return {
      sql: chunks.join(' '),
      values,
    };
  }

  /**
   * Format the spell into a DELETE query.
   * @param {Spell} spell
   */
  formatDelete(spell) {
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
   * To help choosing the right function when formatting a spell into SELECT query.
   * @param {Spell} spell
   */
  formatSelect(spell) {
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
   * Format a spell with joins into a full SELECT query.
   * @param {Spell} spell
   */
  formatSelectWithJoin(spell) {
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

    const table = formatExpr(spell, spell.table);
    chunks.push(`FROM ${table}`);
    if (spell.table.value instanceof spell.constructor) {
      const subTableAlias = spell.table.value.Model && spell.table.value.Model.tableAlias;
      chunks.push(`AS ${subTableAlias? escapeId(subTableAlias) : `t${spell.subqueryIndex++}`}`);
    } else {
      chunks.push(`AS ${escapeId(baseName)}`);
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

    if (orders.length > 0) chunks.push(`ORDER BY ${this.formatOrders(spell, orders).join(', ')}`);
    if (rowCount > 0) chunks.push(`LIMIT ${rowCount}`);
    if (skip > 0) chunks.push(`OFFSET ${skip}`);
    return { sql: chunks.join(' '), values };
  }

  /**
   * Format orders into ORDER BY clause in SQL
   * @param {Spell}    spell
   * @param {Object[]} orders
   */
  formatOrders(spell, orders) {
    return orders.map(([token, order]) => {
      const column = formatExpr(spell, token);
      return order == 'desc' ? `${column} DESC` : column;
    });
  }

};

module.exports = SpellBook;
